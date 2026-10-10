import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

export type TradeItem = { symbol: string; market: string; tv_symbol: string; name?: string };

export type Broker = {
  key: string;
  name: string;
  pkg: string;
  badge: string;
  // Third-party brand colors: identical in every theme.
  bg: string;
  fg: string;
  hint: (it: TradeItem) => string;
  url: (it: TradeItem) => string;
};

export const tvUrl = (it: TradeItem) =>
  `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(it.tv_symbol)}`;

export const BROKERS: Broker[] = [
  {
    key: "robinhood",
    name: "Robinhood",
    pkg: "com.robinhood.android",
    badge: "RH",
    bg: "#CCFF00",
    fg: "#111111",
    hint: () => "US stocks & crypto",
    url: (it) =>
      it.market === "CRYPTO"
        ? `https://robinhood.com/us/en/crypto/${it.symbol}`
        : `https://robinhood.com/us/en/stocks/${it.symbol}`,
  },
  {
    key: "coindcx",
    name: "CoinDCX",
    pkg: "com.coindcx.btc",
    badge: "CD",
    bg: "#2453FF",
    fg: "#FFFFFF",
    hint: () => "Crypto in INR",
    url: (it) => `https://coindcx.com/trade/${it.symbol}INR`,
  },
  {
    key: "kite",
    name: "Kite by Zerodha",
    pkg: "com.zerodha.kite3",
    badge: "K",
    bg: "#FF5722",
    fg: "#FFFFFF",
    hint: () => "Indian stocks & F&O",
    url: () => "https://kite.zerodha.com/",
  },
  {
    key: "tradingview",
    name: "TradingView",
    pkg: "com.tradingview.tradingviewapp",
    badge: "TV",
    bg: "#131722",
    fg: "#FFFFFF",
    hint: (it) => `Opens ${it.tv_symbol.split(":").pop()} chart`,
    url: tvUrl,
  },
];

/** Suggested order: the broker that fits the market first. */
export function brokersFor(it: TradeItem) {
  const pref: Record<string, string[]> = {
    US: ["robinhood", "tradingview", "kite", "coindcx"],
    IN: ["kite", "tradingview", "robinhood", "coindcx"],
    CRYPTO: ["coindcx", "robinhood", "tradingview", "kite"],
  };
  const order = pref[it.market] ?? pref.US;
  return [...BROKERS].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

async function androidLaunch(pkg: string, url: string) {
  // startActivity is not affected by Android 11 package-visibility rules, so this works without <queries>.
  try {
    await Promise.race([
      IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: url, packageName: pkg }),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    return true;
  } catch {}
  try {
    await Promise.race([
      IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        packageName: pkg,
        category: "android.intent.category.LAUNCHER",
      }),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    return true;
  } catch {}
  return false;
}

/** Returns 'app' when the app opened, 'store' when it redirected to Play Store, 'web' for browser. */
export async function openBroker(b: Broker, it: TradeItem): Promise<"app" | "store" | "web"> {
  const url = b.url(it);
  if (Platform.OS === "android") {
    if (await androidLaunch(b.pkg, url)) return "app";
    if (b.key === "tradingview") {
      await Linking.openURL(url);
      return "web";
    }
    try {
      await Linking.openURL(`market://details?id=${b.pkg}`);
    } catch {
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${b.pkg}`);
    }
    return "store";
  }
  await Linking.openURL(url);
  return "web";
}

export async function openTradingView(it: TradeItem) {
  return openBroker(BROKERS.find((b) => b.key === "tradingview")!, it);
}
