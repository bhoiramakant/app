import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { biometricAvailable, promptBiometric } from "@/src/biometric";
import { Icon } from "@/src/components/Icon";
import { PinDots, PinPad, useShake } from "@/src/components/PinPad";
import { Pressy } from "@/src/components/Pressy";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function PinSetup() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { savePin, finishSetup } = useAuth();
  const [step, setStep] = useState<"create" | "confirm" | "bio">("create");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [bioOk, setBioOk] = useState(false);
  const { style, shake } = useShake();

  useEffect(() => {
    biometricAvailable().then(setBioOk);
  }, []);

  const afterPin = async () => {
    if (await biometricAvailable()) setStep("bio");
    else await finishSetup(false);
  };

  const onDigit = (d: string) => {
    setErr(null);
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (step === "confirm" && next.length === first.length) {
      if (next === first) {
        savePin(next).then(afterPin);
      } else {
        shake();
        setErr("PINs didn't match. Try again.");
        setTimeout(() => {
          setPin("");
          setFirst("");
          setStep("create");
        }, 600);
      }
    }
  };

  if (step === "bio") {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} testID="biometric-setup-screen">
        <View style={s.fp}>
          <Icon name="fingerprint" size={52} color={colors.brand} />
        </View>
        <Text style={s.title}>Unlock with fingerprint?</Text>
        <Text style={s.sub}>Open the app with a touch. Your PIN stays as the backup.</Text>
        <Pressy
          testID="enable-biometric-button"
          haptic
          onPress={async () => {
            const ok = await promptBiometric();
            await finishSetup(ok);
          }}
          style={s.cta}
        >
          <Text style={s.ctaText}>Enable fingerprint</Text>
        </Pressy>
        <Pressy testID="skip-biometric-button" onPress={() => finishSetup(false)} style={s.ghost}>
          <Text style={s.ghostText}>Not now</Text>
        </Pressy>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} testID="pin-setup-screen">
      <View style={s.head}>
        <Icon name="shield-lock-outline" size={36} color={colors.brand} />
        <Text style={s.title}>{step === "create" ? "Create a PIN" : "Confirm your PIN"}</Text>
        <Text style={s.sub}>
          {step === "create" ? "Choose 4 to 6 digits. You'll use it to unlock the app." : "Enter the same PIN again."}
        </Text>
        <PinDots length={step === "create" ? Math.max(4, Math.min(6, pin.length + (pin.length < 6 ? 1 : 0))) : first.length} filled={pin.length} error={!!err} style={[style, { marginTop: 24 }]} />
        <Text style={s.err} testID="pin-setup-error">
          {err ?? " "}
        </Text>
      </View>
      <PinPad onDigit={onDigit} onBackspace={() => setPin(pin.slice(0, -1))} />
      <View style={s.footer}>
        {step === "create" && (
          <Pressy
            testID="pin-continue-button"
            disabled={pin.length < 4}
            onPress={() => {
              setFirst(pin);
              setPin("");
              setStep("confirm");
            }}
            style={[s.cta, pin.length < 4 && s.ctaOff]}
          >
            <Text style={s.ctaText}>Continue</Text>
          </Pressy>
        )}
        {!bioOk && step === "create" && <Text style={s.hint}>Fingerprint unlock is available on supported phones.</Text>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, paddingHorizontal: 24 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  head: { alignItems: "center", gap: 8, marginBottom: 16 },
  title: { fontFamily: fonts.heavy, fontSize: 22, color: c.onSurface, textAlign: "center" },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, textAlign: "center", lineHeight: 19 },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: c.error, marginTop: 8 },
  fp: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: c.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: c.brandTertiary,
  },
  footer: { marginTop: "auto", gap: 8 },
  cta: { height: 52, alignSelf: "stretch", borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaOff: { opacity: 0.4 },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
  ghost: { height: 48, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: fonts.bold, fontSize: 14, color: c.muted },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: c.faint, textAlign: "center" },
}));
