import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

/**
 * THE ROOM THE APP SITS IN. Every screen floats on this.
 *
 * Dark is the "Neon Celebration" look: a plum-night page with a neon-orange pool at the top-left, a faint
 * hot-pink glow at the top-right, and a swoosh of orange-to-gold light sweeping up the lower right with a
 * hot-pink haze under it.
 * Light stays calm: a wash and two soft pools of the accent. Everything is a gradient (no blur filter), so it costs
 * almost nothing to paint.
 */
export function AmbientBackground({ children }: { children?: React.ReactNode }) {
  const { neon } = useTheme();
  const { width: w, height: h } = useWindowDimensions();
  const a = neon.aurora;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: neon.bg }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={neon.wash[0]} />
            <Stop offset="0.42" stopColor={neon.wash[1]} />
            <Stop offset="1" stopColor={neon.wash[2]} />
          </LinearGradient>
          {a ? (
            <>
              <RadialGradient id="poolBlue" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={a.blue} stopOpacity={0.42} />
                <Stop offset="0.45" stopColor={a.blue} stopOpacity={0.16} />
                <Stop offset="1" stopColor={a.blue} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="poolViolet" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={a.violet} stopOpacity={0.32} />
                <Stop offset="0.5" stopColor={a.violet} stopOpacity={0.1} />
                <Stop offset="1" stopColor={a.violet} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="poolMagenta" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={a.magenta} stopOpacity={0.55} />
                <Stop offset="0.4" stopColor={a.magenta} stopOpacity={0.22} />
                <Stop offset="1" stopColor={a.magenta} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="swoosh" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FF5F1F" />
                <Stop offset="0.45" stopColor="#B026FF" />
                <Stop offset="0.8" stopColor="#FF2E88" />
                <Stop offset="1" stopColor="#FFD23F" />
              </LinearGradient>
              <LinearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={a.magenta} stopOpacity={0.5} />
                <Stop offset="0.5" stopColor={a.violet} stopOpacity={0.22} />
                <Stop offset="1" stopColor={a.blue} stopOpacity={0} />
              </LinearGradient>
            </>
          ) : (
            <>
              <RadialGradient id="poolA" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={neon.violet} stopOpacity={0.13} />
                <Stop offset="0.5" stopColor={neon.violet} stopOpacity={0.05} />
                <Stop offset="1" stopColor={neon.violet} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="poolB" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={neon.pink} stopOpacity={0.1} />
                <Stop offset="0.5" stopColor={neon.pink} stopOpacity={0.04} />
                <Stop offset="1" stopColor={neon.pink} stopOpacity={0} />
              </RadialGradient>
            </>
          )}
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#wash)" />
        {a ? (
          <>
            <Circle cx={-w * 0.1} cy={h * 0.04} r={w * 0.95} fill="url(#poolBlue)" />
            <Circle cx={w * 1.05} cy={h * 0.02} r={w * 0.6} fill="url(#poolViolet)" />
            <Circle cx={w * 1.02} cy={h * 0.62} r={w * 0.62} fill="url(#poolMagenta)" />
            {/* the haze under the swoosh */}
            <Path
              d={`M${-w * 0.05} ${h * 0.73} C${w * 0.3} ${h * 0.79} ${w * 0.58} ${h * 0.67} ${w * 1.05} ${h * 0.58} L${w * 1.05} ${h * 1.05} L${-w * 0.05} ${h * 1.05} Z`}
              fill="url(#haze)"
              opacity={0.55}
            />
            {/* the swoosh: wide soft strokes under a bright thin core */}
            {[
              { sw: 46, o: 0.1 },
              { sw: 26, o: 0.18 },
              { sw: 11, o: 0.4 },
              { sw: 3.5, o: 0.95 },
            ].map((s) => (
              <Path
                key={s.sw}
                d={`M${-w * 0.05} ${h * 0.73} C${w * 0.3} ${h * 0.79} ${w * 0.58} ${h * 0.67} ${w * 1.05} ${h * 0.58}`}
                fill="none"
                stroke="url(#swoosh)"
                strokeWidth={s.sw}
                strokeOpacity={s.o}
                strokeLinecap="round"
              />
            ))}
          </>
        ) : (
          <>
            <Circle cx={-w * 0.35 + (w * 1.25) / 2} cy={-h * 0.12 + (w * 1.25) / 2} r={(w * 1.25) / 2} fill="url(#poolA)" />
            <Circle cx={w * 0.12 + (w * 1.3) / 2} cy={h * 1.1 - w * 1.3 + (w * 1.3) / 2} r={(w * 1.3) / 2} fill="url(#poolB)" />
          </>
        )}
      </Svg>
      {children}
    </View>
  );
}

export { withAlpha };
