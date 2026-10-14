import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** `primary` is the one thing most people want; `quiet` is the one they cannot undo. */
  tone?: 'primary' | 'plain' | 'quiet';
  /** Drops the label, leaving a square icon button — for an action that should not draw the eye. */
  iconOnly?: boolean;
  /** Spoken name, for when the visible label is shortened to fit the pill. */
  accessibilityLabel?: string;
  busy?: boolean;
  disabled?: boolean;
}

/**
 * The pill is deliberately small — 34px tall — so `hitSlop` is what carries the tap target past the
 * 44px everyone's thumb needs. Shrinking the button must not shrink what you have to hit.
 */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/** A compact action in the document toolbar: share, save to the phone, or delete. */
export function ActionButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  iconOnly,
  accessibilityLabel,
  busy,
  disabled,
}: Props) {
  const { colors } = useTheme();
  const filled = tone === 'primary';
  const accent = tone === 'quiet' ? colors.mutedForeground : colors.primary;
  const inactive = disabled || busy;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={inactive}
      hitSlop={HIT_SLOP}
      style={[
        s.button,
        iconOnly ? s.square : s.pill,
        filled
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: colors.card, borderColor: tone === 'quiet' ? colors.border : accent + '66' },
        inactive ? s.inactive : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={filled ? '#fff' : accent} />
      ) : (
        <Icon name={icon} size={15} color={filled ? '#fff' : accent} />
      )}
      {iconOnly ? null : <Text style={[s.label, { color: filled ? '#fff' : accent }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  button: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 17,
    borderWidth: 1,
  },
  pill: { paddingHorizontal: 13 },
  square: { width: 34 },
  inactive: { opacity: 0.45 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
