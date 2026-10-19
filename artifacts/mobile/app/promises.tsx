import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dueWords } from '@/services/assistant/everyday';
import { listOpenPromises, setPromiseStatus, type PromiseRow } from '@/services/assistant/promises';

/** PROMISES: what the user said they would do, noted by the assistant, until it is done. */
export default function PromisesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [rows, setRows] = useState<PromiseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const t = (await getValidSession())?.access_token;
    if (!t) {
      setError('Please sign in again to see your promises.');
      setRows(null);
      return;
    }
    try {
      setRows(await listOpenPromises(t, 100));
    } catch {
      setError('Your promises could not be loaded.');
      setRows(null);
    }
  }, [getValidSession]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const mark = async (p: PromiseRow, status: 'done' | 'cancelled') => {
    const t = (await getValidSession())?.access_token;
    if (!t) return;
    try {
      await setPromiseStatus(t, p.id, status);
    } catch {
      Alert.alert('Not saved', 'That change could not be saved. Please try again.');
    }
    await load();
  };

  return (
    <AmbientBackground>
      <View style={s.container}>
        <HubHeader title="Promises" />
        {rows === null && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : rows === null ? (
          <LoadingState label="Loading your promises…" />
        ) : (
          <ScrollView
            contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 100) }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
          >
            {!rows.length ? (
              <EmptyState icon="check-circle" title="Nothing outstanding" message={'When you tell the assistant "I\'ll send Ravi the proposal by Friday", it is kept here until you say it is done.'} />
            ) : (
              rows.map((p) => {
                const due = dueWords(p.due_at);
                return (
                  <View key={p.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.text, { color: colors.foreground }]}>{p.text}</Text>
                      <Text style={[s.meta, { color: due === 'overdue' ? colors.destructive : colors.mutedForeground }]}>
                        {[p.owed_to ? `To ${p.owed_to}` : '', due].filter(Boolean).join(' · ') || 'No date'}
                      </Text>
                      {p.quote ? <Text style={[s.quote, { color: colors.mutedForeground }]} numberOfLines={2}>“{p.quote}”</Text> : null}
                    </View>
                    <View style={s.actions}>
                      <TouchableOpacity onPress={() => void mark(p, 'done')} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Mark done: ${p.text}`}>
                        <Icon name="check-circle" size={22} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => void mark(p, 'cancelled')} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove: ${p.text}`}>
                        <Icon name="x" size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 14, gap: 12 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  text: { fontSize: 15.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 4 },
  quote: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 6 },
  actions: { alignItems: 'center', justifyContent: 'space-between', gap: 14 },
});
