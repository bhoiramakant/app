import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getPinLength, useAuth } from "@/src/auth";
import { biometricAvailable } from "@/src/biometric";
import { Icon } from "@/src/components/Icon";
import { PinDots, PinPad, useShake } from "@/src/components/PinPad";
import { Pressy } from "@/src/components/Pressy";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function Unlock() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { bioEnabled, unlockWithBiometric, unlockWithPin, signOut, user } = useAuth();
  const [len, setLen] = useState(4);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [canBio, setCanBio] = useState(false);
  const { style, shake } = useShake();

  const tryBio = useCallback(() => {
    unlockWithBiometric();
  }, [unlockWithBiometric]);

  useEffect(() => {
    getPinLength().then(setLen);
    biometricAvailable().then((ok) => {
      setCanBio(ok && bioEnabled);
      if (ok && bioEnabled) tryBio();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDigit = async (d: string) => {
    if (pin.length >= len) return;
    setErr(null);
    const next = pin + d;
    setPin(next);
    if (next.length === len) {
      const ok = await unlockWithPin(next);
      if (!ok) {
        shake();
        setTries((t) => t + 1);
        setErr("Wrong PIN. Try again.");
        setTimeout(() => setPin(""), 400);
      }
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]} testID="unlock-screen">
      <View style={s.head}>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub} numberOfLines={1}>
          {canBio ? "Touch the sensor to unlock" : user?.email ?? "Enter your PIN to unlock"}
        </Text>
        {canBio && (
          <Pressy testID="unlock-biometric-button" onPress={tryBio} style={s.fp}>
            <Icon name="fingerprint" size={46} color={colors.brand} />
          </Pressy>
        )}
        <Text style={s.mini}>{canBio ? "or enter PIN" : "Enter PIN"}</Text>
        <PinDots length={len} filled={pin.length} error={!!err} style={style} />
        <Text style={s.err} testID="unlock-error">
          {err ?? " "}
        </Text>
      </View>
      <PinPad
        onDigit={onDigit}
        onBackspace={() => setPin(pin.slice(0, -1))}
        leftKey={canBio ? { icon: "fingerprint", onPress: tryBio, testID: "pin-key-biometric" } : null}
      />
      <Pressy testID="unlock-forgot-pin-button" onPress={signOut} style={s.forgot}>
        <Text style={[s.forgotText, tries >= 3 && { color: colors.brand }]}>Forgot PIN? Sign in again</Text>
      </Pressy>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, paddingHorizontal: 24, alignItems: "center" },
  head: { alignItems: "center", gap: 10, marginBottom: 20 },
  title: { fontFamily: fonts.heavy, fontSize: 22, color: c.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  fp: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: c.brand,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
    marginVertical: 8,
  },
  mini: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginBottom: 4 },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: c.error },
  forgot: { marginTop: "auto", height: 44, justifyContent: "center" },
  forgotText: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted },
}));
