"""Technical indicators on plain float lists. None marks warm-up bars."""
from typing import List, Optional, Tuple

Series = List[Optional[float]]


def sma(vals: List[float], n: int) -> Series:
    out: Series = [None] * len(vals)
    s = 0.0
    for i, v in enumerate(vals):
        s += v
        if i >= n:
            s -= vals[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def stdev(vals: List[float], n: int) -> Series:
    out: Series = [None] * len(vals)
    for i in range(n - 1, len(vals)):
        w = vals[i - n + 1: i + 1]
        m = sum(w) / n
        out[i] = (sum((x - m) ** 2 for x in w) / n) ** 0.5
    return out


def rsi(closes: List[float], n: int = 14) -> Series:
    out: Series = [None] * len(closes)
    if len(closes) <= n:
        return out
    gains = losses = 0.0
    for i in range(1, n + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0)
        losses += max(-d, 0)
    ag, al = gains / n, losses / n
    out[n] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def true_range(h, l, c) -> List[float]:
    tr = [h[0] - l[0]]
    for i in range(1, len(c)):
        tr.append(max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])))
    return tr


def wilder(vals: List[float], n: int, start: int = 0) -> Series:
    out: Series = [None] * len(vals)
    if len(vals) - start < n:
        return out
    a = sum(vals[start:start + n]) / n
    out[start + n - 1] = a
    for i in range(start + n, len(vals)):
        a = (a * (n - 1) + vals[i]) / n
        out[i] = a
    return out


def atr(h, l, c, n: int = 10) -> Series:
    return wilder(true_range(h, l, c), n)


def supertrend(h, l, c, period: int = 10, mult: float = 3.0) -> Tuple[Series, List[int]]:
    a = atr(h, l, c, period)
    st: Series = [None] * len(c)
    direction = [0] * len(c)
    fu = fl = None
    for i in range(len(c)):
        if a[i] is None:
            continue
        mid = (h[i] + l[i]) / 2
        bu, bl = mid + mult * a[i], mid - mult * a[i]
        if fu is None:
            fu, fl = bu, bl
            direction[i] = 1 if c[i] >= mid else -1
        else:
            fu = bu if (bu < fu or c[i - 1] > fu) else fu
            fl = bl if (bl > fl or c[i - 1] < fl) else fl
            prev = direction[i - 1] or 1
            if prev == 1 and c[i] < fl:
                direction[i] = -1
            elif prev == -1 and c[i] > fu:
                direction[i] = 1
            else:
                direction[i] = prev
        st[i] = fl if direction[i] == 1 else fu
    return st, direction


def adx(h, l, c, n: int = 14) -> Series:
    if len(c) < 2 * n + 1:
        return [None] * len(c)
    pdm, ndm = [0.0], [0.0]
    for i in range(1, len(c)):
        up, dn = h[i] - h[i - 1], l[i - 1] - l[i]
        pdm.append(up if up > dn and up > 0 else 0.0)
        ndm.append(dn if dn > up and dn > 0 else 0.0)
    tr = true_range(h, l, c)
    atr_s, p_s, n_s = wilder(tr, n, 1), wilder(pdm, n, 1), wilder(ndm, n, 1)
    dx: List[float] = []
    idx: List[int] = []
    for i in range(len(c)):
        if atr_s[i]:
            pdi, ndi = 100 * p_s[i] / atr_s[i], 100 * n_s[i] / atr_s[i]
            dx.append(0.0 if pdi + ndi == 0 else 100 * abs(pdi - ndi) / (pdi + ndi))
            idx.append(i)
    sm = wilder(dx, n)
    out: Series = [None] * len(c)
    for j, i in enumerate(idx):
        out[i] = sm[j]
    return out
