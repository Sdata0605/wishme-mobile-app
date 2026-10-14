import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/DatePickerField';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { ensureNotificationPermission } from '@/services/hub/notifications';
import {
  createOccasion,
  DAYS_BEFORE,
  fetchLovedOnes,
  OCCASION_TYPES,
  REMINDER_TIMES,
  typeInfo,
  type LovedOneLite,
  type OccasionType,
} from '@/services/occasionAlerts';

interface Props {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  token: string | null;
  /** Called after the occasion is saved so the list can reload. */
  onSaved: () => void;
}

const RELATIONS = ['Mom', 'Dad', 'Partner', 'Friend', 'Sibling', 'Child', 'Colleague', 'Other'];

export function AddOccasionSheet({ visible, onClose, profileId, token, onSaved }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = '#D23FE0';

  const [people, setPeople] = useState<LovedOneLite[] | null>(null);
  const [personId, setPersonId] = useState<string | 'new' | null>(null);
  const [newName, setNewName] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [type, setType] = useState<OccasionType>('birthday');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [date, setDate] = useState('');
  const [notify, setNotify] = useState(true);
  const [daysBefore, setDaysBefore] = useState(1);
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !token) return;
    setPeople(null);
    setPersonId(null);
    setNewName('');
    setRelationship('Friend');
    setType('birthday');
    setName('');
    setNameTouched(false);
    setDate('');
    setNotify(true);
    setDaysBefore(1);
    setTime('09:00');
    setError('');
    fetchLovedOnes(profileId, token)
      .then(list => { setPeople(list); if (list.length === 0) setPersonId('new'); })
      .catch(() => { setPeople([]); setPersonId('new'); });
  }, [visible, token, profileId]);

  const personFirst = personId === 'new'
    ? newName.trim()
    : people?.find(p => p.id === personId)?.first_name?.trim() ?? '';

  // Suggest a name like "Ravi's Birthday" until the user types their own.
  useEffect(() => {
    if (nameTouched) return;
    const label = typeInfo(type).label;
    setName(personFirst ? (type === 'other' ? `${personFirst}'s special day` : `${personFirst}'s ${label}`) : '');
  }, [personFirst, type, nameTouched]);

  const valid = !!personId && !!personFirst && name.trim().length > 0 && date.length === 10;

  const save = async () => {
    if (!valid || !token) return;
    setSaving(true);
    setError('');
    try {
      if (notify) {
        const perm = await ensureNotificationPermission(true);
        if (perm !== 'granted') {
          Alert.alert(
            'Notifications are off',
            'You will still see a message inside the app on the day. To get phone notifications too, allow them in Settings.',
            [{ text: 'OK' }, { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }],
          );
        }
      }
      await createOccasion({
        profileId,
        lovedOneId: personId !== 'new' ? personId ?? undefined : undefined,
        newPerson: personId === 'new' ? { firstName: newName, relationship } : undefined,
        type,
        name,
        date,
        notify,
        daysBefore,
        reminderTime: time,
      }, token);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ on, label, onPress, icon, color }: { on: boolean; label: string; onPress: () => void; icon?: 'gift'; color?: string }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, on ? { backgroundColor: (color ?? accent) + '26', borderColor: color ?? accent } : { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {icon ? <Icon name={icon} size={13} color={on ? color ?? accent : colors.mutedForeground} /> : null}
      <Text style={{ color: on ? color ?? accent : colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </TouchableOpacity>
  );

  const inputStyle = [s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
          <View style={s.head}>
            <Text style={[s.title, { color: colors.foreground }]}>Add an occasion</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><Icon name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={[s.label, { color: colors.foreground }]}>Who is it for?</Text>
            {people === null ? (
              <ActivityIndicator color={accent} style={{ alignSelf: 'flex-start', marginVertical: 12 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} keyboardShouldPersistTaps="handled">
                {people.map(p => {
                  const on = personId === p.id;
                  return (
                    <TouchableOpacity key={p.id} onPress={() => setPersonId(p.id)} activeOpacity={0.8} style={[s.person, on && { borderColor: accent, backgroundColor: accent + '1F' }, !on && { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <View style={[s.avatar, { backgroundColor: on ? accent : colors.border }]}>
                        <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: 'Inter_700Bold' }}>{(p.first_name || '?').trim().charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{p.first_name}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={() => setPersonId('new')} activeOpacity={0.8} style={[s.person, personId === 'new' ? { borderColor: accent, backgroundColor: accent + '1F' } : { borderColor: colors.border, borderStyle: 'dashed' }]}>
                  <View style={[s.avatar, { backgroundColor: personId === 'new' ? accent : colors.border }]}>
                    <Icon name="plus" size={16} color={personId === 'new' ? '#fff' : colors.foreground} />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>New person</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {personId === 'new' && (
              <View style={{ gap: 10, marginTop: 10 }}>
                <TextInput value={newName} onChangeText={setNewName} placeholder="Their name" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
                <View style={s.chipRow}>
                  {RELATIONS.map(r => <Chip key={r} on={relationship === r} label={r} onPress={() => setRelationship(r)} />)}
                </View>
              </View>
            )}

            <Text style={[s.label, { color: colors.foreground }]}>What is the occasion?</Text>
            <View style={s.chipRow}>
              {OCCASION_TYPES.map(t => (
                <Chip key={t.key} on={type === t.key} label={t.label} icon="gift" color={t.color} onPress={() => setType(t.key)} />
              ))}
            </View>

            <Text style={[s.label, { color: colors.foreground }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={t => { setName(t); setNameTouched(true); }}
              placeholder="e.g. Mom's Birthday"
              placeholderTextColor={colors.mutedForeground}
              maxLength={60}
              style={inputStyle}
            />

            <Text style={[s.label, { color: colors.foreground }]}>Date</Text>
            <DatePickerField
              label={type === 'birthday' ? 'Date of birth' : 'Occasion date'}
              kind={typeInfo(type).recurring ? 'birthday' : 'occasion'}
              accent={accent}
              placeholder="Select a date"
              value={date}
              onChange={setDate}
            />
            {typeInfo(type).recurring && <Text style={[s.help, { color: colors.mutedForeground }]}>It repeats every year, so you only set it once.</Text>}

            <View style={[s.notifyCard, { backgroundColor: colors.card, borderColor: notify ? accent + '66' : colors.border }]}>
              <View style={s.notifyRow}>
                <View style={[s.bell, { backgroundColor: accent + '22' }]}><Icon name="bell" size={18} color={accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.notifyTitle, { color: colors.foreground }]}>Notify me</Text>
                  <Text style={[s.help, { color: colors.mutedForeground, marginTop: 0 }]}>We will remind you on the day.</Text>
                </View>
                <Switch value={notify} onValueChange={setNotify} trackColor={{ false: colors.border, true: accent }} thumbColor="#fff" />
              </View>

              {notify && (
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Text style={[s.sub, { color: colors.mutedForeground }]}>Also remind me before</Text>
                  <View style={s.chipRow}>
                    {DAYS_BEFORE.map(d => <Chip key={d.value} on={daysBefore === d.value} label={d.label} onPress={() => setDaysBefore(d.value)} />)}
                  </View>
                  <Text style={[s.sub, { color: colors.mutedForeground }]}>At what time</Text>
                  <View style={s.chipRow}>
                    {REMINDER_TIMES.map(t => <Chip key={t.value} on={time === t.value} label={t.label} onPress={() => setTime(t.value)} />)}
                  </View>
                </View>
              )}
            </View>

            {error ? <Text style={{ color: '#EF4444', marginTop: 12, fontSize: 13 }}>{error}</Text> : null}
          </ScrollView>

          <TouchableOpacity onPress={save} disabled={!valid || saving} activeOpacity={0.9} style={{ opacity: valid && !saving ? 1 : 0.45 }}>
            <LinearGradient colors={['#7B5CFA', '#D23FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save occasion</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 18, marginBottom: 8 },
  sub: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  help: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.2 },
  person: { width: 76, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, borderWidth: 1.2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  notifyCard: { borderWidth: 1.2, borderRadius: 16, padding: 14, marginTop: 20 },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  notifyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  saveBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
