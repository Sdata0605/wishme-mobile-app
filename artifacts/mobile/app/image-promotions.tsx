import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  Share,
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
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

/** Tries per order. The AI service is occasionally busy or drops a request; a repeat almost always works. */
const MAX_ATTEMPTS = 3;
/** Generating an image takes well over the app's usual 20 s request limit. */
const GENERATE_TIMEOUT_MS = 170_000;

interface ImagePromotion {
  id: string;
  user_id: string;
  celebrity_id: string;
  concept: string;
  branding_details: string | null;
  price_paid: number | null;
  generated_image_url: string | null;
  status: 'pending' | 'completed' | 'failed';
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
  wishme_payment_id?: string;
}

interface SubscribedCeleb {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
}

type RefImgSource = 'none' | 'upload';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.split('T')[0];
  }
}

function isToday(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  } catch {
    return false;
  }
}

export default function ImagePromotionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session, getValidSession } = useAuth();
  const { confirmOrder } = useOrderConfirm();
  const wallet = useWallet();
  const { discountPercentage, getDiscountedPrice } = usePlan();
  const { favoriteIds, loading: favLoading } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  const [tab, setTab] = useState<'create' | 'history'>('create');

  const [celebrities, setCelebrities] = useState<SubscribedCeleb[]>([]);
  const [celebsLoading, setCelebsLoading] = useState(false);

  const [selectedCelebId, setSelectedCelebId] = useState('');
  // Opened from a celebrity's profile: start with them selected (they must be one of the user's subscriptions).
  const { celebrity: presetCelebId } = useLocalSearchParams<{ celebrity?: string }>();

  const [concept, setConcept] = useState('');
  const [branding, setBranding] = useState('');

  const [refImgSource, setRefImgSource] = useState<RefImgSource>('none');
  const [refImgBase64, setRefImgBase64] = useState<string | null>(null);
  const [refImgUri, setRefImgUri] = useState<string | null>(null);

  const [basePrice, setBasePrice] = useState(25);
  const finalPrice = getDiscountedPrice(basePrice);
  const discountPct = discountPercentage;

  const [history, setHistory] = useState<ImagePromotion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<ImagePromotion | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const isLoggedIn = !!(user && session);
  const noSubscriptions = isLoggedIn && !favLoading && favoriteIds.size === 0;

  const todayCount = history.filter(p => isToday(p.created_at)).length;
  const completedCount = history.filter(p => p.status === 'completed').length;

  const fetchCelebrities = useCallback(async () => {
    if (!session?.access_token || !favoriteIds.size) {
      setCelebrities([]);
      return;
    }
    setCelebsLoading(true);
    try {
      const ids = Array.from(favoriteIds).join(',');
      const celebRes = await supabaseFetch(
        `/rest/v1/celebrities?select=id,name,category,image_url&id=in.(${ids})`,
        {},
        session.access_token,
      );
      if (celebRes.ok) {
        const rows = await celebRes.json() as SubscribedCeleb[];
        setCelebrities(rows ?? []);
        if (rows.length === 1) setSelectedCelebId(rows[0].id);
        else if (presetCelebId && rows.some(r => r.id === presetCelebId)) setSelectedCelebId(prev => prev || presetCelebId);
      }
    } catch {}
    setCelebsLoading(false);
  }, [session, favoriteIds, presetCelebId]);

  const fetchPricing = useCallback(async () => {
    try {
      const settingsRes = await supabaseFetch(
        '/rest/v1/platform_settings?select=setting_value&setting_key=eq.image_promotion_price&limit=1',
        {},
        session?.access_token,
      );
      if (settingsRes.ok) {
        const rows = await settingsRes.json() as Array<{ setting_value: string }>;
        if (rows?.length) {
          const v = parseFloat(rows[0].setting_value);
          if (!isNaN(v)) setBasePrice(v);
        }
      }
    } catch {}
  }, [session]);

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token || !user?.profileId) return;
    setHistoryLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/image_promotions?user_id=eq.${user.profileId}&order=created_at.desc&limit=50`,
        {},
        session.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as ImagePromotion[];
        setHistory(rows ?? []);
      }
    } catch {}
    setHistoryLoading(false);
  }, [session, user]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void fetchCelebrities();
    void fetchPricing();
    void fetchHistory();
    wallet.refetch();
  }, [isLoggedIn, user?.profileId, favoriteIds]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setRefImgUri(asset.uri);
    setRefImgBase64(asset.base64 ?? null);
  }, []);

  const clearRefImage = useCallback(() => {
    setRefImgUri(null);
    setRefImgBase64(null);
  }, []);

  /** An image the server finished for this celebrity since `since`, or null. Used after a dropped connection. */
  const findFinishedGeneration = useCallback(async (token: string, since: string): Promise<ImagePromotion | null> => {
    if (!user?.profileId || !selectedCelebId) return null;
    try {
      const res = await supabaseFetch(
        `/rest/v1/image_promotions?user_id=eq.${user.profileId}&celebrity_id=eq.${selectedCelebId}&status=eq.completed&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1`,
        {},
        token,
      );
      if (!res.ok) return null;
      const rows = await res.json() as ImagePromotion[];
      return rows?.[0]?.generated_image_url ? rows[0] : null;
    } catch {
      return null;
    }
  }, [user?.profileId, selectedCelebId]);

  const generate = useCallback(async () => {
    if (!selectedCelebId || !concept.trim()) return;
    if (wallet.balance < finalPrice) {
      Alert.alert(
        'Insufficient Balance',
        'Your wallet balance is insufficient. Would you like to add funds?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => router.push('/wallet' as never) },
        ],
      );
      return;
    }
    if (!session?.access_token) return;

    setGenerating(true);
    setCurrentGeneration(null);

    try {
      const payload: Record<string, unknown> = {
        celebrityId: selectedCelebId,
        concept: concept.trim(),
        brandingDetails: branding.trim() || undefined,
        referenceImageSource: refImgBase64 ? 'upload' : 'none',
        referenceImageUrl: refImgBase64 ? `data:image/jpeg;base64,${refImgBase64}` : null,
      };

      const startedAt = new Date(Date.now() - 5_000).toISOString();
      let gen: ImagePromotion | null = null;
      let lastError = '';

      // Up to 3 tries, so a hiccup (a busy AI model, a dropped connection, an expired token) never
      // reaches the user. A try is only repeated when nothing was charged: the server bills only
      // after an image exists, and before retrying a dropped connection we look for an image the
      // server already finished, so the same order is never paid for twice.
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !gen; attempt++) {
        if (attempt > 1) await new Promise<void>(r => setTimeout(r, 1500 * (attempt - 1)));

        // The token in state can be an hour old; ask for one that is guaranteed valid right now.
        const fresh = await getValidSession();
        if (!fresh?.access_token) {
          Alert.alert('Session expired', 'Please sign in again to generate images.');
          setGenerating(false);
          return;
        }

        let res: Response;
        try {
          res = await supabaseFetch(
            '/functions/v1/generate-image-promotion',
            { method: 'POST', body: JSON.stringify(payload) },
            fresh.access_token,
            GENERATE_TIMEOUT_MS,
          );
        } catch {
          // Connection dropped or timed out: the image may still have been made and paid for.
          lastError = 'The connection dropped.';
          const done = await findFinishedGeneration(fresh.access_token, startedAt);
          if (done) gen = done;
          continue;
        }

        if (res.ok) {
          const data = await res.json().catch(() => null) as { generation?: ImagePromotion; error?: string } | null;
          if (data?.generation) { gen = data.generation; break; }
          lastError = data?.error ?? 'No image came back.';
          continue;
        }

        let errMsg = `Request failed (${res.status})`;
        try {
          const errData = await res.json() as Record<string, unknown>;
          const msg = (errData.error as string) || (errData.message as string) || '';
          if (msg) errMsg = msg;
        } catch {}
        lastError = errMsg;

        if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('balance')) {
          Alert.alert(
            'Insufficient Balance',
            'Your wallet balance is insufficient. Would you like to add funds?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Add Funds', onPress: () => router.push('/wallet' as never) },
            ],
          );
          setGenerating(false);
          return;
        }
        // Worth another try: the AI service was busy or failed (5xx / 429), or the token was refused.
        const transient = res.status >= 500 || res.status === 429 || res.status === 401;
        if (!transient) {
          Alert.alert('Generation Failed', errMsg);
          setGenerating(false);
          return;
        }
      }

      if (!gen) {
        Alert.alert('Could not create the image', `${lastError} We tried ${MAX_ATTEMPTS} times. You are only charged when an image is created, so please try again in a moment.`);
        setGenerating(false);
        return;
      }

      {

        const now = new Date();
        const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const randPart = String(Math.floor(1000 + Math.random() * 9000));
        const wishmePaymentId = `WM-${datePart}-${randPart}`;

        let paymentRecorded = false;
        try {
          const txRes = await supabaseFetch(
            '/rest/v1/payment_transactions',
            {
              method: 'POST',
              body: JSON.stringify({
                wishme_payment_id: wishmePaymentId,
                user_id: user?.profileId,
                amount: finalPrice,
                payment_method: 'wallet',
                service_type: 'image_promotion',
                image_promotion_id: gen.id,
                description: 'Image Promotion',
                status: 'completed',
                paid_at: now.toISOString(),
              }),
            },
            session.access_token,
          );
          if (txRes.ok) paymentRecorded = true;
        } catch {}

        if (paymentRecorded) {
          try {
            await supabaseFetch(
              `/rest/v1/image_promotions?id=eq.${gen.id}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ wishme_payment_id: wishmePaymentId }),
              },
              session.access_token,
            );
          } catch {}
        }

        setCurrentGeneration({ ...gen, wishme_payment_id: paymentRecorded ? wishmePaymentId : undefined });
        wallet.refetch();
        void fetchHistory();
        confirmOrder({
          item: `an image promotion${celebrities.find(x => x.id === selectedCelebId)?.name ? ` with ${celebrities.find(x => x.id === selectedCelebId)?.name}` : ''}`,
          orderId: gen.id,
        });
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    }

    setGenerating(false);
  }, [selectedCelebId, concept, branding, refImgBase64, wallet, finalPrice, session, user, fetchHistory, getValidSession, findFinishedGeneration]);

  const downloadPromo = useCallback(async (imgUrl: string, promoId: string) => {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = imgUrl;
      a.download = `promo_${promoId}.jpg`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to save photos is required.');
        return;
      }

      const isBase64 = imgUrl.startsWith('data:');
      const fileUri = (FileSystem.cacheDirectory ?? '') + `promo_${promoId}.jpg`;

      if (isBase64) {
        const base64Data = imgUrl.split(',')[1] ?? imgUrl;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.downloadAsync(imgUrl, fileUri);
      }

      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('Saved!', 'Image saved to your gallery.');
    } catch {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    }
  }, []);

  const sharePromo = useCallback(async (imgUrl: string, promoId: string) => {
    try {
      const isBase64 = imgUrl.startsWith('data:');
      const fileUri = (FileSystem.cacheDirectory ?? '') + `promo_share_${promoId}.jpg`;

      if (isBase64) {
        const base64Data = imgUrl.split(',')[1] ?? imgUrl;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Share.share({ url: fileUri });
      } else {
        await FileSystem.downloadAsync(imgUrl, fileUri);
        await Share.share({ url: fileUri });
      }
    } catch {
      await Share.share({ message: 'Check out my AI promotion image generated with WishMe!' });
    }
  }, []);

  const statusColor = (st: string) =>
    st === 'completed' ? '#22c55e' : st === 'pending' ? '#7B5CFA' : '#ef4444';

  const statusLabel = (st: string) =>
    st.charAt(0).toUpperCase() + st.slice(1);

  const celebName = (celebrityId: string) => {
    const c = celebrities.find(x => x.id === celebrityId);
    return c ? c.name : 'Celebrity';
  };

  if (!isLoggedIn) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }]}>
        <Icon name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[s.gateTitle, { color: colors.foreground }]}>Sign in to create promotions</Text>
        <TouchableOpacity style={s.gateBtn} onPress={() => router.push('/(auth)' as never)}>
          <Text style={s.gateBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Image Promotions</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="credit-card" size={18} color="#3B5BDB" />
            <Text style={[s.statValue, { color: colors.foreground }]}>₹{wallet.balance.toLocaleString('en-IN')}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Wallet</Text>
            <TouchableOpacity style={s.addFundsBtn} onPress={() => router.push('/wallet' as never)}>
              <Text style={s.addFundsText}>Add Funds</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="calendar" size={18} color="#7B5CFA" />
            <Text style={[s.statValue, { color: colors.foreground }]}>{todayCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Today's</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="check-circle" size={18} color="#22c55e" />
            <Text style={[s.statValue, { color: colors.foreground }]}>{completedCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Completed</Text>
          </View>
        </View>

        {/* Free Period Banner */}
        <View style={[s.freeBanner, { backgroundColor: '#22c55e15', borderColor: '#22c55e40' }]}>
          <Icon name="zap" size={16} color="#22c55e" />
          <Text style={[s.freeBannerText, { color: '#22c55e' }]}>
            🎉 Free Period Active! Generate promotional images at no cost during our launch.
          </Text>
        </View>

        {/* Tab Bar */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'history'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#7B5CFA' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create Promotion' : 'My Promotions'}
              </Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {/* Subscription Gate */}
            {noSubscriptions && (
              <View style={[s.alertBanner, { backgroundColor: '#7B5CFA15', borderColor: '#7B5CFA40' }]}>
                <Icon name="lock" size={18} color="#7B5CFA" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: '#7B5CFA' }]}>No Celebrity Subscriptions</Text>
                  <Text style={[s.alertSub, { color: colors.mutedForeground }]}>
                    You need to subscribe to at least one celebrity to create promotions
                  </Text>
                  <TouchableOpacity
                    style={s.subGateBtn}
                    onPress={() => router.push('/favorites' as never)}
                  >
                    <Text style={s.subGateBtnText}>Browse & Subscribe</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Celebrity Select */}
            <Text style={[s.label, { color: colors.foreground }]}>Select Celebrity</Text>
            {celebsLoading ? (
              <ActivityIndicator color="#7B5CFA" style={{ marginVertical: 8 }} />
            ) : noSubscriptions ? (
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
                Subscribe to a celebrity to create promotions.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.celebChips}>
                {celebrities.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      s.celebChip,
                      {
                        backgroundColor: selectedCelebId === c.id ? '#7B5CFA' : colors.muted,
                        borderColor: selectedCelebId === c.id ? '#7B5CFA' : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedCelebId(selectedCelebId === c.id ? '' : c.id)}
                  >
                    <Text style={[s.celebChipText, { color: selectedCelebId === c.id ? '#fff' : colors.foreground }]}>
                      {c.name}
                    </Text>
                    {selectedCelebId === c.id && <Icon name="check" size={13} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Concept */}
            <Text style={[s.label, { color: colors.foreground }]}>Concept / Idea <Text style={{ color: '#ef4444' }}>*</Text></Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Describe the promotion concept, product, or campaign idea..."
              placeholderTextColor={colors.mutedForeground}
              value={concept}
              onChangeText={t => setConcept(t.slice(0, 500))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[s.charCounter, { color: colors.mutedForeground }]}>{concept.length} / 500</Text>

            {/* Branding */}
            <Text style={[s.label, { color: colors.foreground }]}>Branding Details <Text style={[s.optionalTag, { color: colors.mutedForeground }]}>(optional)</Text></Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular', minHeight: 70 }]}
              placeholder="Brand name, colours, logo description, tagline, style guidelines..."
              placeholderTextColor={colors.mutedForeground}
              value={branding}
              onChangeText={t => setBranding(t.slice(0, 300))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={[s.charCounter, { color: colors.mutedForeground }]}>{branding.length} / 300</Text>

            {/* Reference Image */}
            <Text style={[s.label, { color: colors.foreground }]}>Reference Image</Text>
            <View style={[s.refImgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(['none', 'upload'] as RefImgSource[]).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.radioRow}
                  onPress={() => {
                    setRefImgSource(opt);
                    if (opt === 'none') { clearRefImage(); }
                  }}
                >
                  <View style={[s.radioOuter, { borderColor: refImgSource === opt ? '#7B5CFA' : colors.border }]}>
                    {refImgSource === opt && <View style={s.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.radioText, { color: colors.foreground }]}>
                      {opt === 'none' ? 'AI Only' : 'Upload Image'}
                    </Text>
                    {opt === 'none' && (
                      <Text style={[s.radioSub, { color: colors.mutedForeground }]}>
                        Fully AI-generated, no reference needed
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              {refImgSource === 'upload' && (
                refImgUri ? (
                  <View style={s.uploadedPreview}>
                    <Image source={{ uri: refImgUri }} style={s.uploadedThumb} contentFit="cover" />
                    <TouchableOpacity style={s.removeImgBtn} onPress={clearRefImage}>
                      <Icon name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.uploadZone, { borderColor: '#7B5CFA', backgroundColor: '#7B5CFA10' }]}
                    onPress={pickImage}
                  >
                    <Icon name="upload" size={18} color="#7B5CFA" />
                    <Text style={[s.uploadZoneText, { color: '#7B5CFA' }]}>Choose Image</Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* Pricing Card */}
            <View style={[s.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pricingTitle, { color: colors.foreground }]}>Pricing</Text>
              <View style={s.pricingRow}>
                <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Base Price</Text>
                <Text style={[s.pricingBase, { color: colors.mutedForeground }]}>₹{basePrice}</Text>
              </View>
              {discountPct > 0 && (
                <View style={s.pricingRow}>
                  <View style={s.discountBadge}><Text style={s.discountText}>{discountPct}% OFF</Text></View>
                  <Text style={[s.pricingDiscount, { color: '#22c55e' }]}>−{discountPct}%</Text>
                </View>
              )}
              <View style={[s.pricingDivider, { backgroundColor: colors.border }]} />
              <View style={s.pricingRow}>
                <Text style={[s.pricingFinalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={s.pricingFinal}>₹{finalPrice}</Text>
              </View>
              <Text style={[s.pricingNote, { color: colors.mutedForeground }]}>Charged from wallet balance</Text>
            </View>

            {/* Generated Preview */}
            {currentGeneration && currentGeneration.generated_image_url && (
              <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image
                  source={{ uri: currentGeneration.generated_image_url }}
                  style={s.previewImg}
                  contentFit="cover"
                />
                {concept.trim() ? (
                  <View style={[s.previewConceptBox, { backgroundColor: colors.muted }]}>
                    <Text style={[s.previewConceptText, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {currentGeneration.concept}
                    </Text>
                  </View>
                ) : null}
                <View style={s.previewActions}>
                  <TouchableOpacity
                    style={[s.previewBtn, { backgroundColor: colors.muted }]}
                    onPress={() => downloadPromo(currentGeneration.generated_image_url!, currentGeneration.id)}
                  >
                    <Icon name="download" size={15} color={colors.foreground} />
                    <Text style={[s.previewBtnText, { color: colors.foreground }]}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.previewBtn, { backgroundColor: colors.muted }]}
                    onPress={() => sharePromo(currentGeneration.generated_image_url!, currentGeneration.id)}
                  >
                    <Icon name="share-2" size={15} color={colors.foreground} />
                    <Text style={[s.previewBtnText, { color: colors.foreground }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Generate Button */}
            <TouchableOpacity
              onPress={generate}
              disabled={generating || !selectedCelebId || !concept.trim() || wallet.balance < finalPrice}
              activeOpacity={0.85}
              style={{ opacity: generating || !selectedCelebId || !concept.trim() || wallet.balance < finalPrice ? 0.55 : 1, marginTop: 20 }}
            >
              <LinearGradient
                colors={['#7B5CFA', '#1F7BFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.genBtn}
              >
                {generating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="image" size={18} color="#fff" />
                )}
                <Text style={s.genBtnText}>
                  {generating ? 'Generating...' : `Generate Promotion · ₹${finalPrice}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            {generating && (
              <Text style={[s.generatingHint, { color: colors.mutedForeground }]}>
                Generating... (10–30 seconds)
              </Text>
            )}
          </View>
        ) : (
          <View style={s.historyWrap}>
            <Text style={[s.histCount, { color: colors.mutedForeground }]}>
              {history.length} promotion{history.length !== 1 ? 's' : ''} created
            </Text>
            {historyLoading ? (
              <ActivityIndicator color="#7B5CFA" style={{ marginTop: 32 }} />
            ) : history.length === 0 ? (
              <View style={[s.emptyState, { borderColor: colors.border }]}>
                <Icon name="image" size={36} color={colors.mutedForeground} />
                <Text style={[s.emptyStateText, { color: colors.mutedForeground }]}>No promotions yet</Text>
                <Text style={[s.emptyStateSub, { color: colors.mutedForeground }]}>Create your first AI promotion image</Text>
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <View style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {item.generated_image_url ? (
                      <Image
                        source={{ uri: item.generated_image_url }}
                        style={s.histThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient colors={['#7B5CFA', '#1F7BFF']} style={s.histThumb}>
                        <Icon name="zap" size={22} color="rgba(255,255,255,0.8)" />
                      </LinearGradient>
                    )}
                    <View style={s.histInfo}>
                      <View style={s.histBadgeRow}>
                        <View style={[s.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                          <Text style={[s.badgeText, { color: statusColor(item.status) }]}>
                            {statusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.histCeleb, { color: colors.foreground }]}>
                        feat. {celebName(item.celebrity_id)}
                      </Text>
                      <Text style={[s.histConcept, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {item.concept}
                      </Text>
                      <View style={s.histFooter}>
                        <Text style={[s.histDate, { color: colors.mutedForeground }]}>
                          {formatDate(item.created_at)}
                        </Text>
                        {item.status === 'completed' && item.generated_image_url && (
                          <TouchableOpacity
                            style={s.dlBtn}
                            onPress={() => downloadPromo(item.generated_image_url!, item.id)}
                          >
                            <Icon name="download" size={13} color="#7B5CFA" />
                            <Text style={s.dlText}>Download</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gateTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  gateBtn: { backgroundColor: '#7B5CFA', borderRadius: 9999, paddingHorizontal: 32, paddingVertical: 14 },
  gateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  addFundsBtn: { marginTop: 6, backgroundColor: '#3B5BDB15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  addFundsText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#3B5BDB' },
  freeBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, marginHorizontal: 16, marginBottom: 4, padding: 12 },
  freeBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  tabPill: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#7B5CFA', borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  alertTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  alertSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  subGateBtn: { marginTop: 10, backgroundColor: '#7B5CFA', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  subGateBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  optionalTag: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  celebChips: { gap: 8, paddingBottom: 4 },
  celebChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 9 },
  celebChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 80 },
  charCounter: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 4 },
  refImgCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7B5CFA' },
  radioText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  radioSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  uploadZone: { borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadZoneText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedPreview: { position: 'relative', alignSelf: 'flex-start' },
  uploadedThumb: { width: 100, height: 100, borderRadius: 10 },
  removeImgBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#7B5CFA', borderRadius: 9999, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 4 },
  pricingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingBase: { fontSize: 13, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#22c55e20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#22c55e' },
  pricingDiscount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pricingDivider: { height: 1 },
  pricingFinalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pricingFinal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#7B5CFA' },
  pricingNote: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 16 },
  previewImg: { width: '100%', height: 260 },
  previewConceptBox: { padding: 12 },
  previewConceptText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  previewActions: { flexDirection: 'row', gap: 10, padding: 12 },
  previewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 10 },
  previewBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  generatingHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  historyWrap: { padding: 20 },
  histCount: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  emptyState: { alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 40, gap: 10, marginTop: 20 },
  emptyStateText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyStateSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  histCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  histThumb: { width: 90, alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1, padding: 12, gap: 5 },
  histBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  histCeleb: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histConcept: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#7B5CFA' },
});
