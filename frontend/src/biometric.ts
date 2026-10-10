import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export async function biometricAvailable() {
  if (Platform.OS === "web") return false;
  try {
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function promptBiometric() {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock SmartTradeLens",
      cancelLabel: "Use PIN",
      disableDeviceFallback: true,
    });
    return r.success;
  } catch {
    return false;
  }
}
