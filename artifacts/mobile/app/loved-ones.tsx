import { router } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { Icon } from '@/components/Icon';
import { MOCK_LOVED_ONES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const RELATIONS = ['Parent', 'Sibling', 'Friend', 'Spouse', 'Child', 'Colleague', 'Other'];
const OCCASION_TYPES = ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Custom'];

interface LovedOne {
  id: string;
  name: string;
  relation: string;
  birthday: string | null;
  anniversary: string | null;
  email?: string;
  phone?: string;
  notes?: string;
}

interface PersonOccasion {
  id: string;
  name: string;
  date: string;
  type: string;
}

const RELATION_COLORS: Record<string, string> = {
  Parent: '#B44CFF',
  Sibling: '#4B83FF',
  Friend: '#22C55E',
  Spouse: '#E8527A',
  Child: '#FF6B33',
  Colleague: '#F59E0B',
  Mother: '#B44CFF',
  Brother: '#4B83FF',
  Wife: '#E8527A',
  Other: '#6B7280',
};

const MOCK_OCCASIONS_MAP: Record<string, PersonOccasion[]> = {
  lo1: [
    { id: 'o1', name: "Rahul's Birthday", date: '2025-03-15', type: 'Birthday' },
    { id: 'o2', name: "Rahul's Graduation", date: '2025-06-20', type: 'Graduation' },
  ],
  lo2: [
    { id: 'o3', name: "Priya's Birthday", date: '2025-07-22', type: 'Birthday' },
    { id: 'o4', name: 'Wedding Anniversary', date: '2025-02-14', type: 'Anniversary' },
  ],
  lo3: [
    { id: 'o5', name: "Mom's Birthday", date: '2025-11-08', type: 'Birthday' },
  ],
};

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function getRelColor(rel: string) {
  return RELATION_COLORS[rel] ?? '#6B7280';
}

export default function LovedOnesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LovedOne[]>(MOCK_LOVED_ONES.map(lo => ({ ...lo, email: '', phone: '', notes: '' })));
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<LovedOne | null>(null);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', relation: 'Friend', notes: '' });

  const [occasionModal, setOccasionModal] = useState(false);
  const [occasionTarget, setOccasionTarget] = useState<LovedOne | null>(null);
  const [personOccasions, setPersonOccasions] = useState<PersonOccasion[]>([]);
  const [addOccName, setAddOccName] = useState('');
  const [addOccDate, setAddOccDate] = useState('');
  const [addOccType, setAddOccType] = useState('Birthday');
  const [showAddOcc, setShowAddOcc] = useState(false);

  const openAdd = () => {
    setEditTarget(null);
    setDraft({ firstName: '', lastName: '', email: '', phone: '', dob: '', relation: 'Friend', notes: '' });
    setEditModal(true);
  };

  const openEdit = (item: LovedOne) => {
    setEditTarget(item);
    const parts = item.name.split(' ');
    setDraft({
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      email: item.email ?? '',
      phone: item.phone ?? '',
      dob: item.birthday ?? '',
      relation: RELATIONS.includes(item.relation) ? item.relation : 'Other',
      notes: item.notes ?? '',
    });
    setEditModal(true);
  };

  const saveDraft = () => {
    const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(' ') || 'New Person';
    if (editTarget) {
      setItems(prev => prev.map(it => it.id === editTarget.id
        ? { ...it, name: fullName, relation: draft.relation, email: draft.email, phone: draft.phone, birthday: draft.dob || it.birthday, notes: draft.notes }
        : it));
    } else {
      setItems(prev => [...prev, { id: `lo${Date.now()}`, name: fullName, relation: draft.relation, birthday: draft.dob || null, anniversary: null, email: draft.email, phone: draft.phone, notes: draft.notes }]);
    }
    setEditModal(false);
  };

  const openOccasions = (item: LovedOne) => {
    setOccasionTarget(item);
    setPersonOccasions(MOCK_OCCASIONS_MAP[item.id] ?? []);
    setAddOccName(''); setAddOccDate(''); setAddOccType('Birthday'); setShowAddOcc(false);
    setOccasionModal(true);
  };

  const addOccasion = () => {
    if (!addOccName.trim()) return;
    setPersonOccasions(prev => [...prev, { id: `occ${Date.now()}`, name: addOccName, date: addOccDate, type: addOccType }]);
    setAddOccName(''); setAddOccDate(''); setAddOccType('Birthday'); setShowAddOcc(false);
  };

  const typeColor = (t: string) => {
    const m: Record<string, string> = { Birthday: '#FF6B33', Anniversary: '#E8527A', Wedding: '#B44CFF', Graduation: '#4B83FF', Custom: '#22C55E' };
    return m[t] ?? '#6B7280';
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Loved Ones</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {items.map(item => {
          const rc = getRelColor(item.relation);
          return (
            <View key={item.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: rc + '25' }]}>
                  <Text style={[s.avatarText, { color: rc }]}>{getInitials(item.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: colors.foreground }]}>{item.name}</Text>
                  <View style={[s.relBadge, { backgroundColor: rc + '20' }]}>
                    <Text style={[s.relText, { color: rc }]}>{item.relation}</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(item)}>
                  <Icon name="edit-2" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconBtn} onPress={() => setItems(prev => prev.filter(i => i.id !== item.id))}>
                  <Icon name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Info rows */}
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
              {item.birthday && (
                <View style={s.infoRow}>
                  <Icon name="gift" size={13} color="#FF6B33" />
                  <Text style={[s.infoText, { color: colors.mutedForeground }]}>DOB: {item.birthday}</Text>
                </View>
              )}
              {item.anniversary && (
                <View style={s.infoRow}>
                  <Icon name="heart" size={13} color="#E8527A" />
                  <Text style={[s.infoText, { color: colors.mutedForeground }]}>Anniversary: {item.anniversary}</Text>
                </View>
              )}

              {/* Manage Occasions button */}
              <TouchableOpacity style={[s.manageBtn, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={() => openOccasions(item)}>
                <Icon name="calendar" size={14} color="#B44CFF" />
                <Text style={[s.manageBtnText, { color: colors.foreground }]}>Manage Occasions</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: '#FF6B33' }]} onPress={openAdd}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>{editTarget ? 'Edit' : 'Add'} Loved One</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <View style={s.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>First Name</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="First" placeholderTextColor={colors.mutedForeground} value={draft.firstName} onChangeText={v => setDraft(d => ({ ...d, firstName: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Last Name</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Last" placeholderTextColor={colors.mutedForeground} value={draft.lastName} onChangeText={v => setDraft(d => ({ ...d, lastName: v }))} />
                </View>
              </View>
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Email</Text>
              <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="email@example.com" placeholderTextColor={colors.mutedForeground} value={draft.email} onChangeText={v => setDraft(d => ({ ...d, email: v }))} autoCapitalize="none" keyboardType="email-address" />
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Phone</Text>
              <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="+91 98765 43210" placeholderTextColor={colors.mutedForeground} value={draft.phone} onChangeText={v => setDraft(d => ({ ...d, phone: v }))} keyboardType="phone-pad" />
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Date of Birth</Text>
              <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} value={draft.dob} onChangeText={v => setDraft(d => ({ ...d, dob: v }))} />
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Relationship</Text>
              <View style={s.relGrid}>
                {RELATIONS.map(r => (
                  <TouchableOpacity key={r} style={[s.relChip, { backgroundColor: draft.relation === r ? '#FF6B33' : colors.muted, borderColor: draft.relation === r ? '#FF6B33' : colors.border }]} onPress={() => setDraft(d => ({ ...d, relation: r }))}>
                    <Text style={[s.relChipText, { color: draft.relation === r ? '#fff' : colors.foreground }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>Notes</Text>
              <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Any special notes..." placeholderTextColor={colors.mutedForeground} value={draft.notes} onChangeText={v => setDraft(d => ({ ...d, notes: v }))} multiline numberOfLines={3} />
              <TouchableOpacity onPress={saveDraft} style={s.saveBtn}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Occasions Modal */}
      <Modal visible={occasionModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>{occasionTarget?.name}'s Occasions</Text>
              <TouchableOpacity onPress={() => setOccasionModal(false)}>
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              {personOccasions.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No occasions yet. Add one below.</Text>
              ) : (
                personOccasions.map(occ => {
                  const tc = typeColor(occ.type);
                  return (
                    <View key={occ.id} style={[s.occRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.occName, { color: colors.foreground }]}>{occ.name}</Text>
                        <Text style={[s.occDate, { color: colors.mutedForeground }]}>{occ.date}</Text>
                      </View>
                      <View style={[s.typeBadge, { backgroundColor: tc + '20' }]}>
                        <Text style={[s.typeBadgeText, { color: tc }]}>{occ.type}</Text>
                      </View>
                    </View>
                  );
                })
              )}

              {/* Add Occasion */}
              {showAddOcc ? (
                <View style={[s.addOccForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Occasion Name</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="e.g. Birthday Party" placeholderTextColor={colors.mutedForeground} value={addOccName} onChangeText={setAddOccName} />
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Date</Text>
                  <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} value={addOccDate} onChangeText={setAddOccDate} />
                  <Text style={[s.fieldLabel, { color: colors.foreground }]}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {OCCASION_TYPES.map(t => (
                      <TouchableOpacity key={t} style={[s.relChip, { backgroundColor: addOccType === t ? '#B44CFF' : colors.muted, borderColor: addOccType === t ? '#B44CFF' : colors.border }]} onPress={() => setAddOccType(t)}>
                        <Text style={[s.relChipText, { color: addOccType === t ? '#fff' : colors.foreground }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={s.addOccBtns}>
                    <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAddOcc(false)}>
                      <Text style={[s.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.saveBtn} onPress={addOccasion}>
                      <Text style={s.saveBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={[s.addOccBtn, { borderColor: '#B44CFF', backgroundColor: '#B44CFF15' }]} onPress={() => setShowAddOcc(true)}>
                  <Icon name="plus" size={16} color="#B44CFF" />
                  <Text style={s.addOccBtnText}>Add Occasion</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  relBadge: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999, alignSelf: 'flex-start' },
  relText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iconBtn: { padding: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start', marginTop: 4 },
  manageBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 4, paddingBottom: 40 },
  nameRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 14, height: 46 },
  textarea: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  relGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relChip: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8 },
  relChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  saveBtn: { backgroundColor: '#FF6B33', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  occName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  occDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  addOccBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 14, marginTop: 8 },
  addOccBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  addOccForm: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4, marginTop: 8 },
  addOccBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
