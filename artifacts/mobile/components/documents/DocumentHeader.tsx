import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  /** A tab is a root destination, so it has nothing to go back to. */
  hideBack?: boolean;
  title: string;
  /** Shown on the right of the bar — a refresh button, a Save action, and so on. */
  right?: React.ReactNode;
  onBack?: () => void;
}

/** The document screen's top bar, matching Bookings and Occasions. */
export function DocumentHeader({ title, right, onBack, hideBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View
      style={[
        s.header,
        { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      {hideBack ? (
        <View style={s.left} />
      ) : (
        <TouchableOpacity
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)))}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.left}
        >
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
      )}
      <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.side}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  left: { minWidth: 34, alignItems: 'flex-start', justifyContent: 'center' },
  side: { minWidth: 34, alignItems: 'flex-end', justifyContent: 'center' },
});
