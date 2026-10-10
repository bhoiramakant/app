import React from "react";
import { Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { fmtClock } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

/** "Last updated" line; turns into an offline notice when showing saved data. */
export function UpdatedLine({ at, offline, testID = "last-updated" }: { at?: string | null; offline?: boolean; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.row, offline && s.off]} testID={testID}>
      <Icon name={offline ? "wifi-off" : "clock-outline"} size={13} color={offline ? colors.warning : colors.faint} />
      <Text style={[s.text, offline && { color: colors.warning }]}>
        {offline ? "Offline · showing saved data from " : "Last updated "}
        {fmtClock(at)}
      </Text>
    </View>
  );
}

export function Empty({ icon, title, body, children, testID }: { icon: any; title: string; body?: string; children?: React.ReactNode; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.empty} testID={testID}>
      <View style={s.emptyIc}>
        <Icon name={icon} size={28} color={colors.brand} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {body && <Text style={s.emptyBody}>{body}</Text>}
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.sectRow}>
      <Text style={s.sect}>{children}</Text>
      {right}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  off: { backgroundColor: c.warningSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  text: { fontFamily: fonts.regular, fontSize: 11.5, color: c.faint },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: c.onSurface, textAlign: "center" },
  emptyBody: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, textAlign: "center", lineHeight: 19 },
  sectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  sect: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: "uppercase" },
}));
