import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MonthGrid, dayKey, type DayMarkers } from '@/components/hub/MonthGrid';
import { EmptyState, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  RECURRENCE_LABELS,
  expandEvents,
  listEvents,
  type CalendarEvent,
  type EventOccurrence,
} from '@/services/hub/calendar';
import { listRemindersBetween, type Reminder } from '@/services/hub/reminders';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

/** The grid always shows whole weeks, so the window is a little wider than the month itself. */
function gridWindow(month: Date): { from: Date; to: Date } {
  return {
    from: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    to: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  };
}

function timeLabel(occurrence: EventOccurrence): string {
  if (occurrence.event.all_day) return 'All day';
  const start = format(occurrence.start, 'h:mm a');
  return occurrence.end ? `${start} – ${format(occurrence.end, 'h:mm a')}` : start;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const session = await getValidSession();
    if (!session?.access_token) {
      setError('Please sign in again to see your calendar.');
      setEvents([]);
      return;
    }
    const { from, to } = gridWindow(month);
    try {
      const [eventRows, reminderRows] = await Promise.all([
        listEvents(session.access_token, from, to),
        listRemindersBetween(session.access_token, from, to),
      ]);
      setEvents(eventRows);
      setReminders(reminderRows);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Your calendar could not be loaded.');
      setEvents(null);
    }
  }, [getValidSession, month]);

  // Reload on every visit, so an event edited on the next screen is right when we come back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const occurrences = useMemo(() => {
    if (!events) return [];
    const { from, to } = gridWindow(month);
    return expandEvents(events, from, to);
  }, [events, month]);

  const markers = useMemo(() => {
    const out: Record<string, DayMarkers> = {};
    for (const occurrence of occurrences) {
      const key = dayKey(occurrence.start);
      out[key] = { events: (out[key]?.events ?? 0) + 1, reminders: out[key]?.reminders ?? 0 };
    }
    for (const reminder of reminders) {
      if (!reminder.due_at) continue;
      const key = dayKey(new Date(reminder.due_at));
      out[key] = { events: out[key]?.events ?? 0, reminders: (out[key]?.reminders ?? 0) + 1 };
    }
    return out;
  }, [occurrences, reminders]);

  const dayEvents = useMemo(
    () => occurrences.filter((o) => isSameDay(o.start, selected)),
    [occurrences, selected],
  );
  const dayReminders = useMemo(
    () => reminders.filter((r) => r.due_at !== null && isSameDay(new Date(r.due_at), selected)),
    [reminders, selected],
  );

  const addForSelectedDay = () => {
    // Open the new event on the day being looked at, at the top of the next hour.
    const start = new Date(selected);
    const now = new Date();
    start.setHours(isSameDay(selected, now) ? now.getHours() + 1 : 9, 0, 0, 0);
    router.push({ pathname: '/event-edit', params: { startsAt: start.toISOString() } } as never);
  };

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title="Calendar"
        right={
          <TouchableOpacity
            onPress={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              setSelected(today);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
          >
            <Text style={[s.today, { color: colors.primary }]}>Today</Text>
          </TouchableOpacity>
        }
      />

      {events === null && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : events === null ? (
        <LoadingState label="Loading your calendar…" />
      ) : (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 60 : 120) }]}
          showsVerticalScrollIndicator={false}
        >
          <MonthGrid
            month={month}
            selected={selected}
            markers={markers}
            onMonthChange={setMonth}
            onSelect={setSelected}
          />

          <Text style={[s.dayTitle, { color: colors.foreground }]}>{format(selected, 'EEEE, d MMMM yyyy')}</Text>

          {dayEvents.length === 0 && dayReminders.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nothing planned"
              message="This day is clear. Add an event if something is going in the diary."
              actionLabel="Add an event"
              onAction={addForSelectedDay}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {dayEvents.map((occurrence) => (
                <TouchableOpacity
                  key={occurrence.key}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({ pathname: '/event-edit', params: { id: occurrence.event.id } } as never)
                  }
                  style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Event: ${occurrence.event.title}, ${timeLabel(occurrence)}`}
                >
                  <View style={[s.stripe, { backgroundColor: occurrence.event.colour ?? colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {occurrence.event.title}
                    </Text>
                    <Text style={[s.rowMeta, { color: colors.mutedForeground }]}>
                      {timeLabel(occurrence)}
                      {occurrence.event.location ? ` · ${occurrence.event.location}` : ''}
                    </Text>
                    {occurrence.event.recurrence !== 'none' ? (
                      <Text style={[s.rowMeta, { color: colors.mutedForeground }]}>
                        {RECURRENCE_LABELS[occurrence.event.recurrence]}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}

              {dayReminders.map((reminder) => (
                <TouchableOpacity
                  key={reminder.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/reminder-edit', params: { id: reminder.id } } as never)}
                  style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Reminder: ${reminder.title}`}
                >
                  <View style={[s.stripe, { backgroundColor: colors.secondary }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.rowTitle,
                        {
                          color: colors.foreground,
                          textDecorationLine: reminder.status === 'done' ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {reminder.title}
                    </Text>
                    <Text style={[s.rowMeta, { color: colors.mutedForeground }]}>
                      Reminder · {reminder.due_at ? format(new Date(reminder.due_at), 'h:mm a') : 'no time'}
                    </Text>
                  </View>
                  <Icon
                    name={reminder.delivery === 'call' ? 'phone' : 'bell'}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error ? (
            <Text style={[s.staleNote, { color: colors.destructive }]} onPress={() => void load()}>
              {error} Tap to retry.
            </Text>
          ) : null}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={addForSelectedDay}
        style={[
          s.fab,
          { backgroundColor: colors.primary, shadowColor: colors.primary, bottom: insets.bottom + 28 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add an event"
      >
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 14, gap: 14 },
  today: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  dayTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTitle: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  staleNote: { fontSize: 12.5, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 8 },
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
