import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** Shown while a list is being fetched for the first time, with a word about what is happening. */
export function LoadingState({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={s.centre} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[s.sub, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/** A failure the user can do something about: read the reason, tap to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.centre}>
      <Icon name="alert-circle" size={44} color={colors.destructive} />
      <Text style={[s.title, { color: colors.foreground }]}>Something went wrong</Text>
      <Text style={[s.sub, { color: colors.mutedForeground }]}>{message}</Text>
      <TouchableOpacity
        onPress={onRetry}
        style={[s.button, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={s.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Nothing here yet — say so, and offer the one thing worth doing next. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { borderColor: colors.border }]}>
      <Icon name={icon} size={40} color={colors.mutedForeground} />
      <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[s.sub, { color: colors.mutedForeground }]}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={[s.button, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A thin red bar above a list that still has usable (if stale) content below it. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <TouchableOpacity
      onPress={onRetry}
      activeOpacity={0.8}
      style={s.banner}
      accessibilityRole="button"
      accessibilityLabel={`${message}. Tap to retry.`}
    >
      <Icon name="alert-circle" size={16} color="#fff" />
      <Text style={s.bannerText}>{message} — tap to retry</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sub: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  button: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999 },
  buttonText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
});
