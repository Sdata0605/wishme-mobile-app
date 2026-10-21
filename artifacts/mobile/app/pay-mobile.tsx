import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Recent = { id: string; name: string; number: string; amount: number; at: string };
type Contact = { id: string; name: string; number: string; image?: string };
type Perm = 'checking' | 'granted' | 'denied' | 'blocked';

const AVATAR_COLORS = ['#B026FF', '#2563EB', '#E69B00', '#16A34A', '#DB2777', '#0891B2'];

/** Last 10 digits of a phone number, or '' when it is not a plausible Indian mobile. */
function toMobile(raw: string) {
  const d = raw.replace(/\D/g, '');
  const n = d.length > 10 ? d.slice(-10) : d;
  return /^[6-9]\d{9}$/.test(n) ? n : '';
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '#';
}

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function paidOn(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Paid today';
  if (days === 1) return 'Paid yesterday';
  return `Paid on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function Avatar({ name, image }: { name: string; image?: string }) {
  return image ? (
    <Image source={{ uri: image }} style={st.avatar} />
  ) : (
    <View style={[st.avatar, { backgroundColor: colorFor(name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={st.avatarText}>{initials(name)}</Text>
    </View>
  );
}

export default function PayMobileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, getValidSession } = useAuth();

  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<Recent[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(true);
  const [perm, setPerm] = useState<Perm>('checking');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Recent recipients come from the user's own Scan & Pay history.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const profileId = user?.profileId;
        const session = await getValidSession();
        if (!profileId || !session?.access_token) return;
        const res = await supabaseFetch(
          `/rest/v1/wallet_transactions?select=id,amount,created_at,transaction_details&user_id=eq.${profileId}&transaction_type=eq.service_payment&order=created_at.desc&limit=60`,
          {},
          session.access_token,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          id: string;
          amount: number;
          created_at: string;
          transaction_details?: { payee_id?: string; payee_name?: string };
        }>;
        const seen = new Set<string>();
        const list: Recent[] = [];
        for (const r of rows) {
          const number = toMobile(r.transaction_details?.payee_id ?? '');
          if (!number || seen.has(number)) continue;
          seen.add(number);
          const name = r.transaction_details?.payee_name;
          list.push({
            id: String(r.id),
            name: name && name !== number ? name : number,
            number,
            amount: Number(r.amount),
            at: r.created_at,
          });
          if (list.length >= 8) break;
        }
        if (alive) setRecents(list);
      } catch {
        // history is optional; the screen still works without it
      } finally {
        if (alive) setLoadingRecents(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.profileId, getValidSession]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      });
      const list: Contact[] = [];
      for (const c of data) {
        const number = toMobile(c.phoneNumbers?.find((p) => p.number && toMobile(p.number))?.number ?? '');
        if (c.name && number) list.push({ id: String(c.id), name: c.name, number, image: c.image?.uri });
      }
      setContacts(list);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const p = await Contacts.getPermissionsAsync();
      if (p.granted) {
        setPerm('granted');
        void loadContacts();
      } else setPerm(p.canAskAgain ? 'denied' : 'blocked');
    })();
  }, [loadContacts]);

  const askContacts = async () => {
    const p = await Contacts.requestPermissionsAsync();
    if (p.granted) {
      setPerm('granted');
      void loadContacts();
    } else setPerm(p.canAskAgain ? 'denied' : 'blocked');
  };

  const q = query.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, '');
  const typedNumber = qDigits.length === 10 ? toMobile(qDigits) : '';
  const invalid = qDigits.length === 10 && !typedNumber
    ? 'Enter a valid 10-digit mobile number starting with 6–9'
    : qDigits.length > 10
      ? 'Mobile numbers have 10 digits'
      : '';

  const match = (name: string, number: string) =>
    !q || name.toLowerCase().includes(q) || (qDigits.length > 0 && number.includes(qDigits));
  const fRecents = useMemo(() => recents.filter((r) => match(r.name, r.number)), [recents, q, qDigits]);
  const fContacts = useMemo(() => contacts.filter((c) => match(c.name, c.number)), [contacts, q, qDigits]);

  const pay = (number: string, name: string) =>
    router.replace({ pathname: '/(tabs)/scan-pay', params: { payeeId: number, payeeName: name } });

  type Row =
    | { kind: 'head'; key: string; title: string }
    | { kind: 'recent'; key: string; r: Recent }
    | { kind: 'contact'; key: string; c: Contact }
    | { kind: 'note'; key: string; text: string; action?: { label: string; run: () => void } }
    | { kind: 'busy'; key: string };

  const rows: Row[] = [];
  if (typedNumber) rows.push({ kind: 'head', key: 'h0', title: 'Pay to this number' }, { kind: 'contact', key: 'typed', c: { id: 'typed', name: typedNumber, number: typedNumber } });

  rows.push({ kind: 'head', key: 'h1', title: 'Suggestions' });
  if (loadingRecents) rows.push({ kind: 'busy', key: 'b1' });
  else if (fRecents.length) fRecents.forEach((r) => rows.push({ kind: 'recent', key: `r${r.id}`, r }));
  else rows.push({ kind: 'note', key: 'n1', text: q ? 'No recent payments match your search.' : 'No recent payments yet.' });

  rows.push({ kind: 'head', key: 'h2', title: 'Your contacts' });
  if (perm === 'checking' || loadingContacts) rows.push({ kind: 'busy', key: 'b2' });
  else if (perm === 'denied')
    rows.push({ kind: 'note', key: 'n2', text: 'Allow contacts to pay people from your phone book.', action: { label: 'Allow contacts', run: () => void askContacts() } });
  else if (perm === 'blocked')
    rows.push({ kind: 'note', key: 'n3', text: 'Contacts are blocked for WishMe.', action: { label: 'Open settings', run: () => void Linking.openSettings() } });
  else if (fContacts.length) fContacts.forEach((c) => rows.push({ kind: 'contact', key: `c${c.id}`, c }));
  else rows.push({ kind: 'note', key: 'n4', text: q ? 'No contacts match your search.' : 'No contacts with a mobile number found.' });

  return (
    <AmbientBackground>
      <View style={[st.root, { paddingTop: insets.top + 8 }]}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[st.title, { color: colors.foreground }]}>Pay to mobile number</Text>
            <Text style={[st.subtitle, { color: colors.mutedForeground }]}>to any UPI app</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/support')} hitSlop={10}>
            <Text style={[st.help, { color: colors.primary }]}>HELP</Text>
          </TouchableOpacity>
        </View>

        <View style={[st.search, { backgroundColor: colors.input, borderColor: invalid ? '#EF4444' : colors.border }]}>
          <Search size={20} color={colors.primary} />
          <TextInput
            style={[st.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search any mobile number"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        {!!invalid && <Text style={st.error}>{invalid}</Text>}

        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.kind === 'head')
              return <Text style={[st.section, { color: colors.foreground }]}>{item.title}</Text>;
            if (item.kind === 'busy') return <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />;
            if (item.kind === 'note')
              return (
                <View style={st.note}>
                  <Text style={[st.noteText, { color: colors.mutedForeground }]}>{item.text}</Text>
                  {item.action && (
                    <TouchableOpacity style={[st.noteBtn, { backgroundColor: colors.primary }]} onPress={item.action.run}>
                      <Text style={st.noteBtnText}>{item.action.label}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            const r = item.kind === 'recent' ? item.r : null;
            const c = item.kind === 'contact' ? item.c : null;
            const name = r?.name ?? c!.name;
            const number = r?.number ?? c!.number;
            return (
              <TouchableOpacity style={st.row} activeOpacity={0.8} onPress={() => pay(number, name)}>
                <Avatar name={name} image={c?.image} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.name, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
                  <Text style={[st.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {r ? `₹${r.amount.toLocaleString('en-IN')} · ${paidOn(r.at)}` : number}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </AmbientBackground>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  help: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  error: { color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 6 },
  section: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  note: { paddingVertical: 12, gap: 10, alignItems: 'flex-start' },
  noteText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  noteBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  noteBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
