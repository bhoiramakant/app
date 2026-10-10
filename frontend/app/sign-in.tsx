import React, { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Logo } from "@/src/components/Logo";
import { Pressy } from "@/src/components/Pressy";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function SignIn() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email");
    if (password.length < 8) return setErr("Password must be at least 8 characters");
    setBusy(true);
    try {
      await signIn(email.trim(), password, mode);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root} testID="sign-in-screen">
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={s.brand}>
          <Logo size={92} />
          <Text style={s.wordmark}>
            Smart<Text style={{ color: colors.brand }}>Trade</Text>Lens
          </Text>
          <Text style={s.tag}>Spot setups. Trade with clarity.</Text>
        </View>
        <Text style={s.heading}>{mode === "login" ? "Sign in" : "Create your account"}</Text>
        <TextInput
          testID="sign-in-email-input"
          style={s.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
        <TextInput
          testID="sign-in-password-input"
          style={s.input}
          placeholder="Password (8+ characters)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {err && (
          <Text style={s.err} testID="sign-in-error">
            {err}
          </Text>
        )}
        <Pressy testID="sign-in-submit-button" haptic disabled={busy} onPress={submit} style={[s.cta, busy && { opacity: 0.7 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>{mode === "login" ? "Sign in" : "Create account"}</Text>}
        </Pressy>
        <Pressy
          testID="sign-in-toggle-mode-button"
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setErr(null);
          }}
          style={s.toggle}
        >
          <Text style={s.toggleText}>
            {mode === "login" ? "New here? " : "Have an account? "}
            <Text style={s.toggleLink}>{mode === "login" ? "Create account" : "Sign in"}</Text>
          </Text>
        </Pressy>
        <Text style={s.legal}>Your watchlist syncs to your account. For analysis only, not financial advice.</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, gap: 12 },
  brand: { alignItems: "center", gap: 8, marginBottom: 24 },
  wordmark: { fontFamily: fonts.heavy, fontSize: 26, color: c.onSurface },
  tag: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  heading: { fontFamily: fonts.bold, fontSize: 16, color: c.onSurface, marginBottom: 4 },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.onSurface,
  },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: c.error },
  cta: { height: 52, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  ctaText: { fontFamily: fonts.heavy, fontSize: 15, color: c.onBrandPrimary },
  toggle: { alignItems: "center", paddingVertical: 12 },
  toggleText: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  toggleLink: { fontFamily: fonts.bold, color: c.brand },
  legal: { fontFamily: fonts.regular, fontSize: 11, color: c.faint, textAlign: "center", marginTop: 16 },
}));
