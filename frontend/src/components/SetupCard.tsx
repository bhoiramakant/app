import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useTradeSheet } from "@/src/components/TradeSheet";
import { fmtPct, fmtPrice, MARKET_LABEL } from "@/src/format";
import { openTradingView } from "@/src/trade";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export type Setup = {
  id: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  tv_symbol: string;
  timeframe: string;
  strategy: string;
  status: string;
  reason?: string;
  price: number | null;
  change_pct: number | null;
  direction?: "bullish" | "bearish";
  side?: "buy" | "sell";
  ready?: boolean;
  upcoming?: boolean;
  upcoming_note?: string | null;
  met?: number;
  total?: number;
  checklist?: { label: string; ok: boolean }[];
  levels?: Record<string, any>;
  term: "short" | "long";
  fetched_at?: string | null;
};

export function Tag({ text, tone, icon, testID }: { text: string; tone: "bull" | "bear" | "ready" | "term" | "soon"; icon?: any; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const map = {
    bull: [colors.successSoft, colors.success],
    bear: [colors.errorSoft, colors.error],
    ready: [colors.brand, colors.onBrand],
    term: [colors.surfaceTertiary, colors.muted],
    soon: [colors.warningSoft, colors.warning],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.tag, { backgroundColor: bg }]} testID={testID}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <Text style={[s.tagText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function SetupTags({ item, idx }: { item: Setup; idx?: string }) {
  const s = useStyles();
  const left = (item.total ?? 0) - (item.met ?? 0);
  return (
    <View style={s.tags}>
      {item.direction === "bullish" && <Tag text="BULLISH" tone="bull" icon="triangle" testID={`setup-direction-${idx}`} />}
      {item.direction === "bearish" && <Tag text="BEARISH" tone="bear" icon="triangle-down" testID={`setup-direction-${idx}`} />}
      {item.ready && <Tag text="SETUP READY" tone="ready" icon="lightning-bolt" testID={`setup-ready-${idx}`} />}
      {!item.ready && item.upcoming && (
        <Tag text={left > 0 ? `UPCOMING · ${left} LEFT` : "UPCOMING"} tone="soon" icon="clock-outline" testID={`setup-upcoming-${idx}`} />
      )}
      <Tag text={item.term === "short" ? "SHORT-TERM" : "LONG-TERM"} tone="term" testID={`setup-term-${idx}`} />
      {item.strategy === "options" && item.levels?.option_side && <Tag text={item.levels.option_side.toUpperCase()} tone="term" />}
    </View>
  );
}

export function Checklist({ items }: { items: { label: string; ok: boolean }[] }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.check}>
      {items.map((c, i) => (
        <View key={i} style={s.checkRow} testID={`checklist-item-${i}`}>
          <Icon name={c.ok ? "check" : "close"} size={15} color={c.ok ? colors.success : colors.error} />
          <Text style={s.checkText}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function TradeButtons({ item, idx }: { item: Setup; idx: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const openSheet = useTradeSheet();
  const toast = useToast();
  return (
    <View style={s.btns}>
      <Pressy testID={`trade-button-${idx}`} haptic onPress={() => openSheet(item)} style={[s.btn, s.trade]}>
        <Icon name="swap-horizontal" size={18} color={colors.onBrandPrimary} />
        <Text style={s.tradeText}>Trade</Text>
      </Pressy>
      <Pressy
        testID={`tradingview-button-${idx}`}
        onPress={() => openTradingView(item).catch(() => toast("Couldn't open TradingView", "error"))}
        style={[s.btn, s.tv]}
      >
        <Icon name="chart-timeline-variant" size={17} color={colors.onSurface} />
        <Text style={s.tvText}>Open in TradingView</Text>
      </Pressy>
    </View>
  );
}

export function SetupCard({ item, index, onPress, highlight }: { item: Setup; index: number; onPress: () => void; highlight?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const idx = item.symbol.toLowerCase();
  const up = (item.change_pct ?? 0) >= 0;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(220)}>
      <Pressy testID={`setup-card-${idx}`} onPress={onPress} style={[s.card, item.ready && s.cardReady, highlight && s.cardHi]}>
        <View style={s.row}>
          <View style={s.symRow}>
            <Text style={s.sym}>{item.symbol}</Text>
            <View style={s.mkt}>
              <Text style={s.mktText}>{MARKET_LABEL[item.market]}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.price} testID={`setup-price-${idx}`}>
              {fmtPrice(item.price, item.currency)}
            </Text>
            <Text style={[s.chg, { color: up ? colors.success : colors.error }]}>{fmtPct(item.change_pct)}</Text>
          </View>
        </View>
        <Text style={s.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.status === "ok" ? (
          <>
            <SetupTags item={item} idx={idx} />
            {item.checklist && <Checklist items={item.checklist} />}
            {!item.ready && item.upcoming_note && (
              <View style={s.note} testID={`setup-upcoming-note-${idx}`}>
                <Icon name="bell-ring-outline" size={14} color={colors.warning} />
                <Text style={s.noteText}>{item.upcoming_note}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={s.pending} testID={`setup-status-${idx}`}>
            <Icon name={item.status === "pending" ? "progress-clock" : "information-outline"} size={16} color={colors.muted} />
            <Text style={s.pendingText}>{item.reason ?? "No data yet"}</Text>
          </View>
        )}
        <TradeButtons item={item} idx={idx} />
      </Pressy>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardReady: { borderColor: c.brandBorder },
  cardHi: { borderColor: c.brand, borderWidth: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  symRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sym: { fontFamily: fonts.heavy, fontSize: 17, color: c.onSurface },
  mkt: { backgroundColor: c.surfaceTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mktText: { fontFamily: fonts.heavy, fontSize: 10, color: c.muted, letterSpacing: 0.5 },
  name: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: -2 },
  price: { fontFamily: fonts.monoBold, fontSize: 15, color: c.onSurface },
  chg: { fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, marginBottom: 10 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontFamily: fonts.heavy, fontSize: 10, letterSpacing: 0.4 },
  check: { gap: 6, marginBottom: 12 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  checkText: { fontFamily: fonts.regular, fontSize: 12.5, color: c.onSurfaceTertiary, flex: 1, lineHeight: 17 },
  note: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: c.warningSoft,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noteText: { fontFamily: fonts.semibold, fontSize: 12, color: c.warning, flex: 1 },
  pending: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 14 },
  pendingText: { fontFamily: fonts.regular, fontSize: 12.5, color: c.muted, flex: 1 },
  btns: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  trade: { backgroundColor: c.brandPrimary, flex: 0.8 },
  tradeText: { fontFamily: fonts.heavy, fontSize: 14, color: c.onBrandPrimary },
  tv: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, flex: 1.2 },
  tvText: { fontFamily: fonts.bold, fontSize: 13, color: c.onSurface },
}));
