import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Empty, UpdatedLine } from "@/src/components/Bits";
import { PriceChart, RsiStrip } from "@/src/components/Chart";
import { ChipRow } from "@/src/components/Chips";
import { ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useCached } from "@/src/cache";
import { fmtPct, fmtPrice, MARKET_LABEL, TIMEFRAMES } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { openTradingView } from "@/src/trade";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export type WatchItem = { id: string; symbol: string; market: string; name: string; currency: string; tv_symbol: string };

export type ChartData = {
  id: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  tv_symbol: string;
  status: string;
  reason?: string;
  price: number | null;
  change_pct: number | null;
  fetched_at?: string | null;
  t?: string[];
  close?: number[];
  supertrend?: (number | null)[];
  st_dir?: number[];
  ma20?: (number | null)[];
  ma50?: (number | null)[];
  rsi?: (number | null)[];
  st_label?: string;
  ma_fast_len?: number;
  ma_slow_len?: number;
};

const TFS = TIMEFRAMES.map((t) => ({ key: t.key, label: t.short }));

export function ChartBlock({ id, tf }: { id: string; tf: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const q = useCached<ChartData>(["chart", id, tf], `/chart/${id}?timeframe=${tf}`);
  const d = q.data;
  if (!d && q.isLoading)
    return (
      <View style={s.chartLoading} testID="chart-loading">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  if (!d) return <Empty icon="chart-line-variant" title="Chart unavailable" body={(q.error as Error)?.message} testID="chart-error" />;
  if (d.status !== "ok" || !d.close)
    return <Empty icon="progress-clock" title="No chart data yet" body={d.reason} testID="chart-status" />;
  return (
    <View style={{ gap: 12 }}>
      <PriceChart close={d.close} supertrend={d.supertrend} stDir={d.st_dir} ma20={d.ma20} ma50={d.ma50} currency={d.currency} />
      <View style={s.legend}>
        <Text style={[s.leg, { color: colors.success }]}>— {d.st_label ?? "Super Trend"}</Text>
        <Text style={[s.leg, { color: colors.brand }]}>— MA {d.ma_fast_len ?? 20}</Text>
        <Text style={[s.leg, { color: colors.info }]}>— MA {d.ma_slow_len ?? 50}</Text>
        <Text style={[s.leg, { color: colors.onSurface }]}>— Price</Text>
      </View>
      {d.rsi && <RsiStrip rsi={d.rsi} />}
      <Text style={s.range}>
        {d.t?.[0]} → {d.t?.[d.t.length - 1]} · {d.close.length} bars
      </Text>
      <UpdatedLine at={d.fetched_at} offline={d._offline && q.isError} />
    </View>
  );
}

export default function Charts() {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const params = useLocalSearchParams<{ id?: string }>();
  const list = useCached<{ items: WatchItem[] }>(["watchlist"], "/watchlist");
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const [id, setId] = useState<string | undefined>(params.id);
  const [tf, setTf] = useState("daily");

  useEffect(() => {
    if (params.id) setId(params.id);
  }, [params.id]);
  useEffect(() => {
    if (!id && items.length) setId(items[0].id);
  }, [id, items]);

  const cur = items.find((i) => i.id === id);
  const chartQ = useCached<ChartData>(["chart", id, tf], `/chart/${id}?timeframe=${tf}`, { enabled: !!id });
  const up = (chartQ.data?.change_pct ?? 0) >= 0;

  return (
    <View style={s.root} testID="charts-screen">
      <ScreenHeader
        title={
          <View style={s.titleRow}>
            <Text style={s.title} testID="chart-symbol">
              {cur?.symbol ?? "Charts"}
            </Text>
            {cur && (
              <View style={s.mkt}>
                <Text style={s.mktText}>{MARKET_LABEL[cur.market]}</Text>
              </View>
            )}
          </View>
        }
        subtitle={
          cur && (
            <Text style={s.price} testID="chart-price">
              {fmtPrice(chartQ.data?.price, cur.currency)}{" "}
              <Text style={{ color: up ? colors.success : colors.error }}>{fmtPct(chartQ.data?.change_pct)}</Text>
            </Text>
          )
        }
      />
      <View style={s.sticky}>
        <ChipRow
          options={items.map((i) => ({ key: i.id, label: i.symbol }))}
          value={id ?? ""}
          onChange={setId}
          testPrefix="chart-symbol-chip"
        />
        <ChipRow options={TFS} value={tf} onChange={setTf} testPrefix="chart-timeframe-chip" />
      </View>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={chartQ.isRefetching} onRefresh={() => chartQ.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
      >
        {!items.length && !list.isLoading && (
          <Empty icon="chart-line" title="No symbols yet" body="Add symbols to your watchlist to see charts." testID="charts-empty" />
        )}
        {id && <ChartBlock id={id} tf={tf} />}
        {cur && (
          <View style={s.actions}>
            <Pressy
              testID="chart-open-tradingview-button"
              onPress={() => openTradingView(cur).catch(() => toast("Couldn't open TradingView", "error"))}
              style={s.tvBtn}
            >
              <Icon name="chart-timeline-variant" size={18} color={colors.onSurface} />
              <Text style={s.tvText}>Open in TradingView</Text>
            </Pressy>
            <Pressy
              testID="chart-view-setup-button"
              onPress={() => router.push({ pathname: "/setup/[id]", params: { id: cur.id, strategy: "supertrend", timeframe: tf } })}
              style={s.setupBtn}
            >
              <Text style={s.setupText}>View setup</Text>
            </Pressy>
          </View>
        )}
      </ScrollView>
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
  content: { padding: 16, gap: 12 },
  chartLoading: { height: 230, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", justifyContent: "space-between" },
  leg: { fontFamily: fonts.semibold, fontSize: 11 },
  range: { fontFamily: fonts.mono, fontSize: 11, color: c.faint },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  tvBtn: { flex: 1.4, height: 48, borderRadius: 12, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  tvText: { fontFamily: fonts.bold, fontSize: 14, color: c.onSurface },
  setupBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  setupText: { fontFamily: fonts.heavy, fontSize: 14, color: c.onBrandSecondary },
}));
