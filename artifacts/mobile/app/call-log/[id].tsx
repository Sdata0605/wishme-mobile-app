import { format } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { RecordingPlayer } from '@/components/hub/RecordingPlayer';
import { ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { fetchAiCall, isActive, whoLabel, type AiCall } from '@/services/assistant/aiCalls';
import {
  OUTCOME_LABELS,
  STATUS_LABELS,
  listCallLines,
  parseTranscriptText,
  type TranscriptLine,
} from '@/services/hub/callLogs';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

function durationLabel(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

export default function CallLogDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [call, setCall] = useState<AiCall | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const session = await getValidSession();
    return session?.access_token ?? null;
  }, [getValidSession]);

  const load = useCallback(async () => {
    if (!id) {
      setError('That call could not be found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setError('Please sign in again to see this call.');
      setLoading(false);
      return;
    }
    try {
      const row = await fetchAiCall(token, id);
      if (!row) {
        setError('That call is no longer there.');
        return;
      }
      setCall(row);

      // Lines are the live record. Older calls only have the single block of text.
      const saved = await listCallLines(token, id).catch(() => [] as TranscriptLine[]);
      setLines(saved.length > 0 ? saved : row.transcript ? parseTranscriptText(row.transcript) : []);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'That call could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title="Call" />
        <LoadingState label="Loading this call…" />
      </View></AmbientBackground>
    );
  }

  if (error || !call) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title="Call" />
        <ErrorState message={error ?? 'That call could not be loaded.'} onRetry={() => void load()} />
      </View></AmbientBackground>
    );
  }

  const status = STATUS_LABELS[call.status] ?? STATUS_LABELS.failed;
  const length = durationLabel(call.duration_seconds);

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader title={whoLabel(call)} />
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 100) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headRow}>
          <View style={[s.chip, { backgroundColor: status.colour + '22' }]}>
            <Text style={[s.chipText, { color: status.colour }]}>{status.label}</Text>
          </View>
          {call.outcome ? (
            <View style={[s.chip, { backgroundColor: colors.primary + '1F' }]}>
              <Text style={[s.chipText, { color: colors.primary }]}>
                {OUTCOME_LABELS[call.outcome] ?? call.outcome}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[s.meta, { color: colors.mutedForeground }]}>
          {format(new Date(call.created_at), 'EEE d MMM yyyy, h:mm a')}
          {length ? ` · ${length}` : ''}
        </Text>

        <Text style={[s.label, { color: colors.mutedForeground }]}>Why it called</Text>
        <Text style={[s.paragraph, { color: colors.foreground }]}>{call.purpose}</Text>
        {call.details ? <Text style={[s.paragraph, { color: colors.mutedForeground }]}>{call.details}</Text> : null}

        {call.summary ? (
          <>
            <Text style={[s.label, { color: colors.mutedForeground }]}>What happened</Text>
            <Text style={[s.paragraph, { color: colors.foreground }]}>{call.summary}</Text>
          </>
        ) : isActive(call.status) ? (
          <Text style={[s.paragraph, { color: colors.mutedForeground }]}>
            The call is still going. What was said will appear below as it happens.
          </Text>
        ) : null}

        {call.next_step ? (
          <View style={[s.next, { backgroundColor: colors.primary + '14' }]}>
            <Icon name="arrow-right" size={15} color={colors.primary} />
            <Text style={[s.nextText, { color: colors.foreground }]}>{call.next_step}</Text>
          </View>
        ) : null}

        {call.error_message ? (
          <Text style={[s.paragraph, { color: colors.destructive }]}>{call.error_message}</Text>
        ) : null}

        {call.recording_url ? (
          <>
            <Text style={[s.label, { color: colors.mutedForeground }]}>Recording</Text>
            <RecordingPlayer callId={call.id} getAccessToken={getAccessToken} />
          </>
        ) : null}

        <Text style={[s.label, { color: colors.mutedForeground }]}>What was said</Text>
        {lines.length === 0 ? (
          <Text style={[s.paragraph, { color: colors.mutedForeground }]}>
            {isActive(call.status)
              ? 'Nothing has been said yet.'
              : 'No conversation was saved for this call.'}
          </Text>
        ) : (
          <View style={s.chat}>
            {lines.map((line) => {
              const fromAssistant = line.role === 'assistant';
              return (
                <View
                  key={line.key}
                  style={[
                    s.bubble,
                    fromAssistant
                      ? { alignSelf: 'flex-start', backgroundColor: colors.muted }
                      : { alignSelf: 'flex-end', backgroundColor: colors.primary + '1F' },
                  ]}
                  accessibilityLabel={`${fromAssistant ? 'Assistant' : whoLabel(call)}: ${line.message}`}
                >
                  <Text style={[s.bubbleWho, { color: colors.mutedForeground }]}>
                    {fromAssistant ? 'Assistant' : whoLabel(call)}
                  </Text>
                  <Text style={[s.bubbleText, { color: colors.foreground }]}>{line.message}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 18 },
  headRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 11.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 10 },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 22,
  },
  paragraph: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 6 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 16 },
  nextText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  chat: { marginTop: 10, gap: 8 },
  bubble: { maxWidth: '86%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleWho: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
});
