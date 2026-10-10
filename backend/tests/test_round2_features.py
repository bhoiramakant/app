"""Round-2 features: strategy settings, price alerts, register-push.
Scope per task note:
- Crypto-only mutations (BTC/ETH/SOL). No stock-adding.
- Push can't be delivered in preview; just verify auth gate & code path doesn't break.
"""
import os
import time
import pytest
import requests

BASE = "https://smart-trade-lens-2.preview.emergentagent.com".rstrip("/")
API = f"{BASE}/api"
SEED_EMAIL = "trader@smarttradelens.app"
SEED_PASS = "Trader@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seed_headers(session):
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def defaults(session, seed_headers):
    r = session.get(f"{API}/settings/strategy", headers=seed_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["defaults"]


# ---------- strategy settings
class TestStrategySettings:
    def test_get_shape(self, session, seed_headers):
        r = session.get(f"{API}/settings/strategy", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        for k in ("params", "defaults", "bounds"):
            assert k in b
        # bounds must cover all defaults
        for k in b["defaults"]:
            assert k in b["bounds"], f"missing bound for {k}"
            lo, hi = b["bounds"][k]
            assert isinstance(lo, (int, float)) and isinstance(hi, (int, float))

    def test_put_fast_ge_slow_rejected(self, session, seed_headers, defaults):
        bad = {**defaults, "ma_fast": 50, "ma_slow": 50}
        r = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": bad}, timeout=15)
        assert r.status_code == 400
        bad2 = {**defaults, "ma_fast": 60, "ma_slow": 20}
        r2 = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": bad2}, timeout=15)
        assert r2.status_code == 400

    def test_put_out_of_bounds_rejected(self, session, seed_headers, defaults):
        bad = {**defaults, "st_period": 999}  # bound (3, 50)
        r = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": bad}, timeout=15)
        assert r.status_code == 400

    def test_put_rsi_lo_ge_hi_rejected(self, session, seed_headers, defaults):
        bad = {**defaults, "rsi_bull_lo": 80, "rsi_bull_hi": 70}
        r = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": bad}, timeout=15)
        assert r.status_code == 400

    def test_put_save_9_21_reflects_in_setups_and_chart(self, session, seed_headers, defaults):
        new_params = {**defaults, "ma_fast": 9, "ma_slow": 21}
        r = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": new_params}, timeout=15)
        assert r.status_code == 200, r.text
        saved = r.json()["params"]
        assert saved["ma_fast"] == 9 and saved["ma_slow"] == 21

        # Setups: MA strategy daily checklist should mention '9 MA' and '21 MA'
        s = session.get(f"{API}/setups", params={"strategy": "ma", "timeframe": "daily"},
                        headers=seed_headers, timeout=60)
        assert s.status_code == 200
        items = s.json()["items"]
        # Find a crypto with any checklist text that references MA numbers
        found_fast = found_slow = False
        for it in items:
            # setup/checklist shape: look through any string fields
            blob = str(it)
            if "9 MA" in blob:
                found_fast = True
            if "21 MA" in blob:
                found_slow = True
            if found_fast and found_slow:
                break
        assert found_fast and found_slow, f"did not find '9 MA'/'21 MA' labels. items[0]={items[0] if items else None}"

        # Chart: ma_fast_len/ma_slow_len/st_label must reflect saved params
        wl = session.get(f"{API}/watchlist", headers=seed_headers, timeout=15).json()["items"]
        crypto = next((i for i in wl if i["market"] == "CRYPTO"), None)
        assert crypto, "no crypto in watchlist"
        c = session.get(f"{API}/chart/{crypto['id']}", params={"timeframe": "daily"},
                        headers=seed_headers, timeout=30)
        assert c.status_code == 200
        cb = c.json()
        assert cb.get("ma_fast_len") == 9, cb
        assert cb.get("ma_slow_len") == 21, cb
        assert "st_label" in cb and "Super Trend" in cb["st_label"]

    def test_zz_reset_to_defaults(self, session, seed_headers, defaults):
        # final cleanup: restore defaults
        r = session.put(f"{API}/settings/strategy", headers=seed_headers, json={"params": defaults}, timeout=15)
        assert r.status_code == 200
        got = r.json()["params"]
        for k, v in defaults.items():
            assert got[k] == v, f"{k}: {got[k]} != {v}"


# ---------- price alerts
class TestPriceAlerts:
    def _find_crypto(self, session, seed_headers, prefer=("BTC", "ETH", "SOL")):
        wl = session.get(f"{API}/watchlist", headers=seed_headers, timeout=15).json()["items"]
        for sym in prefer:
            for it in wl:
                if it["market"] == "CRYPTO" and it["symbol"] == sym:
                    return it
        # any crypto fallback
        return next((i for i in wl if i["market"] == "CRYPTO"), None)

    def test_create_above_below_validation(self, session, seed_headers):
        it = self._find_crypto(session, seed_headers)
        assert it, "no crypto in watchlist"
        # fetch current price via chart or quote - chart response has candles; use setup detail status/price via setups
        s = session.get(f"{API}/setups", params={"strategy": "supertrend", "timeframe": "daily"},
                        headers=seed_headers, timeout=60).json()["items"]
        row = next((r for r in s if r["id"] == it["id"]), None)
        assert row and row.get("price") is not None, f"no price for {it['symbol']}"
        price = float(row["price"])

        # above with target <= price -> 400
        r = session.post(f"{API}/price-alerts", headers=seed_headers,
                        json={"item_id": it["id"], "condition": "above", "target": price * 0.5}, timeout=15)
        assert r.status_code == 400, r.text
        # below with target >= price -> 400
        r = session.post(f"{API}/price-alerts", headers=seed_headers,
                        json={"item_id": it["id"], "condition": "below", "target": price * 1.5}, timeout=15)
        assert r.status_code == 400, r.text

    def test_non_watchlist_item_404(self, session, seed_headers):
        bogus = "ffffffffffffffffffffffff"  # valid-looking ObjectId not in user's watchlist
        r = session.post(f"{API}/price-alerts", headers=seed_headers,
                        json={"item_id": bogus, "condition": "above", "target": 999999}, timeout=15)
        assert r.status_code == 404, r.text

    def test_create_list_delete_flow(self, session, seed_headers):
        it = self._find_crypto(session, seed_headers)
        assert it
        s = session.get(f"{API}/setups", params={"strategy": "supertrend", "timeframe": "daily"},
                        headers=seed_headers, timeout=60).json()["items"]
        row = next((r for r in s if r["id"] == it["id"]), None)
        price = float(row["price"])
        # valid above alert at +10%
        r = session.post(f"{API}/price-alerts", headers=seed_headers,
                        json={"item_id": it["id"], "condition": "above", "target": round(price * 1.10, 2)}, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created.get("id") and created["symbol"] == it["symbol"]
        aid = created["id"]
        # list
        lst = session.get(f"{API}/price-alerts", headers=seed_headers, timeout=15)
        assert lst.status_code == 200
        assert any(a["id"] == aid for a in lst.json()["items"])
        # delete
        d = session.delete(f"{API}/price-alerts/{aid}", headers=seed_headers, timeout=15)
        assert d.status_code == 200 and d.json().get("ok") is True
        # delete again -> 404
        d2 = session.delete(f"{API}/price-alerts/{aid}", headers=seed_headers, timeout=15)
        assert d2.status_code == 404


# ---------- register-push
class TestRegisterPush:
    def test_no_auth_401(self, session):
        r = session.post(f"{API}/register-push", json={"platform": "web", "device_token": "tok_x"}, timeout=15)
        assert r.status_code == 401

    def test_with_auth_500_expected_with_placeholder_key(self, session, seed_headers):
        r = session.post(f"{API}/register-push", headers=seed_headers,
                        json={"platform": "web", "device_token": "tok_test_xyz"}, timeout=20)
        # placeholder EMERGENT_PUSH_KEY returns 401 upstream -> endpoint returns 500 per task note
        assert r.status_code in (201, 500), r.text
