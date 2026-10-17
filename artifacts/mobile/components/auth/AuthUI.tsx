import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardTypeOptions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandFill } from '@/components/all-services/BrandFill';
import { Icon, type IconName } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { NeonCard } from '@/components/neon/NeonCard';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

/**
 * The auth look, matched to the rest of the app: the aurora page, a brand-ring mark, the form in a glass card,
 * inset fields with a cyan focus ring, and a gradient primary button (solid violet in light).
 */

const MARK = require('@/assets/images/wishme-mark.png');

/** The page: the aurora sits behind a scrolling column (kept out of the ScrollView so typing never repaints it). */
export function AuthPage({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 }]}
        >
          <View style={styles.pageInner}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A 72px disc with a 2px brand-gradient ring. Holds the WishMe heart, or a cyan icon on the inner screens. */
export function AuthMark({ icon, size = 72 }: { icon?: IconName; size?: number }) {
  const { neon } = useTheme();
  const inner = size - 4;
  return (
    <LinearGradient
      colors={neon.gBrand as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: neon.surface, alignItems: 'center', justifyContent: 'center' }}>
        {icon ? (
          <Icon name={icon} size={Math.round(size * 0.39)} color={neon.cyan} />
        ) : (
          <Image source={MARK} style={{ width: size * 0.74, height: size * 0.74 }} resizeMode="contain" />
        )}
      </View>
    </LinearGradient>
  );
}

/** Centred mark + headline + subtitle. No `icon` shows the WishMe heart. */
export function AuthHeader({
  icon,
  title,
  subtitle,
  titleSize = 30,
}: {
  icon?: IconName;
  title: string;
  subtitle?: React.ReactNode;
  titleSize?: number;
}) {
  const { neon } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <AuthMark icon={icon} />
      <Text
        style={[styles.title, { color: neon.textHi, fontSize: titleSize, lineHeight: titleSize + 6 }]}
        maxFontSizeMultiplier={1.3}
      >
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: neon.textLo }]}>{subtitle}</Text> : null}
      <View style={{ height: 24 }} />
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
  prefix,
  inputRef,
  returnKeyType,
  onSubmitEditing,
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
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
}) {
  const { neon, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? neon.error : focused ? neon.cyan : neon.line;
  const iconColor = error ? neon.error : focused ? neon.cyan : neon.textDim;
  const fill = focused && !error ? withAlpha(neon.cyan, 0.06) : isDark ? withAlpha(neon.bg, 0.6) : neon.surfaceHigh;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[styles.field, { backgroundColor: fill, borderColor: border, borderWidth: focused || error ? 1.5 : 1 }]}>
        {icon ? <Icon name={icon} size={18} color={iconColor} /> : null}
        {prefix ? <Text style={[styles.prefix, { color: neon.textHi }]}>{prefix}</Text> : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: neon.textHi }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? neon.textDim : neon.textLo}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={maxLength}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={!onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.fieldErrorRow}>
          <Icon name="alert-circle" size={13} color={neon.error} />
          <Text style={[styles.fieldError, { color: neon.error }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** An error or success note shown between the fields and the button. */
export function AuthBanner({ tone = 'error', children }: { tone?: 'error' | 'success'; children: React.ReactNode }) {
  const { neon } = useTheme();
  const c = tone === 'error' ? neon.error : neon.success;
  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(c, 0.12), borderColor: withAlpha(c, 0.35) }]}>
      <Icon name={tone === 'error' ? 'alert-circle' : 'check-circle'} size={19} color={c} />
      <Text style={[styles.bannerText, { color: c }]}>{children}</Text>
    </View>
  );
}

/** The primary button: the brand gradient in dark, solid violet in light. White label in both. */
export function AuthButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  iconAfter,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Put the icon after the label (e.g. an arrow on "Next"). */
  iconAfter?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { neon, isDark } = useTheme();
  const off = disabled || loading;
  return (
    <PressScale onPress={onPress} disabled={off} style={[{ marginTop: 20 }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={[
          styles.button,
          { backgroundColor: neon.violet, opacity: disabled && !loading ? 0.45 : 1 },
          Platform.OS === 'ios' && {
            shadowColor: neon.violet,
            shadowOpacity: isDark ? 0.35 : 0.18,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          },
        ]}
      >
        <BrandFill />
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.buttonRow}>
            {icon && !iconAfter ? <Icon name={icon} size={18} color="#fff" /> : null}
            <Text style={styles.buttonText} maxFontSizeMultiplier={1.2}>{label}</Text>
            {icon && iconAfter ? <Icon name={icon} size={18} color="#fff" /> : null}
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

/** "New here? Create an account": the question in the quiet colour, the action in cyan. */
export function AuthPrompt({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  const { neon } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.link, { alignSelf: 'center' }]} accessibilityRole="button" accessibilityLabel={`${question} ${action}`}>
      <Text style={[styles.promptText, { color: neon.textLo }]}>
        {question} <Text style={{ color: neon.cyan, fontFamily: 'Inter_600SemiBold' }}>{action}</Text>
      </Text>
    </Pressable>
  );
}

/** A glass pill row with an icon, a label and a chevron, for a secondary route such as the celebrity sign-up. */
export function AuthPill({ icon, iconColor, label, onPress }: { icon: IconName; iconColor?: string; label: string; onPress: () => void }) {
  const { neon } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.pill, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
        <Icon name={icon} size={16} color={iconColor ?? neon.pink} />
        <Text style={[styles.pillText, { color: neon.textHi }]} numberOfLines={1}>{label}</Text>
        <Icon name="chevron-right" size={16} color={neon.textDim} />
      </View>
    </PressScale>
  );
}

/** Two or three options in a hairline track: the chosen one gets the cyan-tinted active-chip look. */
export function AuthSegmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  /** `weight` gives a long label more of the track (default 1). */
  options: { key: T; label: string; icon?: IconName; weight?: number }[];
  onChange: (k: T) => void;
}) {
  const { neon, isDark } = useTheme();
  return (
    <View style={[styles.seg, { borderColor: neon.line, backgroundColor: isDark ? withAlpha(neon.bg, 0.6) : neon.surfaceHigh }]}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segItem, { flex: o.weight ?? 1, borderColor: on ? neon.cyan : 'transparent', backgroundColor: on ? withAlpha(neon.cyan, 0.12) : 'transparent' }]}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={on ? neon.cyan : neon.textLo} /> : null}
            <Text numberOfLines={1} style={{ fontSize: 13.5, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_500Medium', color: on ? neon.cyan : neon.textLo }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The glass card a form sits in. */
export function AuthCard({ children, style, radius = 24 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  return (
    <NeonCard radius={radius} style={[{ padding: 20 }, style]}>
      {children}
    </NeonCard>
  );
}

/** A labelled group inside one long card: a hairline above (unless first), an overline label, an optional right slot. */
export function AuthSection({ label, right, first, children }: { label: string; right?: React.ReactNode; first?: boolean; children: React.ReactNode }) {
  const { neon } = useTheme();
  return (
    <View style={!first ? [styles.sectionRule, { borderTopColor: neon.line }] : undefined}>
      <View style={styles.sectionHead}>
        <Text style={[styles.overline, { color: neon.textDim }]}>{label}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  pageInner: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.5, marginTop: 18, textAlign: 'center' },
  subtitle: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21, marginTop: 6, textAlign: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: 16, paddingHorizontal: 16 },
  prefix: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', height: 54 },
  fieldErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 4 },
  fieldError: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  bannerText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  button: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  promptText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 16 },
  pillText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginBottom: 12, gap: 4 },
  segItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  sectionRule: { borderTopWidth: 1, marginTop: 8, paddingTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginBottom: 12 },
  overline: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase' },
});
