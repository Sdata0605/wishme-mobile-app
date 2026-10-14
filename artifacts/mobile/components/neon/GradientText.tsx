import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

let seq = 0;

/**
 * Text filled with a left-to-right gradient. A real (invisible) Text lays the line out and reports its size; an SVG
 * text of the same string is painted over it with the gradient as its fill. No native masked-view needed.
 */
export function GradientText({
  children,
  colors,
  style,
  fontSize,
  fontFamily,
  letterSpacing = 0,
}: {
  children: string;
  colors: readonly string[];
  style?: StyleProp<TextStyle>;
  fontSize: number;
  fontFamily: string;
  letterSpacing?: number;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [id] = useState(() => `gt${seq++}`);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Text
        onLayout={(e) => setBox({ w: Math.ceil(e.nativeEvent.layout.width) + 2, h: e.nativeEvent.layout.height })}
        style={[{ fontSize, fontFamily, letterSpacing, opacity: box ? 0 : 1, color: colors[0] }, style]}
        maxFontSizeMultiplier={1.2}
      >
        {children}
      </Text>
      {box ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              {colors.map((c, i) => <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          <SvgText x={0} y={fontSize * 0.98} fontSize={fontSize} fontFamily={fontFamily} fill={`url(#${id})`} letterSpacing={letterSpacing}>
            {children}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
