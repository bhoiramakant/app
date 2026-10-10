// Notification permission flow + tap routing. Mounted once inside AuthProvider.
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { getPushPermission, pushSupported, registerDevice, requestAndRegister } from "@/src/push";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const PROMPTED_KEY = "pushPromptedAt";
const NUDGE_KEY = "pushNudgeAt";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function PushManager() {
  const { status, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<"ask" | "settings" | null>(null);
  const pending = useRef<string | null>(null);

  const go = (url?: string) => {
    if (!url) return;
    if (url.startsWith("http")) Linking.openURL(url);
    else router.push(url as any);
  };

  // Tap handlers (warm + cold start). Routes wait until the app is unlocked.
  useEffect(() => {
    if (!pushSupported) return;
    const handle = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const data = (r.notification.request.content.data || {}) as Record<string, string>;
      const url = data.deeplink || data.action_url;
      if (url) pending.current = url;
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handle(r);
      if (status === "unlocked" && pending.current) {
        go(pending.current);
        pending.current = null;
      }
    });
    Notifications.getLastNotificationResponseAsync().then(handle);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "unlocked" || !user || !pushSupported) return;
    if (pending.current) {
      go(pending.current);
      pending.current = null;
    }
    (async () => {
      const p = await getPushPermission();
      if (p.status === "granted") return registerDevice(user.id); // re-register every open (tokens rotate)
      if (p.status === "undetermined" || (p.status === "denied" && p.canAskAgain)) {
        const asked = await storage.getItem(PROMPTED_KEY, 0);
        if (!asked || (p.status === "denied" && Date.now() - Number(asked) > WEEK)) setSheet("ask");
        return;
      }
      const lastNudge = await storage.getItem(NUDGE_KEY, 0);
      if (!lastNudge || Date.now() - Number(lastNudge) > WEEK) setSheet("settings");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  const close = async (key: string) => {
    await storage.setItem(key, Date.now());
    setSheet(null);
  };

  return (
    <Modal visible={!!sheet} transparent animationType="none" onRequestClose={() => close(sheet === "ask" ? PROMPTED_KEY : NUDGE_KEY)} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(160)} style={s.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => close(sheet === "ask" ? PROMPTED_KEY : NUDGE_KEY)} />
        </Animated.View>
        <Animated.View entering={SlideInDown.duration(240)} style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} testID="push-permission-sheet">
          <View style={s.ic}>
            <Icon name="bell-ring-outline" size={30} color={colors.brand} />
          </View>
          <Text style={s.title}>{sheet === "ask" ? "Get told when setups are ready" : "Notifications are off"}</Text>
          <Text style={s.body}>
            {sheet === "ask"
              ? "We'll notify you when the AI agent spots a ready setup or one of your price alerts fires, even when the app is closed."
              : "Turn on notifications in your phone settings to get agent and price alerts while the app is closed."}
          </Text>
          <Pressy
            testID="push-permission-allow-button"
            haptic
            style={s.cta}
            onPress={async () => {
              if (sheet === "ask") {
                await storage.setItem(PROMPTED_KEY, Date.now());
                setSheet(null);
                if (user) await requestAndRegister(user.id);
              } else {
                await close(NUDGE_KEY);
                Linking.openSettings();
              }
            }}
          >
            <Text style={s.ctaText}>{sheet === "ask" ? "Turn on notifications" : "Open Settings"}</Text>
          </Pressy>
          <Pressy testID="push-permission-later-button" style={s.ghost} onPress={() => close(sheet === "ask" ? PROMPTED_KEY : NUDGE_KEY)}>
            <Text style={s.ghostText}>Not now</Text>
          </Pressy>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  ic: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontFamily: fonts.heavy, fontSize: 19, color: c.onSurface, textAlign: "center" },
  body: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, textAlign: "center", lineHeight: 19, marginBottom: 8 },
  cta: { alignSelf: "stretch", height: 52, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
  ghost: { alignSelf: "stretch", height: 48, alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: fonts.bold, fontSize: 14, color: c.muted },
}));
