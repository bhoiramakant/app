import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; haptic?: boolean };

/** Pressable with a quick scale-down press animation. */
export function Pressy({ style, children, haptic, onPress, ...rest }: Props) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      onPressIn={() => (s.value = withTiming(0.96, { duration: 80 }))}
      onPressOut={() => (s.value = withTiming(1, { duration: 120 }))}
      style={[style, anim]}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}
