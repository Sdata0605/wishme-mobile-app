import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { WishFriendLanding } from '@/components/wish-friend/WishFriendLanding';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { parseApiError, supabaseFetch, SUPABASE_URL } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityById } from '@/hooks/useCelebrityById';
import { useSubscribedCelebrities } from '@/hooks/useSubscribedCelebrities';
import { SubscribedCelebrityChips } from '@/components/celebrity/SubscribedCelebrityChips';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const CELEBRITY_SELECT = 'id,name,category,image_url,delivery_time,service_prices';
const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imgUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : B2_BASE + url;
}

type VideoType = 'video_wish' | 'ugc_video';
type Step = 'type' | 'details' | 'review' | 'done';

interface Celebrity {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  delivery_time: string | null;
  service_prices: { general_wish?: number; ugc_ad?: number } | null;
}

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Congratulations',
  'Get Well Soon', 'Thank You', 'Farewell', 'Festival', 'Other',
];
const TONES = ['Heartfelt', 'Funny', 'Romantic', 'Energetic', 'Formal'];
const HOOK_STYLES: { value: string; label: string }[] = [
  { value: 'question', label: 'Question hook' },
  { value: 'bold_claim', label: 'Bold statement' },
  { value: 'testimonial', label: 'Personal story' },
  { value: 'curiosity', label: 'Curiosity hook' },
];
const ASPECT_RATIOS = ['9:16', '1:1', '16:9'];

export default function WishFriendScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const wallet = useWallet();
  const { confirmOrder } = useOrderConfirm();
  const { getDiscountedPrice } = usePlan();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const token = session?.access_token ?? null;
  // Opened from a celebrity's profile: the order goes to them without a pick-a-celebrity step.
  const { celebrity: celebrityParam } = useLocalSearchParams<{ celebrity?: string }>();
  const preset = useCelebrityById<Celebrity>(celebrityParam, CELEBRITY_SELECT);

  const [step, setStep] = useState<Step>('type');
  const [videoType, setVideoType] = useState<VideoType>('video_wish');
  // Only celebrities the user has subscribed to can be chosen, as chips on the details screen.
  const subscribed = useSubscribedCelebrities<Celebrity>(CELEBRITY_SELECT);
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [ugcFallbackPrice, setUgcFallbackPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(0);

  const [recipientName, setRecipientName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [relationship, setRelationship] = useState('');
  const [tone, setTone] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [hookStyle, setHookStyle] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickReferenceImage = async () => {
    if (!token || !user?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingImage(true);
    try {
      const blob = await (await fetch(result.assets[0].uri)).blob();
      const path = `${user.id}/wish-friend-${Date.now()}.jpg`;
      const res = await supabaseFetch(
        `/storage/v1/object/promotional-content/${path}`,
        { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob },
        token,
      );
      if (!res.ok) throw new Error(await parseApiError(res));
      setReferenceImageUrl(`${SUPABASE_URL}/storage/v1/object/public/promotional-content/${path}`);
    } catch (e) {
      console.warn('[wish-friend] photo upload failed', e);
      Alert.alert('Photo upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => { wallet.refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    supabaseFetch('/rest/v1/platform_settings?setting_key=eq.ugc_video_price&select=setting_value&limit=1', {}, token)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ setting_value: string }>) => setUgcFallbackPrice(parseInt(rows[0]?.setting_value ?? '0', 10) || 0))
      .catch(() => {});
  }, [token]);

  const basePriceFor = (c: Celebrity | null, type: VideoType = videoType): number => {
    if (!c) return 0;
    if (type === 'video_wish') return c.service_prices?.general_wish ?? 0;
    return c.service_prices?.ugc_ad || ugcFallbackPrice;
  };

  const basePrice = basePriceFor(celebrity);
  const price = getDiscountedPrice(basePrice);
  const typeLabel = videoType === 'video_wish' ? 'Video Wish' : 'UGC Video';
  const detailsValid = useMemo(
    () => !!celebrity && basePrice > 0 && recipientName.trim().length > 0 && occasion.length > 0 && prompt.trim().length >= 10,
    [celebrity, basePrice, recipientName, occasion, prompt],
  );

  const pickType = (key: 'greeting_card' | VideoType) => {
    if (key === 'greeting_card') {
      router.push('/greeting-cards' as never);
      return;
    }
    setVideoType(key);
    // Opened from a celebrity's profile: start with them chosen, if the user is subscribed and they offer this.
    const chosen = preset.celebrity;
    const usable = chosen && basePriceFor(chosen, key) > 0 && subscribed.celebrities.some(c => c.id === chosen.id);
    setCelebrity(usable ? chosen : null);
    setStep('details');
  };

  const goBack = () => {
    if (step === 'details') setStep('type');
    else if (step === 'review') setStep('details');
    else router.back();
  };

  const submit = async () => {
    if (!celebrity || !token) return;
    if (wallet.balance < price) {
      Alert.alert('Insufficient balance', `You need ₹${price.toLocaleString('en-IN')} in your wallet.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add funds', onPress: () => router.push('/wallet' as never) },
      ]);
      return;
    }
    setSubmitting(true);
    try {
      const res = await supabaseFetch('/rest/v1/rpc/create_wish_friend_order', {
        method: 'POST',
        body: JSON.stringify({
          p_order_type: videoType,
          p_celebrity_id: celebrity.id,
          p_recipient_name: recipientName,
          p_occasion: occasion,
          p_relationship: relationship,
          p_tone: tone,
          p_prompt: prompt,
          ...(videoType === 'ugc_video' && {
            p_aspect_ratio: aspectRatio,
            p_hook_style: hookStyle,
            p_call_to_action: callToAction,
            p_reference_image_url: referenceImageUrl,
          }),
        }),
      }, token);
      if (!res.ok) throw new Error(await parseApiError(res));
      const order = await res.json() as { id?: string; price_paid?: number };
      setPaid(order.price_paid ?? price);
      wallet.refetch();
      setStep('done');
      confirmOrder({
        item: `a ${videoType === 'video_wish' ? 'video wish' : 'UGC video'} for ${recipientName.trim()}`,
        orderId: order.id,
        viewRoute: { pathname: '/bookings', params: { tab: 'Wish a Friend' } },
      });
    } catch (e) {
      console.warn('[wish-friend] create_wish_friend_order failed', e);
      Alert.alert('Could not place order', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('type');
    setCelebrity(null);
    setRecipientName('');
    setOccasion('');
    setRelationship('');
    setTone('');
    setPrompt('');
    setHookStyle('');
    setCallToAction('');
    setReferenceImageUrl('');
  };

  const inputStyle = [s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }];

  const Chips = ({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={s.chipRow}>
      {items.map(item => {
        const active = value === item;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onChange(active ? '' : item)}
            style={[s.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : 'transparent' }]}
          >
            <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const header = (
    <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={goBack} hitSlop={12}>
        <Icon name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Friend</Text>
      <View style={{ width: 22 }} />
    </View>
  );

  if (!user || !session) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        {header}
        <View style={s.gate}>
          <Icon name="heart" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>Sign in to Wish a Friend</Text>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)' as never)}>
            <Text style={s.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      {header}

      {step === 'type' && (preset.loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
      ) : (
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {preset.celebrity ? (
            <View style={[s.presetBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {imgUri(preset.celebrity.image_url) ? (
                <Image source={{ uri: imgUri(preset.celebrity.image_url)! }} style={s.presetAvatar} contentFit="cover" />
              ) : (
                <View style={[s.presetAvatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="star" size={18} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Your order goes to</Text>
                <Text style={[s.optionTitle, { color: colors.foreground }]} numberOfLines={1}>{preset.celebrity.name}</Text>
              </View>
            </View>
          ) : null}
          <WishFriendLanding
            onPick={pickType}
            onOpenOrders={() => router.push({ pathname: '/bookings', params: { tab: 'Wish a Friend' } } as never)}
          />
        </KeyboardAwareScrollViewCompat>
      ))}

      {step === 'details' && (
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          <Text style={[s.lead, { color: colors.mutedForeground }]}>
            {typeLabel}{celebrity ? ` with ${celebrity.name}` : ''}
          </Text>

          <Text style={[s.label, { color: colors.foreground }]}>Select Celebrity *</Text>
          <SubscribedCelebrityChips
            celebrities={subscribed.celebrities}
            loading={subscribed.loading}
            hasNone={subscribed.hasNone}
            selectedId={celebrity?.id}
            onSelect={c => setCelebrity(c)}
            priceFor={c => {
              const base = basePriceFor(c);
              return base > 0 ? getDiscountedPrice(base) : null;
            }}
            accent={colors.primary}
          />

          <Text style={[s.label, { color: colors.foreground }]}>Friend's name *</Text>
          <TextInput value={recipientName} onChangeText={setRecipientName} placeholder="e.g. Priya" placeholderTextColor={colors.mutedForeground} style={inputStyle} />

          <Text style={[s.label, { color: colors.foreground }]}>Occasion *</Text>
          <Chips items={OCCASIONS} value={occasion} onChange={setOccasion} />

          <Text style={[s.label, { color: colors.foreground }]}>Tone</Text>
          <Chips items={TONES} value={tone} onChange={setTone} />

          <Text style={[s.label, { color: colors.foreground }]}>Your relationship</Text>
          <TextInput value={relationship} onChangeText={setRelationship} placeholder="Best friend, sister, colleague (optional)" placeholderTextColor={colors.mutedForeground} style={inputStyle} />

          <Text style={[s.label, { color: colors.foreground }]}>What should the video say? *</Text>
          <TextInput
            value={prompt}
            onChangeText={t => setPrompt(t.slice(0, 600))}
            multiline
            textAlignVertical="top"
            placeholder="Describe your idea, memories to mention, inside jokes, or the exact message you want."
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, { minHeight: 120 }]}
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'right', marginTop: 4 }}>{prompt.length} / 600 (minimum 10)</Text>

          {videoType === 'ugc_video' && (
            <View style={[s.panel, { borderColor: colors.border, marginTop: 20 }]}>
              <Text style={[s.optionTitle, { color: colors.foreground }]}>UGC video details</Text>

              <Text style={[s.label, { color: colors.foreground, marginTop: 8 }]}>Video format</Text>
              <Chips items={ASPECT_RATIOS} value={aspectRatio} onChange={v => setAspectRatio(v || '9:16')} />

              <Text style={[s.label, { color: colors.foreground }]}>Opening style</Text>
              <View style={s.chipRow}>
                {HOOK_STYLES.map(h => {
                  const active = hookStyle === h.value;
                  return (
                    <TouchableOpacity
                      key={h.value}
                      onPress={() => setHookStyle(active ? '' : h.value)}
                      style={[s.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : 'transparent' }]}
                    >
                      <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{h.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.label, { color: colors.foreground }]}>Closing line</Text>
              <TextInput value={callToAction} onChangeText={setCallToAction} placeholder="e.g. Happy birthday, see you soon! (optional)" placeholderTextColor={colors.mutedForeground} style={inputStyle} />

              <Text style={[s.label, { color: colors.foreground }]}>Reference photo (optional)</Text>
              <TouchableOpacity onPress={pickReferenceImage} disabled={uploadingImage} style={[s.input, { borderColor: colors.border, alignItems: 'center' }]}>
                {uploadingImage ? <ActivityIndicator color={colors.primary} /> : (
                  <Text style={{ color: colors.foreground }}>{referenceImageUrl ? 'Change photo' : 'Choose a photo of your friend'}</Text>
                )}
              </TouchableOpacity>
              {referenceImageUrl ? <Image source={{ uri: referenceImageUrl }} style={{ width: '100%', height: 140, borderRadius: 12, marginTop: 8 }} contentFit="cover" /> : null}
            </View>
          )}

          <TouchableOpacity
            disabled={!detailsValid || uploadingImage}
            onPress={() => setStep('review')}
            style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: detailsValid && !uploadingImage ? 1 : 0.4, marginTop: 20 }]}
          >
            <Text style={s.primaryBtnText}>Review order</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollViewCompat>
      )}

      {step === 'review' && celebrity && (
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
          <View style={[s.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.optionTitle, { color: colors.foreground }]}>{typeLabel} · {celebrity.name}</Text>
            {celebrity.delivery_time ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Delivery: {celebrity.delivery_time}</Text> : null}
            <Text style={[s.row, { color: colors.foreground }]}>For: {recipientName}</Text>
            <Text style={[s.row, { color: colors.foreground }]}>Occasion: {occasion}</Text>
            {tone ? <Text style={[s.row, { color: colors.foreground }]}>Tone: {tone}</Text> : null}
            {relationship ? <Text style={[s.row, { color: colors.foreground }]}>Relationship: {relationship}</Text> : null}
            <Text style={[s.row, { color: colors.foreground }]}>Prompt: {prompt}</Text>
            {videoType === 'ugc_video' ? (
              <>
                <Text style={[s.row, { color: colors.foreground }]}>Format: {aspectRatio}</Text>
                {hookStyle ? <Text style={[s.row, { color: colors.foreground }]}>Opening style: {HOOK_STYLES.find(h => h.value === hookStyle)?.label}</Text> : null}
                {callToAction ? <Text style={[s.row, { color: colors.foreground }]}>Closing line: {callToAction}</Text> : null}
                {referenceImageUrl ? <Image source={{ uri: referenceImageUrl }} style={{ width: '100%', height: 100, borderRadius: 10 }} contentFit="cover" /> : null}
              </>
            ) : null}
          </View>

          <View style={[s.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.splitRow}>
              <Text style={{ color: colors.foreground }}>{typeLabel}</Text>
              <Text style={{ color: colors.foreground }}>
                {price < basePrice ? `₹${basePrice.toLocaleString('en-IN')}  ` : ''}₹{price.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={s.splitRow}>
              <Text style={{ color: colors.mutedForeground }}>Wallet balance</Text>
              <Text style={{ color: colors.mutedForeground }}>₹{wallet.balance.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[s.splitRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
              <Text style={[s.optionTitle, { color: colors.foreground }]}>Total</Text>
              <Text style={[s.optionTitle, { color: colors.primary }]}>₹{price.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {wallet.balance < price && (
            <TouchableOpacity onPress={() => router.push('/wallet' as never)} style={[s.panel, { borderColor: '#EF4444' }]}>
              <Text style={{ color: '#EF4444' }}>You need ₹{(price - wallet.balance).toLocaleString('en-IN')} more. Tap to add funds.</Text>
            </TouchableOpacity>
          )}

          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Your request goes to our team. They make your video, check it, and deliver it to My Bookings.
          </Text>

          <TouchableOpacity
            disabled={submitting || wallet.balance < price}
            onPress={submit}
            style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: submitting || wallet.balance < price ? 0.4 : 1 }]}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Pay ₹{price.toLocaleString('en-IN')} from wallet</Text>}
          </TouchableOpacity>
        </KeyboardAwareScrollViewCompat>
      )}

      {step === 'done' && (
        <View style={s.gate}>
          <Icon name="check-circle" size={64} color="#22C55E" />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>Request sent</Text>
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
            We received your {typeLabel.toLowerCase()} request (₹{paid.toLocaleString('en-IN')} paid). Our team will make it and deliver it in My Bookings, under Wish a Friend.
          </Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/bookings', params: { tab: 'Wish a Friend' } } as never)}
          >
            <Text style={s.primaryBtnText}>View My Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset}><Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Send another</Text></TouchableOpacity>
        </View>
      )}
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
  lead: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  gateTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  primaryBtn: { paddingHorizontal: 24, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  optionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  presetBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 14, borderWidth: 1 },
  presetAvatar: { width: 44, height: 44, borderRadius: 22 },
  celebCard: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  celebImg: { width: '100%', height: 130 },
  celebName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  row: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
