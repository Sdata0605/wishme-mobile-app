import { format, formatDistanceToNow, isToday } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isActive, listAiCalls, whoLabel, type AiCall } from '@/services/assistant/aiCalls';
import { OUTCOME_LABELS, STATUS_LABELS } from '@/services/hub/callLogs';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

function durationLabel(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function whenLabel(call: AiCall): string {
  if (call.status === 'scheduled' && call.scheduled_for) {
    return `Planned for ${format(new Date(call.scheduled_for), 'd MMM, h:mm a')}`;
  }
  const at = new Date(call.created_at);
  return isToday(at)
    ? formatDistanceToNow(at, { addSuffix: true })
    : format(at, 'd MMM yyyy, h:mm a');
}

export default function CallLogsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [calls, setCalls] = useState<AiCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const session = await getValidSession();
    if (!session?.access_token) {
      setError('Please sign in again to see your call logs.');
      setCalls(null);
      return;
    }
    try {
      setCalls(await listAiCalls(session.access_token, 100));
    } catch {
      setError('Your call logs could not be loaded.');
      setCalls(null);
    }
  }, [getValidSession]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A call that is still going is worth refreshing on its own.
  const anyActive = useMemo(() => calls?.some((call) => isActive(call.status)) ?? false, [calls]);
  useFocusEffect(
    useCallback(() => {
      if (!anyActive) return;
      const timer = setInterval(() => void load(), 8000);
      return () => clearInterval(timer);
    }, [anyActive, load]),
  );

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title="Call logs"
        right={
          <TouchableOpacity
            onPress={() => void load()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      {calls === null && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : calls === null ? (
        <LoadingState label="Loading your calls…" />
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
          {calls.length === 0 ? (
            <EmptyState
              icon="phone"
              title="No calls yet"
              message={'Ask the assistant something like "call Dr Sharma\'s clinic and book an appointment for tomorrow at 5".'}
            />
          ) : (
            calls.map((call) => {
              const status = STATUS_LABELS[call.status] ?? STATUS_LABELS.failed;
              const length = durationLabel(call.duration_seconds);
              return (
                <TouchableOpacity
                  key={call.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/call-log/${call.id}` as never)}
                  style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Call with ${whoLabel(call)}, ${status.label}, ${whenLabel(call)}`}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.who, { color: colors.foreground }]} numberOfLines={1}>
                        {whoLabel(call)}
                      </Text>
                      <Text style={[s.purpose, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {call.purpose}
                      </Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: status.colour + '22' }]}>
                      <Text style={[s.chipText, { color: status.colour }]}>{status.label}</Text>
                    </View>
                  </View>

                  <Text style={[s.meta, { color: colors.mutedForeground }]}>
                    {whenLabel(call)}
                    {length ? ` · ${length}` : ''}
                    {call.outcome ? ` · ${OUTCOME_LABELS[call.outcome] ?? call.outcome}` : ''}
                  </Text>

                  {call.summary ? (
                    <Text style={[s.summary, { color: colors.foreground }]} numberOfLines={2}>
                      {call.summary}
                    </Text>
                  ) : isActive(call.status) ? (
                    <Text style={[s.summary, { color: colors.mutedForeground }]}>
                      The assistant is on it — the result will appear here.
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 14, gap: 12 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  who: { fontSize: 15.5, fontFamily: 'Inter_700Bold' },
  purpose: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 11.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
  summary: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 8 },
});
