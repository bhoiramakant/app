import React, { createContext, useContext, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { brokersFor, openBroker, TradeItem } from "@/src/trade";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const Ctx = createContext<(it: TradeItem) => void>(() => {});
export const useTradeSheet = () => useContext(Ctx);

export function TradeSheetProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<TradeItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const s = useStyles();
  const { colors } = useTheme();
  const close = () => setItem(null);

  return (
    <Ctx.Provider value={setItem}>
      {children}
      <Modal visible={!!item} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        {item && (
          <View style={{ flex: 1 }}>
            <Animated.View entering={FadeIn.duration(160)} style={s.backdrop}>
              <Pressable style={{ flex: 1 }} onPress={close} testID="trade-sheet-backdrop" />
            </Animated.View>
            <Animated.View
              entering={SlideInDown.duration(260)}
              style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
              testID="trade-sheet"
            >
              <View style={s.grab} />
              <Text style={s.title} testID="trade-sheet-title">
                Trade {item.symbol}
              </Text>
              <Text style={s.sub}>Choose where to open this setup</Text>
              {brokersFor(item).map((b) => (
                <Pressy
                  key={b.key}
                  testID={`trade-option-${b.key}`}
                  haptic
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(b.key);
                    try {
                      const r = await openBroker(b, item);
                      if (r === "store") toast(`${b.name} isn't installed. Opening Play Store`, "info");
                      if (r !== "store") close();
                    } catch {
                      toast(`Couldn't open ${b.name}`, "error");
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={s.app}
                >
                  <View style={[s.logo, { backgroundColor: b.bg }]}>
                    <Text style={[s.logoText, { color: b.fg }]}>{b.badge}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{b.name}</Text>
                    <Text style={s.hint}>{b.hint(item)}</Text>
                  </View>
                  <View style={s.go}>
                    <Text style={s.goText}>{busy === b.key ? "OPENING…" : "OPEN"}</Text>
                    <Icon name="arrow-top-right" size={14} color={colors.brand} />
                  </View>
                </Pressy>
              ))}
              <Text style={s.note}>Not installed? We&apos;ll take you to the Play Store.</Text>
              <Text style={s.disclaimer} testID="trade-sheet-disclaimer">
                For analysis only · not financial advice
              </Text>
            </Animated.View>
          </View>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: c.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
  sub: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, marginTop: 2, marginBottom: 16 },
  app: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: c.surfaceTertiary,
    marginBottom: 8,
  },
  logo: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  logoText: { fontFamily: fonts.heavy, fontSize: 13 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  go: { flexDirection: "row", alignItems: "center", gap: 2 },
  goText: { fontFamily: fonts.heavy, fontSize: 11, color: c.brand, letterSpacing: 0.5 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, textAlign: "center", marginTop: 8 },
  disclaimer: { fontFamily: fonts.semibold, fontSize: 11, color: c.faint, textAlign: "center", marginTop: 4 },
}));
