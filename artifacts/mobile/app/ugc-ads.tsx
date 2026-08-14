import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
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
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';

const HOOKS = ['question', 'bold_claim', 'problem_solution', 'testimonial', 'curiosity'];
const RATIOS = ['9:16', '16:9', '1:1'];

interface Ad {
  id: string;
  product_name: string;
  product_description: string;
  script: string | null;
  video_url: string | null;
  status: string;
  price_paid: number;
  created_at: string;
}

export default function UgcAdsScreen() {
  const { celebrity } = useLocalSearchParams<{ celebrity?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const wallet = useWallet();
  const { getDiscountedPrice } = usePlan();

  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hookStyle, setHookStyle] = useState(HOOKS[0]);
  const [callToAction, setCallToAction] = useState('');
  const [aspectRatio, setAspectRatio] = useState(RATIOS[0]);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [celebrityId, setCelebrityId] = useState(celebrity || '');
  const [heygenAvatarId, setHeygenAvatarId] = useState<string | undefined>();
  const [heygenVoiceId, setHeygenVoiceId] = useState<string | undefined>();
  const [basePrice, setBasePrice] = useState(999);
  const [history, setHistory] = useState<Ad[]>([]);
  const [generating, setGenerating] = useState(false);
  const price = getDiscountedPrice(basePrice);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    const [priceRes, adsRes] = await Promise.all([
      supabaseFetch('/rest/v1/platform_settings?setting_key=eq.ugc_ads_price&select=setting_value&limit=1', {}, session.access_token),
      supabaseFetch(`/rest/v1/ugc_ads?user_id=eq.${user.id}&select=*&order=created_at.desc`, {}, session.access_token),
    ]);
    if (priceRes.ok) {
      const rows = await priceRes.json() as Array<{ setting_value: string }>;
      if (rows[0]?.setting_value) setBasePrice(parseInt(rows[0].setting_value, 10) || 999);
    }
    if (adsRes.ok) setHistory(await adsRes.json() as Ad[]);
    if (celebrity) {
      const cr = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity}&select=id,heygen_avatar_id,heygen_voice_id,service_prices&limit=1`,
        {},
        session.access_token,
      );
      if (cr.ok) {
        const rows = await cr.json() as Array<{ id: string; heygen_avatar_id?: string; heygen_voice_id?: string; service_prices?: { ugc_ad?: number } }>;
        const row = rows[0];
        if (row) {
          setCelebrityId(row.id);
          setHeygenAvatarId(row.heygen_avatar_id);
          setHeygenVoiceId(row.heygen_voice_id);
          if (row.service_prices?.ugc_ad) setBasePrice(row.service_prices.ugc_ad);
        }
      }
    }
  }, [session?.access_token, user?.id, celebrity]);

  useEffect(() => { void load(); }, [load]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    setProductImageUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const generate = async () => {
    if (!productName.trim() || !productDescription.trim() || !prompt.trim()) {
      Alert.alert('Fill product name, description and prompt');
      return;
    }
    if (wallet.balance < price) {
      Alert.alert('Insufficient balance', `Need ₹${price}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wallet', onPress: () => router.push('/wallet' as never) },
      ]);
      return;
    }
    if (!session?.access_token || !user?.id || !wallet.profileId) return;
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
          description: `UGC Ad: ${productName.trim()}`,
        }),
      }, session.access_token);
      if (!tx.ok) throw new Error('Wallet payment failed');

      const ins = await supabaseFetch('/rest/v1/ugc_ads', {
        method: 'POST',
        headers: { Prefer: 'return=representation' } as Record<string, string>,
        body: JSON.stringify({
          user_id: user.id,
          product_name: productName.trim(),
          product_description: productDescription.trim(),
          product_image_url: productImageUrl,
          prompt: prompt.trim(),
          hook_style: hookStyle,
          call_to_action: callToAction.trim(),
          avatar_id: heygenAvatarId || selectedAvatar || null,
          aspect_ratio: aspectRatio,
          status: 'pending',
          price_paid: price,
          celebrity_id: celebrityId || null,
        }),
      }, session.access_token);
      if (!ins.ok) throw new Error('Could not create ad order');
      const ads = await ins.json() as Ad[];
      const ugcAdId = ads[0]?.id;
      if (!ugcAdId) throw new Error('No ad id');

      const res = await supabaseFetch('/functions/v1/generate-ugc-ad', {
        method: 'POST',
        body: JSON.stringify({
          ugc_ad_id: ugcAdId,
          product_name: productName.trim(),
          product_description: productDescription.trim(),
          product_image_url: productImageUrl,
          prompt: prompt.trim(),
          hook_style: hookStyle,
          call_to_action: callToAction.trim(),
          avatar_id: heygenAvatarId || selectedAvatar || undefined,
          voice_id: heygenVoiceId,
          aspect_ratio: aspectRatio,
          celebrity_id: celebrityId || null,
        }),
      }, session.access_token);
      const data = await res.json() as { message?: string; error?: string; status?: string };
      if (!res.ok || data.error) throw new Error(data.error || data.message || 'Generation failed');
      setProductName('');
      setProductDescription('');
      setPrompt('');
      wallet.refetch();
      await load();
      setTab('history');
      Alert.alert('Started', data.message || 'UGC ad submitted for approval');
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
        <Text style={[s.title, { color: colors.foreground }]}>UGC Ads</Text>
      </View>
      <View style={s.tabs}>
        {(['create', 'history'] as const).map((id) => (
          <TouchableOpacity key={id} onPress={() => setTab(id)} style={[s.tab, tab === id && { borderBottomColor: colors.primary }]}>
            <Text style={{ color: tab === id ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>{id === 'create' ? 'Create' : 'My Ads'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'create' ? (
          <>
            <Text style={[s.label, { color: colors.mutedForeground }]}>Product name</Text>
            <TextInput value={productName} onChangeText={setProductName} style={[s.input, { color: colors.foreground, borderColor: colors.border }]} placeholderTextColor={colors.mutedForeground} />
            <Text style={[s.label, { color: colors.mutedForeground }]}>Description</Text>
            <TextInput value={productDescription} onChangeText={setProductDescription} multiline style={[s.area, { color: colors.foreground, borderColor: colors.border }]} placeholderTextColor={colors.mutedForeground} />
            <Text style={[s.label, { color: colors.mutedForeground }]}>Prompt</Text>
            <TextInput value={prompt} onChangeText={setPrompt} multiline style={[s.area, { color: colors.foreground, borderColor: colors.border }]} placeholderTextColor={colors.mutedForeground} />
            <Text style={[s.label, { color: colors.mutedForeground }]}>Call to action</Text>
            <TextInput value={callToAction} onChangeText={setCallToAction} style={[s.input, { color: colors.foreground, borderColor: colors.border }]} placeholderTextColor={colors.mutedForeground} />
            <TouchableOpacity onPress={pickImage} style={[s.btnGhost, { borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground }}>{productImageUrl ? 'Change product image' : 'Upload product image'}</Text>
            </TouchableOpacity>
            {productImageUrl ? <Image source={{ uri: productImageUrl }} style={s.preview} /> : null}
            <Text style={[s.label, { color: colors.mutedForeground }]}>Hook</Text>
            <View style={s.row}>
              {HOOKS.map((h) => (
                <TouchableOpacity key={h} onPress={() => setHookStyle(h)} style={[s.chip, { borderColor: hookStyle === h ? colors.primary : colors.border }]}>
                  <Text style={{ color: hookStyle === h ? colors.primary : colors.foreground, fontSize: 12 }}>{h.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { color: colors.mutedForeground }]}>Aspect ratio</Text>
            <View style={s.row}>
              {RATIOS.map((r) => (
                <TouchableOpacity key={r} onPress={() => setAspectRatio(r)} style={[s.chip, { borderColor: aspectRatio === r ? colors.primary : colors.border }]}>
                  <Text style={{ color: aspectRatio === r ? colors.primary : colors.foreground }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={selectedAvatar} onChangeText={setSelectedAvatar} placeholder="Avatar id (optional)" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border, marginTop: 12 }]} />
            <TouchableOpacity disabled={generating} onPress={generate} style={[s.btn, { backgroundColor: colors.primary, opacity: generating ? 0.6 : 1 }]}>
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Submit ad · ₹{price}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          history.map((ad) => (
            <View key={ad.id} style={[s.card, { borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{ad.product_name}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{ad.product_description}</Text>
              <Text style={{ color: colors.primary, marginTop: 6 }}>{ad.status}</Text>
              {ad.script ? <Text style={{ color: colors.foreground, marginTop: 8 }}>{ad.script}</Text> : null}
              {ad.video_url ? <Text style={{ color: colors.primary, marginTop: 8 }}>{ad.video_url}</Text> : null}
            </View>
          ))
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
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
  area: { minHeight: 80, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  btn: { marginTop: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnGhost: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  preview: { width: '100%', height: 140, borderRadius: 12, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
});
