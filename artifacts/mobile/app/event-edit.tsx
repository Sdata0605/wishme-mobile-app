import { addHours, format, isBefore, startOfDay } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { DateTimeField } from '@/components/hub/DateTimeField';
import { ChoiceRow, FormField, FormSection, ToggleRow, type Choice } from '@/components/hub/FormControls';
import { ErrorBanner, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  RECURRENCE_LABELS,
  createEvent,
  deleteEvent,
  fetchEvent,
  updateEvent,
  type EventDraft,
  type EventSource,
  type Recurrence,
} from '@/services/hub/calendar';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const RECURRENCE_OPTIONS: Choice<Recurrence>[] = (
  ['none', 'daily', 'weekly', 'monthly', 'yearly'] as Recurrence[]
).map((value) => ({ value, label: RECURRENCE_LABELS[value] }));

/** Where mirrored events are really edited, so the user is not left wondering. */
const MIRROR_SOURCE: Record<Exclude<EventSource, 'user'>, string> = {
  occasion: 'This came from your occasions, and is kept up to date there.',
  booking: 'This came from one of your bookings, and is kept up to date there.',
};

export default function EventEditScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; startsAt?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [starts, setStarts] = useState<Date>(() => {
    const seeded = typeof params.startsAt === 'string' ? new Date(params.startsAt) : null;
    if (seeded && !Number.isNaN(seeded.getTime())) return seeded;
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return addHours(now, 1);
  });
  const [hasEnd, setHasEnd] = useState(false);
  const [ends, setEnds] = useState<Date>(() => addHours(new Date(), 2));
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [source, setSource] = useState<EventSource>('user');

  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    const session = await getValidSession();
    if (!session?.access_token) {
      setLoadError('Please sign in again to open this event.');
      setLoading(false);
      return;
    }
    try {
      const row = await fetchEvent(session.access_token, id);
      if (!row) {
        setLoadError('That event is no longer there.');
        return;
      }
      setTitle(row.title);
      setNotes(row.notes ?? '');
      setLocation(row.location ?? '');
      setAllDay(row.all_day);
      setStarts(new Date(row.starts_at));
      setHasEnd(row.ends_at !== null);
      setEnds(row.ends_at ? new Date(row.ends_at) : addHours(new Date(row.starts_at), 1));
      setRecurrence(row.recurrence);
      setSource(row.source);
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'That event could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [getValidSession, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The finish time only shows a clock, so its date has to follow the start's. */
  const changeStarts = useCallback(
    (next: Date) => {
      setStarts(next);
      setEnds((prev) => {
        const moved = new Date(next);
        moved.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
        return isBefore(moved, next) ? addHours(next, 1) : moved;
      });
    },
    [],
  );

  const changeEnds = useCallback(
    (next: Date) => {
      // Likewise: the picker hands back a clock time, which belongs on the start's day.
      const moved = new Date(starts);
      moved.setHours(next.getHours(), next.getMinutes(), 0, 0);
      setEnds(isBefore(moved, starts) ? addHours(starts, 1) : moved);
    },
    [starts],
  );

  const save = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setSaveError('Give the event a title first.');
      return;
    }
    // An all-day event sits on the whole day, so it keeps no end instant of its own.
    const startsAt = allDay ? startOfDay(starts) : starts;
    const endsAt = allDay || !hasEnd ? null : ends;
    if (endsAt && isBefore(endsAt, startsAt)) {
      setSaveError('The event cannot finish before it starts.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    const session = await getValidSession();
    if (!session?.access_token || !user?.id) {
      setSaveError('Please sign in again to save this.');
      setSaving(false);
      return;
    }

    const draft: EventDraft = {
      title: trimmed,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      location: location.trim().length > 0 ? location.trim() : null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      all_day: allDay,
      recurrence,
      recurrence_until: null,
    };

    try {
      if (id) await updateEvent(session.access_token, id, draft);
      else await createEvent(session.access_token, user.id, draft);
      router.back();
    } catch (ex) {
      setSaveError(ex instanceof Error ? ex.message : 'The event could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [allDay, ends, getValidSession, hasEnd, id, location, notes, recurrence, starts, title, user?.id]);

  const confirmDelete = useCallback(() => {
    if (!id) return;
    const remove = async () => {
      const session = await getValidSession();
      if (!session?.access_token) {
        setSaveError('Please sign in again.');
        return;
      }
      try {
        await deleteEvent(session.access_token, id);
        router.back();
      } catch (ex) {
        setSaveError(ex instanceof Error ? ex.message : 'The event could not be deleted.');
      }
    };
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert('Delete this event?', title, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }, [getValidSession, id, title]);

  const heading = id ? 'Event' : 'New event';
  const readOnly = source !== 'user';

  if (loading) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title={heading} />
        <LoadingState label="Loading this event…" />
      </View></AmbientBackground>
    );
  }

  if (loadError) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title={heading} />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </View></AmbientBackground>
    );
  }

  if (readOnly) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title={heading} />
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 60 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.notice, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '55' }]}>
            <Icon name="info" size={16} color={colors.primary} />
            <Text style={[s.noticeText, { color: colors.foreground }]}>
              {MIRROR_SOURCE[source as Exclude<EventSource, 'user'>]}
            </Text>
          </View>
          <Text style={[s.readTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[s.note, { color: colors.mutedForeground }]}>
            {allDay
              ? `All day, ${format(starts, 'EEE d MMM yyyy')}`
              : `${format(starts, 'EEE d MMM yyyy, h:mm a')}${hasEnd ? ` – ${format(ends, 'h:mm a')}` : ''}`}
          </Text>
          {location ? <Text style={[s.note, { color: colors.mutedForeground }]}>{location}</Text> : null}
          {notes ? <Text style={[s.note, { color: colors.foreground }]}>{notes}</Text> : null}
        </KeyboardAwareScrollViewCompat>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title={heading}
        right={
          <TouchableOpacity
            onPress={() => void save()}
            disabled={saving}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save this event"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[s.save, { color: colors.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        }
      />

      {saveError ? <ErrorBanner message={saveError} onRetry={() => void save()} /> : null}

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <FormField
          label="What is it?"
          value={title}
          onChangeText={setTitle}
          placeholder="Dentist appointment"
          maxLength={200}
        />
        <FormField
          label="Where"
          hint="A place or a meeting link — whatever helps you get there."
          value={location}
          onChangeText={setLocation}
          placeholder="Optional"
          maxLength={300}
        />

        <FormSection title="When" hint="An event takes up time on your calendar. A reminder does not.">
          <ToggleRow
            label="All day"
            help="On: it sits across the whole day with no particular time."
            value={allDay}
            onChange={setAllDay}
          />
          <View style={s.pair}>
            <DateTimeField label="Date" mode="date" value={starts} onChange={changeStarts} />
            {allDay ? null : <DateTimeField label="Starts" mode="time" value={starts} onChange={changeStarts} />}
          </View>

          {allDay ? null : (
            <>
              <ToggleRow
                label="Set a finish time"
                help="Leave off if you don't know yet how long it will take."
                value={hasEnd}
                onChange={(next) => {
                  setHasEnd(next);
                  if (next) setEnds(addHours(starts, 1));
                }}
              />
              {hasEnd ? (
                <View style={s.pair}>
                  <DateTimeField label="Finishes" mode="time" value={ends} onChange={changeEnds} />
                </View>
              ) : null}
            </>
          )}

          <ChoiceRow
            label="Repeat"
            hint="A repeating event shows on every matching day without being entered again."
            options={RECURRENCE_OPTIONS}
            value={recurrence}
            onChange={setRecurrence}
          />
          <Text style={[s.note, { color: colors.mutedForeground }]}>
            Saved as{' '}
            {allDay
              ? `all day on ${format(starts, 'EEE d MMM yyyy')}`
              : format(starts, 'EEE d MMM yyyy, h:mm a')}{' '}
            in your local time.
          </Text>
        </FormSection>

        <FormField
          label="Notes"
          hint="The agenda, what to bring, who you are meeting."
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
          maxLength={2000}
        />

        {id ? (
          <TouchableOpacity
            onPress={confirmDelete}
            style={[s.delete, { borderColor: colors.destructive }]}
            accessibilityRole="button"
            accessibilityLabel="Delete this event"
          >
            <Icon name="trash-2" size={16} color={colors.destructive} />
            <Text style={[s.deleteText, { color: colors.destructive }]}>Delete this event</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 18, paddingTop: 4 },
  save: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  pair: { flexDirection: 'row', gap: 10, marginTop: 14 },
  note: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 10 },
  readTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 18 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  noticeText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  deleteText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
