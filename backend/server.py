import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from starlette.middleware.cors import CORSMiddleware

import agent
import catalog
import market
from db import Alert, User, WatchItem, client, db
from strategies import STRATEGIES, chart_payload, evaluate

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("server")

JWT_SECRET = os.environ["JWT_SECRET"]
TIMEFRAMES = ["hourly", "daily", "weekly", "monthly"]
app = FastAPI(title="SmartTradeLens API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- auth
class Credentials(BaseModel):
    email: EmailStr
    password: str


def issue_token(uid: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": uid, "iat": now, "exp": now + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")


async def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if not cred:
        raise HTTPException(401, "Not authenticated")
    try:
        uid = jwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"])["sub"]
        user = User.from_mongo(await db.users.find_one({"_id": ObjectId(uid)}))
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Session expired, please sign in again")
    return user


def public_user(u: User) -> dict:
    return {"id": u.id, "email": u.email, "created_at": u.created_at}


async def seed_watchlist(uid: str):
    docs = []
    for sym, mkt in catalog.STARTER:
        it = catalog.lookup(sym, mkt)
        docs.append(WatchItem(user_id=uid, added_at=market.now_iso(), **it).to_mongo())
    await db.watchlist.insert_many(docs)
    market.refresh_event.set()


async def _first_scan(uid: str):
    await asyncio.sleep(20)
    try:
        await agent.scan_user(uid)
    except Exception:
        log.exception("first scan failed")


@api.post("/auth/register")
async def register(body: Credentials):
    email = body.email.lower().strip()
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email is already registered")
    user = User(email=email, password_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
                created_at=market.now_iso())
    res = await db.users.insert_one(user.to_mongo())
    user.id = str(res.inserted_id)
    await seed_watchlist(user.id)
    asyncio.create_task(_first_scan(user.id))
    return {"token": issue_token(user.id), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: Credentials):
    user = User.from_mongo(await db.users.find_one({"email": body.email.lower().strip()}))
    if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": issue_token(user.id), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: User = Depends(current_user)):
    return public_user(user)


# ---------------------------------------------------------------- watchlist & symbols
class AddSymbol(BaseModel):
    symbol: str
    market: str  # US | IN | CRYPTO
    name: str | None = None
    cg_id: str | None = None


def wl_out(w: WatchItem) -> dict:
    return w.model_dump()


@api.get("/watchlist")
async def get_watchlist(user: User = Depends(current_user)):
    docs = await db.watchlist.find({"user_id": user.id}).sort("added_at", 1).to_list(200)
    return {"items": [wl_out(WatchItem.from_mongo(d)) for d in docs]}


@api.post("/watchlist")
async def add_watch(body: AddSymbol, user: User = Depends(current_user)):
    mkt = body.market.upper()
    if mkt not in ("US", "IN", "CRYPTO"):
        raise HTTPException(400, "Market must be US, IN or CRYPTO")
    sym = body.symbol.upper().strip()
    if not sym or len(sym) > 20:
        raise HTTPException(400, "Invalid symbol")
    if await db.watchlist.find_one({"user_id": user.id, "symbol": sym, "market": mkt}):
        raise HTTPException(409, f"{sym} is already in your watchlist")
    it = catalog.lookup(sym, mkt)
    if not it:
        if mkt == "CRYPTO" and not body.cg_id:
            raise HTTPException(400, "Unknown crypto. Pick it from search results")
        it = catalog.make_item(sym, mkt, body.name or sym, body.cg_id or "")
    w = WatchItem(user_id=user.id, added_at=market.now_iso(), **it)
    res = await db.watchlist.insert_one(w.to_mongo())
    w.id = str(res.inserted_id)
    market.refresh_event.set()
    return wl_out(w)


@api.delete("/watchlist/{item_id}")
async def remove_watch(item_id: str, user: User = Depends(current_user)):
    if not ObjectId.is_valid(item_id):
        raise HTTPException(404, "Not found")
    res = await db.watchlist.delete_one({"_id": ObjectId(item_id), "user_id": user.id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/symbols/search")
async def search_symbols(q: str, user: User = Depends(current_user)):
    q = q.strip()
    if not q:
        return []
    results = catalog.search_local(q)[:20]
    have = {(r["symbol"], r["market"]) for r in results}
    if len(results) < 3:
        try:  # quick, unqueued lookup so search stays snappy
            async with httpx.AsyncClient(timeout=6) as c:
                r = await c.get(market.CG_URL + "/search", params={"query": q})
            data = r.json() if r.status_code == 200 else None
        except Exception:
            data = None
        for c in (data or {}).get("coins", [])[:8]:
            sym = c["symbol"].upper()
            if (sym, "CRYPTO") not in have:
                results.append(catalog.make_item(sym, "CRYPTO", c["name"], c["id"]))
                have.add((sym, "CRYPTO"))
    if q.isalpha() and len(q) <= 12:  # allow any ticker, data provider validates later
        for mkt in ("US", "IN"):
            if (q.upper(), mkt) not in have:
                results.append({**catalog.make_item(q.upper(), mkt, q.upper()), "custom": True})
    return {"items": results}


# ---------------------------------------------------------------- setups
async def setup_for(it: dict, strategy: str, tf: str, q: dict | None = None) -> dict:
    d = await market.get_candles(it, tf)
    base = {"id": str(it["_id"]), "symbol": it["symbol"], "name": it["name"], "market": it["market"],
            "currency": it["currency"], "tv_symbol": it["tv_symbol"], "timeframe": tf, "strategy": strategy,
            "fetched_at": d.get("fetched_at"), "term": "short" if tf in ("hourly", "daily") else "long"}
    q = q or await market.quote(it)
    base.update(price=q["price"], change_pct=q["change_pct"])
    if d["status"] != "ok":
        return {**base, "status": d["status"], "reason": d.get("reason")}
    ev = evaluate(d["candles"], strategy, tf)
    if ev["status"] != "ok":
        return {**base, "status": ev["status"], "reason": ev["reason"]}
    if base["price"] is None:
        base["price"] = d["candles"][-1]["c"]
    return {**base, **ev}


def _check_params(strategy: str, timeframe: str):
    if strategy not in STRATEGIES or timeframe not in TIMEFRAMES:
        raise HTTPException(400, "Invalid strategy or timeframe")


@api.get("/setups")
async def setups(strategy: str = "supertrend", timeframe: str = "daily", user: User = Depends(current_user)):
    _check_params(strategy, timeframe)
    items = await db.watchlist.find({"user_id": user.id}).sort("added_at", 1).to_list(200)
    out = await asyncio.gather(*(setup_for(it, strategy, timeframe) for it in items))
    out = list(out)
    out.sort(key=lambda s: (s.get("status") != "ok", not s.get("ready"), not s.get("upcoming")))
    return {"items": out, "strategy": strategy, "timeframe": timeframe, "generated_at": market.now_iso()}


@api.get("/setups/{item_id}")
async def setup_detail(item_id: str, strategy: str = "supertrend", timeframe: str = "daily",
                       user: User = Depends(current_user)):
    _check_params(strategy, timeframe)
    it = await db.watchlist.find_one({"_id": ObjectId(item_id), "user_id": user.id}) if ObjectId.is_valid(item_id) else None
    if not it:
        raise HTTPException(404, "Symbol not in watchlist")
    s = await setup_for(it, strategy, timeframe)
    others = {}
    for sk in STRATEGIES:  # quick summary across strategies
        if sk != strategy:
            o = await setup_for(it, sk, timeframe, {"price": s["price"], "change_pct": s["change_pct"]})
            others[sk] = {k: o.get(k) for k in ("status", "direction", "ready", "upcoming", "met", "total")}
    return {**s, "others": others}


@api.get("/chart/{item_id}")
async def chart(item_id: str, timeframe: str = "daily", user: User = Depends(current_user)):
    if timeframe not in TIMEFRAMES:
        raise HTTPException(400, "Invalid timeframe")
    it = await db.watchlist.find_one({"_id": ObjectId(item_id), "user_id": user.id}) if ObjectId.is_valid(item_id) else None
    if not it:
        raise HTTPException(404, "Symbol not in watchlist")
    d = await market.get_candles(it, timeframe)
    q = await market.quote(it)
    base = {"id": item_id, "symbol": it["symbol"], "name": it["name"], "market": it["market"],
            "currency": it["currency"], "tv_symbol": it["tv_symbol"], "timeframe": timeframe,
            "price": q["price"], "change_pct": q["change_pct"], "fetched_at": d.get("fetched_at")}
    if d["status"] != "ok" or len(d["candles"]) < 2:
        return {**base, "status": d["status"] if d["status"] != "ok" else "insufficient",
                "reason": d.get("reason") or "Not enough history"}
    return {**base, "status": "ok", **chart_payload(d["candles"])}


# ---------------------------------------------------------------- dashboard
@api.get("/dashboard")
async def dashboard(user: User = Depends(current_user)):
    items = await db.watchlist.find({"user_id": user.id}).to_list(200)
    quotes = await asyncio.gather(*(market.quote(it) for it in items))
    qmap = {str(it["_id"]): q for it, q in zip(items, quotes)}
    ready = upcoming = 0
    ready_list = []
    for sk in STRATEGIES:
        res = await asyncio.gather(*(setup_for(it, sk, "daily", qmap[str(it["_id"])]) for it in items))
        for r in res:
            if r.get("ready"):
                ready += 1
                ready_list.append({"symbol": r["symbol"], "strategy": sk, "direction": r["direction"]})
            elif r.get("upcoming"):
                upcoming += 1
    overview = []
    for sym, mkt, label in (("SPY", "US", "S&P 500 · SPY"), ("NIFTYBEES", "IN", "NIFTY 50 · ETF")):
        q = await market.quote(catalog.lookup(sym, mkt))
        overview.append({"label": label, "symbol": sym, "currency": "USD" if mkt == "US" else "INR", **q})
    prices = await market.crypto_prices(["bitcoin", "ethereum"])
    for cid, label in (("bitcoin", "BTC"), ("ethereum", "ETH")):
        p = prices.get(cid) or {}
        overview.append({"label": label, "symbol": label, "currency": "USD", "price": p.get("usd"),
                         "change_pct": p.get("usd_24h_change")})
    alerts = await db.alerts.find({"user_id": user.id}).sort("created_at", -1).to_list(3)
    unread = await db.alerts.count_documents({"user_id": user.id, "read": False})
    movers = sorted(
        [{"id": str(it["_id"]), "symbol": it["symbol"], "market": it["market"], "currency": it["currency"],
          **qmap[str(it["_id"])]} for it in items if qmap[str(it["_id"])]["price"] is not None],
        key=lambda m: -abs(m["change_pct"] or 0))
    return {"ready_count": ready, "upcoming_count": upcoming, "watching": len(items), "ready": ready_list[:6],
            "overview": overview, "alerts": [Alert.from_mongo(a).model_dump() for a in alerts], "unread": unread,
            "movers": movers[:6], "generated_at": market.now_iso()}


# ---------------------------------------------------------------- alerts & agent
@api.get("/alerts")
async def list_alerts(user: User = Depends(current_user)):
    docs = await db.alerts.find({"user_id": user.id}).sort("created_at", -1).to_list(100)
    state = await db.agent_state.find_one({"_id": user.id}) or {}
    return {"items": [Alert.from_mongo(d).model_dump() for d in docs], "last_scan": state.get("last_scan"),
            "scan_times": ["08:30", "13:00", "19:30"], "unread": sum(1 for d in docs if not d.get("read"))}


@api.post("/alerts/read-all")
async def read_all(user: User = Depends(current_user)):
    await db.alerts.update_many({"user_id": user.id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/alerts/{alert_id}/read")
async def read_one(alert_id: str, user: User = Depends(current_user)):
    if ObjectId.is_valid(alert_id):
        await db.alerts.update_one({"_id": ObjectId(alert_id), "user_id": user.id}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/agent/scan")
async def scan_now(user: User = Depends(current_user)):
    state = await db.agent_state.find_one({"_id": user.id}) or {}
    last = state.get("last_manual")
    if last and (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() < 300:
        raise HTTPException(429, "The agent scanned recently. Try again in a few minutes")
    await db.agent_state.update_one({"_id": user.id}, {"$set": {"last_manual": market.now_iso()}}, upsert=True)
    n = await agent.scan_user(user.id)
    return {"new_alerts": n}


# ---------------------------------------------------------------- news
@api.get("/news")
async def news(user: User = Depends(current_user)):
    return await agent.news_for_user(user.id)


@api.get("/")
async def root():
    return {"app": "SmartTradeLens", "av_budget_left": await market.av_budget_left()}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

_tasks: list = []


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.watchlist.create_index([("user_id", 1), ("symbol", 1), ("market", 1)], unique=True)
    await db.alerts.create_index([("user_id", 1), ("created_at", -1)])
    _tasks.append(asyncio.create_task(market.refresher_loop()))
    _tasks.append(asyncio.create_task(agent.agent_loop()))


@app.on_event("shutdown")
async def shutdown():
    for t in _tasks:
        t.cancel()
    client.close()
