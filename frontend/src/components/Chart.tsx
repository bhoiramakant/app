import React, { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { fmtPrice } from "@/src/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type S = (number | null)[];

function pathFor(vals: S, x: (i: number) => number, y: (v: number) => number, from = 0, to = vals.length) {
  let d = "";
  let pen = false;
  for (let i = from; i < to; i++) {
    const v = vals[i];
    if (v === null || v === undefined) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function PriceChart({
  close,
  supertrend,
  stDir,
  ma20,
  ma50,
  currency,
  height = 230,
}: {
  close: number[];
  supertrend?: S;
  stDir?: number[];
  ma20?: S;
  ma50?: S;
  currency: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  const { colors } = useTheme();
  const s = useStyles();
  const all = [...close, ...(supertrend ?? []), ...(ma20 ?? []), ...(ma50 ?? [])].filter((v): v is number => v !== null && v !== undefined);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = 14;
  const right = 56;
  const n = close.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - right));
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);

  // Super Trend split into green/red runs.
  const stPaths: { d: string; up: boolean }[] = [];
  if (supertrend && stDir) {
    let start = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || stDir[i] !== stDir[start]) {
        stPaths.push({ d: pathFor(supertrend, x, y, start, i), up: stDir[start] === 1 });
        start = i;
      }
    }
  }
  const last = close[n - 1];

  return (
    <View style={[s.wrap, { height }]} onLayout={(e) => setW(e.nativeEvent.layout.width)} testID="price-chart">
      {w > 0 && n > 1 && (
        <Svg width={w} height={height}>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} x2={w - right} y1={height * f} y2={height * f} stroke={colors.divider} strokeWidth={1} />
          ))}
          {stPaths.map((p, i) => (
            <Path key={i} d={p.d} stroke={p.up ? colors.success : colors.error} strokeWidth={2} strokeDasharray="4 3" fill="none" />
          ))}
          {ma50 && <Path d={pathFor(ma50, x, y)} stroke={colors.info} strokeWidth={1.6} fill="none" />}
          {ma20 && <Path d={pathFor(ma20, x, y)} stroke={colors.brand} strokeWidth={1.6} fill="none" />}
          <Path d={pathFor(close, x, y)} stroke={colors.onSurface} strokeWidth={2} fill="none" />
          <SvgText x={w - right + 6} y={pad + 4} fill={colors.muted} fontSize={10}>
            {fmtPrice(max, currency)}
          </SvgText>
          <SvgText x={w - right + 6} y={height - pad + 4} fill={colors.muted} fontSize={10}>
            {fmtPrice(min, currency)}
          </SvgText>
          <Rect x={w - right + 2} y={y(last) - 9} width={right - 2} height={18} rx={5} fill={colors.brand} />
          <SvgText x={w - right + 6} y={y(last) + 4} fill={colors.onBrand} fontSize={10} fontWeight="bold">
            {fmtPrice(last, currency)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

export function RsiStrip({ rsi }: { rsi: S }) {
  const [w, setW] = useState(0);
  const { colors } = useTheme();
  const s = useStyles();
  const h = 70;
  const n = rsi.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => (1 - v / 100) * h;
  const last = [...rsi].reverse().find((v) => v !== null) ?? null;
  return (
    <View style={s.rsiCard} testID="rsi-card">
      <View style={s.rsiHead}>
        <Text style={s.rsiLabel}>RSI (14)</Text>
        <Text style={s.rsiVal} testID="rsi-value">
          {last === null ? "—" : last.toFixed(1)}
        </Text>
      </View>
      <View style={{ height: h }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={h}>
            <Rect x={0} y={y(70)} width={w} height={y(30) - y(70)} fill={colors.brandTertiary} />
            <Line x1={0} x2={w} y1={y(70)} y2={y(70)} stroke={colors.border} strokeDasharray="3 3" />
            <Line x1={0} x2={w} y1={y(30)} y2={y(30)} stroke={colors.border} strokeDasharray="3 3" />
            <Path d={pathFor(rsi, x, y)} stroke={colors.brand} strokeWidth={1.6} fill="none" />
          </Svg>
        )}
      </View>
      <View style={s.bar}>
        <View style={{ width: `${last ?? 0}%`, backgroundColor: colors.brand }} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
    paddingLeft: 8,
  },
  rsiCard: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 },
  rsiHead: { flexDirection: "row", justifyContent: "space-between" },
  rsiLabel: { fontFamily: fonts.semibold, fontSize: 12, color: c.muted },
  rsiVal: { fontFamily: fonts.monoBold, fontSize: 14, color: c.onSurface },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.surfaceTertiary, overflow: "hidden", flexDirection: "row" },
}));
