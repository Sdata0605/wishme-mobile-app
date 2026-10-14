import { format, setHours, setMinutes } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { DateTimeField } from '@/components/hub/DateTimeField';
import { ChoiceRow, FormField, FormSection, ToggleRow, type Choice } from '@/components/hub/FormControls';
import { ErrorBanner, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { checkPhoneNumber } from '@/services/assistant/aiCalls';
import { syncScheduledReminders } from '@/services/hub/notifications';
import { RECURRENCE_LABELS, type Recurrence } from '@/services/hub/calendar';
import {
  DEFAULT_DRAFT,
  DELIVERY_HELP,
  STYLE_HELP,
  createReminder,
  deleteReminder,
  fetchReminder,
  updateReminder,
  type ReminderDelivery,
  type ReminderDraft,
  type ReminderStyle,
} from '@/services/hub/reminders';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const STYLE_OPTIONS: Choice<ReminderStyle>[] = (['alarm', 'reminder', 'quiet'] as ReminderStyle[]).map((value) => ({
  value,
  label: STYLE_HELP[value].label,
  help: STYLE_HELP[value].help,
}));

const DELIVERY_OPTIONS: Choice<ReminderDelivery>[] = (['notification', 'call'] as ReminderDelivery[]).map((value) => ({
  value,
  label: DELIVERY_HELP[value].label,
  help: DELIVERY_HELP[value].help,
}));

const RECURRENCE_OPTIONS: Choice<Recurrence>[] = (
  ['none', 'daily', 'weekly', 'monthly', 'yearly'] as Recurrence[]
).map((value) => ({ value, label: RECURRENCE_LABELS[value] }));

/** Minutes before the moment itself. Stored in `lead_minutes`. */
const LEAD_OPTIONS: Choice<string>[] = [
  { value: '0', label: 'On time', help: 'It speaks up at the exact moment you set.' },
  { value: '5', label: '5 min before', help: 'Just enough warning to put the kettle down.' },
  { value: '15', label: '15 min before', help: 'Time to wrap up what you are doing.' },
  { value: '60', label: '1 hour before', help: 'Useful when you have to travel to it.' },
  { value: '1440', label: '1 day before', help: 'For things you have to prepare for.' },
];

const ESCALATE_OPTIONS: Choice<string>[] = [
  { value: '2', label: '2 min' },
  { value: '3', label: '3 min' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
];

/** A sensible first guess: the top of the next hour, today. */
function defaultDue(): Date {
  const now = new Date();
  return setMinutes(setHours(now, now.getHours() + 1), 0);
}

export default function ReminderEditScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; dueAt?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;

  const [draft, setDraft] = useState<ReminderDraft>(DEFAULT_DRAFT);
  const [hasDate, setHasDate] = useState(false);
  const [due, setDue] = useState<Date>(defaultDue);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh reminders can arrive with a moment already chosen (from the calendar, for example).
  useEffect(() => {
    if (id || typeof params.dueAt !== 'string') return;
    const seeded = new Date(params.dueAt);
    if (!Number.isNaN(seeded.getTime())) {
      setDue(seeded);
      setHasDate(true);
    }
  }, [id, params.dueAt]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    const session = await getValidSession();
    if (!session?.access_token) {
      setLoadError('Please sign in again to edit this reminder.');
      setLoading(false);
      return;
    }
    try {
      const row = await fetchReminder(session.access_token, id);
      if (!row) {
        setLoadError('That reminder is no longer there.');
        return;
      }
      setDraft({
        title: row.title,
        notes: row.notes,
        due_at: row.due_at,
        pin_to_timezone: row.pin_to_timezone,
        lead_minutes: row.lead_minutes,
        delivery: row.delivery,
        style: row.style,
        recurrence: row.recurrence,
        recurrence_until: row.recurrence_until,
        escalate: row.escalate,
        escalate_after_minutes: row.escalate_after_minutes,
        escalate_phone: row.escalate_phone,
      });
      setHasDate(row.due_at !== null);
      if (row.due_at) setDue(new Date(row.due_at));
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'That reminder could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [getValidSession, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // A reminder saved elsewhere may carry a lead time that is not one of the offered ones; show it
  // as an extra choice rather than quietly snapping it to something else.
  const leadOptions = useMemo<Choice<string>[]>(() => {
    const stored = String(draft.lead_minutes);
    if (LEAD_OPTIONS.some((option) => option.value === stored)) return LEAD_OPTIONS;
    return [
      ...LEAD_OPTIONS,
      { value: stored, label: `${draft.lead_minutes} min before`, help: 'The warning already saved for this one.' },
    ];
  }, [draft.lead_minutes]);

  const save = useCallback(async () => {
    const title = draft.title.trim();
    if (title.length === 0) {
      setSaveError('Give the reminder a title first.');
      return;
    }

    let phone = draft.escalate_phone;
    if (draft.escalate) {
      const check = checkPhoneNumber(phone ?? user?.phone ?? '');
      if (!check.ok) {
        setSaveError(check.reason);
        return;
      }
      phone = check.e164;
    }

    setSaving(true);
    setSaveError(null);
    const session = await getValidSession();
    if (!session?.access_token || !user?.id) {
      setSaveError('Please sign in again to save this.');
      setSaving(false);
      return;
    }

    const payload: ReminderDraft = {
      ...draft,
      title,
      notes: draft.notes && draft.notes.trim().length > 0 ? draft.notes.trim() : null,
      due_at: hasDate ? due.toISOString() : null,
      // Pinning and repeating only mean anything once there is a moment to pin or repeat.
      pin_to_timezone: hasDate ? draft.pin_to_timezone : false,
      recurrence: hasDate ? draft.recurrence : 'none',
      escalate_phone: draft.escalate ? phone : null,
    };

    try {
      if (id) await updateReminder(session.access_token, id, payload);
      else await createReminder(session.access_token, user.id, payload);
      // Put it on the phone's own scheduler now; waiting for the next app start meant a reminder
      // made here never rang. Always run, so switching a reminder to "call" also drops its old alert.
      const { permission } = await syncScheduledReminders(session.access_token, { ask: true });
      if (permission === 'blocked' && payload.delivery === 'notification') {
        Alert.alert(
          'Notifications are off',
          'Your reminder is saved, but WishMe is not allowed to show notifications, so it will not alert you. Turn them on in Settings.',
          [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }],
        );
      }
      router.back();
    } catch (ex) {
      setSaveError(ex instanceof Error ? ex.message : 'The reminder could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [draft, due, getValidSession, hasDate, id, user?.id, user?.phone]);

  const confirmDelete = useCallback(() => {
    if (!id) return;
    const remove = async () => {
      const session = await getValidSession();
      if (!session?.access_token) {
        setSaveError('Please sign in again.');
        return;
      }
      try {
        await deleteReminder(session.access_token, id);
        router.back();
      } catch (ex) {
        setSaveError(ex instanceof Error ? ex.message : 'The reminder could not be deleted.');
      }
    };
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert('Delete this reminder?', draft.title, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }, [draft.title, getValidSession, id]);

  if (loading) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title={id ? 'Edit reminder' : 'New reminder'} />
        <LoadingState label="Loading this reminder…" />
      </View></AmbientBackground>
    );
  }

  if (loadError) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <HubHeader title={id ? 'Edit reminder' : 'New reminder'} />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title={id ? 'Edit reminder' : 'New reminder'}
        right={
          <TouchableOpacity
            onPress={() => void save()}
            disabled={saving}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save this reminder"
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
          label="What should I remind you about?"
          value={draft.title}
          onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))}
          placeholder="Call Raj about the invoice"
          maxLength={200}
        />
        <FormField
          label="Notes"
          hint="Anything extra you want in front of you when it goes off."
          value={draft.notes ?? ''}
          onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))}
          placeholder="Optional"
          multiline
          maxLength={2000}
        />

        <FormSection
          title="When"
          hint="Leave this off and it goes on your Someday list instead, where it waits without going off."
        >
          <ToggleRow
            label="Give it a date and time"
            help="Off means no date at all — it will never ring, it just sits on the list."
            value={hasDate}
            onChange={setHasDate}
          />
          {hasDate ? (
            <>
              <View style={s.pair}>
                <DateTimeField label="Date" mode="date" value={due} onChange={setDue} />
                <DateTimeField label="Time" mode="time" value={due} onChange={setDue} />
              </View>
              <Text style={[s.note, { color: colors.mutedForeground }]}>
                Saved as {format(due, 'EEE d MMM yyyy, h:mm a')} in your local time.
              </Text>

              <ChoiceRow
                label="Warn me"
                hint="How far ahead of that moment you want to hear about it."
                options={leadOptions}
                value={String(draft.lead_minutes)}
                onChange={(next) => setDraft((prev) => ({ ...prev, lead_minutes: Number(next) }))}
              />

              <ChoiceRow
                label="Repeat"
                hint="Repeating reminders come back on their own until you delete them."
                options={RECURRENCE_OPTIONS}
                value={draft.recurrence}
                onChange={(recurrence) => setDraft((prev) => ({ ...prev, recurrence }))}
              />

              <ToggleRow
                label="Keep the clock time if I travel"
                help="On: 7 am stays 7 am wherever you are. Off: it keeps the same moment in time."
                value={draft.pin_to_timezone}
                onChange={(pin_to_timezone) => setDraft((prev) => ({ ...prev, pin_to_timezone }))}
              />
            </>
          ) : null}
        </FormSection>

        <FormSection title="How it reaches you">
          <ChoiceRow
            label="Delivery"
            options={DELIVERY_OPTIONS}
            value={draft.delivery}
            onChange={(delivery) => setDraft((prev) => ({ ...prev, delivery }))}
          />
          <ChoiceRow
            label="Style"
            options={STYLE_OPTIONS}
            value={draft.style}
            onChange={(style) => setDraft((prev) => ({ ...prev, style }))}
          />
        </FormSection>

        <FormSection
          title="If you don't respond"
          hint="Only for things you really cannot miss. Nothing here happens unless you switch it on."
        >
          <ToggleRow
            label="Ring me if I don't respond"
            help="If you have not dismissed the reminder in time, the assistant phones you."
            value={draft.escalate}
            onChange={(escalate) =>
              setDraft((prev) => ({
                ...prev,
                escalate,
                escalate_phone: escalate ? (prev.escalate_phone ?? user?.phone ?? null) : prev.escalate_phone,
              }))
            }
          />
          {draft.escalate ? (
            <>
              <ChoiceRow
                label="Wait this long first"
                hint="How long to give you to deal with it before the phone starts ringing."
                options={ESCALATE_OPTIONS}
                value={String(draft.escalate_after_minutes)}
                onChange={(next) => setDraft((prev) => ({ ...prev, escalate_after_minutes: Number(next) }))}
              />
              <FormField
                label="Number to ring"
                hint="Your own Indian mobile number. The assistant never calls emergency numbers."
                value={draft.escalate_phone ?? ''}
                onChangeText={(escalate_phone) => setDraft((prev) => ({ ...prev, escalate_phone }))}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />
            </>
          ) : null}
        </FormSection>

        {id ? (
          <TouchableOpacity
            onPress={confirmDelete}
            style={[s.delete, { borderColor: colors.destructive }]}
            accessibilityRole="button"
            accessibilityLabel="Delete this reminder"
          >
            <Icon name="trash-2" size={16} color={colors.destructive} />
            <Text style={[s.deleteText, { color: colors.destructive }]}>Delete this reminder</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[s.note, { color: colors.mutedForeground }]}>
          Reminders are sent by our servers, so they still arrive when the app is closed. Your phone's own
          battery and Do Not Disturb settings can still delay one, so please don't rely on it for anything
          life-critical.
        </Text>
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
