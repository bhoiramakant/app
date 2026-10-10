import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Empty, UpdatedLine } from "@/src/components/Bits";
import { ChipRow, Segmented } from "@/src/components/Chips";
import { AlertsBell, IconButton, ScreenHeader } from "@/src/components/Header";
import { Pressy } from "@/src/components/Pressy";
import { Setup, SetupCard } from "@/src/components/SetupCard";
import { useCached } from "@/src/cache";
import { STRATEGY_LABELS, TIMEFRAMES } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const STRATS = Object.entries(STRATEGY_LABELS).map(([key, label]) => ({ key, label }));
const TFS = TIMEFRAMES.map((t) => ({ key: t.key, label: t.label }));
const SIDES = [
  { key: "all", label: "All" },
  { key: "buy", label: "Buy" },
  { key: "sell", label: "Sell" },
];

export default function Setups() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const params = useLocalSearchParams<{ strategy?: string; timeframe?: string; symbol?: string }>();
  const [strategy, setStrategy] = useState("supertrend");
  const [tf, setTf] = useState("daily");
  const [side, setSide] = useState("all");
  const [hi, setHi] = useState<string | undefined>();

  useEffect(() => {
    if (params.strategy && STRATEGY_LABELS[params.strategy]) setStrategy(params.strategy);
    if (params.timeframe && TFS.some((t) => t.key === params.timeframe)) setTf(params.timeframe);
    setHi(params.symbol);
  }, [params.strategy, params.timeframe, params.symbol]);

  const q = useCached<{ items: Setup[]; generated_at: string }>(["setups", strategy, tf], `/setups?strategy=${strategy}&timeframe=${tf}`);
  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    const list = side === "all" ? all : all.filter((i) => i.status === "ok" && i.side === side);
    if (!hi) return list;
    return [...list].sort((a, b) => (a.symbol === hi ? -1 : b.symbol === hi ? 1 : 0));
  }, [q.data, side, hi]);
  const readyN = (q.data?.items ?? []).filter((i) => i.ready).length;

  return (
    <View style={s.root} testID="setups-screen">
      <ScreenHeader
        title="Setups"
        subtitle={
          <Text style={s.sub} testID="setups-ready-summary">
            {readyN} ready · {STRATEGY_LABELS[strategy]} · {TFS.find((t) => t.key === tf)?.label}
          </Text>
        }
        right={
          <>
            <IconButton icon="playlist-plus" testID="header-watchlist-button" onPress={() => router.push("/watchlist")} />
            <AlertsBell />
          </>
        }
      />
      <View style={s.sticky}>
        <ChipRow options={STRATS} value={strategy} onChange={setStrategy} testPrefix="strategy-chip" />
        <ChipRow options={TFS} value={tf} onChange={setTf} testPrefix="timeframe-chip" />
        <Segmented options={SIDES} value={side} onChange={setSide} testPrefix="side-filter" />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[s.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
        ListHeaderComponent={
          q.data ? (
            <View style={{ marginBottom: 8 }}>
              <UpdatedLine at={q.data._savedAt ?? q.data.generated_at} offline={q.data._offline && q.isError} />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <SetupCard
            item={item}
            index={index}
            highlight={item.symbol === hi}
            onPress={() => router.push({ pathname: "/setup/[id]", params: { id: item.id, strategy, timeframe: tf } })}
          />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={s.loading} testID="setups-loading">
              <ActivityIndicator color={colors.brand} />
              <Text style={s.loadingText}>Checking your watchlist…</Text>
            </View>
          ) : q.isError && !q.data ? (
            <Empty icon="wifi-off" title="Couldn't load setups" body={(q.error as Error).message} testID="setups-error" />
          ) : (
            <Empty
              icon="crosshairs-question"
              title={side === "all" ? "Your watchlist is empty" : `No ${side} setups right now`}
              body={side === "all" ? "Add stocks or crypto to start scanning for setups." : "Try another strategy or timeframe."}
              testID="setups-empty"
            >
              {side === "all" && (
                <Pressy testID="setups-empty-add-button" onPress={() => router.push("/watchlist")} style={s.addBtn}>
                  <Text style={s.addText}>Add symbols</Text>
                </Pressy>
              )}
            </Empty>
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  sub: { fontFamily: fonts.semibold, fontSize: 12, color: c.muted, marginTop: 2 },
  sticky: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 4 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  loading: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  addBtn: { marginTop: 12, backgroundColor: c.brandPrimary, height: 44, paddingHorizontal: 20, borderRadius: 12, justifyContent: "center" },
  addText: { fontFamily: fonts.heavy, fontSize: 14, color: c.onBrandPrimary },
}));
