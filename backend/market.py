"""Market data layer: Alpha Vantage (stocks) + CoinGecko (crypto), cache-first in MongoDB.

Alpha Vantage free tier = 25 calls/day, so stock data is only fetched by the background
refresher (shared across users) under a daily budget. Requests read from cache.
"""
import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import httpx

from db import db

log = logging.getLogger("market")
AV_KEY = os.environ["ALPHA_VANTAGE_KEY"]
AV_URL = "https://www.alphavantage.co/query"
CG_URL = "https://api.coingecko.com/api/v3"
AV_DAILY_LIMIT = 24

TTL = {  # seconds
    ("stock", "hourly"): 20 * 3600,
    ("stock", "daily"): 20 * 3600,
    ("stock", "weekly"): 20 * 3600,
    ("crypto", "hourly"): 30 * 60,
    ("crypto", "daily"): 3 * 3600,
}

_cg_lock = asyncio.Lock()
_av_lock = asyncio.Lock()
_key_locks: dict[str, asyncio.Lock] = {}
refresh_event = asyncio.Event()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _age(doc: dict | None) -> float:
    if not doc or not doc.get("fetched_at"):
        return 1e12
    return time.time() - datetime.fromisoformat(doc["fetched_at"]).timestamp()


# ---------------------------------------------------------------- Alpha Vantage budget
def _budget_id() -> str:
    return "av:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def av_budget_left() -> int:
    doc = await db.api_budget.find_one({"_id": _budget_id()})
    return AV_DAILY_LIMIT - (doc or {}).get("count", 0)


async def av_call(params: dict) -> dict | None:
    """One budgeted Alpha Vantage call. Returns None when out of budget or rate limited."""
    async with _av_lock:
        if await av_budget_left() <= 0:
            return None
        await db.api_budget.update_one({"_id": _budget_id()}, {"$inc": {"count": 1}}, upsert=True)
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.get(AV_URL, params={**params, "apikey": AV_KEY})
                data = r.json()
        except Exception as e:  # network error
            log.warning("AV error %s %s", params.get("function"), e)
            return None
        finally:
            await asyncio.sleep(2.0)
        info = data.get("Information") or data.get("Note")
        if info:
            log.warning("AV limited: %s", info)
            if "premium" in info.lower():
                return {"_error": "premium"}
            await db.api_budget.update_one({"_id": _budget_id()}, {"$set": {"count": 999}})
            return None
        if "Error Message" in data:
            log.warning("AV error message for %s: %s", params, data["Error Message"])
            return {"_error": data["Error Message"]}
        return data


def _parse_av_series(data: dict) -> list:
    key = next((k for k in data if k.startswith("Time Series") or k.endswith("Time Series")), None)
    if not key:
        return []
    rows = []
    for t, v in data[key].items():
        rows.append({
            "t": t, "o": float(v["1. open"]), "h": float(v["2. high"]),
            "l": float(v["3. low"]), "c": float(v["4. close"]), "v": float(v.get("5. volume", 0) or 0),
        })
    rows.sort(key=lambda r: r["t"])
    return rows


async def fetch_stock(av_symbol: str, tf: str) -> bool:
    fn = {"daily": ("TIME_SERIES_DAILY", {}), "weekly": ("TIME_SERIES_WEEKLY", {}),
          "hourly": ("TIME_SERIES_INTRADAY", {"interval": "60min"})}[tf]
    data = await av_call({"function": fn[0], "symbol": av_symbol, **fn[1]})
    if data is None:
        return False
    key = f"stock:{av_symbol}:{tf}"
    if "_error" in data:
        await db.candles.update_one({"_id": key}, {"$set": {"status": "unavailable", "fetched_at": now_iso(),
                                                              "candles": []}}, upsert=True)
        return True
    rows = _parse_av_series(data)
    if tf == "weekly":
        rows = rows[-520:]
    await db.candles.update_one({"_id": key}, {"$set": {"status": "ok", "fetched_at": now_iso(),
                                                          "candles": rows}}, upsert=True)
    log.info("AV fetched %s (%d bars)", key, len(rows))
    return True


# ---------------------------------------------------------------- CoinGecko
async def cg_get(path: str, params: dict) -> dict | list | None:
    async with _cg_lock:
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=20) as c:
                    r = await c.get(CG_URL + path, params=params)
                if r.status_code == 200:
                    await asyncio.sleep(2.5)
                    return r.json()
                log.warning("CG %s -> %s", path, r.status_code)
                if r.status_code != 429:
                    return None
            except Exception as e:
                log.warning("CG error %s %s", path, e)
            await asyncio.sleep(15)
        return None


def _points_to_candles(prices: list, volumes: list, fmt: str) -> list:
    vol = {int(p[0]): p[1] for p in volumes}
    rows, prev = [], None
    for ts, price in prices:
        c = float(price)
        o = prev if prev is not None else c
        t = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime(fmt)
        if rows and rows[-1]["t"] == t:  # de-dup same bucket (last point)
            rows[-1].update({"c": c, "h": max(rows[-1]["h"], c), "l": min(rows[-1]["l"], c)})
            continue
        rows.append({"t": t, "o": o, "h": max(o, c), "l": min(o, c), "c": c, "v": float(vol.get(int(ts), 0) or 0)})
        prev = c
    return rows


async def fetch_crypto(cg_id: str, tf: str) -> bool:
    days = 10 if tf == "hourly" else 365
    data = await cg_get(f"/coins/{cg_id}/market_chart", {"vs_currency": "usd", "days": days})
    if not data or "prices" not in data:
        return False
    fmt = "%Y-%m-%d %H:00" if tf == "hourly" else "%Y-%m-%d"
    rows = _points_to_candles(data["prices"], data.get("total_volumes", []), fmt)
    if tf == "hourly":  # 24h rolling volume -> not a per-bar volume
        for r in rows:
            r["v"] = 0.0
    await db.candles.update_one({"_id": f"crypto:{cg_id}:{tf}"},
                                {"$set": {"status": "ok", "fetched_at": now_iso(), "candles": rows}}, upsert=True)
    return True


# ---------------------------------------------------------------- resampling
def resample(rows: list, period: str) -> list:
    out: list = []
    for r in rows:
        d = datetime.fromisoformat(r["t"][:10])
        if period == "weekly":
            key = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
        else:
            key = d.strftime("%Y-%m")
        if out and out[-1]["t"] == key:
            b = out[-1]
            b["h"], b["l"], b["c"] = max(b["h"], r["h"]), min(b["l"], r["l"]), r["c"]
            b["v"] += r["v"]
        else:
            out.append({"t": key, "o": r["o"], "h": r["h"], "l": r["l"], "c": r["c"], "v": r["v"]})
    return out


# ---------------------------------------------------------------- public API
def supports(item: dict, tf: str) -> bool:
    # Alpha Vantage intraday is a premium endpoint, so hourly is crypto-only on the free plan.
    return not (item["market"] != "CRYPTO" and tf == "hourly")


async def get_candles(item: dict, tf: str) -> dict:
    """Cache-first candles. Returns {status: ok|pending|unavailable, candles, fetched_at}."""
    if not supports(item, tf):
        reason = ("Hourly data isn't available for Indian stocks" if item["market"] == "IN"
                  else "Hourly stock data needs a premium Alpha Vantage plan. Try Daily")
        return {"status": "unavailable", "reason": reason,
                "candles": [], "fetched_at": None}
    if item["market"] == "CRYPTO":
        base_tf = "hourly" if tf == "hourly" else "daily"
        key = f"crypto:{item['cg_id']}:{base_tf}"
        lock = _key_locks.setdefault(key, asyncio.Lock())
        async with lock:
            doc = await db.candles.find_one({"_id": key})
            if _age(doc) > TTL[("crypto", base_tf)]:
                if await fetch_crypto(item["cg_id"], base_tf):
                    doc = await db.candles.find_one({"_id": key})
    else:
        base_tf = "weekly" if tf in ("weekly", "monthly") else tf
        doc = await db.candles.find_one({"_id": f"stock:{item['av_symbol']}:{base_tf}"})
        if not doc:
            refresh_event.set()
            return {"status": "pending", "reason": "New symbol: data arrives with the next refresh (free data plan)", "candles": [], "fetched_at": None}
    if not doc:
        return {"status": "pending", "reason": "Data source busy, retrying shortly", "candles": [], "fetched_at": None}
    if doc.get("status") == "unavailable":
        return {"status": "unavailable", "reason": "Symbol not found at data provider", "candles": [],
                "fetched_at": doc.get("fetched_at")}
    rows = doc["candles"]
    if tf == "monthly":
        rows = resample(rows, "monthly")
    elif tf == "weekly" and item["market"] == "CRYPTO":
        rows = resample(rows, "weekly")
    return {"status": "ok", "candles": rows, "fetched_at": doc["fetched_at"]}


async def crypto_prices(cg_ids: list) -> dict:
    """Live crypto prices with 24h change, cached 60s."""
    ids = sorted(set(i for i in cg_ids if i))
    if not ids:
        return {}
    doc = await db.price_cache.find_one({"_id": "cg_simple"})
    cached = (doc or {}).get("data", {})
    if _age(doc) < 60 and all(i in cached for i in ids):
        return cached
    data = await cg_get("/simple/price", {"ids": ",".join(sorted(set(ids) | set(cached))),
                                          "vs_currencies": "usd", "include_24hr_change": "true"})
    if data:
        cached = {**cached, **data}
        await db.price_cache.update_one({"_id": "cg_simple"}, {"$set": {"data": cached, "fetched_at": now_iso()}},
                                        upsert=True)
    return cached


async def quote(item: dict) -> dict:
    """Last price + change. Crypto: live; stocks: last daily close vs previous."""
    if item["market"] == "CRYPTO":
        p = (await crypto_prices([item["cg_id"]])).get(item["cg_id"])
        if p:
            return {"price": p.get("usd"), "change_pct": p.get("usd_24h_change")}
        d = await get_candles(item, "daily")
    else:
        d = await get_candles(item, "daily")
        if d["status"] != "ok":
            d = await get_candles(item, "weekly")
    rows = d.get("candles") or []
    if len(rows) >= 2:
        return {"price": rows[-1]["c"], "change_pct": (rows[-1]["c"] / rows[-2]["c"] - 1) * 100}
    return {"price": None, "change_pct": None}


# ---------------------------------------------------------------- background refresher
async def needed_stock_jobs() -> list:
    """(av_symbol, tf) jobs that are stale, in priority order."""
    pipeline = [{"$match": {"market": {"$in": ["US", "IN"]}}},
                {"$group": {"_id": {"av": "$av_symbol", "m": "$market"}, "n": {"$sum": 1}}},
                {"$sort": {"n": -1}}]
    syms = [(g["_id"]["av"], g["_id"]["m"]) async for g in db.watchlist.aggregate(pipeline)]
    for extra in (("SPY", "US"), ("NIFTYBEES.BSE", "IN")):
        if extra not in syms:
            syms.append(extra)
    jobs = []
    for tf, group in (("daily", [s for s, _ in syms]), ("weekly", [s for s, m in syms if s not in ("SPY", "NIFTYBEES.BSE")])):
        for s in group:
            doc = await db.candles.find_one({"_id": f"stock:{s}:{tf}"}, {"fetched_at": 1})
            if _age(doc) > TTL[("stock", tf)]:
                jobs.append((s, tf))
    return jobs


async def refresh_once():
    for s, tf in await needed_stock_jobs():
        if await av_budget_left() <= 1:  # keep 1 for news
            break
        await fetch_stock(s, tf)
    # warm crypto caches
    async for g in db.watchlist.aggregate([{"$match": {"market": "CRYPTO"}}, {"$group": {"_id": "$cg_id"}}]):
        for tf in ("daily", "hourly"):
            doc = await db.candles.find_one({"_id": f"crypto:{g['_id']}:{tf}"}, {"fetched_at": 1})
            if _age(doc) > TTL[("crypto", tf)]:
                await fetch_crypto(g["_id"], tf)


async def refresher_loop():
    while True:
        try:
            await refresh_once()
        except Exception:
            log.exception("refresh failed")
        refresh_event.clear()
        try:
            await asyncio.wait_for(refresh_event.wait(), timeout=600)
        except asyncio.TimeoutError:
            pass
