import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, StatusBadge, SectionEmpty, LoadingBox, Card, SectionTitle, PrimaryBtn, InputRow, styles } from './shared';
import type { TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

interface CelebEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  description: string;
  location?: string;
  is_public?: boolean;
  status: string;
}

const EVENT_TYPES = ['concert', 'meetup', 'birthday', 'anniversary', 'launch', 'charity', 'other'] as const;

const EMPTY_EVENT_FORM = { title: '', event_type: '', event_date: '', description: '', location: '', is_public: true };

export function EventsTab({ celebrity, colors, session }: TabProps) {
  const [events, setEvents] = useState<CelebEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CelebEvent | null>(null);
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_events?celebrity_id=eq.${celebrity.id}&order=event_date.asc&limit=30`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as CelebEvent[]; setEvents(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(EMPTY_EVENT_FORM);
    setShowForm(true);
  };

  const openEdit = (ev: CelebEvent) => {
    setEditingEvent(ev);
    setForm({ title: ev.title, event_type: ev.event_type, event_date: ev.event_date, description: ev.description || '', location: ev.location || '', is_public: ev.is_public ?? true });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingEvent(null); setForm(EMPTY_EVENT_FORM); };

  const saveEvent = async () => {
    if (!form.title || !form.event_type || !form.event_date) { Alert.alert('Fill title, type, and date'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingEvent;
      const body = isEdit
        ? { title: form.title, event_type: form.event_type, event_date: form.event_date, description: form.description, location: form.location, is_public: form.is_public }
        : { ...form, celebrity_id: celebrity.id };
      const res = await supabaseFetch(
        isEdit ? `/rest/v1/celebrity_events?id=eq.${editingEvent!.id}` : '/rest/v1/celebrity_events',
        { method: isEdit ? 'PATCH' : 'POST', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify(body) },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to save event (${res.status})`);
      } else {
        closeForm();
        fetchEvents();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save event');
    }
    setSaving(false);
  };

  const deleteEvent = (ev: CelebEvent) => {
    Alert.alert('Delete Event', `Delete "${ev.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!session?.access_token) return;
          setDeleting(ev.id);
          try {
            const res = await supabaseFetch(
              `/rest/v1/celebrity_events?id=eq.${ev.id}`,
              { method: 'DELETE', headers: { Prefer: 'return=minimal' } as Record<string, string> },
              session.access_token,
            );
            if (!res.ok) {
              const err = await res.json().catch(() => ({})) as Record<string, string>;
              Alert.alert('Error', err.message ?? `Failed to delete event (${res.status})`);
            } else {
              fetchEvents();
            }
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete event');
          }
          setDeleting(null);
        },
      },
    ]);
  };

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <View style={styles.rowBetween}>
        <SectionTitle text={`Events (${events.length})`} colors={colors} />
        <TouchableOpacity onPress={showForm ? closeForm : openCreate} style={{ padding: 4 }}>
          <Icon name={showForm ? 'x' : 'plus'} size={22} color="#7B5CFA" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 12 }]}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
          <InputRow label="Title" value={form.title} onChangeText={(v) => setForm(p => ({ ...p, title: v }))} colors={colors} />
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Event Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {EVENT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm(p => ({ ...p, event_type: t }))}
                style={[styles.chipBtn, { borderColor: form.event_type === t ? '#7B5CFA' : colors.border, backgroundColor: form.event_type === t ? '#7B5CFA18' : 'transparent' }]}
              >
                <Text style={{ color: form.event_type === t ? '#7B5CFA' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <InputRow label="Event Date (YYYY-MM-DD)" value={form.event_date} onChangeText={(v) => setForm(p => ({ ...p, event_date: v }))} colors={colors} />
          <InputRow label="Location" value={form.location} onChangeText={(v) => setForm(p => ({ ...p, location: v }))} colors={colors} />
          <InputRow label="Description" value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} colors={colors} multiline />
          <View style={[styles.rowBetween, { marginBottom: 16 }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Public Event</Text>
            <Switch
              value={form.is_public}
              onValueChange={(v) => setForm(p => ({ ...p, is_public: v }))}
              trackColor={{ false: colors.border, true: '#7B5CFA' }}
              thumbColor="#fff"
            />
          </View>
          <PrimaryBtn label={editingEvent ? 'Save Changes' : 'Create Event'} onPress={saveEvent} loading={saving} colors={colors} />
        </Card>
      )}

      {events.length === 0 && !showForm ? (
        <SectionEmpty icon="calendar" text="No events yet" colors={colors} />
      ) : (
        events.map(ev => (
          <Card key={ev.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{ev.title}</Text>
                {ev.description ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{ev.description}</Text> : null}
                {ev.location ? <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>📍 {ev.location}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusBadge status={ev.event_type} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => openEdit(ev)} style={{ padding: 4 }}>
                    <Icon name="edit-2" size={15} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteEvent(ev)} disabled={deleting === ev.id} style={{ padding: 4 }}>
                    {deleting === ev.id
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : <Icon name="trash-2" size={15} color="#EF4444" />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={[styles.rowBetween, { marginTop: 4 }]}>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(ev.event_date)}</Text>
              {ev.is_public === false && (
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Private</Text>
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}
