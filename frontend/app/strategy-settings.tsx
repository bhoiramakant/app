import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/Header";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { useCached } from "@/src/cache";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Params = Record<string, number>;
type Data = { params: Params; defaults: Params; bounds: Record<string, [number, number]> };

const GROUPS: { title: string; icon: any; rows: { key: string; label: string; step: number; hint?: string }[] }[] = [
  {
    title: "Super Trend",
    icon: "chart-timeline-variant-shimmer",
    rows: [
      { key: "st_period", label: "ATR period", step: 1 },
      { key: "st_mult", label: "Multiplier", step: 0.5 },
    ],
  },
  {
    title: "RSI",
    icon: "speedometer",
    rows: [
      { key: "rsi_period", label: "RSI period", step: 1 },
      { key: "rsi_bull_lo", label: "Bullish zone · low", step: 5, hint: "Super Trend buy needs RSI inside the bullish zone" },
      { key: "rsi_bull_hi", label: "Bullish zone · high", step: 5 },
      { key: "rsi_bear_lo", label: "Bearish zone · low", step: 5, hint: "Super Trend sell needs RSI inside the bearish zone" },
      { key: "rsi_bear_hi", label: "Bearish zone · high", step: 5 },
    ],
  },
  {
    title: "Moving averages",
    icon: "chart-bell-curve-cumulative",
    rows: [
      { key: "ma_fast", label: "Fast MA length", step: 1 },
      { key: "ma_slow", label: "Slow MA length", step: 5 },
      { key: "ma_cross_bars", label: "Fresh cross within (bars)", step: 1 },
    ],
  },
  {
    title: "Option selling",
    icon: "shield-half-full",
    rows: [
      { key: "adx_max", label: "Max ADX (weak trend)", step: 1 },
      { key: "opt_rsi_lo", label: "Neutral RSI · low", step: 5 },
      { key: "opt_rsi_hi", label: "Neutral RSI · high", step: 5 },
    ],
  },
];

function Stepper({ k, label, hint, value, step, bounds, dirty, onChange }: { k: string; label: string; hint?: string; value: number; step: number; bounds: [number, number]; dirty: boolean; onChange: (v: number) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [lo, hi] = bounds;
  const set = (v: number) => onChange(Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)));
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {hint && <Text style={s.hint}>{hint}</Text>}
      </View>
      <Pressy testID={`param-${k}-minus`} onPress={() => set(value - step)} disabled={value <= lo} style={[s.step, value <= lo && s.off]}>
        <Icon name="minus" size={18} color={colors.onSurface} />
      </Pressy>
      <Text style={[s.val, dirty && { color: colors.brand }]} testID={`param-${k}-value`}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </Text>
      <Pressy testID={`param-${k}-plus`} onPress={() => set(value + step)} disabled={value >= hi} style={[s.step, value >= hi && s.off]}>
        <Icon name="plus" size={18} color={colors.onSurface} />
      </Pressy>
    </View>
  );
}

export default function StrategySettings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useCached<Data>(["strategy-settings"], "/settings/strategy");
  const [draft, setDraft] = useState<Params | null>(null);

  useEffect(() => {
    if (q.data && !draft) setDraft(q.data.params);
  }, [q.data, draft]);

  const save = useMutation({
    mutationFn: (params: Params) => api<Data>("/settings/strategy", { method: "PUT", body: { params } }),
    onSuccess: (d) => {
      qc.setQueryData(["strategy-settings"], d);
      ["setups", "setup", "dashboard", "chart"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast("Strategy rules saved. Setups re-checked with your rules", "success");
      router.back();
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const saved = q.data?.params;
  const changed = !!draft && !!saved && Object.keys(draft).some((k) => draft[k] !== saved[k]);
  const isDefault = !!draft && !!q.data && Object.keys(draft).every((k) => draft[k] === q.data!.defaults[k]);

  return (
    <View style={s.root} testID="strategy-settings-screen">
      <ScreenHeader
        back
        title="Strategy rules"
        right={
          q.data && !isDefault ? (
            <Pressy testID="strategy-reset-button" onPress={() => setDraft(q.data!.defaults)} hitSlop={8} style={{ height: 44, justifyContent: "center" }}>
              <Text style={s.reset}>Reset</Text>
            </Pressy>
          ) : null
        }
      />
      {!draft || !q.data ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}>
          <Text style={s.intro}>Tune the rules behind every checklist. Setups, charts and the AI agent all use your values.</Text>
          {GROUPS.map((g) => (
            <View key={g.title}>
              <View style={s.sectRow}>
                <Icon name={g.icon} size={16} color={colors.brand} />
                <Text style={s.sect}>{g.title}</Text>
              </View>
              <View style={s.group}>
                {g.rows.map((r) => (
                  <Stepper
                    key={r.key}
                    k={r.key}
                    label={r.label}
                    hint={r.hint}
                    step={r.step}
                    value={draft[r.key]}
                    bounds={q.data!.bounds[r.key]}
                    dirty={draft[r.key] !== saved?.[r.key]}
                    onChange={(v) => setDraft({ ...draft, [r.key]: v })}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      {draft && (
        <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressy testID="strategy-save-button" haptic disabled={!changed || save.isPending} onPress={() => save.mutate(draft)} style={[s.cta, !changed && s.off]}>
            {save.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>{changed ? "Save rules" : "No changes"}</Text>}
          </Pressy>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16 },
  intro: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, lineHeight: 19, marginTop: 4 },
  reset: { fontFamily: fonts.bold, fontSize: 13, color: c.brand },
  sectRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 8 },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  group: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.divider },
  label: { fontFamily: fonts.bold, fontSize: 14, color: c.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: c.muted, marginTop: 2 },
  step: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  val: { fontFamily: fonts.monoBold, fontSize: 15, color: c.onSurface, minWidth: 40, textAlign: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
  cta: { height: 52, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
}));
