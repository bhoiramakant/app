// SmartTradeLens design tokens. Dark only, saffron/bhagwa accent (from /app/plan/mockups.html).
// Keys follow the template's pairing rule: a plain key is a background, its `on` key sits on it.

import { useMemo } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0B0D10",
  onSurface: "#F2F3F5",
  surfaceSecondary: "#14171C",
  onSurfaceSecondary: "#F2F3F5",
  surfaceTertiary: "#1B1F26",
  onSurfaceTertiary: "#C9CED6",
  surfaceInverse: "#F2F3F5",
  onSurfaceInverse: "#0B0D10",
  muted: "#8A93A0",
  faint: "#5C6470",

  brand: "#FF8A1F",
  onBrand: "#140A00",
  brandPrimary: "#FF8A1F",
  onBrandPrimary: "#140A00",
  brandSecondary: "#FF8A1F24",
  onBrandSecondary: "#FF8A1F",
  brandTertiary: "#FF8A1F14",
  onBrandTertiary: "#FF9933",
  brandBorder: "#FF8A1F8C",

  success: "#22C55E",
  onSuccess: "#04140A",
  successSoft: "#22C55E21",
  warning: "#F5B83D",
  onWarning: "#1A1200",
  warningSoft: "#F5B83D21",
  error: "#EF4444",
  onError: "#FFFFFF",
  errorSoft: "#EF444421",
  info: "#5B8CFF",
  onInfo: "#FFFFFF",

  border: "#262B33",
  borderStrong: "#3A414C",
  divider: "#1F242B",
  tabBar: "#0E1014",
  overlay: "#000000A0",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark: ThemeColors } = { light: dark, dark };

export const fonts = {
  regular: "Manrope_500",
  semibold: "Manrope_600",
  bold: "Manrope_700",
  heavy: "Manrope_800",
  mono: "JetBrainsMono_500",
  monoBold: "JetBrainsMono_700",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 18, sheet: 26, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.("dark");

export const colors = dark;

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}
