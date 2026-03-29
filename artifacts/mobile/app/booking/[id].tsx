import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { Icon } from '@/components/Icon';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';
import { lightColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Colors = typeof lightColors;

const FALLBACK_LANGUAGES = [
  'English','Hindi','Tamil','Telugu','Kannada','Malayalam','Bengali','Marathi',
  'Gujarati','Punjabi','Odia','Assamese','Urdu','Rajasthani','Bhojpuri','Sanskrit',
];

const GOALS = ['Promote a product','Celebrate occasion','Business announcement','Raise awareness','Other'];
const TONES = ['Funny','Heartfelt','Professional','Inspirational','Casual'];
const AVOID_OPTIONS = ['Competitor mentions','Profanity','Sensitive topics','Pricing mentions'];
const STEP_LABELS = ['Details','Delivery','Guidelines','Script','Review','Checkout'];

type ServiceType = 'wish' | 'ad' | 'video';

interface Celebrity {
  id: string;
  name: string;
  image_url?: string;
  category: string;
  pricePerWish: number;
  service_prices?: { general_wish?: number; ugc_ad?: number; video_promotion?: number; image_promotion?: number };
}

function generateWMId(): string {
  return 'WM' + Date.now().toString(36).toUpperCase();
}

function sbFetch(path: string, options: RequestInit = {}, token?: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  }).finally(() => clearTimeout(timer));
}

export default function BookingWizardScreen() {
  const { id, service: svc } = useLocalSearchParams<{ id: string; service: string }>();
  const service: ServiceType = (svc === 'ad' || svc === 'video') ? svc : 'wish';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [step, setStep] = useState<1|2|3|4|5|6>(1);

  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [subPrice, setSubPrice] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [profileId, setProfileId] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [languages, setLanguages] = useState<string[]>(FALLBACK_LANGUAGES);
  const [loadingInit, setLoadingInit] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const [step1, setStep1] = useState({
    recipientName: '', recipientRelation: '', occasion: '', message: '', preferredLanguage: 'English',
    videoType: 'marketing' as 'marketing' | 'business_event',
    businessName: '', businessPronunciation: '',
  });

  const [step2, setStep2] = useState({ deliveryType: 'video' as 'video' | 'card' | 'both' });

  const [step3, setStep3] = useState({
    goal: GOALS[0], customGoal: '', tone: TONES[0],
    thingsToAvoid: [] as string[], filmingRequirements: '',
  });

  const [step4, setStep4] = useState({ scriptType: 'talking_points' as 'talking_points' | 'exact_script', scriptText: '' });

  const [step6, setStep6] = useState({
    scheduleGift: false,
    recipientName: '', recipientEmail: '', recipientPhone: '', deliveryDate: '',
    termsAccepted: false,
  });

  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [showToneDropdown, setShowToneDropdown] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = session?.access_token;
    const uid = user?.id;

    const init = async () => {
      setLoadingInit(true);
      try {
        const [celebRes, profRes, langRes] = await Promise.allSettled([
          sbFetch(`/rest/v1/celebrities?id=eq.${id}&select=*&limit=1`, {}, token),
          uid ? sbFetch(`/rest/v1/profiles?user_id=eq.${uid}&select=id,wallet_balance,plan_discount&limit=1`, {}, token) : Promise.resolve(null),
          sbFetch('/functions/v1/heygen-get-languages', { method: 'POST', body: '{}' }, token),
        ]);

        if (celebRes.status === 'fulfilled' && celebRes.value.ok) {
          const rows: Record<string, unknown>[] = await celebRes.value.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const raw = rows[0];
            setCelebrity({
              id: raw.id as string,
              name: raw.name as string,
              image_url: raw.image_url as string | undefined,
              category: raw.category as string,
              pricePerWish: (raw.price_per_wish ?? raw.pricePerWish ?? 1500) as number,
              service_prices: (raw.service_prices ?? {}) as Celebrity['service_prices'],
            });

            const resolvedProfileId =
              profRes.status === 'fulfilled' && profRes.value && (profRes.value as Response).ok
                ? await (profRes.value as Response).clone().json()
                    .then((r: { id?: string }[]) => r[0]?.id ?? '')
                    .catch(() => '')
                : '';

            const [subPriceRes, subStatusRes] = await Promise.allSettled([
              sbFetch(`/rest/v1/celebrity_favorite_pricing?celebrity_id=eq.${raw.id}&is_enabled=eq.true&select=price&limit=1`, {}, token),
              resolvedProfileId
                ? sbFetch(`/rest/v1/celebrity_favorites?user_id=eq.${resolvedProfileId}&celebrity_id=eq.${raw.id}&status=eq.active&select=id&limit=1`, {}, token)
                : Promise.resolve(null),
            ]);

            if (subPriceRes.status === 'fulfilled' && subPriceRes.value?.ok) {
              const sp: { price?: number }[] = await subPriceRes.value.json().catch(() => []);
              if (Array.isArray(sp) && sp.length > 0) setSubPrice(sp[0].price ?? 0);
            }

            if (subStatusRes.status === 'fulfilled' && subStatusRes.value && (subStatusRes.value as Response).ok) {
              const favRows: { id: string }[] = await (subStatusRes.value as Response).json().catch(() => []);
              setIsSubscribed(Array.isArray(favRows) && favRows.length > 0);
            }
          }
        }

        if (profRes.status === 'fulfilled' && profRes.value && (profRes.value as Response).ok) {
          const prows: { id?: string; wallet_balance?: number; plan_discount?: number }[] =
            await (profRes.value as Response).json().catch(() => []);
          if (Array.isArray(prows) && prows.length > 0) {
            setProfileId(prows[0].id ?? '');
            setWalletBalance(prows[0].wallet_balance ?? 0);
            setDiscountPct(prows[0].plan_discount ?? 0);
          }
        }

        if (langRes.status === 'fulfilled' && langRes.value && (langRes.value as Response).ok) {
          try {
            const ld: (string | { name: string })[] = await (langRes.value as Response).json();
            if (Array.isArray(ld) && ld.length > 0) {
              setLanguages(ld.map((l) => typeof l === 'string' ? l : l.name));
            }
          } catch { /* use fallback */ }
        }
      } catch { /* keep defaults */ }
      setLoadingInit(false);
    };
    init();
  }, [id, user, session]);

  const basePrice = celebrity
    ? service === 'wish'
      ? celebrity.service_prices?.general_wish ?? celebrity.pricePerWish
      : service === 'ad'
        ? celebrity.service_prices?.ugc_ad ?? 25000
        : celebrity.service_prices?.video_promotion ?? 50000
    : 0;

  const discountAmt = Math.round(basePrice * discountPct / 100);
  const afterDiscount = basePrice - discountAmt;
  const serviceFee = Math.round(afterDiscount * 0.10);
  const finalPrice = afterDiscount + serviceFee;

  const validateStep = () => {
    if (step === 1) {
      if (service === 'wish') {
        if (!step1.recipientName.trim()) { showToast('Please enter recipient name'); return false; }
        if (!step1.occasion.trim()) { showToast('Please enter the occasion'); return false; }
      } else if (service === 'video') {
        if (!step1.businessName.trim()) { showToast('Please enter business name'); return false; }
      } else if (service === 'ad') {
        if (!step1.businessName.trim()) { showToast('Please enter business name'); return false; }
      }
    }
    if (step === 6) {
      if (!isSubscribed) { showToast('You must subscribe to this celebrity to book'); return false; }
      if (!step6.termsAccepted) { showToast('Please accept the Terms & Conditions'); return false; }
      if (walletBalance < finalPrice) { showToast('Insufficient wallet balance'); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step < 6) setStep((s) => (s + 1) as 1|2|3|4|5|6);
  };
  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1|2|3|4|5|6);
    else router.back();
  };

  const generateScript = async () => {
    if (!celebrity) return;
    setAiLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          celebrityName: celebrity.name,
          serviceType: service,
          requestDetails: step1,
          creativeGuidelines: { goal: step3.goal === 'Other' ? step3.customGoal : step3.goal, tone: step3.tone, thingsToAvoid: step3.thingsToAvoid, filmingRequirements: step3.filmingRequirements },
          talkingPoints: step4.scriptText,
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.script) setStep4((s) => ({ ...s, scriptText: data.script }));
        else showToast('AI generation failed — please write your script manually');
      } else {
        showToast('AI generation failed — please write your script manually');
      }
    } catch {
      showToast('AI generation failed — please write your script manually');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePay = async () => {
    if (!celebrity || !profileId) { showToast('Missing booking information'); return; }
    if (!isSubscribed) { showToast('You must subscribe to this celebrity to book'); return; }
    setPaying(true);
    try {
      const serviceTypeMap = { wish: 'video_wish', ad: 'image_promotion', video: 'video_promotion' };
      const bookingData = {
        celebrity_id: celebrity.id,
        user_id: profileId,
        service_type: serviceTypeMap[service],
        original_price: basePrice,
        discount_amount: discountAmt,
        final_price: finalPrice,
        status: 'pending',
        message: JSON.stringify({ step1, step2, step3, step4, step6: { scheduleGift: step6.scheduleGift, recipientName: step6.recipientName, recipientEmail: step6.recipientEmail, recipientPhone: step6.recipientPhone, deliveryDate: step6.deliveryDate } }),
        instructions: step3.goal === 'Other' ? step3.customGoal : step3.goal,
        delivery_type: step2.deliveryType,
        generated_prompt: step4.scriptText,
      };

      const bookRes = await sbFetch('/rest/v1/bookings', { method: 'POST', body: JSON.stringify(bookingData) }, session?.access_token);
      if (!bookRes.ok) {
        const err = await bookRes.json().catch(() => ({}));
        showToast(err.message ?? 'Booking failed. Please try again.');
        return;
      }
      const bookRows = await bookRes.json();
      const booking = Array.isArray(bookRows) ? bookRows[0] : bookRows;
      const bookingId = booking?.id;
      if (!bookingId) { showToast('Booking creation failed'); return; }

      const walTxRes = await sbFetch('/rest/v1/wallet_transactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: profileId,
          transaction_type: 'booking',
          amount: finalPrice,
          status: 'completed',
          payment_method: 'wallet',
          description: `Booking: ${celebrity.name} - ${service}`,
        }),
      }, session?.access_token);
      if (!walTxRes.ok) {
        const err = await walTxRes.json().catch(() => ({}));
        showToast(err.message ?? 'Wallet deduction failed');
        return;
      }

      const wmPaymentId = generateWMId();
      const payTxRes = await sbFetch('/rest/v1/payment_transactions', {
        method: 'POST',
        body: JSON.stringify({
          wishme_payment_id: wmPaymentId,
          user_id: profileId,
          amount: finalPrice,
          payment_method: 'wallet',
          service_type: 'booking',
          booking_id: bookingId,
          description: `Booking for ${celebrity.name} - ${service}`,
          status: 'completed',
          paid_at: new Date().toISOString(),
        }),
      }, session?.access_token);
      if (!payTxRes.ok) {
        const err = await payTxRes.json().catch(() => ({}));
        showToast(err.message ?? 'Payment recording failed');
        return;
      }

      await sbFetch(`/rest/v1/bookings?id=eq.${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ wishme_payment_id: wmPaymentId }),
      }, session?.access_token);

      router.replace({ pathname: '/booking-summary', params: { bookingId, paymentId: wmPaymentId } });
    } catch (e) {
      showToast('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loadingInit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[{ marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>Loading...</Text>
      </View>
    );
  }

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>
        {service === 'wish' ? 'Who is this wish for?' : service === 'video' ? 'Video Details' : 'Ad Details'}
      </Text>

      {service === 'wish' && (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Recipient Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Rahul"
            placeholderTextColor={colors.mutedForeground}
            value={step1.recipientName}
            onChangeText={(t) => setStep1(s => ({ ...s, recipientName: t }))}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Relation (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Friend, Mom, Brother"
            placeholderTextColor={colors.mutedForeground}
            value={step1.recipientRelation}
            onChangeText={(t) => setStep1(s => ({ ...s, recipientRelation: t }))}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Occasion *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Birthday, Anniversary"
            placeholderTextColor={colors.mutedForeground}
            value={step1.occasion}
            onChangeText={(t) => setStep1(s => ({ ...s, occasion: t }))}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Message (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Any special message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={step1.message}
            onChangeText={(t) => setStep1(s => ({ ...s, message: t }))}
          />
        </>
      )}

      {service === 'video' && (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Video Type *</Text>
          <View style={styles.radioGroup}>
            {(['marketing','business_event'] as const).map((vt) => (
              <TouchableOpacity key={vt} style={styles.radioRow} onPress={() => setStep1(s => ({ ...s, videoType: vt }))}>
                <View style={[styles.radioCircle, { borderColor: colors.primary }]}>
                  {step1.videoType === vt && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.radioLabel, { color: colors.foreground }]}>{vt === 'marketing' ? 'Marketing' : 'Business Event'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Business Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Your brand name"
            placeholderTextColor={colors.mutedForeground}
            value={step1.businessName}
            onChangeText={(t) => setStep1(s => ({ ...s, businessName: t }))}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Pronunciation (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="How to pronounce the name"
            placeholderTextColor={colors.mutedForeground}
            value={step1.businessPronunciation}
            onChangeText={(t) => setStep1(s => ({ ...s, businessPronunciation: t }))}
          />
        </>
      )}

      {service === 'ad' && (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Business Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Your brand name"
            placeholderTextColor={colors.mutedForeground}
            value={step1.businessName}
            onChangeText={(t) => setStep1(s => ({ ...s, businessName: t }))}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Ad Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Describe what the ad should convey..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={step1.message}
            onChangeText={(t) => setStep1(s => ({ ...s, message: t }))}
          />
        </>
      )}

      <Text style={[styles.label, { color: colors.foreground }]}>Preferred Language</Text>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.border }]}
        onPress={() => setShowLangDropdown(v => !v)}
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{step1.preferredLanguage}</Text>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {showLangDropdown && (
        <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {languages.map((lang) => (
              <TouchableOpacity key={lang} style={styles.dropdownItem} onPress={() => { setStep1(s => ({ ...s, preferredLanguage: lang })); setShowLangDropdown(false); }}>
                <Text style={{ color: step1.preferredLanguage === lang ? colors.primary : colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>Delivery Type</Text>
      <Text style={[styles.stepSubheading, { color: colors.mutedForeground }]}>How would you like this delivered?</Text>
      {([['video','🎥','Video Message'],['card','💌','Digital Greeting Card'],['both','✨','Video + Card Combo']] as [string,string,string][]).map(([val, emoji, label]) => (
        <TouchableOpacity
          key={val}
          style={[styles.selectionCard, { backgroundColor: colors.card, borderColor: step2.deliveryType === val ? colors.primary : colors.border, borderWidth: step2.deliveryType === val ? 2 : 1 }]}
          onPress={() => setStep2({ deliveryType: val as 'video' | 'card' | 'both' })}
        >
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.selectionTitle, { color: colors.foreground }]}>{label}</Text>
          </View>
          {step2.deliveryType === val && <Icon name="check-circle" size={20} color={colors.primary} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>Creative Guidelines</Text>

      <Text style={[styles.label, { color: colors.foreground }]}>Goal</Text>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.border }]}
        onPress={() => setShowGoalDropdown(v => !v)}
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{step3.goal}</Text>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {showGoalDropdown && (
        <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {GOALS.map((g) => (
            <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setStep3(s => ({ ...s, goal: g })); setShowGoalDropdown(false); }}>
              <Text style={{ color: step3.goal === g ? colors.primary : colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {step3.goal === 'Other' && (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Describe your goal</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Enter your custom goal"
            placeholderTextColor={colors.mutedForeground}
            value={step3.customGoal}
            onChangeText={(t) => setStep3(s => ({ ...s, customGoal: t }))}
          />
        </>
      )}

      <Text style={[styles.label, { color: colors.foreground }]}>Tone</Text>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.border }]}
        onPress={() => setShowToneDropdown(v => !v)}
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{step3.tone}</Text>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {showToneDropdown && (
        <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TONES.map((t) => (
            <TouchableOpacity key={t} style={styles.dropdownItem} onPress={() => { setStep3(s => ({ ...s, tone: t })); setShowToneDropdown(false); }}>
              <Text style={{ color: step3.tone === t ? colors.primary : colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.label, { color: colors.foreground }]}>Things to Avoid</Text>
      {AVOID_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={styles.checkRow}
          onPress={() => setStep3(s => ({
            ...s,
            thingsToAvoid: s.thingsToAvoid.includes(opt) ? s.thingsToAvoid.filter(x => x !== opt) : [...s.thingsToAvoid, opt],
          }))}
        >
          <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: step3.thingsToAvoid.includes(opt) ? colors.primary : 'transparent' }]}>
            {step3.thingsToAvoid.includes(opt) && <Icon name="check" size={12} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.foreground }]}>{opt}</Text>
        </TouchableOpacity>
      ))}

      {service === 'video' && (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Filming Requirements</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Any specific filming instructions..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={step3.filmingRequirements}
            onChangeText={(t) => setStep3(s => ({ ...s, filmingRequirements: t }))}
          />
        </>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>Script Builder</Text>

      <View style={styles.radioGroup}>
        {([['talking_points','Give Talking Points'],['exact_script','Exact Script']] as [string,string][]).map(([val, label]) => (
          <TouchableOpacity key={val} style={styles.radioRow} onPress={() => setStep4(s => ({ ...s, scriptType: val as 'talking_points' | 'exact_script' }))}>
            <View style={[styles.radioCircle, { borderColor: colors.primary }]}>
              {step4.scriptType === val && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
            </View>
            <Text style={[styles.radioLabel, { color: colors.foreground }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>
        {step4.scriptType === 'talking_points' ? 'Talking Points' : 'Your Script'}
      </Text>
      <TextInput
        style={[styles.input, styles.inputLarge, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
        placeholder={step4.scriptType === 'talking_points' ? 'Enter key points for the celebrity to cover...' : 'Enter the exact script...'}
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={6}
        value={step4.scriptText}
        onChangeText={(t) => setStep4(s => ({ ...s, scriptText: t }))}
      />

      <TouchableOpacity
        style={[styles.aiBtn, { borderColor: colors.primary }]}
        onPress={generateScript}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Icon name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.aiBtnText, { color: colors.primary }]}>AI Generate Script</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>Review Your Booking</Text>

      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Request Details</Text>
        {service === 'wish' && (
          <>
            {!!step1.recipientName && <ReviewRow label="Recipient" value={step1.recipientName} colors={colors} />}
            {!!step1.recipientRelation && <ReviewRow label="Relation" value={step1.recipientRelation} colors={colors} />}
            {!!step1.occasion && <ReviewRow label="Occasion" value={step1.occasion} colors={colors} />}
            {!!step1.message && <ReviewRow label="Message" value={step1.message} colors={colors} />}
          </>
        )}
        {(service === 'ad' || service === 'video') && (
          <>
            {!!step1.businessName && <ReviewRow label="Business" value={step1.businessName} colors={colors} />}
            {service === 'video' && <ReviewRow label="Video Type" value={step1.videoType} colors={colors} />}
            {!!step1.message && <ReviewRow label="Description" value={step1.message} colors={colors} />}
          </>
        )}
        <ReviewRow label="Language" value={step1.preferredLanguage} colors={colors} />
      </View>

      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Delivery</Text>
        <ReviewRow label="Type" value={step2.deliveryType === 'video' ? 'Video Message' : step2.deliveryType === 'card' ? 'Digital Greeting Card' : 'Video + Card Combo'} colors={colors} />
      </View>

      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Creative Guidelines</Text>
        <ReviewRow label="Goal" value={step3.goal === 'Other' ? step3.customGoal || 'Other' : step3.goal} colors={colors} />
        <ReviewRow label="Tone" value={step3.tone} colors={colors} />
        {step3.thingsToAvoid.length > 0 && <ReviewRow label="Avoid" value={step3.thingsToAvoid.join(', ')} colors={colors} />}
      </View>

      {!!step4.scriptText && (
        <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Script Preview</Text>
          <Text style={[styles.reviewValue, { color: colors.mutedForeground }]}>
            {step4.scriptText.length > 200 ? step4.scriptText.slice(0, 200) + '...' : step4.scriptText}
          </Text>
        </View>
      )}

      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Pricing</Text>
        <ReviewRow label="Base Price" value={`₹${basePrice.toLocaleString('en-IN')}`} colors={colors} />
        {discountPct > 0 && <ReviewRow label={`Discount (${discountPct}%)`} value={`-₹${discountAmt.toLocaleString('en-IN')}`} colors={colors} valueColor="#22C55E" />}
        <ReviewRow label="Service Fee (10%)" value={`₹${serviceFee.toLocaleString('en-IN')}`} colors={colors} />
        <View style={[styles.reviewTotalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.reviewTotalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.reviewTotalValue, { color: colors.primary }]}>₹{finalPrice.toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeading, { color: colors.foreground }]}>Checkout</Text>

      {!isSubscribed && (
        <View style={[styles.infoBox, { backgroundColor: '#EF444415', borderColor: '#EF4444', marginBottom: 12 }]}>
          <Icon name="alert-circle" size={18} color="#EF4444" />
          <Text style={[styles.infoBoxText, { color: '#EF4444' }]}>
            You must subscribe to this celebrity before booking. Please go back and subscribe first.
          </Text>
        </View>
      )}

      <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.reviewCardTitle, { color: colors.foreground }]}>Pricing Summary</Text>
        <ReviewRow label="Base Price" value={`₹${basePrice.toLocaleString('en-IN')}`} colors={colors} />
        {discountPct > 0 && <ReviewRow label={`Discount (${discountPct}%)`} value={`-₹${discountAmt.toLocaleString('en-IN')}`} colors={colors} valueColor="#22C55E" />}
        <ReviewRow label="Service Fee (10%)" value={`₹${serviceFee.toLocaleString('en-IN')}`} colors={colors} />
        <View style={[styles.reviewTotalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.reviewTotalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.reviewTotalValue, { color: colors.primary }]}>₹{finalPrice.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={[styles.giftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.giftToggleRow}>
          <View>
            <Text style={[styles.giftTitle, { color: colors.foreground }]}>🎁 Schedule as a Gift</Text>
            <Text style={[styles.giftSub, { color: colors.mutedForeground }]}>Send directly to the recipient</Text>
          </View>
          <Switch
            value={step6.scheduleGift}
            onValueChange={(v) => setStep6(s => ({ ...s, scheduleGift: v }))}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {step6.scheduleGift && (
          <View style={{ marginTop: 12, gap: 10 }}>
            <TextInput style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} placeholder="Recipient Name" placeholderTextColor={colors.mutedForeground} value={step6.recipientName} onChangeText={(t) => setStep6(s => ({ ...s, recipientName: t }))} />
            <TextInput style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} placeholder="Recipient Email" placeholderTextColor={colors.mutedForeground} value={step6.recipientEmail} onChangeText={(t) => setStep6(s => ({ ...s, recipientEmail: t }))} keyboardType="email-address" />
            <TextInput style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} placeholder="Recipient Phone" placeholderTextColor={colors.mutedForeground} value={step6.recipientPhone} onChangeText={(t) => setStep6(s => ({ ...s, recipientPhone: t }))} keyboardType="phone-pad" />
            <TextInput style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} placeholder="Delivery Date (e.g. 2025-12-25)" placeholderTextColor={colors.mutedForeground} value={step6.deliveryDate} onChangeText={(t) => setStep6(s => ({ ...s, deliveryDate: t }))} />
          </View>
        )}
      </View>

      <View style={[styles.walletRow, { backgroundColor: walletBalance >= finalPrice ? '#22C55E15' : '#EF444415', borderColor: walletBalance >= finalPrice ? '#22C55E' : '#EF4444' }]}>
        <Icon name="wallet" size={18} color={walletBalance >= finalPrice ? '#22C55E' : '#EF4444'} />
        <Text style={[styles.walletLabel, { color: walletBalance >= finalPrice ? '#22C55E' : '#EF4444' }]}>
          Wallet Balance: ₹{walletBalance.toLocaleString('en-IN')}
          {walletBalance < finalPrice ? ' (Insufficient)' : ''}
        </Text>
      </View>

      <TouchableOpacity style={styles.termsRow} onPress={() => setStep6(s => ({ ...s, termsAccepted: !s.termsAccepted }))}>
        <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: step6.termsAccepted ? colors.primary : 'transparent' }]}>
          {step6.termsAccepted && <Icon name="check" size={12} color="#fff" />}
        </View>
        <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
          I agree to the <Text style={{ color: colors.primary }}>Terms & Conditions</Text>
        </Text>
      </TouchableOpacity>

      <Pressable
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 8 }]}
        onPress={handlePay}
        disabled={!step6.termsAccepted || walletBalance < finalPrice || paying}
      >
        <LinearGradient
          colors={(!step6.termsAccepted || walletBalance < finalPrice) ? ['#ccc','#ccc'] : ['#FF6B33','#B44CFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.payBtn}
        >
          {paying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.payBtnText}>Pay ₹{finalPrice.toLocaleString('en-IN')} via Wallet</Text>}
        </LinearGradient>
      </Pressable>

      <TouchableOpacity style={[styles.razorpayBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Coming Soon', 'Razorpay integration is coming soon!')}>
        <Text style={[styles.razorpayBtnText, { color: colors.mutedForeground }]}>Pay via Razorpay</Text>
      </TouchableOpacity>
    </View>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6][step - 1];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{STEP_LABELS[step - 1]}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Step {step} of 6 • {celebrity?.name ?? '...'}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.progressBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([1,2,3,4,5,6] as const).map((s) => (
          <View key={s} style={styles.dotWrap}>
            <LinearGradient
              colors={s <= step ? ['#FF6B33','#B44CFF'] : [colors.muted, colors.muted]}
              style={[styles.dot, s === step && styles.dotActive]}
            >
              <Text style={[styles.dotText, { color: s <= step ? '#fff' : colors.mutedForeground }]}>{s}</Text>
            </LinearGradient>
            {s < 6 && <View style={[styles.dotLine, { backgroundColor: s < step ? colors.primary : colors.border }]} />}
          </View>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {stepContent()}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={goBack}>
          <Text style={[styles.backBtnText, { color: colors.foreground }]}>Back</Text>
        </TouchableOpacity>
        {step < 6 ? (
          <Pressable style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]} onPress={goNext}>
            <LinearGradient colors={['#FF6B33','#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtn}>
              <Text style={styles.nextBtnText}>Next</Text>
              <Icon name="arrow-right" size={16} color="#fff" />
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function ReviewRow({ label, value, colors, valueColor }: { label: string; value: string; colors: Colors; valueColor?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  progressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, gap: 0 },
  dotWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotActive: { width: 32, height: 32, borderRadius: 16 },
  dotText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dotLine: { width: 16, height: 2 },
  stepContent: { padding: 20, gap: 4 },
  stepHeading: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  stepSubheading: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  inputLarge: { height: 120, textAlignVertical: 'top' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dropdownList: { borderWidth: 1, borderRadius: 10, marginTop: 4, zIndex: 100 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  radioGroup: { flexDirection: 'column', gap: 10, marginVertical: 8 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  selectionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16, marginBottom: 10 },
  selectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  aiBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  reviewCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5 },
  reviewLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  reviewValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1.5, textAlign: 'right' },
  reviewTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1 },
  reviewTotalLabel: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  reviewTotalValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  giftCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  giftToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  giftTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  giftSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  walletLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  termsText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  payBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  payBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  razorpayBtn: { borderWidth: 1.5, borderRadius: 26, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  razorpayBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  backBtn: { borderWidth: 1.5, borderRadius: 26, paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  nextBtn: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  toast: { position: 'absolute', bottom: 90, left: 20, right: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  infoBoxText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20 },
});
