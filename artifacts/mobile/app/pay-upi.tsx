import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowLeftRight, Landmark, X } from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Recent = { key: string; payeeId: string; name: string; sub: string; bank: boolean };

const UPI_RE = /^[\w.\-]{2,}@[A-Za-z]{2,}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_SUFFIX = '.ifsc.npci';

export default function PayUpiScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, getValidSession } = useAuth();

  const [bankTab, setBankTab] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [acctNo, setAcctNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [error, setError] = useState('');
  const [recents, setRecents] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);

  // Past payees come from the user's own Scan & Pay history.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const profileId = user?.profileId;
        const session = await getValidSession();
        if (!profileId || !session?.access_token) return;
        const res = await supabaseFetch(
          `/rest/v1/wallet_transactions?select=id,transaction_details&user_id=eq.${profileId}&transaction_type=eq.service_payment&order=created_at.desc&limit=80`,
          {},
          session.access_token,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          id: string;
          transaction_details?: { payee_id?: string; payee_name?: string };
        }>;
        const seen = new Set<string>();
        const list: Recent[] = [];
        for (const r of rows) {
          const id = r.transaction_details?.payee_id ?? '';
          if (!id.includes('@') || seen.has(id)) continue;
          seen.add(id);
          const bank = id.endsWith(BANK_SUFFIX);
          list.push({
            key: String(r.id),
            payeeId: id,
            name: r.transaction_details?.payee_name || id.split('@')[0],
            sub: bank ? id.slice(0, id.indexOf('@')).replace(/.(?=.{4})/g, '•') : id,
            bank,
          });
        }
        if (alive) setRecents(list);
      } catch {
        // history is optional
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.profileId, getValidSession]);

  const go = (payeeId: string, name: string) =>
    router.replace({ pathname: '/(tabs)/scan-pay', params: { payeeId, payeeName: name } });

  const submit = () => {
    if (bankTab) {
      const acct = acctNo.replace(/\D/g, '');
      const code = ifsc.trim().toUpperCase();
      if (acct.length < 9 || acct.length > 18) return setError('Enter a valid account number (9–18 digits)');
      if (!IFSC_RE.test(code)) return setError('Enter a valid 11-character IFSC code');
      return go(`${acct}@${code}${BANK_SUFFIX}`, `A/c ••${acct.slice(-4)}`);
    }
    const id = upiId.trim();
    if (!UPI_RE.test(id)) return setError('Enter a valid UPI ID, like name@bank');
    go(id, id.split('@')[0]);
  };

  const q = (bankTab ? acctNo : upiId).trim().toLowerCase();
  const shown = recents.filter((r) => r.bank === bankTab && (!q || r.name.toLowerCase().includes(q) || r.payeeId.toLowerCase().includes(q)));

  const inputStyle = [st.input, { backgroundColor: colors.input, borderColor: error ? '#EF4444' : colors.border, color: colors.foreground }];

  return (
    <AmbientBackground>
      <View style={[st.root, { paddingTop: insets.top + 8 }]}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[st.title, { color: colors.foreground }]}>Pay to UPI ID or bank</Text>
        </View>

        {bankTab ? (
          <View style={{ gap: 10 }}>
            <TextInput
              style={inputStyle}
              value={acctNo}
              onChangeText={(t) => { setAcctNo(t); setError(''); }}
              placeholder="Search or enter bank a/c number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={18}
            />
            <TextInput
              style={inputStyle}
              value={ifsc}
              onChangeText={(t) => { setIfsc(t); setError(''); }}
              placeholder="IFSC code"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={11}
            />
          </View>
        ) : (
          <View>
            <TextInput
              style={inputStyle}
              value={upiId}
              onChangeText={(t) => { setUpiId(t); setError(''); }}
              placeholder="Search or enter UPI ID (name@bank)"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!upiId && (
              <TouchableOpacity style={st.clear} onPress={() => setUpiId('')} hitSlop={10}>
                <X size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {!!error && <Text style={st.error}>{error}</Text>}

        <View style={[st.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[false, true].map((b) => (
            <TouchableOpacity
              key={String(b)}
              style={[st.tab, bankTab === b && { backgroundColor: colors.primary }]}
              onPress={() => { setBankTab(b); setError(''); }}
              activeOpacity={0.85}
            >
              <Text style={[st.tabText, { color: bankTab === b ? '#fff' : colors.foreground }]}>
                {b ? 'Bank accounts' : 'UPI IDs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
        ) : shown.length ? (
          <FlatList
            style={{ flex: 1 }}
            data={shown}
            keyExtractor={(r) => r.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={st.row} activeOpacity={0.8} onPress={() => go(item.payeeId, item.name)}>
                <View style={[st.rowIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {item.bank ? <Landmark size={20} color={colors.primary} /> : <ArrowLeftRight size={20} color={colors.primary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[st.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={st.empty}>
            <View style={[st.emptyArt, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ArrowLeftRight size={56} color={colors.primary} />
            </View>
            <Text style={[st.emptyText, { color: colors.mutedForeground }]}>Send and receive money with ease</Text>
          </View>
        )}

        <Text style={[st.powered, { color: colors.mutedForeground }]}>Powered by UPI</Text>
        <TouchableOpacity
          style={[st.cta, { backgroundColor: colors.primary, marginBottom: insets.bottom + 12 }]}
          activeOpacity={0.85}
          onPress={submit}
        >
          <Text style={st.ctaText}>{bankTab ? 'Pay to bank account' : 'Pay to UPI ID'}</Text>
        </TouchableOpacity>
      </View>
    </AmbientBackground>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  input: {
    height: 56,
    paddingHorizontal: 16,
    paddingRight: 44,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  clear: { position: 'absolute', right: 14, top: 19 },
  error: { color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 6 },
  tabs: { flexDirection: 'row', padding: 5, borderRadius: 18, borderWidth: 1, marginTop: 18, marginBottom: 8 },
  tab: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  emptyArt: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  powered: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  cta: { height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
});
