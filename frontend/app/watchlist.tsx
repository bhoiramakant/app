import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Empty } from "@/src/components/Bits";
import { ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useCached } from "@/src/cache";
import { MARKET_LABEL } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Item = { id: string; symbol: string; market: string; name: string };
type Result = { symbol: string; market: string; name: string; cg_id?: string | null; custom?: boolean };

function useDebounced(v: string, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function Watchlist() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const query = useDebounced(text.trim());
  const wl = useCached<{ items: Item[] }>(["watchlist"], "/watchlist");
  const items = wl.data?.items ?? [];
  const search = useQuery({
    queryKey: ["search", query],
    enabled: query.length > 0,
    queryFn: () => api<{ items: Result[] }>(`/symbols/search?q=${encodeURIComponent(query)}`),
  });

  const refresh = () => {
    ["watchlist", "setups", "dashboard", "news"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const add = useMutation({
    mutationFn: (r: Result) => api("/watchlist", { method: "POST", body: { symbol: r.symbol, market: r.market, name: r.name, cg_id: r.cg_id } }),
    onSuccess: (_d, r) => {
      toast(`${r.symbol} added to watchlist`, "success");
      refresh();
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const remove = useMutation({
    mutationFn: (it: Item) => api(`/watchlist/${it.id}`, { method: "DELETE" }),
    onSuccess: (_d, it) => {
      toast(`${it.symbol} removed`, "info");
      refresh();
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const have = new Set(items.map((i) => `${i.symbol}:${i.market}`));

  return (
    <View style={s.root} testID="watchlist-screen">
      <ScreenHeader back title="Watchlist" subtitle={<Text style={s.sub}>{items.length} symbols · swipe left to remove</Text>} />
      <View style={s.searchWrap}>
        <Icon name="magnify" size={20} color={colors.muted} />
        <TextInput
          testID="watchlist-search-input"
          style={s.search}
          placeholder="Search stocks or crypto (e.g. MSFT, HDFCBANK, DOGE)"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!text && (
          <Pressy testID="watchlist-search-clear" onPress={() => setText("")} hitSlop={8}>
            <Icon name="close-circle" size={18} color={colors.muted} />
          </Pressy>
        )}
      </View>
      {query ? (
        <FlatList
          data={search.data?.items ?? []}
          keyExtractor={(r) => `${r.symbol}:${r.market}:${r.cg_id ?? ""}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={search.isLoading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} /> : <Empty icon="magnify-close" title="No matches" testID="watchlist-search-empty" />}
          renderItem={({ item: r }) => {
            const added = have.has(`${r.symbol}:${r.market}`);
            return (
              <View style={s.row} testID={`search-result-${r.symbol.toLowerCase()}-${r.market.toLowerCase()}`}>
                <View style={{ flex: 1 }}>
                  <View style={s.symRow}>
                    <Text style={s.sym}>{r.symbol}</Text>
                    <View style={s.mkt}>
                      <Text style={s.mktText}>{MARKET_LABEL[r.market]}</Text>
                    </View>
                  </View>
                  <Text style={s.name} numberOfLines={1}>
                    {r.custom ? `Add any ${r.market === "US" ? "US" : "BSE"} ticker` : r.name}
                  </Text>
                </View>
                <Pressy
                  testID={`add-symbol-${r.symbol.toLowerCase()}-${r.market.toLowerCase()}`}
                  haptic
                  disabled={added || add.isPending}
                  onPress={() => add.mutate(r)}
                  style={[s.addBtn, added && s.addedBtn]}
                >
                  <Icon name={added ? "check" : "plus"} size={18} color={added ? colors.success : colors.onBrandPrimary} />
                </Pressy>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={<Empty icon="playlist-plus" title="Your watchlist is empty" body="Search above to add US stocks, Indian stocks or crypto." testID="watchlist-empty" />}
          renderItem={({ item }) => <SwipeRow item={item} onRemove={() => remove.mutate(item)} />}
        />
      )}
    </View>
  );
}

function SwipeRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const ref = useRef<any>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableOpen={(dir) => {
        if (dir === "left" || dir === "right") onRemove();
      }}
      renderRightActions={() => (
        <View style={s.swipeAction}>
          <Icon name="delete-outline" size={22} color={colors.onError} />
          <Text style={s.swipeText}>Remove</Text>
        </View>
      )}
    >
      <View style={s.row} testID={`watchlist-row-${item.symbol.toLowerCase()}`}>
        <View style={{ flex: 1 }}>
          <View style={s.symRow}>
            <Text style={s.sym}>{item.symbol}</Text>
            <View style={s.mkt}>
              <Text style={s.mktText}>{MARKET_LABEL[item.market]}</Text>
            </View>
          </View>
          <Text style={s.name} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Pressy testID={`remove-symbol-${item.symbol.toLowerCase()}`} onPress={onRemove} hitSlop={6} style={s.trash}>
          <Icon name="delete-outline" size={20} color={colors.muted} />
        </Pressy>
      </View>
    </ReanimatedSwipeable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  sub: { fontFamily: fonts.semibold, fontSize: 12, color: c.muted, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  search: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface, height: 48 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 8,
  },
  symRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sym: { fontFamily: fonts.heavy, fontSize: 15, color: c.onSurface },
  mkt: { backgroundColor: c.surfaceTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mktText: { fontFamily: fonts.heavy, fontSize: 10, color: c.muted },
  name: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  addedBtn: { backgroundColor: c.successSoft },
  trash: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  swipeAction: { backgroundColor: c.error, borderRadius: 14, marginBottom: 8, marginLeft: 8, width: 96, alignItems: "center", justifyContent: "center", gap: 2 },
  swipeText: { fontFamily: fonts.bold, fontSize: 11, color: c.onError },
}));
