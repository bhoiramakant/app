import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/src/api";

export const pushSupported = Platform.OS !== "web";

export async function getPushPermission() {
  if (!pushSupported) return { status: "unsupported" as const, canAskAgain: false };
  const p = await Notifications.getPermissionsAsync();
  return { status: p.status, canAskAgain: p.canAskAgain };
}

/** Sends the native FCM/APNs token to our backend relay. Works only in real builds (not Expo Go). */
export async function registerDevice(userId: string) {
  if (!pushSupported) return false;
  try {
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api("/register-push", {
      method: "POST",
      body: { user_id: userId, platform: Platform.OS, device_token: String(tokenResp.data) },
    });
    return true;
  } catch {
    return false;
  }
}

/** Ask (permission first, then token). Returns final permission status. */
export async function requestAndRegister(userId: string) {
  if (!pushSupported) return "unsupported";
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === "granted") await registerDevice(userId);
  return status;
}
