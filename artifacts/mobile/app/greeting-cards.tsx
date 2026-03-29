import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/hooks/useWallet';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Graduation', 'New Year', 'Christmas',
  "Valentine's Day", "Mother's Day", "Father's Day", 'Thank You', 'Congratulations', 'Get Well Soon',
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

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

interface Generation {
  id: string;
  user_id: string;
  original_prompt: string | null;
  refined_prompt: string | null;
  occasion_name: string;
  recipient_name: string | null;
  generated_image_url: string | null;
  greeting_text: string | null;
  reference_image_url: string | null;
  reference_image_source: string | null;
  prompt_refinement_used: boolean;
  saved_to_library: boolean;
  amount_charged: number | null;
  status: 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

type RefImgTab = 'upload' | 'library' | 'none';

export default function GreetingCardsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const wallet = useWallet();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [tab, setTab] = useState<'create' | 'cards'>('create');

  const [basePrice, setBasePrice] = useState<number>(199);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const finalPrice = Math.round(basePrice * (1 - discountPct / 100));

  const [history, setHistory] = useState<Generation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [occasion, setOccasion] = useState('Birthday');
  const [showOccasions, setShowOccasions] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [prompt, setPrompt] = useState('');
  const [refineAI, setRefineAI] = useState(false);

  const [refImgTab, setRefImgTab] = useState<RefImgTab>('none');
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<Generation | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const savedCards = history.filter(h => h.saved_to_library);
  const todayCards = history.filter(h => h.created_at.startsWith(todayIso()));

  const fetchPricing = useCallback(async () => {
    try {
      const [settingsRes, profileRes] = await Promise.all([
        supabaseFetch('/rest/v1/platform_settings?setting_key=eq.greeting_card_price&select=setting_value', {}, session?.access_token),
        user?.id
          ? supabaseFetch(`/rest/v1/profiles?select=plan_name&user_id=eq.${user.id}&limit=1`, {}, session?.access_token)
          : Promise.resolve(null),
      ]);

      if (settingsRes.ok) {
        const rows = await settingsRes.json() as Array<{ setting_value: string }>;
        if (rows?.length) {
          const v = parseFloat(rows[0].setting_value);
          if (!isNaN(v)) setBasePrice(v);
        }
      }

      if (profileRes && profileRes.ok) {
        const profRows = await profileRes.json() as Array<{ plan_name?: string }>;
        const planName = profRows?.[0]?.plan_name;
        if (planName) {
          const plansRes = await supabaseFetch(
            `/rest/v1/plans?name=eq.${encodeURIComponent(planName)}&select=service_discount_percentage`,
            {},
            session?.access_token,
          );
          if (plansRes.ok) {
            const planRows = await plansRes.json() as Array<{ service_discount_percentage?: number }>;
            if (planRows?.length && planRows[0].service_discount_percentage != null) {
              setDiscountPct(planRows[0].service_discount_percentage);
            }
          }
        }
      }
    } catch {}
  }, [session, user]);

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token || !wallet.profileId) return;
    setHistoryLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/greeting_card_generations?user_id=eq.${wallet.profileId}&order=created_at.desc&limit=30`,
        {},
        session.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Generation[];
        setHistory(rows ?? []);
      }
    } catch {}
    setHistoryLoading(false);
  }, [session, wallet.profileId]);

  useEffect(() => {
    fetchPricing();
    wallet.refetch();
  }, [fetchPricing]);

  useEffect(() => {
    if (wallet.profileId) {
      fetchHistory();
    }
  }, [wallet.profileId, fetchHistory]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = useCallback((generationId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    pollingRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await supabaseFetch(
          `/rest/v1/greeting_card_generations?id=eq.${generationId}&select=status,generated_image_url,greeting_text,refined_prompt&limit=1`,
          {},
          session?.access_token,
        );
        if (res.ok) {
          const rows = await res.json() as Array<Pick<Generation, 'status' | 'generated_image_url' | 'greeting_text' | 'refined_prompt'>>;
          if (rows?.length) {
            const row = rows[0];
            if (row.status === 'completed' && row.generated_image_url) {
              clearInterval(pollingRef.current!);
              pollingRef.current = null;
              setCurrentGeneration(prev => prev ? { ...prev, ...row } : prev);
              showToast('Card generated successfully!');
              wallet.refetch();
              fetchHistory();
              return;
            }
            if (row.status === 'failed') {
              clearInterval(pollingRef.current!);
              pollingRef.current = null;
              setCurrentGeneration(prev => prev ? { ...prev, status: 'failed' } : prev);
              return;
            }
          }
        }
      } catch {}
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setCurrentGeneration(prev => prev ? { ...prev, status: 'failed', error_message: 'Generation timed out. Please try again.' } : prev);
      }
    }, 3000);
  }, [session, wallet, fetchHistory]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      if (asset.base64) {
        setReferenceImageBase64(asset.base64);
        setSelectedLibraryId(null);
      }
    }
  };

  const handleGenerate = async () => {
    if (!sender.trim()) { showToast('Please enter your name.'); return; }
    if (!prompt.trim()) { showToast('Please describe the card.'); return; }
    if (!session?.access_token) { showToast('Please log in to continue.'); return; }
    if (wallet.balance < finalPrice) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance ₹${wallet.balance} is less than the required ₹${finalPrice}. Please add funds.`,
        [
          { text: 'Add Funds', onPress: () => router.push('/wallet') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    setGenerating(true);
    setCurrentGeneration(null);

    let refImageUrl: string | undefined;
    if (refImgTab === 'upload' && referenceImageBase64) {
      refImageUrl = `data:image/jpeg;base64,${referenceImageBase64}`;
    } else if (refImgTab === 'library' && selectedLibraryId) {
      const sel = history.find(h => h.id === selectedLibraryId);
      if (sel?.generated_image_url) {
        refImageUrl = sel.generated_image_url;
      }
    }

    const payload: Record<string, unknown> = {
      prompt,
      occasionName: occasion,
      recipientName: recipient || undefined,
      senderName: sender,
      refinePrompt: refineAI,
      referenceImageSource: refImgTab === 'upload' ? 'upload' : refImgTab === 'library' ? 'library' : 'none',
    };
    if (refImageUrl) payload.referenceImageUrl = refImageUrl;

    try {
      const res = await supabaseFetch(
        '/functions/v1/generate-greeting-card-ai',
        { method: 'POST', body: JSON.stringify(payload) },
        session.access_token,
      );

      if (!res.ok) {
        let errMsg = 'Generation failed. Please try again.';
        try {
          const body = await res.json() as Record<string, unknown>;
          const msg = (body.error ?? body.message ?? '') as string;
          if (res.status === 400 && msg.toLowerCase().includes('insufficient')) {
            errMsg = `Insufficient wallet balance. Your balance: ₹${wallet.balance}, Required: ₹${finalPrice}`;
          } else if (res.status === 429) {
            errMsg = 'Rate limit reached, please try again later.';
          } else if (res.status === 402) {
            errMsg = 'AI credits exhausted, please try again later.';
          } else if (msg) {
            errMsg = `Generation failed: ${msg}`;
          }
        } catch {}
        Alert.alert('Error', errMsg);
        setGenerating(false);
        return;
      }

      const data = await res.json() as { generation?: Generation };
      if (data.generation) {
        setCurrentGeneration(data.generation);
        if (data.generation.status === 'completed' && data.generation.generated_image_url) {
          showToast('Card generated successfully!');
          wallet.refetch();
          fetchHistory();
        } else {
          startPolling(data.generation.id);
        }
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.');
    }

    setGenerating(false);
  };

  const handleToggleSave = async (gen: Generation) => {
    if (!session?.access_token) return;
    const newVal = !gen.saved_to_library;
    try {
      const res = await supabaseFetch(
        `/rest/v1/greeting_card_generations?id=eq.${gen.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ saved_to_library: newVal }),
        },
        session.access_token,
      );
      if (res.ok || res.status === 204) {
        setHistory(prev => prev.map(h => h.id === gen.id ? { ...h, saved_to_library: newVal } : h));
        if (currentGeneration?.id === gen.id) {
          setCurrentGeneration(prev => prev ? { ...prev, saved_to_library: newVal } : prev);
        }
        showToast(newVal ? 'Saved to library!' : 'Removed from library.');
      }
    } catch {}
  };

  const handleDownload = async (imageUrl: string) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Please allow access to save images to your gallery.');
      return;
    }
    try {
      const fileUri = FileSystem.cacheDirectory + `wishme_card_${Date.now()}.png`;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        await MediaLibrary.saveToLibraryAsync(fileUri);
      } else {
        const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      showToast('Card saved to your gallery!');
    } catch {
      showToast('Failed to save card. Please try again.');
    }
  };

  const statusColor = (st: string) => {
    if (st === 'completed') return '#22c55e';
    if (st === 'processing') return '#FF6B33';
    return '#ef4444';
  };

  const renderHistoryItem = ({ item, index }: { item: Generation; index: number }) => (
    <TouchableOpacity
      style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => { setCurrentGeneration(item); setTab('create'); }}
    >
      <View style={s.histThumbWrap}>
        {item.generated_image_url ? (
          <Image
            source={{ uri: item.generated_image_url }}
            style={s.histThumbImg}
            contentFit="cover"
          />
        ) : (
          <LinearGradient colors={GRAD_COLORS[index % GRAD_COLORS.length]} style={s.histThumbGrad}>
            <Icon name="image" size={22} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        )}
      </View>
      <View style={s.histInfo}>
        <View style={s.histBadgeRow}>
          <View style={[s.badge, { backgroundColor: '#E8527A20' }]}>
            <Text style={[s.badgeText, { color: '#E8527A' }]}>{item.occasion_name}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
            <Text style={[s.badgeText, { color: statusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        {item.recipient_name ? (
          <Text style={[s.histRecipient, { color: colors.foreground }]}>{item.recipient_name}</Text>
        ) : null}
        <View style={s.histFooter}>
          <Text style={[s.histDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.status === 'completed' && item.generated_image_url ? (
            <TouchableOpacity
              style={s.dlBtn}
              onPress={() => handleDownload(item.generated_image_url!)}
            >
              <Icon name="download" size={13} color="#E8527A" />
              <Text style={[s.dlText, { color: '#E8527A' }]}>Download</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={s.starBtn}
        onPress={() => handleToggleSave(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon
          name={item.saved_to_library ? 'star' : 'star-outline'}
          size={18}
          color={item.saved_to_library ? '#F59E0B' : colors.mutedForeground}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const libraryCards = savedCards;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Greeting Cards</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity
            style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/wallet')}
          >
            <Icon name="credit-card" size={16} color="#4B83FF" />
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Wallet</Text>
            <Text style={[s.statValue, { color: '#4B83FF' }]}>₹{wallet.balance}</Text>
            <Text style={[s.statSub, { color: '#4B83FF' }]}>Add Funds</Text>
          </TouchableOpacity>

          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="sparkles" size={16} color="#E8527A" />
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Today</Text>
            <Text style={[s.statValue, { color: colors.foreground }]}>{todayCards.length}</Text>
            <Text style={[s.statSub, { color: colors.mutedForeground }]}>Cards</Text>
          </View>

          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="star" size={16} color="#F59E0B" />
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Saved</Text>
            <Text style={[s.statValue, { color: colors.foreground }]}>{savedCards.length}</Text>
            <Text style={[s.statSub, { color: colors.mutedForeground }]}>Library</Text>
          </View>
        </View>

        {/* Discount banner */}
        {discountPct > 0 ? (
          <View style={[s.bannerCard, { backgroundColor: '#22c55e10', borderColor: '#22c55e40' }]}>
            <Icon name="gift" size={16} color="#22c55e" />
            <Text style={[s.bannerText, { color: '#22c55e' }]}>
              You're saving {discountPct}% with your plan
            </Text>
          </View>
        ) : (
          <View style={[s.bannerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="alert-circle" size={16} color={colors.mutedForeground} />
            <Text style={[s.bannerText, { color: colors.mutedForeground }]}>
              Upgrade your plan to get discounts
            </Text>
          </View>
        )}

        {/* Tab bar */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'cards'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#E8527A' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create Card' : 'My Cards'}
              </Text>
              {tab === t && <View style={[s.tabUnderline, { backgroundColor: '#E8527A' }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {/* Reference Image section */}
            <Text style={[s.label, { color: colors.foreground }]}>Reference Image</Text>
            <View style={[s.refTabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(['upload', 'library', 'none'] as RefImgTab[]).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.refTabBtn, refImgTab === opt && { backgroundColor: '#E8527A' }]}
                  onPress={() => {
                    setRefImgTab(opt);
                    if (opt !== 'upload') setReferenceImageBase64(null);
                    if (opt !== 'library') setSelectedLibraryId(null);
                  }}
                >
                  <Text style={[s.refTabText, { color: refImgTab === opt ? '#fff' : colors.mutedForeground }]}>
                    {opt === 'upload' ? 'Upload' : opt === 'library' ? 'Library' : 'AI Only'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {refImgTab === 'upload' && (
              <View style={{ marginTop: 10 }}>
                {referenceImageBase64 ? (
                  <View style={[s.uploadedPreview, { borderColor: '#E8527A40', backgroundColor: '#E8527A08' }]}>
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${referenceImageBase64}` }}
                      style={s.uploadedThumb}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      style={[s.removeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => setReferenceImageBase64(null)}
                    >
                      <Icon name="x" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.uploadZone, { borderColor: '#E8527A', backgroundColor: '#E8527A10' }]}
                    onPress={pickImage}
                  >
                    <Icon name="upload" size={22} color="#E8527A" />
                    <Text style={[s.uploadZoneText, { color: '#E8527A' }]}>Choose Image</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {refImgTab === 'library' && (
              <View style={{ marginTop: 10 }}>
                {libraryCards.length === 0 ? (
                  <View style={[s.emptyLib, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Icon name="star" size={24} color={colors.mutedForeground} />
                    <Text style={[s.emptyLibText, { color: colors.mutedForeground }]}>
                      No saved cards yet. Save a generated card to use as reference.
                    </Text>
                  </View>
                ) : (
                  <View style={s.libGrid}>
                    {libraryCards.map((card) => (
                      <TouchableOpacity
                        key={card.id}
                        style={[
                          s.libThumbWrap,
                          {
                            borderColor: selectedLibraryId === card.id ? '#E8527A' : colors.border,
                            borderWidth: selectedLibraryId === card.id ? 2.5 : 1,
                          },
                        ]}
                        onPress={() => setSelectedLibraryId(selectedLibraryId === card.id ? null : card.id)}
                      >
                        {card.generated_image_url ? (
                          <Image
                            source={{ uri: card.generated_image_url }}
                            style={s.libThumb}
                            contentFit="cover"
                          />
                        ) : (
                          <LinearGradient colors={['#E8527A', '#B44CFF']} style={s.libThumb}>
                            <Icon name="image" size={16} color="rgba(255,255,255,0.8)" />
                          </LinearGradient>
                        )}
                        {selectedLibraryId === card.id && (
                          <View style={s.libSelectedOverlay}>
                            <Icon name="check" size={16} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {refImgTab === 'none' && (
              <View style={[s.aiOnlyNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Icon name="sparkles" size={16} color="#B44CFF" />
                <Text style={[s.aiOnlyText, { color: colors.mutedForeground }]}>
                  Card will be generated purely by AI
                </Text>
              </View>
            )}

            {/* Occasion */}
            <Text style={[s.label, { color: colors.foreground }]}>Occasion</Text>
            <TouchableOpacity
              style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowOccasions(o => !o)}
            >
              <Text style={[s.dropdownText, { color: colors.foreground }]}>{occasion}</Text>
              <Icon name={showOccasions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showOccasions && (
              <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {OCCASIONS.map(o => (
                    <TouchableOpacity
                      key={o}
                      style={[s.dropdownItem, o === occasion && { backgroundColor: '#E8527A15' }]}
                      onPress={() => { setOccasion(o); setShowOccasions(false); }}
                    >
                      <Text style={[s.dropdownItemText, { color: o === occasion ? '#E8527A' : colors.foreground }]}>
                        {o}
                      </Text>
                      {o === occasion && <Icon name="check" size={14} color="#E8527A" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Names */}
            <Text style={[s.label, { color: colors.foreground }]}>Recipient Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Who is this card for?"
              placeholderTextColor={colors.mutedForeground}
              value={recipient}
              onChangeText={setRecipient}
            />

            <Text style={[s.label, { color: colors.foreground }]}>Sender Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              value={sender}
              onChangeText={setSender}
            />

            {/* Prompt */}
            <Text style={[s.label, { color: colors.foreground }]}>
              Prompt / Description{' '}
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
                ({prompt.length}/500)
              </Text>
            </Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Describe the card style, theme, colours, message tone..."
              placeholderTextColor={colors.mutedForeground}
              value={prompt}
              onChangeText={t => setPrompt(t.slice(0, 500))}
              multiline
              numberOfLines={4}
            />

            {/* AI Refine checkbox */}
            <TouchableOpacity style={s.checkRow} onPress={() => setRefineAI(r => !r)}>
              <View style={[s.checkbox, { borderColor: '#E8527A', backgroundColor: refineAI ? '#E8527A' : 'transparent' }]}>
                {refineAI && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View>
                <Text style={[s.checkLabel, { color: colors.foreground }]}>Refine with AI</Text>
                <Text style={[s.checkSub, { color: colors.mutedForeground }]}>
                  AI will enhance your prompt for better results
                </Text>
              </View>
            </TouchableOpacity>

            {/* Pricing card */}
            <View style={[s.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pricingTitle, { color: colors.foreground }]}>Pricing</Text>
              <View style={s.pricingRow}>
                <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Base Price</Text>
                <Text style={[s.pricingBase, { color: colors.mutedForeground }]}>₹{basePrice}</Text>
              </View>
              {discountPct > 0 && (
                <View style={s.pricingRow}>
                  <Text style={[s.pricingLabel, { color: '#22c55e' }]}>Plan Discount (−{discountPct}%)</Text>
                  <Text style={[s.pricingDiscount, { color: '#22c55e' }]}>
                    −₹{basePrice - finalPrice}
                  </Text>
                </View>
              )}
              <View style={[s.pricingDivider, { backgroundColor: colors.border }]} />
              <View style={s.pricingRow}>
                <Text style={[s.pricingFinalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={s.pricingFinal}>₹{finalPrice}</Text>
              </View>
            </View>

            {/* Generate button */}
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={generating || !sender.trim() || !prompt.trim() || wallet.balance < finalPrice}
              activeOpacity={0.85}
              style={{ opacity: (generating || !sender.trim() || !prompt.trim() || wallet.balance < finalPrice) ? 0.6 : 1, marginTop: 16 }}
            >
              <LinearGradient
                colors={['#E8527A', '#B44CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.genBtn}
              >
                {generating ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.genBtnText}>Generating... (this may take ~30s)</Text>
                  </>
                ) : (
                  <>
                    <Icon name="sparkles" size={18} color="#fff" />
                    <Text style={s.genBtnText}>
                      Generate Card · ₹{finalPrice}
                      {discountPct > 0 ? (
                        <Text style={s.genBtnStrike}> ₹{basePrice}</Text>
                      ) : null}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Generated preview — 4-state section */}
            {(generating || currentGeneration) ? (
              generating ? (
                /* State A — Generating (initial API call in progress) */
                <LinearGradient
                  colors={['#FF6B3320', '#E8527A20']}
                  style={s.previewPlaceholder}
                >
                  <ActivityIndicator color="#E8527A" size="large" />
                  <Text style={[s.previewPlaceholderTitle, { color: colors.foreground }]}>✦ Generating your card...</Text>
                  <Text style={[s.previewPlaceholderSub, { color: colors.mutedForeground }]}>This may take ~30 seconds</Text>
                </LinearGradient>
              ) : currentGeneration?.status === 'processing' ? (
                /* State B — Polling (edge function returned processing) */
                <LinearGradient
                  colors={['#4B83FF20', '#7B2FFF20']}
                  style={s.previewPlaceholder}
                >
                  <ActivityIndicator color="#4B83FF" size="large" />
                  <Text style={[s.previewPlaceholderTitle, { color: colors.foreground }]}>Processing card...</Text>
                  <Text style={[s.previewPlaceholderSub, { color: colors.mutedForeground }]}>Checking every few seconds</Text>
                </LinearGradient>
              ) : currentGeneration?.status === 'completed' && currentGeneration.generated_image_url ? (
                /* State C — Completed */
                <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.previewImgWrap}>
                    <Image
                      source={{ uri: currentGeneration.generated_image_url }}
                      style={{ height: 280, width: '100%' }}
                      contentFit="cover"
                    />
                    {currentGeneration.greeting_text ? (
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.72)']}
                        style={s.greetingOverlay}
                      >
                        <Text style={s.greetingText}>{currentGeneration.greeting_text}</Text>
                      </LinearGradient>
                    ) : null}
                  </View>

                  {currentGeneration.refined_prompt ? (
                    <View style={[s.refinedBox, { backgroundColor: '#4B83FF10', borderColor: '#4B83FF30' }]}>
                      <Icon name="info" size={14} color="#4B83FF" />
                      <Text style={[s.refinedText, { color: '#4B83FF' }]}>
                        AI refined your prompt: {currentGeneration.refined_prompt}
                      </Text>
                    </View>
                  ) : null}

                  <View style={s.previewActions}>
                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: currentGeneration.saved_to_library ? '#F59E0B' : colors.border }]}
                      onPress={() => handleToggleSave(currentGeneration)}
                    >
                      <Icon name={currentGeneration.saved_to_library ? 'star' : 'star-outline'} size={16} color={currentGeneration.saved_to_library ? '#F59E0B' : colors.mutedForeground} />
                      <Text style={[s.actionBtnText, { color: currentGeneration.saved_to_library ? '#F59E0B' : colors.mutedForeground }]}>
                        {currentGeneration.saved_to_library ? 'Remove from Library' : 'Save to Library'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: '#E8527A' }]}
                      onPress={() => handleDownload(currentGeneration.generated_image_url!)}
                    >
                      <Icon name="download" size={16} color="#E8527A" />
                      <Text style={[s.actionBtnText, { color: '#E8527A' }]}>Download Card</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : currentGeneration?.status === 'failed' ? (
                /* State D — Failed */
                <View style={[s.previewError, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
                  <Icon name="alert-circle" size={24} color="#ef4444" />
                  <Text style={[s.previewErrorText, { color: '#ef4444' }]}>
                    {currentGeneration.error_message ?? 'Card generation failed. Please try again.'}
                  </Text>
                  <TouchableOpacity onPress={() => setCurrentGeneration(null)}>
                    <Text style={[s.previewErrorRetry, { color: '#ef4444' }]}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            ) : null}
          </View>
        ) : (
          <View style={s.historyWrap}>
            <Text style={[s.histCount, { color: colors.mutedForeground }]}>
              {historyLoading ? 'Loading...' : `${history.length} greeting cards created`}
            </Text>
            {historyLoading ? (
              <ActivityIndicator color="#E8527A" style={{ marginTop: 32 }} />
            ) : history.length === 0 ? (
              <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Icon name="image" size={36} color={colors.mutedForeground} />
                <Text style={[s.emptyStateText, { color: colors.mutedForeground }]}>
                  No cards generated yet. Create your first greeting card!
                </Text>
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={item => item.id}
                renderItem={renderHistoryItem}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 12 }}
              />
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
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 4 },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statSub: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  bannerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, margin: 16, marginBottom: 0, padding: 14 },
  bannerText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20, marginTop: 16 },
  tabPill: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  refTabBar: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  refTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  refTabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedPreview: { borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', position: 'relative', height: 140 },
  uploadedThumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 8, right: 8, borderRadius: 20, borderWidth: 1, padding: 4 },
  uploadZone: { borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadZoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  emptyLib: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', padding: 20, alignItems: 'center', gap: 8 },
  emptyLibText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  libGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  libThumbWrap: { width: '48%', borderRadius: 10, overflow: 'hidden', position: 'relative', aspectRatio: 1 },
  libThumb: { width: '100%', height: '100%' },
  libSelectedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(232,82,122,0.4)', alignItems: 'center', justifyContent: 'center' },
  aiOnlyNote: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  aiOnlyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  checkSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 4 },
  pricingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingBase: { fontSize: 13, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  pricingDiscount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pricingDivider: { height: 1 },
  pricingFinalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pricingFinal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#E8527A' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  genBtnStrike: { color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through', fontSize: 13 },
  previewPlaceholder: { borderRadius: 16, height: 200, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 },
  previewPlaceholderTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  previewPlaceholderSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  previewError: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10, marginTop: 20 },
  previewErrorText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  previewErrorRetry: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline', marginTop: 4 },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 20 },
  previewImgWrap: { position: 'relative' },
  greetingOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  greetingText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  refinedBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, margin: 12, padding: 10 },
  refinedText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  previewActions: { padding: 12, gap: 10 },
  actionBtn: { borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  historyWrap: { padding: 20 },
  histCount: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  histCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  histThumbWrap: { width: 70, height: 70, overflow: 'hidden' },
  histThumbImg: { width: '100%', height: '100%' },
  histThumbGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1, padding: 12, gap: 5 },
  histBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  histRecipient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  starBtn: { padding: 12 },
  emptyState: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12, marginTop: 8 },
  emptyStateText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
