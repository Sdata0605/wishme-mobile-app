import { endOfWeek, format, isAfter, isBefore, isToday, isTomorrow, startOfDay } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBanner, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { RECURRENCE_LABELS } from '@/services/hub/calendar';
import {
  DATED_GROUPS,
  GROUP_TITLES,
  deleteReminder,
  listReminders,
  setReminderDone,
  type Reminder,
  type ReminderGroup,
} from '@/services/hub/reminders';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

/** Which section a reminder belongs in, decided by its date alone. */
function groupFor(reminder: Reminder, now: Date): ReminderGroup {
  if (!reminder.due_at) return 'someday';
  const due = new Date(reminder.due_at);
  if (isToday(due)) return 'today';
  if (isTomorrow(due)) return 'tomorrow';
  if (isBefore(due, startOfDay(now))) return 'overdue';
  if (!isAfter(due, endOfWeek(now, { weekStartsOn: 1 }))) return 'week';
  return 'later';
}

function whenLabel(reminder: Reminder): string {
  if (!reminder.due_at) return 'No date';
  const due = new Date(reminder.due_at);
  const time = format(due, 'h:mm a');
  const day = isToday(due) ? 'Today' : isTomorrow(due) ? 'Tomorrow' : format(due, 'EEE d MMM');
  const lead = reminder.lead_minutes > 0 ? ` · ${reminder.lead_minutes} min early` : '';
  return `${day}, ${time}${lead}`;
}

function Row({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const done = reminder.status === 'done';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/reminder-edit', params: { id: reminder.id } } as never)}
      onLongPress={onDelete}
      delayLongPress={400}
      style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${reminder.title}, ${whenLabel(reminder)}${done ? ', done' : ''}`}
      accessibilityHint="Tap to edit, press and hold to delete"
    >
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={10}
        style={[
          s.check,
          { borderColor: done ? colors.success : colors.border },
          done && { backgroundColor: colors.success },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Mark ${reminder.title} as not done` : `Mark ${reminder.title} as done`}
      >
        {done ? <Icon name="check" size={13} color="#fff" /> : null}
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            s.rowTitle,
            { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? 'line-through' : 'none' },
          ]}
          numberOfLines={2}
        >
          {reminder.title}
        </Text>
        <Text style={[s.rowMeta, { color: colors.mutedForeground }]}>
          {whenLabel(reminder)}
          {reminder.recurrence !== 'none' ? ` · ${RECURRENCE_LABELS[reminder.recurrence]}` : ''}
        </Text>
        {reminder.status === 'missed' ? (
          <Text style={[s.rowMeta, { color: colors.warning }]}>This one was missed.</Text>
        ) : null}
      </View>

      <View style={s.icons}>
        <Icon
          name={reminder.delivery === 'call' ? 'phone' : 'bell'}
          size={16}
          color={reminder.style === 'alarm' ? colors.primary : colors.mutedForeground}
        />
        {reminder.escalate ? <Icon name="phone-call" size={13} color={colors.primary} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function RemindersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const session = await getValidSession();
    if (!session?.access_token) {
      setError('Please sign in again to see your reminders.');
      setReminders(null);
      return;
    }
    try {
      setReminders(await listReminders(session.access_token));
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Your reminders could not be loaded.');
      setReminders(null);
    }
  }, [getValidSession]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = useCallback(
    async (reminder: Reminder) => {
      const done = reminder.status !== 'done';
      setActionError(null);
      // Tick it straight away; a failure puts it back.
      setReminders((prev) =>
        prev?.map((r) =>
          r.id === reminder.id
            ? { ...r, status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null }
            : r,
        ) ?? prev,
      );
      const session = await getValidSession();
      if (!session?.access_token) {
        setActionError('Please sign in again.');
        void load();
        return;
      }
      try {
        await setReminderDone(session.access_token, reminder.id, done);
      } catch (ex) {
        setActionError(ex instanceof Error ? ex.message : 'That could not be saved.');
        void load();
      }
    },
    [getValidSession, load],
  );

  const confirmDelete = useCallback(
    (reminder: Reminder) => {
      const remove = async () => {
        setActionError(null);
        setReminders((prev) => prev?.filter((r) => r.id !== reminder.id) ?? prev);
        const session = await getValidSession();
        if (!session?.access_token) {
          setActionError('Please sign in again.');
          void load();
          return;
        }
        try {
          await deleteReminder(session.access_token, reminder.id);
        } catch (ex) {
          setActionError(ex instanceof Error ? ex.message : 'That could not be deleted.');
          void load();
        }
      };

      if (Platform.OS === 'web') {
        void remove();
        return;
      }
      Alert.alert('Delete this reminder?', reminder.title, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ]);
    },
    [getValidSession, load],
  );

  const sections = useMemo(() => {
    const now = new Date();
    const buckets: Record<ReminderGroup, Reminder[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      later: [],
      someday: [],
    };
    for (const reminder of reminders ?? []) buckets[groupFor(reminder, now)].push(reminder);
    return buckets;
  }, [reminders]);

  const hasAny = (reminders?.length ?? 0) > 0;

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title="Reminders"
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

      {actionError ? <ErrorBanner message={actionError} onRetry={() => void load()} /> : null}

      {reminders === null && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : reminders === null ? (
        <LoadingState label="Loading your reminders…" />
      ) : (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 60 : 120) }]}
          showsVerticalScrollIndicator={false}
        >
          {!hasAny ? (
            <EmptyState
              icon="bell"
              title="No reminders yet"
              message="Add one for something with a time, or jot a note down with no date for your Someday list."
              actionLabel="Add a reminder"
              onAction={() => router.push('/reminder-edit' as never)}
            />
          ) : (
            <>
              {DATED_GROUPS.map((group) =>
                sections[group].length === 0 ? null : (
                  <View key={group} style={{ gap: 10 }}>
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                      {GROUP_TITLES[group]}
                      <Text style={[s.count, { color: colors.mutedForeground }]}> {sections[group].length}</Text>
                    </Text>
                    {sections[group].map((reminder) => (
                      <Row
                        key={reminder.id}
                        reminder={reminder}
                        onToggle={() => void toggle(reminder)}
                        onDelete={() => confirmDelete(reminder)}
                      />
                    ))}
                  </View>
                ),
              )}

              <View style={{ gap: 10 }}>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                  {GROUP_TITLES.someday}
                  <Text style={[s.count, { color: colors.mutedForeground }]}> {sections.someday.length}</Text>
                </Text>
                <Text style={[s.sectionHint, { color: colors.mutedForeground }]}>
                  Notes with no date. They never go off — they just wait here until you give them a time.
                </Text>
                {sections.someday.length === 0 ? (
                  <Text style={[s.sectionHint, { color: colors.mutedForeground }]}>Nothing on the list.</Text>
                ) : (
                  sections.someday.map((reminder) => (
                    <Row
                      key={reminder.id}
                      reminder={reminder}
                      onToggle={() => void toggle(reminder)}
                      onDelete={() => confirmDelete(reminder)}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={() => router.push('/reminder-edit' as never)}
        style={[
          s.fab,
          { backgroundColor: colors.primary, shadowColor: colors.primary, bottom: insets.bottom + 28 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add a reminder"
      >
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 14, gap: 20 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sectionHint: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  icons: { alignItems: 'center', gap: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
