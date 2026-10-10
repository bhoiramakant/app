export function fmtPrice(p: number | null | undefined, currency = "USD") {
  if (p === null || p === undefined) return "—";
  const digits = p < 1 ? 4 : p < 100 ? 2 : p < 10000 ? 2 : 0;
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const sym = currency === "INR" ? "₹" : "$";
  return sym + p.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(p: number | null | undefined) {
  if (p === null || p === undefined) return "—";
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(2)}%`;
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtClock(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

/** Alpha Vantage news timestamps look like 20261010T153000 */
export function avTime(s?: string | null) {
  if (!s || s.length < 13) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00Z`;
}

export const STRATEGY_LABELS: Record<string, string> = {
  supertrend: "Super Trend",
  ma: "MA Crossover",
  options: "Option Selling",
};

export const TIMEFRAMES = [
  { key: "hourly", label: "Hourly", short: "1H" },
  { key: "daily", label: "Daily", short: "1D" },
  { key: "weekly", label: "Weekly", short: "1W" },
  { key: "monthly", label: "Monthly", short: "1M" },
];

export const MARKET_LABEL: Record<string, string> = { US: "US", IN: "BSE", CRYPTO: "CRYPTO" };
