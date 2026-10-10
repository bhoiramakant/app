"""Strategy checklists. Each returns direction, conditions, ready/upcoming and key levels."""
from indicators import adx, rsi, sma, stdev, supertrend

STRATEGIES = {"supertrend": "Super Trend", "ma": "MA Crossover", "options": "Option Selling"}
TERMS = {"hourly": "short", "daily": "short", "weekly": "long", "monthly": "long"}


def _f(x, d=1):
    return "–" if x is None else f"{x:.{d}f}"


def evaluate(rows: list, strategy: str, tf: str) -> dict:
    h = [r["h"] for r in rows]
    l = [r["l"] for r in rows]
    c = [r["c"] for r in rows]
    v = [r["v"] for r in rows]
    need = {"supertrend": 16, "ma": 52, "options": 30}[strategy]
    if len(c) < need:
        return {"status": "insufficient", "reason": f"Needs {need} bars of history, has {len(c)}"}

    st, dirs = supertrend(h, l, c)
    r = rsi(c)[-1]
    bull = dirs[-1] == 1
    levels = {"close": c[-1], "supertrend": st[-1], "rsi": r}
    conds: list = []
    side = "buy" if bull else "sell"
    note = None

    if strategy == "supertrend":
        flip_age = next((i for i in range(1, len(dirs)) if dirs[-i - 1] != dirs[-1]), len(dirs))
        levels["bars_since_flip"] = flip_age
        conds.append({"label": f"Price closed {'above' if bull else 'below'} Super Trend (10, 3) at {_f(st[-1], 2)}",
                      "ok": (c[-1] > st[-1]) if bull else (c[-1] < st[-1])})
        lo, hi = (50, 70) if bull else (30, 50)
        conds.append({"label": f"RSI {_f(r, 0)} — {f'between {lo} and {hi}' if lo <= (r or 0) <= hi else f'needs {lo} to {hi}'}",
                      "ok": r is not None and lo <= r <= hi})
        vavg = sma(v, 20)[-1]
        if vavg:
            conds.append({"label": "Volume above 20-period average", "ok": v[-1] > vavg})
        else:
            conds.append({"label": f"Fresh trend: flipped {flip_age} bars ago (≤ 10)", "ok": flip_age <= 10})
    elif strategy == "ma":
        m20, m50 = sma(c, 20), sma(c, 50)
        bull = m20[-1] > m50[-1]
        side = "buy" if bull else "sell"
        cross_age = next((i for i in range(1, len(c) - 50) if (m20[-i - 1] > m50[-i - 1]) != bull), 99)
        gap = (m20[-1] / m50[-1] - 1) * 100
        levels.update({"ma20": m20[-1], "ma50": m50[-1], "gap_pct": gap, "bars_since_cross": cross_age})
        conds.append({"label": f"20 MA {'above' if bull else 'below'} 50 MA ({gap:+.2f}%)", "ok": True})
        conds.append({"label": f"Crossed within last 10 bars ({cross_age if cross_age < 99 else '10+'} ago)",
                      "ok": cross_age <= 10})
        conds.append({"label": f"Price {'above' if bull else 'below'} 20 MA ({_f(m20[-1], 2)})",
                      "ok": c[-1] > m20[-1] if bull else c[-1] < m20[-1]})
        prev_gap = (m20[-4] / m50[-4] - 1) * 100
        if abs(gap) < 1.0 and abs(gap) < abs(prev_gap):
            note = f"{'Bearish' if bull else 'Bullish'} crossover forming: 20 MA {abs(gap):.2f}% from 50 MA"
    else:  # option selling on the underlying
        a = adx(h, l, c)[-1]
        mid, sd = sma(c, 20)[-1], stdev(c, 20)[-1]
        up, dn = mid + 2 * sd, mid - 2 * sd
        levels.update({"adx": a, "bb_upper": up, "bb_lower": dn})
        conds.append({"label": f"ADX {_f(a, 0)} — {'below' if (a or 99) < 25 else 'needs below'} 25 (weak trend)",
                      "ok": a is not None and a < 25})
        conds.append({"label": f"RSI {_f(r, 0)} — {'between 40 and 60' if 40 <= (r or 0) <= 60 else 'needs 40 to 60'}",
                      "ok": r is not None and 40 <= r <= 60})
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


def chart_payload(rows: list, limit: int = 120) -> dict:
    h = [r["h"] for r in rows]
    l = [r["l"] for r in rows]
    c = [r["c"] for r in rows]
    st, dirs = supertrend(h, l, c)
    m20, m50, rs = sma(c, 20), sma(c, 50), rsi(c)
    s = max(0, len(rows) - limit)
    return {"t": [r["t"] for r in rows[s:]], "close": c[s:], "supertrend": st[s:], "st_dir": dirs[s:],
            "ma20": m20[s:], "ma50": m50[s:], "rsi": rs[s:]}
