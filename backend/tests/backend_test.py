"""SmartTradeLens backend regression tests. Runs against the public preview URL.

Rules (per task constraints):
- Alpha Vantage free key has ~8 calls left today; do NOT add new stock symbols beyond at most 1.
- Prefer crypto (DOGE/dogecoin) for add/remove to avoid AV cost.
"""
import os
import time
import uuid

import pytest
import requests

BASE = "https://smart-trade-lens-2.preview.emergentagent.com".rstrip("/")
API = f"{BASE}/api"

SEED_EMAIL = "trader@smarttradelens.app"
SEED_PASS = "Trader@123"


# ---------- shared session / auth
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seed_token(session):
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS}, timeout=20)
    assert r.status_code == 200, f"seed login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def seed_headers(seed_token):
    return {"Authorization": f"Bearer {seed_token}"}


# ---------- health
def test_root_ok(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("app") == "SmartTradeLens"
    assert "av_budget_left" in body


# ---------- auth
class TestAuth:
    def test_register_short_password(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"email": f"TEST_{uuid.uuid4().hex[:8]}@ex.com", "password": "short"}, timeout=20)
        assert r.status_code == 400

    def test_register_and_duplicate(self, session):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        # NOTE: register seeds watchlist (starter contains stocks) and triggers a scan.
        # It does NOT cost AV calls synchronously (background refresher is budgeted).
        r1 = session.post(f"{API}/auth/register", json={"email": email, "password": "Password123"}, timeout=30)
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert "token" in body and body["user"]["email"] == email
        r2 = session.post(f"{API}/auth/register", json={"email": email, "password": "Password123"}, timeout=20)
        assert r2.status_code == 409

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "WrongPass123"}, timeout=15)
        assert r.status_code == 401

    def test_login_success_and_me(self, session, seed_token):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {seed_token}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ---------- watchlist (crypto-only mutations to spare AV budget)
class TestWatchlist:
    def test_list_returns_items_shape(self, session, seed_headers):
        r = session.get(f"{API}/watchlist", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)

    def test_add_crypto_duplicate_and_remove(self, session, seed_headers):
        # Clean any pre-existing DOGE first
        r = session.get(f"{API}/watchlist", headers=seed_headers, timeout=15)
        for it in r.json()["items"]:
            if it.get("symbol") == "DOGE" and it.get("market") == "CRYPTO":
                session.delete(f"{API}/watchlist/{it['id']}", headers=seed_headers, timeout=10)
                break
        # add DOGE
        add = session.post(f"{API}/watchlist", headers=seed_headers,
                           json={"symbol": "DOGE", "market": "CRYPTO", "name": "Dogecoin", "cg_id": "dogecoin"},
                           timeout=20)
        assert add.status_code == 200, add.text
        new_id = add.json()["id"]
        assert add.json()["symbol"] == "DOGE"
        # duplicate
        dup = session.post(f"{API}/watchlist", headers=seed_headers,
                           json={"symbol": "DOGE", "market": "CRYPTO", "cg_id": "dogecoin"}, timeout=15)
        assert dup.status_code == 409
        # delete
        d = session.delete(f"{API}/watchlist/{new_id}", headers=seed_headers, timeout=15)
        assert d.status_code == 200 and d.json().get("ok") is True
        # delete again -> 404
        d2 = session.delete(f"{API}/watchlist/{new_id}", headers=seed_headers, timeout=15)
        assert d2.status_code == 404


# ---------- symbol search
class TestSearch:
    def test_search_hdfc(self, session, seed_headers):
        r = session.get(f"{API}/symbols/search", params={"q": "HDFC"}, headers=seed_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)
        assert len(body["items"]) > 0


# ---------- setups
class TestSetups:
    @pytest.mark.parametrize("strategy", ["supertrend", "ma", "options"])
    def test_setups_daily(self, session, seed_headers, strategy):
        r = session.get(f"{API}/setups", params={"strategy": strategy, "timeframe": "daily"},
                        headers=seed_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["strategy"] == strategy and body["timeframe"] == "daily"
        assert isinstance(body["items"], list)

    def test_setups_stocks_hourly_shows_unavailable(self, session, seed_headers):
        r = session.get(f"{API}/setups", params={"strategy": "supertrend", "timeframe": "hourly"},
                        headers=seed_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        stock_items = [i for i in items if i["market"] in ("US", "IN")]
        assert stock_items, "expected at least one stock in seeded watchlist"
        # every stock item should be 'unavailable' with a reason for hourly (free AV plan)
        for it in stock_items:
            assert it.get("status") == "unavailable", f"{it['symbol']} status={it.get('status')}"
            assert it.get("reason"), f"missing reason on {it['symbol']}"

    def test_setups_crypto_hourly_ok(self, session, seed_headers):
        r = session.get(f"{API}/setups", params={"strategy": "supertrend", "timeframe": "hourly"},
                        headers=seed_headers, timeout=60)
        assert r.status_code == 200
        crypto = [i for i in r.json()["items"] if i["market"] == "CRYPTO"]
        if not crypto:
            pytest.skip("no crypto in watchlist")
        # at least one crypto should return a non-error status
        assert any(c.get("status") in ("ok", "pending") for c in crypto)

    def test_setups_bad_params(self, session, seed_headers):
        r = session.get(f"{API}/setups", params={"strategy": "nope", "timeframe": "daily"},
                        headers=seed_headers, timeout=15)
        assert r.status_code == 400

    def test_setup_detail_and_chart(self, session, seed_headers):
        wl = session.get(f"{API}/watchlist", headers=seed_headers, timeout=15).json()["items"]
        # Prefer a CRYPTO item so chart/detail doesn't need AV
        target = next((i for i in wl if i["market"] == "CRYPTO"), wl[0] if wl else None)
        assert target, "watchlist empty"
        d = session.get(f"{API}/setups/{target['id']}", params={"strategy": "supertrend", "timeframe": "daily"},
                        headers=seed_headers, timeout=60)
        assert d.status_code == 200
        body = d.json()
        assert body["symbol"] == target["symbol"]
        assert "others" in body and set(body["others"].keys()) >= {"ma", "options"}

        c = session.get(f"{API}/chart/{target['id']}", params={"timeframe": "daily"},
                        headers=seed_headers, timeout=30)
        assert c.status_code == 200
        cb = c.json()
        assert cb["symbol"] == target["symbol"]
        assert "status" in cb


# ---------- dashboard
class TestDashboard:
    def test_dashboard_shape(self, session, seed_headers):
        r = session.get(f"{API}/dashboard", headers=seed_headers, timeout=60)
        assert r.status_code == 200
        b = r.json()
        for key in ("ready_count", "upcoming_count", "watching", "overview", "alerts", "movers"):
            assert key in b, f"missing {key}"
        assert isinstance(b["overview"], list) and len(b["overview"]) >= 2


# ---------- alerts & agent
class TestAlertsAgent:
    def test_alerts_list_and_read_all(self, session, seed_headers):
        r = session.get(f"{API}/alerts", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert "items" in b and "unread" in b
        rr = session.post(f"{API}/alerts/read-all", headers=seed_headers, timeout=15)
        assert rr.status_code == 200 and rr.json().get("ok") is True

    def test_scan_rate_limit_or_ok(self, session, seed_headers):
        r = session.post(f"{API}/agent/scan", headers=seed_headers, timeout=60)
        # Either succeeded (returns new_alerts count) OR 429 because recent manual scan
        assert r.status_code in (200, 429), r.text
        if r.status_code == 200:
            # a second call should 429
            r2 = session.post(f"{API}/agent/scan", headers=seed_headers, timeout=15)
            assert r2.status_code == 429


# ---------- news
class TestNews:
    def test_news(self, session, seed_headers):
        r = session.get(f"{API}/news", headers=seed_headers, timeout=90)
        assert r.status_code == 200
        # Response shape is defined by agent.news_for_user; just ensure it's a dict/list
        assert isinstance(r.json(), (dict, list))
