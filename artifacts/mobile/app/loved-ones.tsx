import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField, prettyDate } from '@/components/DatePickerField';
import { fetchAlerts as loadOccasionAlerts, normType, scheduleOccasionNotifications } from '@/services/occasionAlerts';
import { Icon } from '@/components/Icon';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const RELATIONS = ['Family', 'Friend', 'Partner', 'Colleague', 'Other'];
const OCCASION_TYPES = ['Birthday', 'Anniversary', 'Wedding', 'Festival', 'Other'];

interface OccasionItem {
  id: string;
  name: string;
  date: string;
  type: string;
}

interface LovedOne {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  relationship: string;
  email?: string;
  phone?: string;
  notes?: string;
  occasions: OccasionItem[];
}

const RELATION_COLORS: Record<string, string> = {
  Family: '#1F7BFF',
  Friend: '#22C55E',
  Partner: '#D23FE0',
  Colleague: '#F59E0B',
  Other: '#6B7280',
};

function getInitials(firstName: string, lastName: string) {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?';
}

function getRelColor(rel: string) {
  return RELATION_COLORS[rel] ?? '#6B7280';
}

function getDaysUntilBirthday(dob: string | null): number | null {
  if (!dob) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dob.split('-');
  if (parts.length < 3) return null;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const thisYear = today.getFullYear();
  let next = new Date(thisYear, month, day);
  next.setHours(0, 0, 0, 0);
  if (next < today) {
    next = new Date(thisYear + 1, month, day);
    next.setHours(0, 0, 0, 0);
  }
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function typeColor(t: string) {
  const m: Record<string, string> = {
    Birthday: '#7B5CFA',
    Anniversary: '#D23FE0',
    Wedding: '#1F7BFF',
    Festival: '#3B5BDB',
    Other: '#22C55E',
  };
  return m[t] ?? '#6B7280';
}

export default function LovedOnesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [items, setItems] = useState<LovedOne[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<LovedOne | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    relationship: 'Friend',
    notes: '',
  });

  const [occasionModal, setOccasionModal] = useState(false);
  const [occasionTarget, setOccasionTarget] = useState<LovedOne | null>(null);
  const [localOccasions, setLocalOccasions] = useState<OccasionItem[]>([]);
  const [addOccName, setAddOccName] = useState('');
  const [addOccDate, setAddOccDate] = useState('');
  const [addOccType, setAddOccType] = useState('Birthday');
  const [showAddOcc, setShowAddOcc] = useState(false);
  const [occSaving, setOccSaving] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<LovedOne | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLovedOnes = useCallback(async () => {
    if (!user?.profileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await supabaseFetch(
        `/rest/v1/loved_ones?user_id=eq.${user.profileId}&order=first_name.asc`,
        {},
        session?.access_token,
      );
      if (!res.ok) {
        const msg = await parseApiError(res);
        setFetchError(msg);
        setLoading(false);
        return;
      }
      const data = await res.json() as LovedOne[];
      setItems(data.map(d => ({ ...d, occasions: Array.isArray(d.occasions) ? d.occasions : [] })));
    } catch {
      setFetchError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user?.profileId, session?.access_token]);

  useEffect(() => {
    fetchLovedOnes();
  }, [fetchLovedOnes]);

  const openAdd = () => {
    setEditTarget(null);
    setSaveError(null);
    setDraft({ firstName: '', lastName: '', email: '', phone: '', dob: '', relationship: 'Friend', notes: '' });
    setEditModal(true);
  };

  const openEdit = (item: LovedOne) => {
    setEditTarget(item);
    setSaveError(null);
    setDraft({
      firstName: item.first_name ?? '',
      lastName: item.last_name ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      dob: item.date_of_birth ?? '',
      relationship: RELATIONS.includes(item.relationship) ? item.relationship : 'Other',
      notes: item.notes ?? '',
    });
    setEditModal(true);
  };

  const saveDraft = async () => {
    if (!draft.firstName.trim()) {
      setSaveError('First name is required.');
      return;
    }
    if (!user?.profileId) {
      setSaveError('Not signed in. Please log in and try again.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        user_id: user.profileId,
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        date_of_birth: draft.dob.trim() || null,
        relationship: draft.relationship,
        notes: draft.notes.trim() || null,
      };

      if (editTarget) {
        const res = await supabaseFetch(
          `/rest/v1/loved_ones?id=eq.${editTarget.id}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' } as Record<string, string>,
            body: JSON.stringify(payload),
          },
          session?.access_token,
        );
        if (!res.ok) {
          const msg = await parseApiError(res);
          setSaveError(msg);
          return;
        }
      } else {
        const res = await supabaseFetch(
          '/rest/v1/loved_ones',
          {
            method: 'POST',
            headers: { Prefer: 'return=minimal' } as Record<string, string>,
            body: JSON.stringify({ ...payload, occasions: [] }),
          },
          session?.access_token,
        );
        if (!res.ok) {
          const msg = await parseApiError(res);
          setSaveError(msg);
          return;
        }
      }
      setEditModal(false);
      await fetchLovedOnes();
    } catch {
      setSaveError('Network error. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: LovedOne) => {
    setDeleteConfirmTarget(item);
    setDeleteConfirmModal(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirmTarget) return;
    setDeleting(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/loved_ones?id=eq.${deleteConfirmTarget.id}`,
        { method: 'DELETE' },
        session?.access_token,
      );
      if (!res.ok) {
        const msg = await parseApiError(res);
        Alert.alert('Error', msg);
        return;
      }
      setDeleteConfirmModal(false);
      setDeleteConfirmTarget(null);
      await fetchLovedOnes();
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setDeleting(false);
    }
  };

  const openOccasions = (item: LovedOne) => {
    setOccasionTarget(item);
    setLocalOccasions([...(item.occasions ?? [])]);
    setAddOccName('');
    setAddOccDate('');
    setAddOccType('Birthday');
    setShowAddOcc(false);
    setOccError(null);
    setOccasionModal(true);
  };

  const addOccasion = () => {
    if (!addOccName.trim() || !addOccDate) return;
    const newOcc: OccasionItem = {
      id: `occ${Date.now()}`,
      name: addOccName.trim(),
      date: addOccDate.trim(),
      type: addOccType,
    };
    setLocalOccasions(prev => [...prev, newOcc]);
    setAddOccName('');
    setAddOccDate('');
    setAddOccType('Birthday');
    setShowAddOcc(false);
  };

  const removeLocalOccasion = (id: string) => {
    setLocalOccasions(prev => prev.filter(o => o.id !== id));
  };

  const saveOccasions = async () => {
    if (!occasionTarget) return;
    if (!user?.profileId) return;
    setOccSaving(true);
    setOccError(null);
    try {
      const res = await supabaseFetch(
        `/rest/v1/loved_ones?id=eq.${occasionTarget.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ occasions: localOccasions }),
        },
        session?.access_token,
      );
      if (!res.ok) {
        const msg = await parseApiError(res);
        setOccError(msg);
        return;
      }

      const previousOccasions = occasionTarget.occasions ?? [];
      const currentIds = new Set(localOccasions.map((o) => o.id));
      const toDelete = previousOccasions.filter((o) => !currentIds.has(o.id));

      let syncFailed = false;

      for (const occ of toDelete) {
        const dr = await supabaseFetch(
          `/rest/v1/occasion_alerts?user_id=eq.${user.profileId}&loved_one_id=eq.${occasionTarget.id}&occasion_name=eq.${encodeURIComponent(occ.name)}`,
          { method: 'DELETE' },
          session?.access_token,
        ).catch(() => null);
        if (!dr || !dr.ok) syncFailed = true;
      }

      for (const occ of localOccasions) {
        if (!occ.date) continue; // an alert needs a date
        const ir = await supabaseFetch(
          '/rest/v1/occasion_alerts?on_conflict=user_id,loved_one_id,occasion_name',
          {
            method: 'POST',
            headers: {
              Prefer: 'resolution=merge-duplicates,return=minimal',
            } as Record<string, string>,
            body: JSON.stringify({
              user_id: user.profileId,
              loved_one_id: occasionTarget.id,
              occasion_name: occ.name,
              occasion_type: normType(occ.type),
              occasion_date: occ.date,
            }),
          },
          session?.access_token,
        ).catch(() => null);
        if (!ir || !ir.ok) syncFailed = true;
      }

      if (syncFailed) {
        setOccError('Occasions saved, but some alerts could not be synced.');
        await fetchLovedOnes();
        return;
      }

      setOccasionModal(false);
      await fetchLovedOnes();
      if (user?.profileId && session?.access_token) {
        loadOccasionAlerts(user.profileId, session.access_token).then(rows => scheduleOccasionNotifications(rows)).catch(() => {});
      }
    } catch {
      setOccError('Network error. Please check your connection.');
    } finally {
      setOccSaving(false);
    }
  };

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Loved Ones</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#7B5CFA" />
          <Text style={[s.statusText, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      ) : fetchError ? (
        <View style={s.centered}>
          <Icon name="alert-circle" size={36} color="#EF4444" />
          <Text style={[s.statusText, { color: '#EF4444' }]}>{fetchError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchLovedOnes}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="users" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyStateText, { color: colors.mutedForeground }]}>
                No loved ones yet. Tap + to add someone special.
              </Text>
            </View>
          ) : (
            items.map(item => {
              const rc = getRelColor(item.relationship);
              const daysUntil = getDaysUntilBirthday(item.date_of_birth);
              const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ');
              return (
                <View key={item.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.cardTop}>
                    <View style={[s.avatar, { backgroundColor: rc + '25' }]}>
                      <Text style={[s.avatarText, { color: rc }]}>{getInitials(item.first_name, item.last_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={[s.name, { color: colors.foreground }]}>{fullName}</Text>
                        {daysUntil !== null && daysUntil <= 30 && (
                          <View style={[s.birthdayBadge, { backgroundColor: daysUntil <= 7 ? '#EF4444' : '#7B5CFA' }]}>
                            <Icon name="gift" size={10} color="#fff" />
                            <Text style={s.birthdayBadgeText}>
                              {daysUntil === 0 ? 'Today!' : `${daysUntil}d`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[s.relBadge, { backgroundColor: rc + '20' }]}>
                        <Text style={[s.relText, { color: rc }]}>{item.relationship}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(item)}>
                      <Icon name="edit-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} onPress={() => confirmDelete(item)}>
                      <Icon name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {item.email ? (
                    <View style={s.infoRow}>
                      <Icon name="mail" size={13} color={colors.mutedForeground} />
                      <Text style={[s.infoText, { color: colors.mutedForeground }]}>{item.email}</Text>
                    </View>
                  ) : null}
                  {item.phone ? (
                    <View style={s.infoRow}>
                      <Icon name="phone" size={13} color={colors.mutedForeground} />
                      <Text style={[s.infoText, { color: colors.mutedForeground }]}>{item.phone}</Text>
                    </View>
                  ) : null}
                  {item.date_of_birth ? (
                    <View style={s.infoRow}>
                      <Icon name="gift" size={13} color="#7B5CFA" />
                      <Text style={[s.infoText, { color: colors.mutedForeground }]}>DOB: {prettyDate(item.date_of_birth)}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[s.manageBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                    onPress={() => openOccasions(item)}
                  >
                    <Icon name="calendar" size={14} color="#1F7BFF" />
                    <Text style={[s.manageBtnText, { color: colors.foreground }]}>
                      Manage Occasions
                      {item.occasions?.length > 0 ? ` (${item.occasions.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: '#7B5CFA' }]} onPress={openAdd}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {editTarget ? 'Edit' : 'Add'} Loved One
              </Text>
              <TouchableOpacity onPress={() => setEditModal(false)} disabled={saving}>
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <View style={s.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>First Name *</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    placeholder="First"
                    placeholderTextColor={colors.mutedForeground}
                    value={draft.firstName}
                    onChangeText={v => setDraft(d => ({ ...d, firstName: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Last Name</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    placeholder="Last"
                    placeholderTextColor={colors.mutedForeground}
                    value={draft.lastName}
                    onChangeText={v => setDraft(d => ({ ...d, lastName: v }))}
                  />
                </View>
              </View>

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Email</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                placeholder="email@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={draft.email}
                onChangeText={v => setDraft(d => ({ ...d, email: v }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Phone</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.mutedForeground}
                value={draft.phone}
                onChangeText={v => setDraft(d => ({ ...d, phone: v }))}
                keyboardType="phone-pad"
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Date of Birth</Text>
              <DatePickerField
                label="Date of Birth"
                kind="birthday"
                optional
                accent="#1F7BFF"
                placeholder="Select date of birth"
                value={draft.dob}
                onChange={v => setDraft(d => ({ ...d, dob: v }))}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Relationship</Text>
              <View style={s.relGrid}>
                {RELATIONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.relChip, {
                      backgroundColor: draft.relationship === r ? '#7B5CFA' : colors.muted,
                      borderColor: draft.relationship === r ? '#7B5CFA' : colors.border,
                    }]}
                    onPress={() => setDraft(d => ({ ...d, relationship: r }))}
                  >
                    <Text style={[s.relChipText, { color: draft.relationship === r ? '#fff' : colors.foreground }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Notes</Text>
              <TextInput
                style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                placeholder="Any special notes..."
                placeholderTextColor={colors.mutedForeground}
                value={draft.notes}
                onChangeText={v => setDraft(d => ({ ...d, notes: v }))}
                multiline
                numberOfLines={3}
              />

              {saveError ? (
                <View style={s.errorBox}>
                  <Icon name="alert-circle" size={14} color="#EF4444" />
                  <Text style={s.errorText}>{saveError}</Text>
                </View>
              ) : null}

              <TouchableOpacity onPress={saveDraft} style={[s.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmModal} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.confirmSheet, { backgroundColor: colors.background }]}>
            <Icon name="trash-2" size={32} color="#EF4444" />
            <Text style={[s.confirmTitle, { color: colors.foreground }]}>Delete Loved One</Text>
            <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>
              Are you sure you want to remove{' '}
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                {[deleteConfirmTarget?.first_name, deleteConfirmTarget?.last_name].filter(Boolean).join(' ')}
              </Text>
              {' '}and all their occasions? This cannot be undone.
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={() => { setDeleteConfirmModal(false); setDeleteConfirmTarget(null); }}
                disabled={deleting}
              >
                <Text style={[s.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteBtn, deleting && { opacity: 0.7 }]}
                onPress={executeDelete}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.deleteBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Occasions Modal */}
      <Modal visible={occasionModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {[occasionTarget?.first_name, occasionTarget?.last_name].filter(Boolean).join(' ')}'s Occasions
              </Text>
              <TouchableOpacity onPress={() => setOccasionModal(false)} disabled={occSaving}>
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              {localOccasions.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                  No occasions yet. Add one below.
                </Text>
              ) : (
                localOccasions.map(occ => {
                  const tc = typeColor(occ.type);
                  return (
                    <View key={occ.id} style={[s.occRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.occName, { color: colors.foreground }]}>{occ.name}</Text>
                        {occ.date ? <Text style={[s.occDate, { color: colors.mutedForeground }]}>{prettyDate(occ.date)}</Text> : null}
                      </View>
                      <View style={[s.typeBadge, { backgroundColor: tc + '20' }]}>
                        <Text style={[s.typeBadgeText, { color: tc }]}>{occ.type}</Text>
                      </View>
                      <TouchableOpacity style={s.iconBtn} onPress={() => removeLocalOccasion(occ.id)}>
                        <Icon name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {showAddOcc ? (
                <View style={[s.addOccForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Occasion Name</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    placeholder="e.g. Birthday Party"
                    placeholderTextColor={colors.mutedForeground}
                    value={addOccName}
                    onChangeText={setAddOccName}
                  />
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Date</Text>
                  <DatePickerField
                    label="Occasion date"
                    kind="occasion"
                    accent="#1F7BFF"
                    placeholder="Select a date"
                    value={addOccDate}
                    onChange={setAddOccDate}
                  />
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {OCCASION_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[s.relChip, {
                          backgroundColor: addOccType === t ? '#1F7BFF' : colors.muted,
                          borderColor: addOccType === t ? '#1F7BFF' : colors.border,
                        }]}
                        onPress={() => setAddOccType(t)}
                      >
                        <Text style={[s.relChipText, { color: addOccType === t ? '#fff' : colors.foreground }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={s.addOccBtns}>
                    <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAddOcc(false)}>
                      <Text style={[s.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.saveBtn, (!addOccName.trim() || !addOccDate) && { opacity: 0.45 }]} onPress={addOccasion} disabled={!addOccName.trim() || !addOccDate}>
                      <Text style={s.saveBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.addOccBtn, { borderColor: '#1F7BFF', backgroundColor: '#1F7BFF15' }]}
                  onPress={() => setShowAddOcc(true)}
                >
                  <Icon name="plus" size={16} color="#1F7BFF" />
                  <Text style={s.addOccBtnText}>Add Occasion</Text>
                </TouchableOpacity>
              )}

              {occError ? (
                <View style={s.errorBox}>
                  <Icon name="alert-circle" size={14} color="#EF4444" />
                  <Text style={s.errorText}>{occError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={saveOccasions}
                style={[s.saveBtn, { marginTop: 8 }, occSaving && { opacity: 0.7 }]}
                disabled={occSaving}
              >
                {occSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save Occasions</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  statusText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { backgroundColor: '#7B5CFA', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyStateText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  birthdayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  birthdayBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  relBadge: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999, alignSelf: 'flex-start' },
  relText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iconBtn: { padding: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  manageBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  confirmSheet: {
    borderRadius: 20,
    margin: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  confirmTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  confirmMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 4, paddingBottom: 40 },
  nameRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 14, height: 46 },
  textarea: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  relGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relChip: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8 },
  relChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  saveBtn: {
    backgroundColor: '#7B5CFA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#EF4444', flex: 1 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16 },
  occRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  occName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  occDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  addOccBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginTop: 8,
  },
  addOccBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1F7BFF' },
  addOccForm: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4, marginTop: 8 },
  addOccBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
