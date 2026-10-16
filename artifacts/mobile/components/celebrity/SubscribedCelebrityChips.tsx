import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/**
 * "Select Celebrity" as a row of choice chips, the same control Image Promotions uses, listing only the
 * celebrities the user has subscribed to. Tapping the chosen chip again clears it.
 */
export function SubscribedCelebrityChips<T extends { id: string; name: string }>({
  celebrities,
  loading,
  hasNone,
  selectedId,
  onSelect,
  priceFor,
  accent = '#7B5CFA',
  invalid = false,
  emptyText = 'Subscribe to a celebrity to use this service.',
}: {
  celebrities: T[];
  loading: boolean;
  /** The user has no subscription at all (as opposed to none that offer this service). */
  hasNone: boolean;
  selectedId: string | null | undefined;
  onSelect: (celebrity: T | null) => void;
  /** Shown on each chip. Return null/0 to mark a celebrity as not offering this service (the chip is hidden). */
  priceFor?: (celebrity: T) => number | null;
  accent?: string;
  invalid?: boolean;
  emptyText?: string;
}) {
  const { colors } = useTheme();

  if (loading) return <ActivityIndicator color={accent} style={{ marginVertical: 8 }} />;

  const offered = priceFor ? celebrities.filter(c => (priceFor(c) ?? 0) > 0) : celebrities;

  if (hasNone || offered.length === 0) {
    return (
      <View style={[s.empty, { borderColor: invalid ? '#ef4444' : colors.border, backgroundColor: colors.card }]}>
        <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
          {hasNone
            ? emptyText
            : 'None of your subscribed celebrities offer this service yet.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/favorites' as never)}
          accessibilityRole="button"
          style={[s.emptyBtn, { backgroundColor: accent }]}
        >
          <Text style={s.emptyBtnText}>Browse & Subscribe</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {offered.map(c => {
        const on = selectedId === c.id;
        const price = priceFor?.(c);
        return (
          <TouchableOpacity
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(on ? null : c)}
            style={[
              s.chip,
              {
                backgroundColor: on ? accent : colors.muted,
                borderColor: on ? accent : invalid ? '#ef4444' : colors.border,
              },
            ]}
          >
            <Text style={[s.chipText, { color: on ? '#fff' : colors.foreground }]}>{c.name}</Text>
            {price ? <Text style={[s.chipPrice, { color: on ? '#fff' : colors.mutedForeground }]}>₹{price.toLocaleString('en-IN')}</Text> : null}
            {on ? <Icon name="check" size={13} color="#fff" /> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chips: { gap: 8, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipPrice: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  emptyBtn: { alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 9 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
