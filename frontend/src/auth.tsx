// Auth "ViewModel": single source of truth for session + app-lock state.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, ApiError, setToken, setUnauthorizedHandler, TOKEN_KEY } from "@/src/api";
import { biometricAvailable, promptBiometric } from "@/src/biometric";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

const PIN_KEY = "stl_pin";
const BIO_KEY = "stl_bio";
const USER_KEY = "stl_user";
const LOCK_AFTER_MS = 30_000;

export type AuthStatus = "loading" | "signedOut" | "needsPin" | "locked" | "unlocked";
type User = { id: string; email: string };

type AuthCtx = {
  status: AuthStatus;
  user: User | null;
  bioEnabled: boolean;
  signIn: (email: string, password: string, mode: "login" | "register") => Promise<void>;
  signOut: () => Promise<void>;
  savePin: (pin: string) => Promise<void>;
  finishSetup: (enableBio: boolean) => Promise<void>;
  setBioEnabled: (v: boolean) => Promise<void>;
  checkPin: (pin: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  lock: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [bioEnabled, setBio] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const bgAt = useRef<number | null>(null);

  const clearSession = useCallback(async () => {
    setToken(null);
    await Promise.all([
      storage.secureRemove(TOKEN_KEY),
      storage.secureRemove(PIN_KEY),
      storage.removeItem(BIO_KEY),
      storage.removeItem(USER_KEY),
    ]);
    queryClient.clear();
    setUser(null);
    setBio(false);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    (async () => {
      const t = await storage.secureGet(TOKEN_KEY, "");
      if (!t) return setStatus("signedOut");
      setToken(t as string);
      try {
        const me = await api<User>("/auth/me");
        setUser(me);
        storage.setItem(USER_KEY, JSON.stringify(me));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return clearSession();
        const raw = await storage.getItem(USER_KEY, "");
        if (raw) setUser(JSON.parse(raw as string));
      }
      const [pin, bio] = await Promise.all([storage.secureGet(PIN_KEY, ""), storage.getItem(BIO_KEY, false)]);
      setBio(!!bio);
      setStatus(pin ? "locked" : "needsPin");
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") bgAt.current = Date.now();
      if (s === "active" && bgAt.current && statusRef.current === "unlocked") {
        if (Date.now() - bgAt.current > LOCK_AFTER_MS) setStatus("locked");
        bgAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      user,
      bioEnabled,
      signIn: async (email, password, mode) => {
        const res = await api<{ token: string; user: User }>(mode === "login" ? "/auth/login" : "/auth/register", {
          method: "POST",
          body: { email, password },
        });
        setToken(res.token);
        await storage.secureSet(TOKEN_KEY, res.token);
        await storage.setItem(USER_KEY, JSON.stringify(res.user));
        await storage.secureRemove(PIN_KEY);
        queryClient.clear();
        setUser(res.user);
        setStatus("needsPin");
      },
      signOut: clearSession,
      savePin: async (pin) => {
        await storage.secureSet(PIN_KEY, pin);
      },
      finishSetup: async (enableBio) => {
        await storage.setItem(BIO_KEY, enableBio);
        setBio(enableBio);
        setStatus("unlocked");
      },
      setBioEnabled: async (v) => {
        if (v && !(await biometricAvailable())) return;
        if (v && !(await promptBiometric())) return;
        await storage.setItem(BIO_KEY, v);
        setBio(v);
      },
      checkPin: async (pin) => (await storage.secureGet(PIN_KEY, "")) === pin,
      unlockWithPin: async (pin) => {
        const ok = (await storage.secureGet(PIN_KEY, "")) === pin;
        if (ok) setStatus("unlocked");
        return ok;
      },
      unlockWithBiometric: async () => {
        const ok = await promptBiometric();
        if (ok) setStatus("unlocked");
        return ok;
      },
      lock: () => setStatus("locked"),
    }),
    [status, user, bioEnabled, clearSession],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}

export async function getPinLength() {
  const p = await storage.secureGet(PIN_KEY, "");
  return p ? String(p).length : 4;
}
