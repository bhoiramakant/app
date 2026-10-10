import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { biometricAvailable } from "@/src/biometric";
import { ScreenHeader } from "@/src/components/Header";
import { Icon, IconName } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { getPushPermission, pushSupported, requestAndRegister } from "@/src/push";
import { fonts, makeStyles, useTheme } from "@/src/theme";

function Row({ icon, label, sub, onPress, right, testID, danger }: { icon: IconName; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; testID: string; danger?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={onPress} disabled={!onPress} style={s.row}>
      <Icon name={icon} size={20} color={danger ? colors.error : colors.onSurfaceTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.label, danger && { color: colors.error }]}>{label}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {right ?? (onPress && <Icon name="chevron-right" size={20} color={colors.faint} />)}
    </Pressy>
  );
}

export default function Settings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, bioEnabled, setBioEnabled, lock, signOut } = useAuth();
  const [canBio, setCanBio] = useState(false);
  const [perm, setPerm] = useState<{ status: string; canAskAgain: boolean } | null>(null);

  useEffect(() => {
    biometricAvailable().then(setCanBio);
    getPushPermission().then(setPerm);
  }, []);

  const pushSub = !pushSupported
    ? "Available in the Android app (published build)"
    : perm?.status === "granted"
      ? "On · agent alerts and price alerts"
      : "Off · tap to turn on";
  const onPushPress = async () => {
    if (perm?.status === "granted") return toast("Notifications are already on", "success");
    if (perm?.canAskAgain && user) {
      const st = await requestAndRegister(user.id);
      setPerm(await getPushPermission());
      if (st === "granted") toast("Notifications are on", "success");
      return;
    }
    Linking.openSettings();
  };

  return (
    <View style={s.root} testID="settings-screen">
      <ScreenHeader back title="Settings" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.sect}>Account</Text>
        <View style={s.group}>
          <Row icon="account-circle-outline" label={user?.email ?? "—"} sub="Watchlist and alerts sync to this account" testID="settings-account-row" />
        </View>

        <Text style={s.sect}>Security</Text>
        <View style={s.group}>
          <Row
            icon="fingerprint"
            label="Fingerprint unlock"
            sub={canBio ? "Unlock with your fingerprint, PIN as backup" : "Not available on this device"}
            testID="settings-biometric-row"
            right={
              <Switch
                testID="settings-biometric-switch"
                value={bioEnabled}
                disabled={!canBio}
                onValueChange={async (v) => {
                  await setBioEnabled(v);
                  toast(v ? "Fingerprint unlock is on" : "Fingerprint unlock is off", "success");
                }}
                trackColor={{ true: colors.brand, false: colors.surfaceTertiary }}
                thumbColor={colors.onSurface}
              />
            }
          />
          <Row icon="dialpad" label="Change PIN" testID="settings-change-pin-row" onPress={() => router.push("/change-pin")} />
          <Row icon="lock-outline" label="Lock now" sub="Auto-locks 30s after leaving the app" testID="settings-lock-row" onPress={lock} />
        </View>

        <Text style={s.sect}>Notifications</Text>
        <View style={s.group}>
          <Row
            icon="bell-ring-outline"
            label="Push notifications"
            sub={pushSub}
            testID="settings-notifications-row"
            onPress={pushSupported ? onPushPress : undefined}
          />
        </View>

        <Text style={s.sect}>Markets</Text>
        <View style={s.group}>
          <Row icon="playlist-edit" label="Manage watchlist" testID="settings-watchlist-row" onPress={() => router.push("/watchlist")} />
          <Row icon="tune-variant" label="Strategy rules" sub="Super Trend, MA lengths, RSI levels" testID="settings-strategy-row" onPress={() => router.push("/strategy-settings")} />
          <Row icon="bell-plus-outline" label="Price alerts" sub="Get told when a symbol crosses your price" testID="settings-price-alerts-row" onPress={() => router.push("/price-alerts")} />
          <Row icon="database-outline" label="Data sources" sub="Stocks: Alpha Vantage (refreshed daily) · Crypto: CoinGecko (live)" testID="settings-data-row" />
        </View>

        <Text style={s.sect}>Session</Text>
        <View style={s.group}>
          <Row icon="logout" label="Sign out" danger testID="settings-sign-out-row" onPress={signOut} />
        </View>

        <Text style={s.disclaimer} testID="settings-disclaimer">
          SmartTradeLens is for analysis only and isn&apos;t financial advice. Signals come from technical rules and AI summaries and can be wrong. Always do your own research.
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16 },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  group: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 56, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider },
  label: { fontFamily: fonts.bold, fontSize: 14, color: c.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  disclaimer: { fontFamily: fonts.regular, fontSize: 12, color: c.faint, lineHeight: 18, marginTop: 24, textAlign: "center" },
}));
