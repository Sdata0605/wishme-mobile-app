import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { addItem } from '@/services/finance/store';
import { createEvent } from '@/services/hub/calendar';
import { createReminder } from '@/services/hub/reminders';
import { AUTO, readText } from '@/services/home/lens';
import { parseText, type Parsed } from '@/services/home/snapParse';
import { TranslateLanguage } from '@react-native-ml-kit/translate-text';

type Done = Record<string, string>;

const fmt = (d: Date, time: boolean) =>
  `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}${time ? `, ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}` : ''}`;

/**
 * Snap to action: photograph a business card, a bill or a note; the text is read on the phone and turned into things
 * the app can do: save the contact, add the expense, set a reminder, put it on the calendar. Every field is editable
 * before it is saved.
 */
export default function SnapActionScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, getValidSession } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hindi, setHindi] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [done, setDone] = useState<Done>({});

  // Editable fields
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');

  const run = async (uri: string) => {
    setImage(uri);
    setBusy(true);
    setDone({});
    try {
      const { text: t } = await readText(uri, hindi ? TranslateLanguage.HINDI : AUTO);
      const p = parseText(t);
      setText(t);
      setParsed(p);
      setName(p.name ?? '');
      setOrg(p.org ?? '');
      setPhone(p.phones[0] ?? '');
      setEmail(p.emails[0] ?? '');
      setAmount(p.amount !== null ? String(p.amount) : '');
      setTitle(p.name ?? p.org ?? p.firstLine.slice(0, 60));
    } catch {
      Alert.alert('Could not read that', 'Try again with better light, or hold the phone steadier.');
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera needed', 'Allow the camera to photograph the card or bill.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) await run(res.assets[0].uri);
  };
  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) await run(res.assets[0].uri);
  };

  const mark = (key: string, msg: string) => setDone((d) => ({ ...d, [key]: msg }));
  const fail = (key: string, e: unknown) => mark(key, `Could not save: ${e instanceof Error ? e.message : String(e)}`);

  const saveContact = async () => {
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') { mark('contact', 'Contacts permission is needed.'); return; }
      const [first, ...rest] = name.trim().split(/\s+/);
      const contact: Contacts.Contact = {
        contactType: Contacts.ContactTypes.Person,
        name: name.trim() || org.trim() || 'New contact',
        firstName: first || undefined,
        lastName: rest.join(' ') || undefined,
        company: org.trim() || undefined,
        jobTitle: parsed?.title ?? undefined,
        phoneNumbers: phone.trim() ? [{ label: 'mobile', number: phone.trim() }] : undefined,
        emails: email.trim() ? [{ label: 'work', email: email.trim() }] : undefined,
      };
      await Contacts.addContactAsync(contact);
      mark('contact', `Saved ${contact.name} to your contacts.`);
    } catch (e) { fail('contact', e); }
  };

  const saveExpense = async () => {
    try {
      if (!user) { mark('expense', 'Sign in to add expenses.'); return; }
      const n = Number(amount.replace(/,/g, ''));
      if (!Number.isFinite(n) || n <= 0) { mark('expense', 'Enter an amount first.'); return; }
      await addItem(user.id, { kind: 'expense', name: (org || title || 'Bill').trim().slice(0, 60), amount: n, interestRate: null, dueDay: parsed?.date ? parsed.date.getDate() : null, outstanding: null });
      mark('expense', `Added ₹${n.toLocaleString('en-IN')} to Finance.`);
    } catch (e) { fail('expense', e); }
  };

  const saveReminder = async () => {
    try {
      const session = await getValidSession();
      if (!session || !user) { mark('reminder', 'Sign in to set reminders.'); return; }
      const due = parsed?.date ?? new Date(Date.now() + 24 * 3600 * 1000);
      if (!parsed?.date) due.setHours(9, 0, 0, 0);
      await createReminder(session.access_token, user.id, {
        title: title.trim() || 'Follow up',
        notes: text.slice(0, 500) || null,
        due_at: due.toISOString(),
        pin_to_timezone: false,
        lead_minutes: 10,
        delivery: 'notification',
        style: 'reminder',
        recurrence: 'none',
        recurrence_until: null,
        escalate: false,
        escalate_after_minutes: 10,
        escalate_phone: null,
      });
      mark('reminder', `Reminder set for ${fmt(due, true)}.`);
    } catch (e) { fail('reminder', e); }
  };

  const saveEvent = async () => {
    try {
      const session = await getValidSession();
      if (!session || !user || !parsed?.date) { mark('event', session ? 'No date was found in the text.' : 'Sign in to add events.'); return; }
      const start = parsed.date;
      const end = parsed.hasTime ? new Date(start.getTime() + 3600 * 1000) : null;
      await createEvent(session.access_token, user.id, {
        title: title.trim() || 'Event',
        notes: text.slice(0, 500) || null,
        location: null,
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        all_day: !parsed.hasTime,
        recurrence: 'none',
        recurrence_until: null,
      });
      mark('event', `Added to the calendar on ${fmt(start, parsed.hasTime)}.`);
    } catch (e) { fail('event', e); }
  };

  const Field = ({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: 'default' | 'phone-pad' | 'email-address' | 'decimal-pad' }) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: neon.textLo }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboard ?? 'default'} placeholder="—" placeholderTextColor={neon.textDim} style={[styles.input, { color: neon.textHi, borderColor: neon.cardBorder, backgroundColor: neon.surface }]} />
    </View>
  );

  const Card = ({ id, icon, heading, children, action, onPress }: { id: string; icon: 'user-plus' | 'wallet' | 'bell' | 'calendar'; heading: string; children: React.ReactNode; action: string; onPress: () => void }) => (
    <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
      <View style={styles.cardHead}>
        <Icon name={icon} size={18} color={neon.pink} />
        <Text style={[styles.cardTitle, { color: neon.textHi }]}>{heading}</Text>
      </View>
      {children}
      {done[id] ? (
        <Text style={[styles.done, { color: /Could not|needed|Sign in|Enter|No date/.test(done[id]) ? neon.warning : neon.success }]}>{done[id]}</Text>
      ) : (
        <PressScale onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
            <Text style={styles.btnText}>{action}</Text>
          </LinearGradient>
        </PressScale>
      )}
    </View>
  );

  const showContact = !!parsed && (parsed.phones.length > 0 || parsed.emails.length > 0 || !!parsed.name);
  const showExpense = !!parsed && parsed.amount !== null;
  const showEvent = !!parsed && parsed.date !== null;

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
            <Icon name="chevron-left" size={22} color={neon.textHi} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: neon.textHi }]}>Snap to action</Text>
            <Text style={[styles.sub, { color: neon.textLo }]}>A card, a bill or a note becomes a contact, an expense, a reminder or an event.</Text>
          </View>
        </View>

        <View style={styles.row}>
          <PressScale onPress={() => void takePhoto()} accessibilityRole="button" style={{ flex: 1 }}>
            <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
              <Icon name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.bigBtnText}>Take a photo</Text>
            </LinearGradient>
          </PressScale>
          <Pressable onPress={() => void pickPhoto()} accessibilityRole="button" style={[styles.bigBtn, { backgroundColor: neon.glass, borderWidth: 1.2, borderColor: neon.cardBorder, flex: 1 }]}>
            <Icon name="image" size={20} color={neon.textHi} />
            <Text style={[styles.bigBtnText, { color: neon.textHi }]}>From gallery</Text>
          </Pressable>
        </View>
        <View style={[styles.row, { alignItems: 'center', justifyContent: 'flex-end', gap: 8 }]}>
          <Text style={[styles.sub, { color: neon.textLo }]}>Text is in Hindi</Text>
          <Switch value={hindi} onValueChange={setHindi} trackColor={{ true: neon.violet, false: neon.cardBorder }} thumbColor="#FFFFFF" />
        </View>

        {image ? <Image source={{ uri: image }} style={styles.preview} contentFit="cover" /> : null}
        {busy ? (
          <View style={styles.busy}><ActivityIndicator color={neon.cyan} /><Text style={[styles.sub, { color: neon.textLo }]}>Reading the text…</Text></View>
        ) : null}

        {parsed && !busy ? (
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {!showContact && !showExpense && !showEvent ? (
              <Text style={[styles.sub, { color: neon.textLo }]}>No phone, email, amount or date was found, but you can still set a reminder from the text.</Text>
            ) : null}

            {showContact ? (
              <Card id="contact" icon="user-plus" heading="Save contact" action="Save to contacts" onPress={() => void saveContact()}>
                <Field label="Name" value={name} onChange={setName} />
                <Field label="Company" value={org} onChange={setOrg} />
                <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" />
                <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
                {parsed.phones.length > 1 ? <Text style={[styles.hint, { color: neon.textDim }]}>Also found: {parsed.phones.slice(1).join(', ')}</Text> : null}
              </Card>
            ) : null}

            {showExpense ? (
              <Card id="expense" icon="wallet" heading="Add expense" action="Add to Finance" onPress={() => void saveExpense()}>
                <Field label="What" value={org || title} onChange={setOrg} />
                <Field label="Amount (₹)" value={amount} onChange={setAmount} keyboard="decimal-pad" />
                {parsed.date ? <Text style={[styles.hint, { color: neon.textDim }]}>Dated {fmt(parsed.date, false)}</Text> : null}
              </Card>
            ) : null}

            <Card id="reminder" icon="bell" heading="Set a reminder" action={parsed.date ? `Remind me ${fmt(parsed.date, parsed.hasTime)}` : 'Remind me tomorrow 9 am'} onPress={() => void saveReminder()}>
              <Field label="Reminder" value={title} onChange={setTitle} />
            </Card>

            {showEvent ? (
              <Card id="event" icon="calendar" heading="Add to calendar" action={`Add on ${fmt(parsed.date!, parsed.hasTime)}`} onPress={() => void saveEvent()}>
                <Field label="Event" value={title} onChange={setTitle} />
              </Card>
            ) : null}

            <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <View style={styles.cardHead}>
                <Icon name="copy" size={18} color={neon.cyan} />
                <Text style={[styles.cardTitle, { color: neon.textHi }]}>Text read from the photo</Text>
                <Pressable onPress={() => void Clipboard.setStringAsync(text)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy text" style={{ marginLeft: 'auto' }}>
                  <Text style={[styles.copy, { color: neon.cyan }]}>Copy</Text>
                </Pressable>
              </View>
              <Text style={[styles.raw, { color: neon.textLo }]} selectable>{text || '(nothing)'}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 12 },
  bigBtn: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  preview: { marginHorizontal: 20, height: 180, borderRadius: 18, marginBottom: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  card: { borderRadius: 20, borderWidth: 1.2, padding: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  btn: { height: 42, borderRadius: 21, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  done: { fontSize: 13.5, fontFamily: 'Inter_500Medium', marginTop: 2 },
  copy: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  raw: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
});
