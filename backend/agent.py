"""AI layer: setup agent (scheduled scans -> alerts) and news sentiment, via Claude."""
import asyncio
import hashlib
import json
import logging
import os
import re
import uuid
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage

import market
from db import Alert, db
import push
from db import BaseDocument
from strategies import DEFAULT_PARAMS, STRATEGIES, evaluate

log = logging.getLogger("agent")
LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = ("anthropic", "claude-sonnet-4-6")
SCAN_TIMES_UTC = [(3, 0), (7, 30), (14, 0)]  # ≈ 08:30 · 13:00 · 19:30 IST
SCAN_TFS = ["daily", "weekly"]
NEWS_TTL = 3 * 3600
_news_lock = asyncio.Lock()


async def llm_json(system: str, prompt: str):
    chat = LlmChat(api_key=LLM_KEY, session_id=str(uuid.uuid4()), system_message=system).with_model(*MODEL)
    text = await chat.send_message(UserMessage(text=prompt))
    m = re.search(r"[\[{].*[\]}]", text, re.S)
    return json.loads(m.group(0)) if m else None


def _fmt(x):
    return None if x is None else round(x, 4 if abs(x) < 10 else 2)


async def user_params(user_id: str) -> dict:
    doc = await db.user_settings.find_one({"_id": user_id}) or {}
    return {**DEFAULT_PARAMS, **(doc.get("params") or {})}


class PriceAlert(BaseDocument):
    user_id: str
    item_id: str
    symbol: str
    market: str
    currency: str
    condition: str  # above | below
    target: float
    price_at_create: float | None = None
    active: bool = True
    triggered_at: str | None = None
    triggered_price: float | None = None
    created_at: str


def _money(v: float, cur: str) -> str:
    return ("₹" if cur == "INR" else "$") + (f"{v:,.4f}" if v < 1 else f"{v:,.2f}")


async def check_price_alerts():
    """Crypto prices are live (60s cache); stocks use the latest cached daily close."""
    active = await db.price_alerts.find({"active": True}).to_list(2000)
    if not active:
        return
    items = {}
    for a in active:
        if a["item_id"] not in items and ObjectId.is_valid(a["item_id"]):
            items[a["item_id"]] = await db.watchlist.find_one({"_id": ObjectId(a["item_id"])})
    quotes = {}
    for iid, it in items.items():
        if it:
            quotes[iid] = (await market.quote(it))["price"]
    for a in active:
        it = items.get(a["item_id"])
        if not it:  # symbol removed from watchlist
            await db.price_alerts.update_one({"_id": a["_id"]}, {"$set": {"active": False}})
            continue
        price = quotes.get(a["item_id"])
        if price is None:
            continue
        hit = price >= a["target"] if a["condition"] == "above" else price <= a["target"]
        if not hit:
            continue
        res = await db.price_alerts.update_one({"_id": a["_id"], "active": True},
                                               {"$set": {"active": False, "triggered_at": market.now_iso(),
                                                         "triggered_price": price}})
        if not res.modified_count:
            continue
        word = "rose above" if a["condition"] == "above" else "fell below"
        title = f"{a['symbol']} · Price {word} {_money(a['target'], a['currency'])}"
        body = f"Now {_money(price, a['currency'])}. Your price alert has fired. Check the setup before acting."
        await db.alerts.insert_one(Alert(user_id=a["user_id"], symbol=a["symbol"], market=a["market"],
                                         strategy="price", timeframe="daily", kind="price", title=title,
                                         body=body, created_at=market.now_iso()).to_mongo())
        await push.notify(a["user_id"], title, body, f"/setup/{a['item_id']}", key=f"pa-{a['_id']}")


async def price_alert_loop():
    while True:
        try:
            await check_price_alerts()
        except Exception:
            log.exception("price alert check failed")
        await asyncio.sleep(60)


# ---------------------------------------------------------------- setup agent
async def collect_setups(user_id: str) -> list:
    items = await db.watchlist.find({"user_id": user_id}).to_list(200)
    p = await user_params(user_id)
    found = []
    for it in items:
        for tf in SCAN_TFS:
            d = await market.get_candles(it, tf)
            if d["status"] != "ok":
                continue
            for sk in STRATEGIES:
                ev = evaluate(d["candles"], sk, tf, p)
                if ev["status"] != "ok" or not (ev["ready"] or ev["upcoming"]):
                    continue
                found.append({"symbol": it["symbol"], "market": it["market"], "currency": it["currency"],
                              "strategy": sk, "timeframe": tf, "direction": ev["direction"], "ready": ev["ready"],
                              "note": ev["upcoming_note"],
                              "checklist": [f"{'✓' if c['ok'] else '✗'} {c['label']}" for c in ev["checklist"]],
                              "levels": {k: _fmt(v) if isinstance(v, float) else v for k, v in ev["levels"].items()}})
    return found


def _state_key(s: dict) -> str:
    return f"{s['symbol']}|{s['strategy']}|{s['timeframe']}"


def _fallback_alert(s: dict) -> dict:
    name = STRATEGIES[s["strategy"]]
    lv = s["levels"]
    if s["ready"]:
        inv = lv.get("supertrend")
        act = "long entry" if s["direction"] == "bullish" else "short / exit longs"
        if s["strategy"] == "options":
            act = f"{lv.get('option_side')} outside the range"
        return {"kind": "ready", "title": f"{s['symbol']} · Setup ready ({name}, {s['timeframe'].title()})",
                "body": f"What to do: consider a {act}. Invalidates beyond {inv}."}
    return {"kind": "upcoming", "title": f"{s['symbol']} · Upcoming {name} setup ({s['timeframe'].title()})",
            "body": f"What to do: watch closely. {s['note'] or ''}"}


async def scan_user(user_id: str) -> int:
    setups = await collect_setups(user_id)
    prev = await db.agent_state.find_one({"_id": user_id}) or {}
    prev_states = prev.get("states", {})
    states = {_state_key(s): ("ready" if s["ready"] else "upcoming") for s in setups}
    changed = [s for s in setups if prev_states.get(_state_key(s)) != states[_state_key(s)]]
    changed.sort(key=lambda s: (not s["ready"], s["timeframe"] != "daily"))
    changed = changed[:8]
    alerts = []
    if changed:
        try:
            out = await llm_json(
                "You are a disciplined trading-setup analyst inside the SmartTradeLens app. For each setup, write a "
                "short alert. title: '<SYMBOL> · <what happened>' (max 60 chars). body: start with 'What to do:' and "
                "give one concrete, plain-language action with the invalidation/stop level from the data and the "
                "currency (max 160 chars). kind: 'ready' if ready is true, 'bearish' if ready and direction bearish "
                "and strategy is not options, else 'upcoming'. Never promise profits. Reply ONLY a JSON array of "
                "objects {i, kind, title, body} in the same order.",
                json.dumps([{**s, "i": i} for i, s in enumerate(changed)]))
            by_i = {o.get("i"): o for o in (out or []) if isinstance(o, dict)}
        except Exception as e:
            log.warning("agent LLM failed: %s", e)
            by_i = {}
        for i, s in enumerate(changed):
            a = by_i.get(i) or _fallback_alert(s)
            alerts.append(Alert(user_id=user_id, symbol=s["symbol"], market=s["market"], strategy=s["strategy"],
                                timeframe=s["timeframe"], kind=a.get("kind", "upcoming"), title=a["title"][:90],
                                body=a["body"][:240], created_at=market.now_iso()).to_mongo())
        await db.alerts.insert_many(alerts)
        top = alerts[0]
        more = f" (+{len(alerts) - 1} more)" if len(alerts) > 1 else ""
        await push.notify(user_id, top["title"] + more, top["body"], "/alerts")
    await db.agent_state.update_one({"_id": user_id}, {"$set": {"states": states, "last_scan": market.now_iso()}},
                                    upsert=True)
    return len(alerts)


async def scan_all():
    async for u in db.users.find({}, {"_id": 1}):
        try:
            await scan_user(str(u["_id"]))
        except Exception:
            log.exception("scan failed for %s", u["_id"])


async def agent_loop():
    last_slot = None
    while True:
        now = datetime.now(timezone.utc)
        for hh, mm in SCAN_TIMES_UTC:
            slot = now.strftime("%Y-%m-%d") + f"-{hh}:{mm}"
            if (now.hour, now.minute) >= (hh, mm) and (now.hour * 60 + now.minute) - (hh * 60 + mm) < 15 \
                    and slot != last_slot:
                done = await db.agent_runs.find_one({"_id": slot})
                if not done:
                    await db.agent_runs.insert_one({"_id": slot, "at": market.now_iso()})
                    log.info("agent scan slot %s", slot)
                    await scan_all()
                last_slot = slot
        await asyncio.sleep(120)


# ---------------------------------------------------------------- news & sentiment
# Alpha Vantage NEWS_SENTIMENT is premium-only, so headlines come from Yahoo Finance's free per-symbol RSS.
def _yahoo_symbol(it: dict) -> str:
    if it["market"] == "CRYPTO":
        return f"{it['symbol']}-USD"
    if it["market"] == "IN":
        return f"{it['symbol']}.BO"
    return it["symbol"]


async def _yahoo_feed(client: httpx.AsyncClient, ysym: str) -> list:
    try:
        r = await client.get("https://feeds.finance.yahoo.com/rss/2.0/headline",
                             params={"s": ysym, "region": "US", "lang": "en-US"})
        root = ET.fromstring(r.text)
    except Exception as e:
        log.warning("news feed %s failed: %s", ysym, e)
        return []
    out = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue
        try:
            pub = parsedate_to_datetime(item.findtext("pubDate") or "").astimezone(timezone.utc).isoformat()
        except Exception:
            pub = None
        out.append({"title": title, "summary": (item.findtext("description") or "")[:300],
                    "url": item.findtext("link"), "published": pub, "source": "Yahoo Finance"})
    return out


async def refresh_news(force: bool = False) -> dict | None:
    doc = await db.news_cache.find_one({"_id": "feed"})
    if doc and not force and market._age(doc) < NEWS_TTL:
        return doc
    async with _news_lock:
        doc = await db.news_cache.find_one({"_id": "feed"})
        if doc and not force and market._age(doc) < NEWS_TTL:
            return doc
        items = {}
        async for it in db.watchlist.find({}, {"symbol": 1, "market": 1}):
            items[(it["symbol"], it["market"])] = it
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "Mozilla/5.0"}) as c:
            feeds = await asyncio.gather(*(_yahoo_feed(c, _yahoo_symbol(it)) for it in items.values()))
        picked, seen = [], set()
        for it, feed in zip(items.values(), feeds):
            for a in sorted(feed, key=lambda a: a["published"] or "", reverse=True)[:3]:
                if a["title"] not in seen:
                    seen.add(a["title"])
                    picked.append({**a, "symbol": it["symbol"]})
        if not picked:
            return doc
        picked.sort(key=lambda a: a["published"] or "", reverse=True)
        articles = [{"i": i, **a} for i, a in enumerate(picked[:40])]
        try:
            out = await llm_json(
                "You classify financial news sentiment for traders. For each article decide the likely price impact "
                "on its symbol. Reply ONLY a JSON array of {i, sentiment, reason} where sentiment is Bullish, "
                "Bearish or Neutral and reason is one plain sentence under 90 chars.",
                json.dumps([{k: a[k] for k in ("i", "symbol", "title", "summary")} for a in articles]))
            by_i = {o.get("i"): o for o in (out or []) if isinstance(o, dict)}
        except Exception as e:
            log.warning("news LLM failed: %s", e)
            by_i = {}
        for a in articles:
            o = by_i.get(a["i"]) or {}
            a["sentiment"] = o.get("sentiment") if o.get("sentiment") in ("Bullish", "Bearish", "Neutral") else "Neutral"
            a["reason"] = o.get("reason") or "No clear directional signal"
        doc = {"_id": "feed", "articles": articles, "fetched_at": market.now_iso()}
        await db.news_cache.replace_one({"_id": "feed"}, doc, upsert=True)
        return doc


async def news_for_user(user_id: str) -> dict:
    doc = await refresh_news()
    if not doc:
        return {"articles": [], "mood": None, "fetched_at": None}
    syms = {it["symbol"] async for it in db.watchlist.find({"user_id": user_id}, {"symbol": 1})}
    arts = [a for a in doc["articles"] if a["symbol"] in syms]
    counts = {k: sum(1 for a in arts if a["sentiment"] == k) for k in ("Bullish", "Neutral", "Bearish")}
    total = max(1, len(arts))
    key = hashlib.md5((doc["fetched_at"] + ",".join(sorted(syms))).encode()).hexdigest()
    mood = await db.mood_cache.find_one({"_id": key})
    if not mood and arts:
        try:
            out = await llm_json(
                "Summarize the overall market mood for this trader's watchlist from these classified headlines. "
                "Reply ONLY JSON {label, summary} where label is one of Bullish, Mildly Bullish, Neutral, "
                "Mildly Bearish, Bearish and summary is one sentence under 110 chars.",
                json.dumps([{k: a[k] for k in ("symbol", "title", "sentiment")} for a in arts[:20]]))
        except Exception as e:
            log.warning("mood LLM failed: %s", e)
            out = None
        if not isinstance(out, dict):
            b, r = counts["Bullish"], counts["Bearish"]
            out = {"label": "Bullish" if b > r * 1.5 else "Bearish" if r > b * 1.5 else "Neutral",
                   "summary": f"{b} bullish, {counts['Neutral']} neutral and {r} bearish headlines."}
        mood = {"_id": key, **out}
        await db.mood_cache.insert_one(mood)
    return {"articles": arts, "fetched_at": doc["fetched_at"],
            "mood": mood and {"label": mood.get("label"), "summary": mood.get("summary"),
                              "bullish": counts["Bullish"] / total, "neutral": counts["Neutral"] / total,
                              "bearish": counts["Bearish"] / total}}
