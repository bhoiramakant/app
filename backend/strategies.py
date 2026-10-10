"""Strategy checklists. Each returns direction, conditions, ready/upcoming and key levels.
All thresholds come from per-user params (see DEFAULT_PARAMS)."""
from indicators import adx, rsi, sma, stdev, supertrend

STRATEGIES = {"supertrend": "Super Trend", "ma": "MA Crossover", "options": "Option Selling"}
TERMS = {"hourly": "short", "daily": "short", "weekly": "long", "monthly": "long"}

DEFAULT_PARAMS = {
    "st_period": 10, "st_mult": 3.0,
    "rsi_period": 14, "rsi_bull_lo": 50, "rsi_bull_hi": 70, "rsi_bear_lo": 30, "rsi_bear_hi": 50,
    "ma_fast": 20, "ma_slow": 50, "ma_cross_bars": 10,
    "adx_max": 25, "opt_rsi_lo": 40, "opt_rsi_hi": 60,
}
# (min, max) bounds for validation
PARAM_BOUNDS = {
    "st_period": (3, 50), "st_mult": (0.5, 10), "rsi_period": (2, 50),
    "rsi_bull_lo": (0, 100), "rsi_bull_hi": (0, 100), "rsi_bear_lo": (0, 100), "rsi_bear_hi": (0, 100),
    "ma_fast": (2, 100), "ma_slow": (5, 200), "ma_cross_bars": (1, 50),
    "adx_max": (5, 60), "opt_rsi_lo": (0, 100), "opt_rsi_hi": (0, 100),
}


def _f(x, d=1):
    return "–" if x is None else f"{x:.{d}f}"


def _g(x):  # compact number for labels: 3.0 -> 3, 2.5 -> 2.5
    return f"{x:g}"


def evaluate(rows: list, strategy: str, tf: str, p: dict | None = None) -> dict:
    p = {**DEFAULT_PARAMS, **(p or {})}
    h = [r["h"] for r in rows]
    l = [r["l"] for r in rows]
    c = [r["c"] for r in rows]
    v = [r["v"] for r in rows]
    stp, stm, fast, slow = int(p["st_period"]), float(p["st_mult"]), int(p["ma_fast"]), int(p["ma_slow"])
    need = {"supertrend": stp + 6, "ma": slow + 4, "options": max(30, stp + 6)}[strategy]
    if len(c) < need:
        return {"status": "insufficient", "reason": f"Needs {need} bars of history, has {len(c)}"}

    st, dirs = supertrend(h, l, c, stp, stm)
    r = rsi(c, int(p["rsi_period"]))[-1]
    bull = dirs[-1] == 1
    levels = {"close": c[-1], "supertrend": st[-1], "rsi": r}
    conds: list = []
    side = "buy" if bull else "sell"
    note = None
    rl = f"RSI {_f(r, 0)}"

    if strategy == "supertrend":
        flip_age = next((i for i in range(1, len(dirs)) if dirs[-i - 1] != dirs[-1]), len(dirs))
        levels["bars_since_flip"] = flip_age
        conds.append({"label": f"Price closed {'above' if bull else 'below'} Super Trend ({stp}, {_g(stm)}) at {_f(st[-1], 2)}",
                      "ok": (c[-1] > st[-1]) if bull else (c[-1] < st[-1])})
        lo, hi = (p["rsi_bull_lo"], p["rsi_bull_hi"]) if bull else (p["rsi_bear_lo"], p["rsi_bear_hi"])
        ok = r is not None and lo <= r <= hi
        conds.append({"label": f"{rl} — {'between' if ok else 'needs'} {_g(lo)} {'and' if ok else 'to'} {_g(hi)}", "ok": ok})
        vavg = sma(v, 20)[-1]
        if vavg:
            conds.append({"label": "Volume above 20-period average", "ok": v[-1] > vavg})
        else:
            conds.append({"label": f"Fresh trend: flipped {flip_age} bars ago (≤ 10)", "ok": flip_age <= 10})
    elif strategy == "ma":
        mf, ms = sma(c, fast), sma(c, slow)
        bull = mf[-1] > ms[-1]
        side = "buy" if bull else "sell"
        win = int(p["ma_cross_bars"])
        cross_age = next((i for i in range(1, len(c) - slow) if (mf[-i - 1] > ms[-i - 1]) != bull), 999)
        gap = (mf[-1] / ms[-1] - 1) * 100
        levels.update({"ma_fast": mf[-1], "ma_slow": ms[-1], "gap_pct": gap, "bars_since_cross": cross_age})
        conds.append({"label": f"{fast} MA {'above' if bull else 'below'} {slow} MA ({gap:+.2f}%)", "ok": True})
        conds.append({"label": f"Crossed within last {win} bars ({cross_age if cross_age < 999 else f'{win}+'} ago)",
                      "ok": cross_age <= win})
        conds.append({"label": f"Price {'above' if bull else 'below'} {fast} MA ({_f(mf[-1], 2)})",
                      "ok": c[-1] > mf[-1] if bull else c[-1] < mf[-1]})
        prev_gap = (mf[-4] / ms[-4] - 1) * 100
        if abs(gap) < 1.0 and abs(gap) < abs(prev_gap):
            note = f"{'Bearish' if bull else 'Bullish'} crossover forming: {fast} MA {abs(gap):.2f}% from {slow} MA"
    else:  # option selling on the underlying
        a = adx(h, l, c)[-1]
        mid, sd = sma(c, 20)[-1], stdev(c, 20)[-1]
        up, dn = mid + 2 * sd, mid - 2 * sd
        amax, lo, hi = p["adx_max"], p["opt_rsi_lo"], p["opt_rsi_hi"]
        levels.update({"adx": a, "bb_upper": up, "bb_lower": dn})
        ok_a = a is not None and a < amax
        conds.append({"label": f"ADX {_f(a, 0)} — {'below' if ok_a else 'needs below'} {_g(amax)} (weak trend)", "ok": ok_a})
        ok_r = r is not None and lo <= r <= hi
        conds.append({"label": f"{rl} — {'between' if ok_r else 'needs'} {_g(lo)} {'and' if ok_r else 'to'} {_g(hi)}", "ok": ok_r})
        conds.append({"label": f"Price inside Bollinger range {_f(dn, 2)} – {_f(up, 2)}", "ok": dn < c[-1] < up})
        levels["option_side"] = "Sell PUT" if bull else "Sell CALL"

    met = sum(1 for x in conds if x["ok"])
    ready = met == len(conds)
    upcoming = (not ready) and met == len(conds) - 1
    missing = next((x["label"] for x in conds if not x["ok"]), None)
    if upcoming and not note:
        note = f"1 condition left: {missing}"
    return {
        "status": "ok", "direction": "bullish" if bull else "bearish", "side": side,
        "ready": ready, "upcoming": upcoming or bool(note and not ready), "upcoming_note": note if not ready else None,
        "met": met, "total": len(conds), "checklist": conds, "levels": levels, "term": TERMS[tf],
    }


def chart_payload(rows: list, p: dict | None = None, limit: int = 120) -> dict:
    p = {**DEFAULT_PARAMS, **(p or {})}
    h = [r["h"] for r in rows]
    l = [r["l"] for r in rows]
    c = [r["c"] for r in rows]
    st, dirs = supertrend(h, l, c, int(p["st_period"]), float(p["st_mult"]))
    mf, ms, rs = sma(c, int(p["ma_fast"])), sma(c, int(p["ma_slow"])), rsi(c, int(p["rsi_period"]))
    s = max(0, len(rows) - limit)
    return {"t": [r["t"] for r in rows[s:]], "close": c[s:], "supertrend": st[s:], "st_dir": dirs[s:],
            "ma20": mf[s:], "ma50": ms[s:], "rsi": rs[s:], "ma_fast_len": int(p["ma_fast"]),
            "ma_slow_len": int(p["ma_slow"]), "st_label": f"Super Trend ({int(p['st_period'])}, {_g(float(p['st_mult']))})"}
