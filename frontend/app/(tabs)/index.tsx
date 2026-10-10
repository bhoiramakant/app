import { useRouter } from "expo-router";
import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertItem, AlertT } from "@/src/components/AlertItem";
import { SectionTitle, UpdatedLine } from "@/src/components/Bits";
import { AlertsBell, IconButton, ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useCached } from "@/src/cache";
import { fmtPct, fmtPrice, MARKET_LABEL, STRATEGY_LABELS } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Dash = {
  ready_count: number;
  upcoming_count: number;
  watching: number;
  ready: { symbol: string; strategy: string; direction: string }[];
  overview: { label: string; symbol: string; currency: string; price: number | null; change_pct: number | null }[];
  alerts: AlertT[];
  unread: number;
  movers: { id: string; symbol: string; market: string; currency: string; price: number | null; change_pct: number | null }[];
  generated_at: string;
};

export default function Dashboard() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useCached<Dash>(["dashboard"], "/dashboard", { refetchInterval: 120_000 });
  const d = q.data;

  return (
    <View style={s.root} testID="dashboard-screen">
      <ScreenHeader
        title="Dashboard"
        right={
          <>
            <AlertsBell />
            <IconButton icon="cog-outline" testID="header-settings-button" onPress={() => router.push("/settings")} />
          </>
        }
      />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
      >
        {!d && q.isLoading && <SkeletonBlock />}
        {!d && q.isError && (
          <Text style={s.error} testID="dashboard-error">
            {(q.error as Error).message}
          </Text>
        )}
        {d && (
          <>
            <Animated.View entering={FadeInDown.duration(240)} style={s.readyCard} testID="ready-summary-card">
              <View style={{ flex: 1 }}>
                <Text style={s.mini}>Setups ready today</Text>
                <Text style={s.big} testID="ready-count">
                  {d.ready_count}
                </Text>
                <Text style={s.mini}>
                  {d.upcoming_count} upcoming · {d.watching} watching
                </Text>
              </View>
              <Pressy testID="view-setups-button" haptic onPress={() => router.push("/setups")} style={s.cta}>
                <Text style={s.ctaText}>View setups</Text>
                <Icon name="arrow-right" size={16} color={colors.onBrandPrimary} />
              </Pressy>
            </Animated.View>
            {d.ready.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.readyChips}>
                {d.ready.map((r, i) => (
                  <Pressy
                    key={i}
                    testID={`ready-chip-${r.symbol.toLowerCase()}-${r.strategy}`}
                    onPress={() => router.push({ pathname: "/setups", params: { strategy: r.strategy, timeframe: "daily", symbol: r.symbol } })}
                    style={s.readyChip}
                  >
                    <Icon name={r.direction === "bullish" ? "triangle" : "triangle-down"} size={10} color={r.direction === "bullish" ? colors.success : colors.error} />
                    <Text style={s.readyChipText}>
                      {r.symbol} · {STRATEGY_LABELS[r.strategy]}
                    </Text>
                  </Pressy>
                ))}
              </ScrollView>
            )}

            <SectionTitle>Market overview</SectionTitle>
            <View style={s.tiles}>
              {d.overview.map((o) => {
                const up = (o.change_pct ?? 0) >= 0;
                return (
                  <View key={o.label} style={s.tile} testID={`overview-tile-${o.symbol.toLowerCase()}`}>
                    <Text style={s.mini} numberOfLines={1}>
                      {o.label}
                    </Text>
                    <Text style={s.tilePrice}>{fmtPrice(o.price, o.currency)}</Text>
                    <Text style={[s.chg, { color: up ? colors.success : colors.error }]}>{fmtPct(o.change_pct)}</Text>
                  </View>
                );
              })}
            </View>

            <SectionTitle
              right={
                <Pressy testID="dashboard-all-alerts-link" onPress={() => router.push("/alerts")} hitSlop={8}>
                  <Text style={s.link}>All alerts</Text>
                </Pressy>
              }
            >
              AI agent · latest
            </SectionTitle>
            {d.alerts.length === 0 ? (
              <View style={s.agentEmpty} testID="dashboard-alerts-empty">
                <Icon name="robot-outline" size={20} color={colors.brand} />
                <Text style={s.agentEmptyText}>The agent is scanning your watchlist. New setups will show up here.</Text>
              </View>
            ) : (
              d.alerts.map((a, i) => <AlertItem key={a.id} a={a} index={i} onPress={() => router.push("/alerts")} />)
            )}

            <SectionTitle>Watchlist movers</SectionTitle>
            <View style={s.list}>
              {d.movers.map((m, i) => {
                const up = (m.change_pct ?? 0) >= 0;
                return (
                  <Pressy
                    key={m.id}
                    testID={`mover-row-${m.symbol.toLowerCase()}`}
                    onPress={() => router.push({ pathname: "/charts", params: { id: m.id } })}
                    style={[s.mover, i > 0 && s.moverBorder]}
                  >
                    <Text style={s.moverSym}>{m.symbol}</Text>
                    <Text style={s.moverMkt}>{MARKET_LABEL[m.market]}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={s.moverPrice}>{fmtPrice(m.price, m.currency)}</Text>
                    <Text style={[s.moverChg, { color: up ? colors.success : colors.error }]}>{fmtPct(m.change_pct)}</Text>
                  </Pressy>
                );
              })}
            </View>
            <View style={{ marginTop: 12 }}>
              <UpdatedLine at={d._savedAt ?? d.generated_at} offline={d._offline && q.isError} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SkeletonBlock() {
  const s = useStyles();
  return (
    <View testID="dashboard-loading">
      <View style={[s.readyCard, { height: 110, opacity: 0.5 }]} />
      <View style={[s.tiles, { marginTop: 24 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.tile, { height: 74, opacity: 0.5 }]} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  error: { fontFamily: fonts.semibold, color: c.error, padding: 16 },
  readyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.brandBorder,
    padding: 16,
    gap: 12,
  },
  mini: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  big: { fontFamily: fonts.monoBold, fontSize: 36, color: c.brand, marginVertical: 2 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandPrimary, height: 44, paddingHorizontal: 16, borderRadius: 12 },
  ctaText: { fontFamily: fonts.heavy, fontSize: 13, color: c.onBrandPrimary },
  readyChips: { gap: 8, paddingTop: 12 },
  readyChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: c.border,
  },
  readyChipText: { fontFamily: fonts.bold, fontSize: 12, color: c.onSurface },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.8%", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12 },
  tilePrice: { fontFamily: fonts.monoBold, fontSize: 15, color: c.onSurface, marginTop: 4 },
  chg: { fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  link: { fontFamily: fonts.bold, fontSize: 12, color: c.brand },
  agentEmpty: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: 14, padding: 14 },
  agentEmptyText: { fontFamily: fonts.regular, fontSize: 12.5, color: c.muted, flex: 1 },
  list: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 },
  mover: { flexDirection: "row", alignItems: "center", gap: 8, height: 52 },
  moverBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  moverSym: { fontFamily: fonts.heavy, fontSize: 14, color: c.onSurface },
  moverMkt: { fontFamily: fonts.bold, fontSize: 10, color: c.muted },
  moverPrice: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface },
  moverChg: { fontFamily: fonts.mono, fontSize: 12, width: 64, textAlign: "right" },
}));
