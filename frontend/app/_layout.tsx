import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider, useAuth } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { Logo } from "@/src/components/Logo";
import { PushManager } from "@/src/components/PushManager";
import { ToastProvider } from "@/src/components/Toast";
import { TradeSheetProvider } from "@/src/components/TradeSheet";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

// Push: foreground display + Android channel, at module scope so they exist before any push arrives.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function RootNav() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }} testID="app-loading">
        <Logo size={96} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "fade" }}>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === "needsPin"}>
        <Stack.Screen name="pin-setup" />
      </Stack.Protected>
      <Stack.Protected guard={status === "locked"}>
        <Stack.Screen name="unlock" />
      </Stack.Protected>
      <Stack.Protected guard={status === "unlocked"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alerts" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="watchlist" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="change-pin" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="price-alerts" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="strategy-settings" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="setup/[id]" options={{ animation: "slide_from_right" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Prewarm fonts, including the icon font, so icons render on first paint (Expo Go Android).
  const [loaded, error] = useFonts({
    Manrope_500: require("../assets/fonts/Manrope-500.ttf"),
    Manrope_600: require("../assets/fonts/Manrope-600.ttf"),
    Manrope_700: require("../assets/fonts/Manrope-700.ttf"),
    Manrope_800: require("../assets/fonts/Manrope-800.ttf"),
    JetBrainsMono_500: require("../assets/fonts/JetBrainsMono-500.ttf"),
    JetBrainsMono_700: require("../assets/fonts/JetBrainsMono-700.ttf"),
    MaterialDesignIcons: require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <ToastProvider>
              <TradeSheetProvider>
                <AuthProvider>
                  <StatusBar style="light" />
                  <RootNav />
                  <PushManager />
                </AuthProvider>
              </TradeSheetProvider>
            </ToastProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
