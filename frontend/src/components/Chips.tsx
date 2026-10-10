import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Pressy } from "@/src/components/Pressy";
import { fonts, makeStyles } from "@/src/theme";

type Opt = { key: string; label: string };

/** One horizontal, non-wrapping chip row (56pt row, 36pt chips). */
export function ChipRow({
  options,
  value,
  onChange,
  testPrefix,
}: {
  options: Opt[];
  value: string;
  onChange: (k: string) => void;
  testPrefix: string;
}) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.content}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressy
              key={o.key}
              testID={`${testPrefix}-${o.key}`}
              onPress={() => onChange(o.key)}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.label, on && s.labelOn]}>{o.label}</Text>
            </Pressy>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  testPrefix,
}: {
  options: Opt[];
  value: string;
  onChange: (k: string) => void;
  testPrefix: string;
}) {
  const s = useStyles();
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressy
          key={o.key}
          testID={`${testPrefix}-${o.key}`}
          onPress={() => onChange(o.key)}
          style={[s.segItem, o.key === value && s.segOn]}
        >
          <Text style={[s.segLabel, o.key === value && s.segLabelOn]}>{o.label}</Text>
        </Pressy>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { height: 52, justifyContent: "center" },
  content: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: c.brandSecondary, borderColor: c.brand },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted },
  labelOn: { color: c.onBrandSecondary },
  seg: {
    flexDirection: "row",
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  segItem: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: c.surfaceTertiary },
  segLabel: { fontFamily: fonts.bold, fontSize: 13, color: c.muted },
  segLabelOn: { color: c.onSurface },
}));
