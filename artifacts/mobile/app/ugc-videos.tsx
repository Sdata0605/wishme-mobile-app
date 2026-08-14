import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';

interface Celeb { id: string; name: string; category: string; image_url?: string }
interface Generation {
  id: string;
  celebrity_id: string;
  concept: string;
  script: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string;
  price_paid: number;
  created_at: string;
  celebrities?: Celeb | Celeb[] | null;
}

function celebOf(g: Generation): Celeb | null {
  const c = g.celebrities;
  if (Array.isArray(c)) return c[0] ?? null;
  return c ?? null;
}

export default function UgcVideosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const wallet = useWallet();
  const { getDiscountedPrice } = usePlan();
  const { favoriteIds, loading: favLoading } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [celebrities, setCelebrities] = useState<Celeb[]>([]);
  const [selectedCelebrity, setSelectedCelebrity] = useState('');
  const [concept, setConcept] = useState('');
  const [basePrice, setBasePrice] = useState(500);
  const [history, setHistory] = useState<Generation[]>([]);
  const [generating, setGenerating] = useState(false);
  const price = getDiscountedPrice(basePrice);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!session?.access_token || !wallet.profileId) return;
    const ids = [...favoriteIds];
    const [priceRes, histRes, celebRes] = await Promise.all([
      supabaseFetch('/rest/v1/platform_settings?setting_key=eq.ugc_video_price&select=setting_value&limit=1', {}, session.access_token),
      supabaseFetch(
        `/rest/v1/ugc_video_generations?user_id=eq.${wallet.profileId}&select=*,celebrities(id,name,category,image_url)&order=created_at.desc`,
        {},
        session.access_token,
      ),
      ids.length
        ? supabaseFetch(
            `/rest/v1/celebrities?id=in.(${ids.join(',')})&is_active=eq.true&select=id,name,category,image_url`,
            {},
            session.access_token,
          )
        : Promise.resolve(null),
    ]);
    if (priceRes.ok) {
      const rows = await priceRes.json() as Array<{ setting_value: string }>;
      if (rows[0]?.setting_value) setBasePrice(parseInt(rows[0].setting_value, 10) || 500);
    }
    if (histRes.ok) setHistory(await histRes.json() as Generation[]);
    if (celebRes && celebRes.ok) setCelebrities(await celebRes.json() as Celeb[]);
  }, [session?.access_token, wallet.profileId, favoriteIds]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    if (!selectedCelebrity) { Alert.alert('Select a celebrity'); return; }
    if (!concept.trim()) { Alert.alert('Enter a concept'); return; }
    if (wallet.balance < price) {
      Alert.alert('Insufficient balance', `Need ₹${price}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wallet', onPress: () => router.push('/wallet' as never) },
      ]);
      return;
    }
    if (!session?.access_token || !wallet.profileId) return;
    setGenerating(true);
    try {
      const tx = await supabaseFetch('/rest/v1/wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({
          user_id: wallet.profileId,
          transaction_type: 'ugc_video',
          amount: price,
          status: 'completed',
          payment_method: 'wallet',
          transaction_details: { celebrity_id: selectedCelebrity, concept: concept.slice(0, 100) },
        }),
      }, session.access_token);
      if (!tx.ok) throw new Error('Wallet payment failed');

      const ins = await supabaseFetch('/rest/v1/ugc_video_generations', {
        method: 'POST',
        headers: { Prefer: 'return=representation' } as Record<string, string>,
        body: JSON.stringify({
          user_id: wallet.profileId,
          celebrity_id: selectedCelebrity,
          concept: concept.trim(),
          status: 'processing',
          price_paid: price,
        }),
      }, session.access_token);
      if (!ins.ok) throw new Error('Could not create generation');
      const rows = await ins.json() as Generation[];
      const generationId = rows[0]?.id;
      if (!generationId) throw new Error('No generation id');

      const res = await supabaseFetch('/functions/v1/generate-ugc-video', {
        method: 'POST',
        body: JSON.stringify({
          concept: concept.trim(),
          celebrity_id: selectedCelebrity,
          user_id: wallet.profileId,
          generation_id: generationId,
        }),
      }, session.access_token);
      const data = await res.json() as { message?: string; script?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || data.message || 'Generation failed');
      setConcept('');
      wallet.refetch();
      await load();
      setTab('history');
      Alert.alert('Ready', data.message || 'UGC video script generated');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="chevron-left" size={22} color={colors.foreground} /></TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>UGC Videos</Text>
      </View>
      <View style={s.tabs}>
        {(['create', 'history'] as const).map((id) => (
          <TouchableOpacity key={id} onPress={() => setTab(id)} style={[s.tab, tab === id && { borderBottomColor: colors.primary }]}>
            <Text style={{ color: tab === id ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>{id === 'create' ? 'Create' : 'My Videos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'create' ? (
          <>
            <Text style={[s.label, { color: colors.mutedForeground }]}>Favorite celebrity</Text>
            {favLoading ? <ActivityIndicator /> : celebrities.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => setSelectedCelebrity(c.id)} style={[s.celeb, { borderColor: selectedCelebrity === c.id ? colors.primary : colors.border }]}>
                {c.image_url ? <Image source={{ uri: c.image_url }} style={s.avatar} /> : <View style={s.avatar} />}
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.label, { color: colors.mutedForeground }]}>Concept</Text>
            <TextInput
              value={concept}
              onChangeText={setConcept}
              placeholder="Describe the UGC video concept"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
            />
            <TouchableOpacity disabled={generating} onPress={generate} style={[s.btn, { backgroundColor: colors.primary, opacity: generating ? 0.6 : 1 }]}>
              <Text style={s.btnText}>{generating ? 'Generating…' : `Generate · ₹${price}`}</Text>
            </TouchableOpacity>
          </>
        ) : (
          history.map((g) => {
            const c = celebOf(g);
            return (
              <View key={g.id} style={[s.card, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{c?.name ?? 'Celebrity'}</Text>
                <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{g.concept}</Text>
                <Text style={{ color: colors.primary, marginTop: 6 }}>{g.status}</Text>
                {g.script ? <Text style={{ color: colors.foreground, marginTop: 8 }}>{g.script}</Text> : null}
                {g.video_url ? <Text style={{ color: colors.primary, marginTop: 8 }}>{g.video_url}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16 },
  tab: { marginRight: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  label: { marginTop: 12, marginBottom: 6, fontFamily: 'Inter_500Medium', fontSize: 12 },
  input: { minHeight: 100, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  celeb: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' },
  btn: { marginTop: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
});
