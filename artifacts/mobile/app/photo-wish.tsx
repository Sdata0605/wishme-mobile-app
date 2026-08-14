import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/hooks/useWallet';
import { usePlan } from '@/hooks/usePlan';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Baby Shower',
  'Retirement', 'Diwali', 'Holi', 'Eid', 'Christmas',
  'New Year', 'Valentine\'s Day', 'Mother\'s Day', 'Father\'s Day', 'Get Well Soon',
];

const TEXT_STYLES = [
  { id: 'elegant', label: 'Elegant', desc: 'Serif fonts with a refined, classic look' },
  { id: 'playful', label: 'Playful', desc: 'Fun, rounded letters with vibrant colours' },
  { id: 'modern', label: 'Modern', desc: 'Clean, minimal sans-serif typography' },
  { id: 'classic', label: 'Classic', desc: 'Timeless design with traditional elements' },
  { id: 'festive', label: 'Festive', desc: 'Bold, celebratory with decorative accents' },
];

const GRAD_COLORS: [string, string][] = [
  ['#FF6B33', '#E8527A'],
  ['#E8527A', '#B44CFF'],
  ['#4B83FF', '#7B2FFF'],
  ['#22C55E', '#4B83FF'],
];

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.LONG);
  } else {
    Alert.alert('', msg);
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso.split('T')[0];
  }
}

interface PhotoWishRecord {
  id: string;
  occasion: string;
  recipient_name: string;
  wish_message?: string;
  sender_name?: string;
  text_style?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  edited_image_url: string | null;
  amount_charged?: number;
  wishme_payment_id?: string;
}

function isValidUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

function statusColor(s: string) {
  if (s === 'completed') return '#22c55e';
  if (s === 'processing') return '#f59e0b';
  if (s === 'failed') return '#ef4444';
  return '#6b7280';
}

function statusLabel(s: string) {
  if (s === 'completed') return 'Completed';
  if (s === 'processing') return 'Processing';
  if (s === 'failed') return 'Failed';
  return s;
}

export default function PhotoWishScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, getValidSession } = useAuth();
  const wallet = useWallet();
  const { discountPercentage, getDiscountedPrice } = usePlan();

  const [tab, setTab] = useState<'create' | 'history'>('create');

  const [occasion, setOccasion] = useState('Birthday');
  const [showOccasions, setShowOccasions] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [textStyle, setTextStyle] = useState('elegant');

  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [pickedImageBase64, setPickedImageBase64] = useState<string | null>(null);
  const [pickedImageName, setPickedImageName] = useState<string>('photo.jpg');

  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [basePrice, setBasePrice] = useState<number>(99);
  const [priceLoading, setPriceLoading] = useState(true);

  const [history, setHistory] = useState<PhotoWishRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const discountPct = discountPercentage;
  const finalPrice = getDiscountedPrice(basePrice);
  const discountAmt = basePrice - finalPrice;

  const todayCount = history.filter(h => {
    const d = new Date(h.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const completedCount = history.filter(h => h.status === 'completed').length;

  useEffect(() => {
    wallet.refetch();
    fetchPrice();
  }, []);

  useEffect(() => {
    if (wallet.profileId) {
      fetchHistory();
    }
  }, [wallet.profileId]);

  useEffect(() => {
    if (tab === 'history' && wallet.profileId) {
      fetchHistory();
    }
  }, [tab]);

  const fetchPrice = useCallback(async () => {
    setPriceLoading(true);
    try {
      const validSession = await getValidSession();
      const res = await supabaseFetch(
        '/rest/v1/platform_settings?select=setting_value&setting_key=eq.photo_wish_price&limit=1',
        {},
        validSession?.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ setting_value: string }>;
        if (rows?.length) {
          const v = parseFloat(rows[0].setting_value);
          if (!isNaN(v)) setBasePrice(v);
        }
      }
    } catch {}
    setPriceLoading(false);
  }, [getValidSession]);

  const fetchHistory = useCallback(async () => {
    if (!wallet.profileId) return;
    setHistoryLoading(true);
    try {
      const validSession = await getValidSession();
      if (!validSession?.access_token) return;
      const res = await supabaseFetch(
        `/rest/v1/photo_wishes?user_id=eq.${wallet.profileId}&order=created_at.desc&limit=20&select=*`,
        {},
        validSession.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as PhotoWishRecord[];
        setHistory(rows ?? []);
      }
    } catch {}
    finally {
      setHistoryLoading(false);
    }
  }, [getValidSession, wallet.profileId]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setPickedImageUri(manipResult.uri);
      setPickedImageBase64('data:image/jpeg;base64,' + manipResult.base64);
      const filename = asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg';
      setPickedImageName(filename);
    } catch {
      setPickedImageUri(asset.uri);
      setPickedImageBase64(null);
      const filename = asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg';
      setPickedImageName(filename);
    }
  }, []);

  const clearImage = useCallback(() => {
    setPickedImageUri(null);
    setPickedImageBase64(null);
    setPickedImageName('photo.jpg');
  }, []);

  const generate = useCallback(async () => {
    if (!pickedImageBase64) {
      showToast('Please select a photo first.');
      return;
    }
    if (!occasion) {
      showToast('Please select an occasion.');
      return;
    }
    if (!recipient.trim()) {
      showToast('Please enter the recipient name.');
      return;
    }
    if (!message.trim()) {
      showToast('Please enter a wish message.');
      return;
    }
    if (wallet.balance < finalPrice) {
      showToast('Insufficient wallet balance. Please top up your wallet.');
      return;
    }

    const validSession = await getValidSession();
    if (!validSession?.access_token) {
      showToast('Please log in to continue.');
      return;
    }

    setGenerating(true);
    setGeneratedUrl(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-photo-wish`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${validSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalImageBase64: pickedImageBase64,
          occasion,
          recipientName: recipient.trim(),
          wishMessage: message.trim(),
          senderName: sender.trim() || null,
          textStyle,
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const errData = await res.json() as Record<string, unknown>;
          errMsg = (errData.error as string) || (errData.message as string) || errMsg;
        } catch {}
        showToast(errMsg);
        setGenerating(false);
        return;
      }

      const data = await res.json() as {
        success?: boolean;
        photoWishId?: string;
        editedImageUrl?: string;
        amountCharged?: number;
        error?: string;
      };

      if (data.error) {
        showToast(data.error);
        setGenerating(false);
        return;
      }

      if (data.editedImageUrl) {
        setGeneratedUrl(data.editedImageUrl);
        wallet.refetch();

        const paymentId = `WM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        if (user?.profileId && data.photoWishId) {
          try {
            const txRes = await supabaseFetch('/rest/v1/payment_transactions', {
              method: 'POST',
              body: JSON.stringify({
                wishme_payment_id: paymentId,
                user_id: user.profileId,
                amount: data.amountCharged ?? finalPrice,
                payment_method: 'wallet',
                service_type: 'photo_wish',
                photo_wish_id: data.photoWishId,
                description: `Photo Wish - ${occasion} for ${recipient.trim()}`,
                status: 'completed',
                paid_at: new Date().toISOString(),
              }),
            }, validSession.access_token);

            if (txRes.ok) {
              await supabaseFetch(
                `/rest/v1/photo_wishes?id=eq.${data.photoWishId}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({ wishme_payment_id: paymentId }),
                },
                validSession.access_token,
              );
            } else {
              console.warn('[PhotoWish] payment_transactions insert failed:', txRes.status);
            }
          } catch (payErr) {
            console.warn('[PhotoWish] payment recording error:', payErr);
          }
        }

        fetchHistory();
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = (err as Error)?.name === 'AbortError'
        ? 'Generation timed out. Please try again.'
        : 'Network error. Please check your connection.';
      showToast(msg);
    }

    setGenerating(false);
  }, [pickedImageBase64, occasion, recipient, message, sender, textStyle, wallet, finalPrice, getValidSession, user, fetchHistory]);

  const downloadImage = useCallback(async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission to save photos is required.');
        return;
      }

      const fileUri = FileSystem.cacheDirectory + `photo_wish_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast('Photo wish saved to your gallery!');
    } catch {
      showToast('Failed to download image.');
    }
  }, []);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 14, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Photo Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          {[
            { label: 'Wallet Balance', value: `₹${wallet.balance.toLocaleString('en-IN')}`, icon: 'credit-card' as const, color: '#4B83FF' },
            { label: "Today's", value: String(todayCount), icon: 'zap' as const, color: '#FF6B33' },
            { label: 'Total Created', value: String(completedCount), icon: 'image' as const, color: '#B44CFF' },
          ].map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: st.color + '20' }]}>
                <Icon name={st.icon} size={16} color={st.color} />
              </View>
              <Text style={[s.statValue, { color: colors.foreground }]}>{st.value}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'history'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#FF6B33' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create' : 'History'}
              </Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {pickedImageUri ? (
              <View style={[s.uploadedPreview, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}>
                <Image source={{ uri: pickedImageUri }} style={s.uploadedThumb} resizeMode="cover" />
                <Text style={[s.uploadedText, { color: colors.foreground }]} numberOfLines={1}>{pickedImageName}</Text>
                <TouchableOpacity onPress={clearImage}>
                  <Icon name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.uploadZone, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={pickImage} activeOpacity={0.8}>
                <Icon name="upload" size={32} color="#FF6B33" />
                <Text style={[s.uploadTitle, { color: colors.foreground }]}>Upload Your Photo</Text>
                <Text style={[s.uploadSub, { color: colors.mutedForeground }]}>Tap to choose from gallery</Text>
                <View style={[s.uploadBtn, { backgroundColor: '#FF6B33' }]}>
                  <Icon name="camera" size={15} color="#fff" />
                  <Text style={s.uploadBtnText}>Choose Photo</Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={[s.label, { color: colors.foreground }]}>Occasion</Text>
            <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowOccasions(o => !o)}>
              <Text style={[s.dropdownText, { color: colors.foreground }]}>{occasion}</Text>
              <Icon name={showOccasions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showOccasions && (
              <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {OCCASIONS.map(o => (
                    <TouchableOpacity key={o} style={[s.dropdownItem, o === occasion && { backgroundColor: '#FF6B3315' }]} onPress={() => { setOccasion(o); setShowOccasions(false); }}>
                      <Text style={[s.dropdownItemText, { color: o === occasion ? '#FF6B33' : colors.foreground }]}>{o}</Text>
                      {o === occasion && <Icon name="check" size={14} color="#FF6B33" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={[s.label, { color: colors.foreground }]}>Recipient Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Who is this for?" placeholderTextColor={colors.mutedForeground} value={recipient} onChangeText={setRecipient} />

            <Text style={[s.label, { color: colors.foreground }]}>Sender Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Your name" placeholderTextColor={colors.mutedForeground} value={sender} onChangeText={setSender} />

            <Text style={[s.label, { color: colors.foreground }]}>Wish Message</Text>
            <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Write a heartfelt message..." placeholderTextColor={colors.mutedForeground} value={message} onChangeText={setMessage} multiline numberOfLines={4} />

            <Text style={[s.label, { color: colors.foreground }]}>Text Style</Text>
            <View style={s.styleGrid}>
              {TEXT_STYLES.map(ts => (
                <TouchableOpacity key={ts.id} style={[s.styleCard, { backgroundColor: colors.card, borderColor: textStyle === ts.id ? '#FF6B33' : colors.border, borderWidth: textStyle === ts.id ? 2 : 1 }]} onPress={() => setTextStyle(ts.id)}>
                  <Text style={[s.styleLabel, { color: textStyle === ts.id ? '#FF6B33' : colors.foreground }]}>{ts.label}</Text>
                  <Text style={[s.styleDesc, { color: colors.mutedForeground }]}>{ts.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[s.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pricingTitle, { color: colors.foreground }]}>Pricing</Text>
              {priceLoading ? (
                <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Loading price...</Text>
              ) : (
                <>
                  <View style={s.pricingRow}>
                    <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Base Price</Text>
                    <Text style={[s.pricingBase, { color: colors.mutedForeground }]}>₹{basePrice}</Text>
                  </View>
                  {discountPct > 0 && (
                    <View style={s.pricingRow}>
                      <View style={s.discountBadge}><Text style={s.discountText}>{discountPct}% OFF</Text></View>
                      <Text style={[s.pricingDiscount, { color: '#22c55e' }]}>−₹{discountAmt}</Text>
                    </View>
                  )}
                  <View style={[s.pricingDivider, { backgroundColor: colors.border }]} />
                  <View style={s.pricingRow}>
                    <Text style={[s.pricingFinalLabel, { color: colors.foreground }]}>Total</Text>
                    <Text style={s.pricingFinal}>₹{finalPrice}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Preview Card — always visible */}
            <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.previewTitle, { color: colors.foreground }]}>Preview</Text>
              {generating ? (
                <View style={s.previewEmpty}>
                  <ActivityIndicator size="large" color="#FF6B33" />
                  <Text style={[s.previewEmptyText, { color: colors.mutedForeground }]}>
                    Generating your photo wish...
                  </Text>
                  <Text style={[s.previewEmptySub, { color: colors.mutedForeground }]}>
                    This may take up to 60 seconds
                  </Text>
                </View>
              ) : generatedUrl ? (
                <>
                  <Image
                    source={{ uri: generatedUrl }}
                    style={s.previewImg}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={[s.previewBtn, { backgroundColor: '#FF6B3320' }]}
                    onPress={() => downloadImage(generatedUrl)}
                  >
                    <Icon name="download" size={15} color="#FF6B33" />
                    <Text style={[s.previewBtnText, { color: '#FF6B33' }]}>Download Photo Wish</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.previewEmpty}>
                  <Icon name="image" size={40} color={colors.mutedForeground} />
                  <Text style={[s.previewEmptyText, { color: colors.mutedForeground }]}>
                    Your generated photo wish will appear here
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={generate} disabled={generating} activeOpacity={0.85} style={{ opacity: generating ? 0.7 : 1 }}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
                <Icon name="image" size={18} color="#fff" />
                <Text style={s.genBtnText}>{generating ? 'Generating...' : `Generate Photo Wish  ₹${finalPrice}`}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.historyWrap}>
            {historyLoading ? (
              <Text style={[s.histCount, { color: colors.mutedForeground }]}>Loading history...</Text>
            ) : (
              <>
                <Text style={[s.histCount, { color: colors.mutedForeground }]}>{history.length} photo {history.length === 1 ? 'wish' : 'wishes'} created</Text>
                {history.length === 0 ? (
                  <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Icon name="image" size={32} color={colors.mutedForeground} />
                    <Text style={[s.emptyTitle, { color: colors.foreground }]}>No photo wishes yet</Text>
                    <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Create your first photo wish to see it here</Text>
                  </View>
                ) : (
                  <View style={s.histGrid}>
                    {history.map((item, idx) => (
                      <View key={item.id} style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {isValidUrl(item.edited_image_url) ? (
                          <Image source={{ uri: item.edited_image_url! }} style={s.histCardImg} resizeMode="cover" />
                        ) : (
                          <LinearGradient colors={GRAD_COLORS[idx % GRAD_COLORS.length]} style={s.histCardPlaceholder}>
                            {item.edited_image_url === 'processing' ? (
                              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                            ) : (
                              <Icon name="image" size={40} color="rgba(255,255,255,0.8)" />
                            )}
                          </LinearGradient>
                        )}
                        <View style={s.histInfo}>
                          <View style={s.histBadgeRow}>
                            <View style={[s.badge, { backgroundColor: '#FF6B3320' }]}>
                              <Text style={[s.badgeText, { color: '#FF6B33' }]}>{item.occasion}</Text>
                            </View>
                            <View style={[s.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                              <Text style={[s.badgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                            </View>
                          </View>
                          <Text style={[s.histRecipient, { color: colors.foreground }]}>{item.recipient_name}</Text>
                          <View style={s.histFooter}>
                            <Text style={[s.histDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                            {isValidUrl(item.edited_image_url) && (
                              <TouchableOpacity style={s.dlBtn} onPress={() => downloadImage(item.edited_image_url!)}>
                                <Icon name="download" size={13} color="#FF6B33" />
                                <Text style={s.dlText}>Download</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20, marginTop: 16 },
  tabPill: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6B33', borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  uploadZone: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, padding: 32, alignItems: 'center', gap: 10, marginBottom: 8 },
  uploadTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  uploadSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9999, marginTop: 4 },
  uploadBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  uploadedThumb: { width: 52, height: 52, borderRadius: 8 },
  uploadedText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  styleGrid: { gap: 8 },
  styleCard: { borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  styleLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', width: 70 },
  styleDesc: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 16 },
  pricingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingBase: { fontSize: 13, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#22c55e20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#22c55e' },
  pricingDiscount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pricingDivider: { height: 1 },
  pricingFinalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pricingFinal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FF6B33' },
  previewCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  previewTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
  previewEmptyText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  previewEmptySub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  previewImg: { width: '100%', aspectRatio: 1, borderRadius: 10, marginVertical: 8 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, marginTop: 4 },
  previewBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  historyWrap: { padding: 20 },
  histCount: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  histGrid: { gap: 12 },
  histCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  histCardImg: { width: '100%', aspectRatio: 1, backgroundColor: '#111' },
  histCardPlaceholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  histInfo: { padding: 12, gap: 6 },
  histBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  histRecipient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF6B33' },
  emptyState: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
