import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChartBlock } from "@/app/(tabs)/charts";
import { PriceAlertRow, usePriceAlerts } from "@/app/price-alerts";
import { Icon } from "@/src/components/Icon";
import { PriceAlertSheet, PriceAlertTarget } from "@/src/components/PriceAlertSheet";
import { Empty } from "@/src/components/Bits";
import { ChipRow } from "@/src/components/Chips";
import { ScreenHeader } from "@/src/components/Header";
import { Pressy } from "@/src/components/Pressy";
import { Checklist, Setup, SetupTags, TradeButtons } from "@/src/components/SetupCard";
import { useCached } from "@/src/cache";
import { fmtPct, fmtPrice, MARKET_LABEL, STRATEGY_LABELS, TIMEFRAMES } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Detail = Setup & { others: Record<string, { status: string; direction?: string; ready?: boolean; upcoming?: boolean; met?: number; total?: number }> };

const LEVEL_LABELS: Record<string, string> = {
  close: "Last close",
  supertrend: "Super Trend",
  rsi: "RSI (14)",
  ma_fast: "Fast MA",
  ma_slow: "Slow MA",
  adx: "ADX (14)",
  bb_upper: "Upper band",
  bb_lower: "Lower band",
};

export default function SetupDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = useLocalSearchParams<{ id: string; strategy?: string; timeframe?: string }>();
  const [strategy, setStrategy] = useState(p.strategy && STRATEGY_LABELS[p.strategy] ? p.strategy : "supertrend");
  const [tf, setTf] = useState(p.timeframe ?? "daily");
  const q = useCached<Detail>(["setup", p.id, strategy, tf], `/setups/${p.id}?strategy=${strategy}&timeframe=${tf}`);
  const d = q.data;
  const [paTarget, setPaTarget] = useState<PriceAlertTarget | null>(null);
  const pa = usePriceAlerts();
  const myAlerts = (pa.data?.items ?? []).filter((a) => a.item_id === p.id && a.active);
  const up = (d?.change_pct ?? 0) >= 0;
  const idx = d?.symbol.toLowerCase() ?? "detail";

  return (
    <View style={s.root} testID="setup-detail-screen">
      <ScreenHeader
        back
        title={
          <View style={s.titleRow}>
            <Text style={s.title}>{d?.symbol ?? "Setup"}</Text>
            {d && (
              <View style={s.mkt}>
                <Text style={s.mktText}>{MARKET_LABEL[d.market]}</Text>
              </View>
            )}
          </View>
        }
        subtitle={
          d && (
            <Text style={s.price} testID="setup-detail-price">
              {fmtPrice(d.price, d.currency)} <Text style={{ color: up ? colors.success : colors.error }}>{fmtPct(d.change_pct)}</Text>
            </Text>
          )
        }
      />
      <View style={s.sticky}>
        <ChipRow options={Object.entries(STRATEGY_LABELS).map(([key, label]) => ({ key, label }))} value={strategy} onChange={setStrategy} testPrefix="detail-strategy-chip" />
        <ChipRow options={TIMEFRAMES.map((t) => ({ key: t.key, label: t.label }))} value={tf} onChange={setTf} testPrefix="detail-timeframe-chip" />
      </View>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
      >
        {!d && q.isLoading && <ActivityIndicator color={colors.brand} style={{ marginTop: 48 }} />}
        {!d && q.isError && <Empty icon="alert-circle-outline" title="Couldn't load setup" body={(q.error as Error).message} testID="setup-detail-error" />}
        {d && (
          <>
            <Text style={s.name}>{d.name}</Text>
            {d.status === "ok" ? (
              <View style={[s.card, d.ready && s.cardReady]}>
                <SetupTags item={d} idx={idx} />
                <Text style={s.cardTitle}>
                  {STRATEGY_LABELS[strategy]} checklist · {d.met}/{d.total}
                </Text>
                {d.checklist && <Checklist items={d.checklist} />}
                {d.upcoming_note && !d.ready && <Text style={s.note}>{d.upcoming_note}</Text>}
              </View>
            ) : (
              <Empty icon="progress-clock" title="Setup not available" body={d.reason} testID="setup-detail-status" />
            )}

            {d.levels && (
              <View style={s.levels} testID="setup-key-levels">
                {Object.entries(d.levels)
                  .filter(([k, v]) => LEVEL_LABELS[k] && typeof v === "number")
                  .map(([k, v]) => (
                    <View key={k} style={s.level}>
                      <Text style={s.levelLabel}>{LEVEL_LABELS[k]}</Text>
                      <Text style={s.levelVal}>{k === "rsi" || k === "adx" ? (v as number).toFixed(1) : fmtPrice(v as number, d.currency)}</Text>
                    </View>
                  ))}
              </View>
            )}

            <View style={s.sectRow}>
              <Text style={[s.sect, { marginTop: 0, marginBottom: 0 }]}>Price alerts</Text>
              <Pressy
                testID="setup-add-price-alert-button"
                haptic
                onPress={() => setPaTarget({ id: p.id, symbol: d.symbol, currency: d.currency, price: d.price })}
                style={s.paBtn}
              >
                <Icon name="bell-plus-outline" size={16} color={colors.onBrandSecondary} />
                <Text style={s.paBtnText}>Price alert</Text>
              </Pressy>
            </View>
            {myAlerts.length === 0 ? (
              <Text style={s.paEmpty} testID="setup-price-alerts-empty">
                No active alerts. Get notified when {d.symbol} crosses your level.
              </Text>
            ) : (
              myAlerts.map((a, i) => <PriceAlertRow key={a.id} a={a} index={i} />)
            )}

            <Text style={s.sect}>Chart</Text>
            <ChartBlock id={p.id} tf={tf} />

            {d.others && (
              <>
                <Text style={s.sect}>Other strategies · {TIMEFRAMES.find((t) => t.key === tf)?.label}</Text>
                <View style={{ gap: 8 }}>
                  {Object.entries(d.others).map(([k, o]) => (
                    <Pressy key={k} testID={`other-strategy-${k}`} onPress={() => setStrategy(k)} style={s.other}>
                      <Text style={s.otherName}>{STRATEGY_LABELS[k]}</Text>
                      <Text
                        style={[
                          s.otherState,
                          { color: o.ready ? colors.brand : o.upcoming ? colors.warning : o.direction === "bullish" ? colors.success : o.direction === "bearish" ? colors.error : colors.muted },
                        ]}
                      >
                        {o.status !== "ok" ? "No data" : o.ready ? "Setup ready" : o.upcoming ? "Upcoming" : `${o.direction} · ${o.met}/${o.total}`}
                      </Text>
                    </Pressy>
                  ))}
                </View>
              </>
            )}
            <Pressy testID="setup-open-alerts-link" onPress={() => router.push("/alerts")} style={{ marginTop: 16, alignItems: "center", height: 44, justifyContent: "center" }}>
              <Text style={s.link}>See AI agent alerts</Text>
            </Pressy>
          </>
        )}
      </ScrollView>
      <PriceAlertSheet target={paTarget} onClose={() => setPaTarget(null)} />
      {d && (
        <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <TradeButtons item={d} idx="detail" />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.heavy, fontSize: 24, color: c.onSurface },
  mkt: { backgroundColor: c.surfaceTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mktText: { fontFamily: fonts.heavy, fontSize: 10, color: c.muted },
  price: { fontFamily: fonts.monoBold, fontSize: 14, color: c.onSurface, marginTop: 2 },
  sticky: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  content: { padding: 16 },
  name: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, marginBottom: 8 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingBottom: 4 },
  cardReady: { borderColor: c.brandBorder },
  cardTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.onSurface, marginBottom: 10 },
  note: { fontFamily: fonts.semibold, fontSize: 12, color: c.warning, marginBottom: 12 },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  level: { width: "48.8%", backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: c.border },
  levelLabel: { fontFamily: fonts.regular, fontSize: 11, color: c.muted },
  levelVal: { fontFamily: fonts.monoBold, fontSize: 14, color: c.onSurface, marginTop: 2 },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 10 },
  other: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: c.border },
  otherName: { fontFamily: fonts.bold, fontSize: 13, color: c.onSurface },
  otherState: { fontFamily: fonts.bold, fontSize: 12, textTransform: "capitalize" },
  sectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
  paBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.brandSecondary },
  paBtnText: { fontFamily: fonts.bold, fontSize: 12, color: c.onBrandSecondary },
  paEmpty: { fontFamily: fonts.regular, fontSize: 12.5, color: c.muted },
  link: { fontFamily: fonts.bold, fontSize: 13, color: c.brand },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
