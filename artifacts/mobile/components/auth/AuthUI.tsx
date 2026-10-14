import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { PressScale } from '@/components/neon/Motion';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

/**
 * MyAssistant's auth look: no gradients and no ambient glow. A plain page, an ink logo tile, a left-aligned headline,
 * filled fields with a hairline border (cyan when focused), a solid violet button, and cyan text links.
 */

/** The page: a scrolling column, centred when short, capped at 420 wide, on the plain background. */
export function AuthPage({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: neon.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.pageInner}>{children}</View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Logo tile + headline + subtitle. */
export function AuthHeader({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: React.ReactNode }) {
  const { neon } = useTheme();
  return (
    <View>
      <View style={[styles.tile, { backgroundColor: neon.textHi }]}>
        <Icon name={icon} size={26} color={neon.onInk} />
      </View>
      <Text style={[styles.title, { color: neon.textHi }]} maxFontSizeMultiplier={1.3}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: neon.textLo }]}>{subtitle}</Text> : null}
      <View style={{ height: 28 }} />
    </View>
  );
}

export function AuthField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
  right,
  maxLength,
  autoFocus,
}: {
  icon?: IconName;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  right?: React.ReactNode;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const { neon } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? neon.error : focused ? neon.cyan : neon.line;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[styles.field, { backgroundColor: neon.surfaceHigh, borderColor: border, borderWidth: focused && !error ? 1.6 : 1 }]}>
        {icon ? <Icon name={icon} size={20} color={neon.textLo} /> : null}
        <TextInput
          style={[styles.input, { color: neon.textHi }]}
          placeholder={placeholder}
          placeholderTextColor={neon.textLo}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
      {error ? <Text style={[styles.fieldError, { color: neon.error }]}>{error}</Text> : null}
    </View>
  );
}

/** An error or success note shown between the fields and the button. */
export function AuthBanner({ tone = 'error', children }: { tone?: 'error' | 'success'; children: React.ReactNode }) {
  const { neon } = useTheme();
  const c = tone === 'error' ? neon.error : neon.success;
  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(c, 0.1) }]}>
      <Icon name={tone === 'error' ? 'alert-circle' : 'check-circle'} size={19} color={c} />
      <Text style={[styles.bannerText, { color: c }]}>{children}</Text>
    </View>
  );
}

/** The solid violet primary button. White label in both themes. */
export function AuthButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { neon } = useTheme();
  const off = disabled || loading;
  return (
    <PressScale onPress={onPress} disabled={off} style={[{ marginTop: 20 }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.button, { backgroundColor: neon.violet, opacity: disabled && !loading ? 0.5 : 1 }]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.buttonRow}>
            {icon ? <Icon name={icon} size={18} color="#fff" /> : null}
            <Text style={styles.buttonText} maxFontSizeMultiplier={1.2}>{label}</Text>
          </View>
        )}
      </View>
    </PressScale>
  );
}

/** A centred text link: cyan by default, quieter with tone="quiet". */
export function AuthLink({
  children,
  onPress,
  tone = 'cyan',
  icon,
  align = 'center',
}: {
  children: React.ReactNode;
  onPress: () => void;
  tone?: 'cyan' | 'quiet';
  icon?: IconName;
  align?: 'center' | 'right' | 'left';
}) {
  const { neon } = useTheme();
  const c = tone === 'cyan' ? neon.cyan : neon.textLo;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.link, { alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }]}
    >
      {icon ? <Icon name={icon} size={14} color={c} /> : null}
      <Text style={[styles.linkText, { color: c }]}>{children}</Text>
    </Pressable>
  );
}

/** Two or three options in a hairline track: the chosen one is violet-tinted with cyan text. */
export function AuthSegmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; icon?: IconName }[];
  onChange: (k: T) => void;
}) {
  const { neon } = useTheme();
  return (
    <View style={[styles.seg, { borderColor: neon.line }]}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, on && { backgroundColor: withAlpha(neon.violet, 0.22) }]}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={on ? neon.cyan : neon.textLo} /> : null}
            <Text style={{ fontSize: 14, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_500Medium', color: on ? neon.cyan : neon.textLo }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A flat card: surface fill, hairline border. */
export function AuthCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { neon } = useTheme();
  return <View style={[styles.card, { backgroundColor: neon.surface, borderColor: neon.line }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  pageInner: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  tile: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.5, marginTop: 22 },
  subtitle: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21, marginTop: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: 16, paddingHorizontal: 20 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', height: 54 },
  fieldError: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, marginLeft: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 10, marginTop: 14 },
  bannerText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  button: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3, marginBottom: 16 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
});
