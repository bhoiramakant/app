import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Kind = "info" | "error" | "success";
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();

  const show = useCallback((msg: string, kind: Kind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const icon = toast?.kind === "error" ? "alert-circle-outline" : toast?.kind === "success" ? "check-circle-outline" : "information-outline";
  const tint = toast?.kind === "error" ? colors.error : toast?.kind === "success" ? colors.success : colors.brand;

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(160)}
          style={[s.toast, { bottom: insets.bottom + 88 }]}
          pointerEvents="none"
          testID="toast-message"
        >
          <View style={s.row}>
            <Icon name={icon} size={18} color={tint} />
            <Text style={s.text}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const useStyles = makeStyles((c) => ({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurface, flex: 1 },
}));
