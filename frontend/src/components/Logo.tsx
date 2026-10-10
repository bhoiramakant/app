import React from "react";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

import { colors } from "@/src/theme";

/** Stylized "S" built from a trend line inside a magnifying glass. */
export function Logo({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={44} cy={44} r={30} fill="none" stroke={colors.brand} strokeWidth={7} />
      <Line x1={66} y1={66} x2={88} y2={88} stroke={colors.brand} strokeWidth={9} strokeLinecap="round" />
      <Path
        d="M56 28 C40 20 28 30 36 40 C44 50 56 46 52 58 C48 68 34 64 30 58"
        fill="none"
        stroke={colors.onBrandTertiary}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Polyline
        points="24,60 36,50 46,54 62,34"
        fill="none"
        stroke={colors.success}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
