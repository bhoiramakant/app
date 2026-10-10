import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { useCached } from "@/src/cache";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export function IconButton({
  icon,
  onPress,
  testID,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  testID: string;
  badge?: number;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={onPress} style={s.ic} hitSlop={6}>
      <Icon name={icon} size={20} color={colors.onSurfaceTertiary} />
      {!!badge && (
        <View style={s.badge} testID={`${testID}-badge`}>
          <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </Pressy>
  );
}

export function useUnread() {
  const q = useCached<{ unread: number }>(["alerts"], "/alerts", { refetchInterval: 60_000 });
  return q.data?.unread ?? 0;
}

export function AlertsBell() {
  const router = useRouter();
  const unread = useUnread();
  return <IconButton icon="bell-outline" testID="header-alerts-button" badge={unread} onPress={() => router.push("/alerts")} />;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  back,
  testID,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  back?: boolean;
  testID?: string;
}) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[s.header, { paddingTop: insets.top + 8 }]} testID={testID}>
      <View style={s.left}>
        {back && (
          <Pressy testID="header-back-button" onPress={() => router.back()} style={s.back} hitSlop={8}>
            <Icon name="chevron-left" size={26} color={colors.onSurface} />
          </Pressy>
        )}
        <View style={{ flexShrink: 1 }}>
          {typeof title === "string" ? (
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle}
        </View>
      </View>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.surface,
  },
  left: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 4 },
  back: { width: 36, height: 44, justifyContent: "center", marginLeft: -8 },
  title: { fontFamily: fonts.heavy, fontSize: 24, color: c.onSurface },
  right: { flexDirection: "row", gap: 8, alignItems: "center" },
  ic: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: c.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.heavy, fontSize: 10, color: c.onBrand },
}));
