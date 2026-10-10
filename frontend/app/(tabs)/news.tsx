import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Empty, UpdatedLine } from "@/src/components/Bits";
import { ChipRow } from "@/src/components/Chips";
import { AlertsBell, ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { Tag } from "@/src/components/SetupCard";
import { useCached } from "@/src/cache";
import { timeAgo } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Article = { i: number; symbol: string; title: string; source?: string; url?: string; published?: string; sentiment: string; reason: string };
type NewsData = {
  articles: Article[];
  fetched_at: string | null;
  mood: { label: string; summary: string; bullish: number; neutral: number; bearish: number } | null;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "Bullish", label: "Bullish" },
  { key: "Bearish", label: "Bearish" },
  { key: "Neutral", label: "Neutral" },
];

function Mood({ m }: { m: NonNullable<NewsData["mood"]> }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.mood} testID="news-mood-card">
      <Text style={s.moodKicker}>AI MARKET MOOD · WATCHLIST</Text>
      <Text style={s.moodLabel} testID="news-mood-label">
        {m.label}
      </Text>
      <Text style={s.moodSummary}>{m.summary}</Text>
      <View style={s.bar}>
        <View style={{ flex: m.bullish || 0.0001, backgroundColor: colors.success }} />
        <View style={{ flex: m.neutral || 0.0001, backgroundColor: colors.faint }} />
        <View style={{ flex: m.bearish || 0.0001, backgroundColor: colors.error }} />
      </View>
      <View style={s.barLegend}>
        <Text style={[s.barText, { color: colors.success }]}>{Math.round(m.bullish * 100)}% bullish</Text>
        <Text style={[s.barText, { color: colors.muted }]}>{Math.round(m.neutral * 100)}% neutral</Text>
        <Text style={[s.barText, { color: colors.error }]}>{Math.round(m.bearish * 100)}% bearish</Text>
      </View>
    </View>
  );
}

export default function News() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [filter, setFilter] = useState("all");
  const q = useCached<NewsData>(["news"], "/news");
  const arts = useMemo(
    () => (q.data?.articles ?? []).filter((a) => filter === "all" || a.sentiment === filter),
    [q.data, filter],
  );

  return (
    <View style={s.root} testID="news-screen">
      <ScreenHeader title="News" right={<AlertsBell />} />
      <View style={s.sticky}>
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} testPrefix="news-filter-chip" />
      </View>
      <FlatList
        data={arts}
        keyExtractor={(a) => String(a.i)}
        contentContainerStyle={[s.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surfaceSecondary} />}
        ListHeaderComponent={q.data?.mood ? <Mood m={q.data.mood} /> : null}
        renderItem={({ item, index }) => {
          const tone = item.sentiment === "Bullish" ? "bull" : item.sentiment === "Bearish" ? "bear" : "term";
          return (
            <Pressy
              testID={`news-item-${index}`}
              onPress={() => item.url && WebBrowser.openBrowserAsync(item.url).catch(() => {})}
              style={s.news}
            >
              <View style={s.newsTop}>
                <Tag text={`${item.sentiment.toUpperCase()} · ${item.symbol}`} tone={tone} />
                <Icon name="open-in-new" size={14} color={colors.faint} />
              </View>
              <Text style={s.headline}>{item.title}</Text>
              <Text style={s.reason}>
                <Text style={s.ai}>AI: </Text>
                {item.reason}
              </Text>
              <Text style={s.meta}>
                {item.source} · {timeAgo(item.published)}
              </Text>
            </Pressy>
          );
        }}
        ListFooterComponent={q.data?.fetched_at ? <UpdatedLine at={q.data.fetched_at} offline={q.data._offline && q.isError} /> : null}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={s.loading} testID="news-loading">
              <ActivityIndicator color={colors.brand} />
              <Text style={s.loadingText}>Reading headlines and scoring sentiment…</Text>
            </View>
          ) : (
            <Empty
              icon="newspaper-variant-outline"
              title={q.isError ? "Couldn't load news" : "No headlines yet"}
              body={q.isError ? (q.error as Error).message : "News refreshes a few times a day. Pull down to check again."}
              testID="news-empty"
            />
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  sticky: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  mood: { padding: 16, borderRadius: 16, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.brandBorder, marginBottom: 12 },
  moodKicker: { fontFamily: fonts.heavy, fontSize: 11, color: c.brand, letterSpacing: 0.6 },
  moodLabel: { fontFamily: fonts.heavy, fontSize: 20, color: c.onSurface, marginTop: 4 },
  moodSummary: { fontFamily: fonts.regular, fontSize: 12.5, color: c.onSurfaceTertiary, marginTop: 4, lineHeight: 18 },
  bar: { height: 8, borderRadius: 4, flexDirection: "row", overflow: "hidden", marginTop: 12 },
  barLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  barText: { fontFamily: fonts.semibold, fontSize: 11 },
  news: { padding: 14, backgroundColor: c.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  newsTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headline: { fontFamily: fonts.bold, fontSize: 14, color: c.onSurface, lineHeight: 20, marginVertical: 8 },
  reason: { fontFamily: fonts.regular, fontSize: 12.5, color: c.onSurfaceTertiary, lineHeight: 18 },
  ai: { fontFamily: fonts.heavy, color: c.brand },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: c.faint, marginTop: 6 },
  loading: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
}));
