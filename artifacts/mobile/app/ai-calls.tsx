import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isActive, listAiCalls, whoLabel, type AiCall, type AiCallStatus } from '@/services/assistant/aiCalls';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const STATUS: Record<AiCallStatus, { label: string; color: string }> = {
  queued: { label: 'Starting', color: '#F59E0B' },
  scheduled: { label: 'Scheduled', color: '#B026FF' },
  ringing: { label: 'Ringing', color: '#F59E0B' },
  'in-progress': { label: 'On the call', color: '#22C55E' },
  completed: { label: 'Done', color: '#22C55E' },
  'no-answer': { label: 'No answer', color: '#9CA3AF' },
  busy: { label: 'Line busy', color: '#9CA3AF' },
  voicemail: { label: 'Voicemail', color: '#9CA3AF' },
  failed: { label: 'Failed', color: '#EF4444' },
};

const OUTCOME: Record<string, string> = {
  success: 'Task done',
  partial: 'Partly done',
  declined: 'They said no',
  no_info: 'Nothing learned',
  callback_requested: 'They asked for a callback',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function AiCallsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [calls, setCalls] = useState<AiCall[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = await getValidSession();
    if (!session?.access_token) return setCalls([]);
    setCalls(await listAiCalls(session.access_token));
  }, [getValidSession]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep a call that is still going up to date.
  const anyActive = useMemo(() => !!calls?.some((c) => isActive(c.status)), [calls]);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [anyActive, load]);

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <SettingsHeader title="AI calls" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
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
        <Text style={[s.intro, { color: colors.mutedForeground }]}>
          Calls your assistant made for you. Ask it, for example, to "call the clinic and book an appointment", and it will tell you what they said.
        </Text>

        {calls === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : calls.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Icon name="phone" size={30} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No AI calls yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
              Try saying: "Call Dr Sharma's clinic and book an appointment for tomorrow at 5."
            </Text>
          </View>
        ) : (
          calls.map((c) => {
            const st = STATUS[c.status] ?? STATUS.failed;
            const expanded = open === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                onPress={() => setOpen(expanded ? null : c.id)}
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`${whoLabel(c)}, ${st.label}`}
              >
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.who, { color: colors.foreground }]} numberOfLines={1}>
                      {whoLabel(c)}
                    </Text>
                    <Text style={[s.purpose, { color: colors.mutedForeground }]} numberOfLines={expanded ? 4 : 2}>
                      {c.purpose}
                    </Text>
                  </View>
                  <View style={[s.chip, { backgroundColor: st.color + '22' }]}>
                    <Text style={[s.chipText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={[s.time, { color: colors.mutedForeground }]}>
                  {c.status === 'scheduled' && c.scheduled_for ? `Planned for ${when(c.scheduled_for)}` : when(c.created_at)}
                  {c.duration_seconds ? ` · ${Math.max(1, Math.round(c.duration_seconds / 60))} min` : ''}
                </Text>

                {c.summary ? (
                  <Text style={[s.summary, { color: colors.foreground }]} numberOfLines={expanded ? undefined : 2}>
                    {c.summary}
                  </Text>
                ) : isActive(c.status) ? (
                  <Text style={[s.summary, { color: colors.mutedForeground }]}>The assistant is on it. The result will appear here.</Text>
                ) : null}

                {expanded ? (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {c.outcome ? (
                      <Text style={[s.label, { color: colors.primary }]}>{OUTCOME[c.outcome] ?? c.outcome}</Text>
                    ) : null}
                    {c.next_step ? (
                      <Text style={[s.next, { color: colors.foreground, backgroundColor: colors.primary + '14' }]}>
                        Next: {c.next_step}
                      </Text>
                    ) : null}
                    {c.error_message ? <Text style={{ color: '#EF4444', fontSize: 13 }}>{c.error_message}</Text> : null}
                    {c.transcript ? (
                      <View>
                        <Text style={[s.label, { color: colors.mutedForeground }]}>What was said</Text>
                        {c.transcript.split('\n').map((line, i) => {
                          const ai = line.startsWith('AI:');
                          return (
                            <Text key={i} style={[s.line, { color: ai ? colors.mutedForeground : colors.foreground }]}>
                              <Text style={{ fontFamily: 'Inter_700Bold' }}>{ai ? 'Assistant: ' : 'Them: '}</Text>
                              {line.replace(/^(AI|Them):\s*/, '')}
                            </Text>
                          );
                        })}
                      </View>
                    ) : null}
                    {c.recording_url ? (
                      <TouchableOpacity onPress={() => void Linking.openURL(c.recording_url!)} style={s.link}>
                        <Icon name="play" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Listen to the recording</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  intro: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', marginTop: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  who: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  purpose: { fontSize: 13.5, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  time: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
  summary: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_500Medium', marginTop: 8 },
  label: { fontSize: 12.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase' },
  next: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', padding: 10, borderRadius: 10, overflow: 'hidden' },
  line: { fontSize: 13.5, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
