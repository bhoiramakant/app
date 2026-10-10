import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { ScreenHeader } from "@/src/components/Header";
import { PinDots, PinPad, useShake } from "@/src/components/PinPad";
import { Pressy } from "@/src/components/Pressy";
import { useToast } from "@/src/components/Toast";
import { fonts, makeStyles } from "@/src/theme";

export default function ChangePin() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { checkPin, savePin } = useAuth();
  const [step, setStep] = useState<"current" | "new" | "confirm">("current");
  const [pin, setPin] = useState("");
  const [fresh, setFresh] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { style, shake } = useShake();

  const fail = (msg: string) => {
    shake();
    setErr(msg);
    setTimeout(() => setPin(""), 400);
  };

  const onDigit = async (d: string) => {
    if (pin.length >= 6) return;
    setErr(null);
    const next = pin + d;
    setPin(next);
    if (step === "confirm" && next.length === fresh.length) {
      if (next !== fresh) return fail("PINs didn't match");
      await savePin(next);
      toast("PIN updated", "success");
      router.back();
    }
  };

  const titles = { current: "Enter current PIN", new: "Choose a new PIN", confirm: "Confirm new PIN" };

  return (
    <View style={s.root} testID="change-pin-screen">
      <ScreenHeader back title="Change PIN" />
      <View style={[s.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.title}>{titles[step]}</Text>
        <PinDots length={step === "confirm" ? fresh.length : Math.max(4, Math.min(6, pin.length + (pin.length < 6 ? 1 : 0)))} filled={pin.length} error={!!err} style={[style, { marginVertical: 16 }]} />
        <Text style={s.err} testID="change-pin-error">
          {err ?? " "}
        </Text>
        <PinPad onDigit={onDigit} onBackspace={() => setPin(pin.slice(0, -1))} />
        {step !== "confirm" && (
          <Pressy
            testID="change-pin-continue-button"
            disabled={pin.length < 4}
            onPress={async () => {
              if (step === "current") {
                if (!(await checkPin(pin))) return fail("Wrong PIN");
                setPin("");
                setStep("new");
              } else {
                setFresh(pin);
                setPin("");
                setStep("confirm");
              }
            }}
            style={[s.cta, pin.length < 4 && { opacity: 0.4 }]}
          >
            <Text style={s.ctaText}>Continue</Text>
          </Pressy>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  body: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: fonts.heavy, fontSize: 20, color: c.onSurface },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: c.error, marginBottom: 16 },
  cta: { marginTop: "auto", height: 52, alignSelf: "stretch", borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
}));
