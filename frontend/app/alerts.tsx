import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AlertItem, AlertT } from "@/src/components/AlertItem";
import { Empty } from "@/src/components/Bits";
import { ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useCached } from "@/src/cache";
import { fmtClock } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type AlertsData = { items: AlertT[]; last_scan?: string; scan_times: string[]; unread: number };

export default function Alerts() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useCached<AlertsData>(["alerts"], "/alerts");
  const wl = useCached<{ items: { id: string; symbol: string; market: string }[] }>(["watchlist"], "/watchlist");

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const readAll = useMutation({ mutationFn: () => api("/alerts/read-all", { method: "POST" }), onSuccess: refreshAll });
  const scan = useMutation({
    mutationFn: () => api<{ new_alerts: number }>("/agent/scan", { method: "POST" }),
    onSuccess: (r) => {
      toast(r.new_alerts ? `${r.new_alerts} new alert${r.new_alerts > 1 ? "s" : ""}` : "No new changes since the last scan", "success");
      refreshAll();
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const sections = useMemo(() => {
    const items = q.data?.items ?? [];
    const today = new Date().toDateString();
    const yest = new Date(Date.now() - 86400000).toDateString();
    const groups: Record<string, AlertT[]> = {};
    for (const a of items) {
      const d = new Date(a.created_at).toDateString();
      const k = d === today ? "Today" : d === yest ? "Yesterday" : "Earlier";
      (groups[k] ||= []).push(a);
    }
    return ["Today", "Yesterday", "Earlier"].filter((k) => groups[k]).map((k) => ({ title: k, data: groups[k] }));
  }, [q.data]);

  const open = (a: AlertT) => {
    if (!a.read) api(`/alerts/${a.id}/read`, { method: "POST" }).then(refreshAll).catch(() => {});
    const item = wl.data?.items.find((w) => w.symbol === a.symbol && w.market === a.market);
    if (item) router.push({ pathname: "/setup/[id]", params: { id: item.id, strategy: a.strategy, timeframe: a.timeframe } });
    else toast(`${a.symbol} is no longer in your watchlist`, "info");
  };

  return (
    <View style={s.root} testID="alerts-screen">
      <ScreenHeader
        back
        title="Alerts"
        right={
          !!q.data?.unread && (
            <Pressy testID="alerts-mark-all-read-button" onPress={() => readAll.mutate()} hitSlop={8} style={s.markBtn}>
              <Text style={s.mark}>Mark all read</Text>
            </Pressy>
          )
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
        ListHeaderComponent={
          <View style={s.agent} testID="agent-card">
            <View style={s.agentIc}>
              <Icon name="robot-outline" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.agentTitle}>AI Setup Agent</Text>
              <Text style={s.agentSub}>Last scan {fmtClock(q.data?.last_scan)}</Text>
            </View>
            <Pressy testID="agent-scan-now-button" haptic disabled={scan.isPending} onPress={() => scan.mutate()} style={s.scanBtn}>
              {scan.isPending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={s.scanText}>Scan now</Text>}
            </Pressy>
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={s.sect}>{section.title}</Text>}
        renderItem={({ item, index }) => <AlertItem a={item} index={index} onPress={() => open(item)} />}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 48 }} />
          ) : (
            <Empty icon="bell-sleep-outline" title="No alerts yet" body="The agent writes alerts when a setup becomes ready or is about to form." testID="alerts-empty" />
          )
        }
        ListFooterComponent={
          <Text style={s.footer} testID="agent-schedule">
            Agent scans: {(q.data?.scan_times ?? ["08:30", "13:00", "19:30"]).join(" · ")} IST
          </Text>
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  markBtn: { height: 44, justifyContent: "center" },
  mark: { fontFamily: fonts.bold, fontSize: 13, color: c.brand },
  agent: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  agentIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  agentTitle: { fontFamily: fonts.bold, fontSize: 14, color: c.onSurface },
  agentSub: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  scanBtn: { height: 40, minWidth: 92, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  scanText: { fontFamily: fonts.heavy, fontSize: 13, color: c.onBrandPrimary },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 10 },
  footer: { fontFamily: fonts.regular, fontSize: 12, color: c.faint, textAlign: "center", marginTop: 16 },
}));
