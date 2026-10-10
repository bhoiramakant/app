import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Segmented } from "@/src/components/Chips";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { fmtPrice } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export type PriceAlertTarget = { id: string; symbol: string; currency: string; price: number | null };

const round = (v: number) => (v < 1 ? Number(v.toFixed(6)) : v < 100 ? Number(v.toFixed(2)) : Math.round(v * 100) / 100);

export function PriceAlertSheet({ target, onClose }: { target: PriceAlertTarget | null; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [cond, setCond] = useState("above");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const price = target?.price ?? null;

  useEffect(() => {
    if (!target) return;
    setCond("above");
    setErr(null);
    setText(price ? String(round(price * 1.05)) : "");
  }, [target, price]);

  const create = useMutation({
    mutationFn: (body: { item_id: string; condition: string; target: number }) => api("/price-alerts", { method: "POST", body }),
    onSuccess: () => {
      toast(`Alert set: ${target?.symbol} ${cond} ${fmtPrice(Number(text), target?.currency)}`, "success");
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
      onClose();
    },
    onError: (e) => setErr((e as Error).message),
  });

  const submit = () => {
    const v = Number(text.replace(/,/g, ""));
    if (!target) return;
    if (!v || v <= 0) return setErr("Enter a price greater than 0");
    if (price !== null && cond === "above" && v <= price) return setErr("For 'above', pick a price higher than now");
    if (price !== null && cond === "below" && v >= price) return setErr("For 'below', pick a price lower than now");
    setErr(null);
    create.mutate({ item_id: target.id, condition: cond, target: v });
  };

  const quick = cond === "above" ? [1, 2, 5, 10] : [-1, -2, -5, -10];

  return (
    <Modal visible={!!target} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {target && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Animated.View entering={FadeIn.duration(160)} style={s.backdrop}>
            <Pressable style={{ flex: 1 }} onPress={onClose} testID="price-alert-backdrop" />
          </Animated.View>
          <Animated.View entering={SlideInDown.duration(240)} style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} testID="price-alert-sheet">
            <View style={s.grab} />
            <Text style={s.title}>Price alert · {target.symbol}</Text>
            <Text style={s.sub}>Now {fmtPrice(price, target.currency)}. We&apos;ll notify you once when it crosses your price.</Text>
            <View style={{ marginHorizontal: -16, marginTop: 12 }}>
              <Segmented
                options={[
                  { key: "above", label: "Rises above" },
                  { key: "below", label: "Falls below" },
                ]}
                value={cond}
                onChange={(k) => {
                  setCond(k);
                  setErr(null);
                  if (price) setText(String(round(price * (k === "above" ? 1.05 : 0.95))));
                }}
                testPrefix="price-alert-condition"
              />
            </View>
            <View style={s.inputWrap}>
              <Text style={s.cur}>{target.currency === "INR" ? "₹" : "$"}</Text>
              <TextInput
                testID="price-alert-target-input"
                style={s.input}
                value={text}
                onChangeText={(t) => {
                  setText(t.replace(/[^0-9.]/g, ""));
                  setErr(null);
                }}
                keyboardType="decimal-pad"
                placeholder="Target price"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </View>
            {price !== null && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quick} keyboardShouldPersistTaps="handled">
                {quick.map((q) => (
                  <Pressy key={q} testID={`price-alert-quick-${q}`} onPress={() => setText(String(round(price * (1 + q / 100))))} style={s.qchip}>
                    <Text style={s.qtext}>
                      {q > 0 ? "+" : ""}
                      {q}%
                    </Text>
                  </Pressy>
                ))}
              </ScrollView>
            )}
            <Text style={s.err} testID="price-alert-error">
              {err ?? " "}
            </Text>
            <Pressy testID="price-alert-create-button" haptic disabled={create.isPending} onPress={submit} style={s.cta}>
              {create.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>Create alert</Text>}
            </Pressy>
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay },
  sheet: {
    marginTop: "auto",
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginBottom: 16 },
  title: { fontFamily: fonts.heavy, fontSize: 19, color: c.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, marginTop: 4, lineHeight: 19 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 14,
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  cur: { fontFamily: fonts.monoBold, fontSize: 20, color: c.muted, marginRight: 8 },
  input: { flex: 1, fontFamily: fonts.monoBold, fontSize: 20, color: c.onSurface, height: 56 },
  quick: { gap: 8, paddingTop: 12 },
  qchip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, justifyContent: "center" },
  qtext: { fontFamily: fonts.bold, fontSize: 13, color: c.onSurfaceTertiary },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: c.error, marginTop: 8 },
  cta: { height: 52, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
}));
