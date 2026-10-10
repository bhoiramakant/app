import React from "react";
import { Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { timeAgo } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export type AlertT = {
  id: string;
  symbol: string;
  market: string;
  strategy: string;
  timeframe: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export function AlertItem({ a, onPress, index }: { a: AlertT; onPress?: () => void; index: number }) {
  const s = useStyles();
  const { colors } = useTheme();
  const tint =
    a.kind === "price" ? colors.info : a.kind === "ready" ? colors.brand : a.kind === "bearish" ? colors.error : a.kind === "upcoming" ? colors.warning : colors.faint;
  return (
    <Pressy testID={`alert-item-${index}`} onPress={onPress} style={[s.alert, { borderLeftColor: tint }, a.read && s.read]}>
      <View style={{ flex: 1 }}>
        <View style={s.top}>
          {!a.read && <View style={[s.dot, { backgroundColor: tint }]} />}
          <Text style={s.title} numberOfLines={2}>
            {a.title}
          </Text>
        </View>
        <Text style={s.body}>{a.body}</Text>
        <Text style={s.meta}>{timeAgo(a.created_at)}</Text>
      </View>
      {onPress && <Icon name="chevron-right" size={18} color={colors.faint} />}
    </Pressy>
  );
}

const useStyles = makeStyles((c) => ({
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  read: { opacity: 0.7 },
  top: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  title: { fontFamily: fonts.bold, fontSize: 13, color: c.onSurface, flex: 1 },
  body: { fontFamily: fonts.regular, fontSize: 12.5, color: c.muted, lineHeight: 18 },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: c.faint, marginTop: 6 },
}));
