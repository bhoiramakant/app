import React from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { Icon, IconName } from "@/src/components/Icon";
import { Pressy } from "@/src/components/Pressy";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    x.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };
  return { style, shake };
}

export function PinDots({ length, filled, error, style }: { length: number; filled: number; error?: boolean; style?: any }) {
  const s = useStyles();
  return (
    <Animated.View style={[s.dots, style]} testID="pin-dots">
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[s.dot, i < filled && s.dotOn, error && s.dotErr]} />
      ))}
    </Animated.View>
  );
}

export function PinPad({
  onDigit,
  onBackspace,
  leftKey,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  leftKey?: { icon: IconName; onPress: () => void; testID: string } | null;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];
  return (
    <View style={s.pad}>
      {rows.map((r) => (
        <View key={r[0]} style={s.padRow}>
          {r.map((d) => (
            <Pressy key={d} testID={`pin-key-${d}`} haptic onPress={() => onDigit(d)} style={s.key}>
              <Text style={s.keyText}>{d}</Text>
            </Pressy>
          ))}
        </View>
      ))}
      <View style={s.padRow}>
        {leftKey ? (
          <Pressy testID={leftKey.testID} onPress={leftKey.onPress} style={[s.key, s.keyGhost]}>
            <Icon name={leftKey.icon} size={26} color={colors.brand} />
          </Pressy>
        ) : (
          <View style={[s.key, s.keyGhost]} />
        )}
        <Pressy testID="pin-key-0" haptic onPress={() => onDigit("0")} style={s.key}>
          <Text style={s.keyText}>0</Text>
        </Pressy>
        <Pressy testID="pin-key-backspace" onPress={onBackspace} style={[s.key, s.keyGhost]}>
          <Icon name="backspace-outline" size={22} color={colors.muted} />
        </Pressy>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  dots: { flexDirection: "row", gap: 14, justifyContent: "center", height: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c.borderStrong },
  dotOn: { backgroundColor: c.brand, borderColor: c.brand },
  dotErr: { borderColor: c.error, backgroundColor: c.error },
  pad: { gap: 12, alignItems: "center" },
  padRow: { flexDirection: "row", gap: 20 },
  key: { width: 72, height: 60, borderRadius: 30, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  keyGhost: { backgroundColor: "transparent" },
  keyText: { fontFamily: fonts.monoBold, fontSize: 22, color: c.onSurface },
}));
