import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Empty } from "@/src/components/Bits";
import { ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useCached } from "@/src/cache";
import { fmtPrice, MARKET_LABEL, timeAgo } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export type PriceAlertT = {
  id: string;
  item_id: string;
  symbol: string;
  market: string;
  currency: string;
  condition: "above" | "below";
  target: number;
  active: boolean;
  triggered_at?: string | null;
  triggered_price?: number | null;
  created_at: string;
};

export function usePriceAlerts() {
  return useCached<{ items: PriceAlertT[] }>(["price-alerts"], "/price-alerts", { refetchInterval: 60_000 });
}

export function PriceAlertRow({ a, index, onPress }: { a: PriceAlertT; index: number; onPress?: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api(`/price-alerts/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Price alert deleted", "info");
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const up = a.condition === "above";
  return (
    <Pressy testID={`price-alert-row-${index}`} onPress={onPress} disabled={!onPress} style={[s.row, !a.active && s.done]}>
      <View style={[s.ic, { backgroundColor: up ? colors.successSoft : colors.errorSoft }]}>
        <Icon name={up ? "arrow-up-bold" : "arrow-down-bold"} size={18} color={up ? colors.success : colors.error} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.top}>
          <Text style={s.sym}>{a.symbol}</Text>
          <Text style={s.mkt}>{MARKET_LABEL[a.market]}</Text>
        </View>
        <Text style={s.cond}>
          {up ? "Rises above " : "Falls below "}
          <Text style={s.target}>{fmtPrice(a.target, a.currency)}</Text>
        </Text>
        <Text style={s.meta}>
          {a.active ? `Watching · set ${timeAgo(a.created_at)}` : `Fired at ${fmtPrice(a.triggered_price, a.currency)} · ${timeAgo(a.triggered_at)}`}
        </Text>
      </View>
      <Pressy testID={`price-alert-delete-${index}`} onPress={() => del.mutate()} hitSlop={6} style={s.del}>
        <Icon name="delete-outline" size={20} color={colors.muted} />
      </Pressy>
    </Pressy>
  );
}

export default function PriceAlerts() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = usePriceAlerts();
  const sections = useMemo(() => {
    const items = q.data?.items ?? [];
    return [
      { title: "Active", data: items.filter((i) => i.active) },
      { title: "Fired", data: items.filter((i) => !i.active) },
    ].filter((x) => x.data.length);
  }, [q.data]);

  return (
    <View style={s.root} testID="price-alerts-screen">
      <ScreenHeader back title="Price alerts" />
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
        renderSectionHeader={({ section }) => <Text style={s.sect}>{section.title}</Text>}
        renderItem={({ item, index }) => (
          <PriceAlertRow a={item} index={index} onPress={() => router.push({ pathname: "/setup/[id]", params: { id: item.item_id } })} />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 48 }} />
          ) : (
            <Empty icon="bell-plus-outline" title="No price alerts yet" body="Open any symbol's setup and tap 'Price alert' to get notified when it crosses your level." testID="price-alerts-empty" />
          )
        }
        ListFooterComponent={
          <Text style={s.foot}>Crypto is checked every minute. Stocks are checked against the latest daily close (free data plan).</Text>
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16 },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 16, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  done: { opacity: 0.65 },
  ic: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: 6 },
  sym: { fontFamily: fonts.heavy, fontSize: 14, color: c.onSurface },
  mkt: { fontFamily: fonts.bold, fontSize: 10, color: c.muted },
  cond: { fontFamily: fonts.regular, fontSize: 13, color: c.onSurfaceTertiary, marginTop: 2 },
  target: { fontFamily: fonts.monoBold, color: c.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: c.faint, marginTop: 2 },
  del: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  foot: { fontFamily: fonts.regular, fontSize: 11.5, color: c.faint, textAlign: "center", marginTop: 16, lineHeight: 17 },
}));
