import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscribedCelebrityChips } from '@/components/celebrity/SubscribedCelebrityChips';
import { Chips } from '@/components/ugc/FormFields';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { supabaseFetch } from '@/constants/supabase';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useAuth } from '@/context/AuthContext';
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { usePlan } from '@/hooks/usePlan';
import { useVoiceCallCelebrities, type VoiceCallCelebrity } from '@/hooks/useVoiceCallCelebrities';
import { useWallet } from '@/hooks/useWallet';
import { CelebrityPhoto } from '@/components/celebrity/CelebrityPhoto';

// ─── What the user can pick ──────────────────────────────────────────────────

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Graduation', 'New Year', 'Diwali', 'Christmas',
  'Eid', 'Holi', 'Promotion', 'Wedding', 'Engagement', 'Baby Shower',
  'Retirement', 'Get Well Soon', 'Thank You', 'Congratulations', 'Good Luck', 'Other',
].map(o => ({ label: o, value: o }));

const TONES = [
  { label: 'Warm & Loving', value: 'warm_loving' },
  { label: 'Funny & Playful', value: 'funny_playful' },
  { label: 'Inspirational & Motivational', value: 'inspirational' },
  { label: 'Formal & Professional', value: 'formal' },
  { label: 'Casual & Friendly', value: 'casual' },
  { label: 'Emotional & Heartfelt', value: 'emotional' },
  { label: 'Enthusiastic & High Energy', value: 'enthusiastic' },
];

const RELATIONSHIPS = [
  { label: 'Friend / Bestie', value: 'friend' },
  { label: 'Parent', value: 'parent' },
  { label: 'Child', value: 'child' },
  { label: 'Spouse / Partner', value: 'spouse' },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Colleague', value: 'colleague' },
  { label: 'Boss / Manager', value: 'boss' },
  { label: 'Relative', value: 'relative' },
  { label: 'Other', value: 'other' },
];

const LANGUAGES = [
  { label: 'English', value: 'english' },
  { label: 'Hindi (Hinglish)', value: 'hindi' },
  { label: 'Tamil', value: 'tamil' },
  { label: 'Telugu', value: 'telugu' },
  { label: 'Kannada', value: 'kannada' },
  { label: 'Malayalam', value: 'malayalam' },
  { label: 'Marathi', value: 'marathi' },
  { label: 'Bengali', value: 'bengali' },
  { label: 'Gujarati', value: 'gujarati' },
  { label: 'Punjabi', value: 'punjabi' },
];

// ─── Dates and times ─────────────────────────────────────────────────────────

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DayTile { dateStr: string; top: string; num: number; summary: string; spoken: string }

function generateDays(): DayTile[] {
  const now = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const top = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAY_SHORT[d.getDay()];
    return {
      dateStr,
      top,
      num: d.getDate(),
      summary: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
      spoken: `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`,
    };
  });
}

const slot = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const range = (from: number, to: number) => {
  const out: string[] = [];
  for (let h = from; h < to; h++) out.push(slot(h, 0), slot(h, 30));
  return out;
};
const TIME_GROUPS: Array<{ title: string; times: string[]; late?: boolean }> = [
  { title: 'Morning', times: range(6, 12) },
  { title: 'Afternoon', times: range(12, 17) },
  { title: 'Evening', times: range(17, 22) },
  { title: 'Late night', times: [...range(22, 24), ...range(0, 6)], late: true },
];

function formatTimeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function buildScheduledAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** A slot on `dateStr` that is less than 30 minutes away (or already past) cannot be booked. */
function slotIsPast(dateStr: string, time: string): boolean {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime() - Date.now() < 30 * 60_000;
}

function formatInPhone(raw: string): { ok: true; e164: string } | { ok: false } {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  const digits = cleaned.replace(/^\+?(91)?/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false };
  return { ok: true, e164: `+91${digits}` };
}

const groupPhone = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
const labelOf = (list: Array<{ label: string; value: string }>, v: string) => list.find(x => x.value === v)?.label ?? '';

type SectionKey = 'celebrity' | 'details' | 'when' | 'personalise';

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function VoiceCallScreen() {
  const { colors, neon, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { celebrity: celebrityParam } = useLocalSearchParams<{ celebrity?: string | string[] }>();
  const celebrityId = Array.isArray(celebrityParam) ? celebrityParam[0] : celebrityParam;
  const { user, session, getValidSession } = useAuth();
  const wallet = useWallet();
  const { confirmOrder } = useOrderConfirm();
  const { discountPercentage, getDiscountedPrice, plan } = usePlan();
  const agentPrefill = useAgentPrefill();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  // This screen lives inside the tab bar: the bar is drawn over the page's bottom edge, and the raised assistant button
  // rises about 30 above it. The action bar sits on top of the tab bar, with room under it for that button.
  const tabBarH = 66 + insets.bottom;
  const MIC_ROOM = 32;

  const { celebrities, loading, error, refetch } = useVoiceCallCelebrities();
  const { favoriteIds, loading: favLoading } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  // This service's colours come from the app's palette: the "calls" accent, deepened into the call gradient.
  const accent = neon.accentE;
  const onAccent = isDark ? neon.onInk : '#fff';
  const gradient = useMemo(() => [neon.tile(neon.accentE)[1], neon.blue] as [string, string], [neon]);

  const DAYS = useMemo(generateDays, []);

  const [selectedCeleb, setSelectedCeleb] = useState<VoiceCallCelebrity | null>(null);
  const [senderName, setSenderName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : '');
  const [recipientName, setRecipientName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [occasion, setOccasion] = useState('');
  const [callTiming, setCallTiming] = useState<'now' | 'scheduled'>('now');
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [showLate, setShowLate] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [tone, setTone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [language, setLanguage] = useState('english');
  const [submitting, setSubmitting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ scheduled: boolean; message: string; when?: string } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ celebrity: true, details: true, when: true, personalise: false });
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  // Auto-fill from the voice assistant
  useEffect(() => {
    if (agentPrefill.recipientName) setRecipientName(agentPrefill.recipientName);
    if (agentPrefill.occasion) setOccasion(agentPrefill.occasion);
    if (agentPrefill.tone) setTone(agentPrefill.tone);
    if (agentPrefill.language) setLanguage(agentPrefill.language.toLowerCase());
    if (agentPrefill.message) setCustomMessage(agentPrefill.message);
  }, [agentPrefill.recipientName, agentPrefill.occasion, agentPrefill.tone, agentPrefill.language, agentPrefill.message]);

  useEffect(() => {
    if (user && !senderName.trim()) setSenderName(`${user.firstName} ${user.lastName}`.trim());
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!celebrityId || loading || favLoading || celebrities.length === 0) return;
    const found = celebrities.find(c => c.id === celebrityId);
    if (!found?.vapiVoiceId) return;
    if (!favoriteIds.has(found.id)) {
      router.push(`/celebrity/${found.id}` as never);
      return;
    }
    setSelectedCeleb(found);
  }, [celebrityId, celebrities, favoriteIds, loading, favLoading]);

  // A slot that has gone past (or a day that became "today") moves to the next one that is still bookable.
  useEffect(() => {
    if (callTiming !== 'scheduled' || !slotIsPast(selectedDay.dateStr, selectedTime)) return;
    const next = TIME_GROUPS.flatMap(g => g.times).find(t => !slotIsPast(selectedDay.dateStr, t));
    if (next) setSelectedTime(next);
  }, [callTiming, selectedDay, selectedTime]);

  const basePrice = selectedCeleb?.pricePerCall || 500;
  const finalPrice = selectedCeleb ? getDiscountedPrice(basePrice) : 0;
  const shortBy = selectedCeleb ? Math.max(0, finalPrice - wallet.balance) : 0;
  const phone = formatInPhone(phoneDigits);
  const noSubscription = !favLoading && favoriteIds.size === 0;

  // Only celebrities the user is subscribed to, and who have a voice to call with, can be chosen.
  const callable = celebrities.filter(c => favoriteIds.has(c.id) && !!c.vapiVoiceId);

  const missing: Array<{ key: string; section: SectionKey }> = [];
  if (!selectedCeleb) missing.push({ key: 'celebrity', section: 'celebrity' });
  if (!senderName.trim()) missing.push({ key: 'sender', section: 'details' });
  if (!recipientName.trim()) missing.push({ key: 'recipient', section: 'details' });
  if (!phone.ok) missing.push({ key: 'phone', section: 'details' });
  if (!occasion) missing.push({ key: 'occasion', section: 'details' });
  const leftIn = (s: SectionKey) => missing.filter(m => m.section === s).length;

  const unflag = (key: string) => setFlagged(prev => {
    if (!prev.has(key)) return prev;
    const next = new Set(prev);
    next.delete(key);
    return next;
  });
  const bad = (key: string) => flagged.has(key);

  const toggleSection = (key: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const goTo = (section: SectionKey) => {
    setOpen(prev => ({ ...prev, [section]: true }));
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[section] ?? 0) - 12), animated: true }), 80);
  };

  const resetForm = () => {
    setRecipientName('');
    setPhoneDigits('');
    setPhoneTouched(false);
    setOccasion('');
    setCustomMessage('');
    setTone('');
    setRelationship('');
    setSelectedCeleb(null);
    setCallTiming('now');
    setSelectedDay(DAYS[0]);
    setSelectedTime('10:00');
    setCallError(null);
    setFlagged(new Set());
    setSuccess(null);
  };

  /** The bar button: flag what is missing, send to the wallet when short, otherwise open the review sheet. */
  const tryReview = () => {
    if (noSubscription) { router.push('/favorites' as never); return; }
    if (missing.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFlagged(new Set(missing.map(m => m.key)));
      setOpen(prev => {
        const next = { ...prev };
        for (const m of missing) next[m.section] = true;
        return next;
      });
      goTo(missing[0].section);
      return;
    }
    if (shortBy > 0) { router.push('/wallet' as never); return; }
    setCallError(null);
    setReviewing(true);
  };

  async function handleMakeCall() {
    if (!selectedCeleb) { setCallError('Please select a celebrity first.'); return; }
    if (!senderName.trim() || !recipientName.trim() || !occasion) { setCallError('Please fill in all required fields.'); return; }
    if (!phone.ok) { setCallError('Please enter a valid 10-digit Indian mobile number starting with 6-9.'); return; }
    if (!selectedCeleb.vapiVoiceId) { setCallError('This celebrity is not yet set up for voice calls. Please choose another.'); return; }
    if (wallet.balance < finalPrice) { setCallError(`Insufficient wallet balance. You need ₹${finalPrice}.`); router.push('/wallet' as never); return; }

    setCallError(null);
    setSubmitting(true);
    try {
      const valid = await getValidSession();
      const token = valid?.access_token ?? session?.access_token;
      const scheduledAt = callTiming === 'scheduled' ? buildScheduledAt(selectedDay.dateStr, selectedTime) : null;
      const body = {
        recipientName: recipientName.trim(),
        recipientPhone: phone.e164,
        occasion,
        senderName: senderName.trim(),
        celebrityId: selectedCeleb.id,
        celebrityName: selectedCeleb.name,
        voiceId: selectedCeleb.vapiVoiceId,
        price: finalPrice,
        celebrityPhoneId: selectedCeleb.vapiPhoneId || undefined,
        customMessage: customMessage.trim(),
        tone,
        relationship,
        language,
        thingsToAvoid: '',
        additionalContext: '',
        scheduledAt,
      };

      const res = await supabaseFetch('/functions/v1/vapi-celebrity-call', { method: 'POST', body: JSON.stringify(body) }, token);
      const json = await res.json();
      if (!res.ok || json.error || !json.success) {
        setReviewing(false);
        setCallError(json.error ?? json.message ?? `Request failed (${res.status})`);
        return;
      }

      wallet.refetch();
      confirmOrder({
        item: `a celebrity call from ${selectedCeleb.name} to ${recipientName.trim()}`,
        orderId: json.callId,
        note: json.scheduled ? `Scheduled for ${new Date(json.scheduledAt ?? scheduledAt ?? '').toLocaleString('en-IN')}` : undefined,
        viewRoute: { pathname: '/bookings', params: { tab: 'Calls' } },
      });
      setReviewing(false);
      if (json.scheduled) {
        const when = json.scheduledAt ?? scheduledAt ?? '';
        setSuccess({ scheduled: true, when, message: json.message || `Your call has been scheduled for ${new Date(when).toLocaleString('en-IN')}` });
      } else {
        setSuccess({ scheduled: false, message: json.message || `${selectedCeleb.name} is now calling ${recipientName.trim()} to wish them!` });
      }
    } catch (err: unknown) {
      setReviewing(false);
      setCallError(err instanceof Error ? err.message : 'Failed to start the call. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pieces ────────────────────────────────────────────────────────────────

  const label = (text: string, required?: boolean) => (
    <Text style={[s.label, { color: colors.foreground }]}>
      {text}{required ? <Text style={{ color: neon.error }}> *</Text> : null}
    </Text>
  );

  const inputBox = (key?: string) => [
    s.input,
    { color: colors.foreground, backgroundColor: colors.input, borderColor: key && bad(key) ? neon.error : colors.border },
  ];

  const whenSummary = callTiming === 'now' ? 'Right now · about 5 min' : `${selectedDay.summary} · ${formatTimeLabel(selectedTime)}`;
  const personaliseSummary = [labelOf(TONES, tone), labelOf(RELATIONSHIPS, relationship), labelOf(LANGUAGES, language)].filter(Boolean).join(' · ');
  const summaries: Record<SectionKey, string> = {
    celebrity: selectedCeleb ? `${selectedCeleb.name} · ₹${finalPrice.toLocaleString('en-IN')}` : '',
    details: [recipientName.trim(), phone.ok ? `+91 ${groupPhone(phoneDigits)}` : '', occasion].filter(Boolean).join(' · '),
    when: whenSummary,
    personalise: personaliseSummary,
  };

  const sections: Array<{ key: SectionKey; title: string; optional?: boolean }> = [
    { key: 'celebrity', title: 'Celebrity' },
    { key: 'details', title: 'Call details' },
    { key: 'when', title: 'When' },
    { key: 'personalise', title: 'Personalise', optional: true },
  ];

  const renderSection = (def: (typeof sections)[number], index: number, children: React.ReactNode) => {
    const isOpen = open[def.key];
    const left = leftIn(def.key);
    const complete = !def.optional && left === 0 && (def.key !== 'celebrity' || !!selectedCeleb) && (def.key !== 'details' || (missing.length === 0 || leftIn('details') === 0));
    return (
      <View
        key={def.key}
        onLayout={e => { sectionY.current[def.key] = e.nativeEvent.layout.y + 300; }}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => toggleSection(def.key)} activeOpacity={0.8} style={s.cardHead} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
          <View style={[s.num, { backgroundColor: complete && def.key !== 'when' ? '#22C55E' : accent + '2B' }]}>
            {complete && def.key !== 'when'
              ? <Icon name="check" size={14} color="#fff" />
              : <Text style={{ color: accent, fontFamily: 'Inter_700Bold', fontSize: 12 }}>{index + 1}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>{def.title}{def.optional ? '  (optional)' : ''}</Text>
            {!isOpen && (
              <Text style={{ color: left > 0 ? neon.error : colors.mutedForeground, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                {left > 0 ? `${left} required left` : summaries[def.key] || 'Optional'}
              </Text>
            )}
          </View>
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        {isOpen && <View style={s.cardBody}>{children}</View>}
      </View>
    );
  };

  const barLabel = noSubscription ? 'Browse & Subscribe' : missing.length === 0 && shortBy > 0 ? `Add ₹${shortBy.toLocaleString('en-IN')} & call` : 'Review & call';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: success ? tabBarH + 40 : tabBarH + MIC_ROOM + 160 }}
      >
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: topPad + 10 }]}>
          <View style={[s.deco, { width: 150, height: 150, top: -40, right: -40, opacity: isDark ? 0.08 : 0.12 }]} />
          <View style={[s.deco, { width: 80, height: 80, bottom: -20, left: -16, opacity: isDark ? 0.08 : 0.12 }]} />
          <View style={s.heroTop}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <Icon name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/bookings', params: { tab: 'Calls' } } as never)}
              style={s.myCalls}
              accessibilityRole="button"
              accessibilityLabel="My calls"
            >
              <Text style={s.myCallsText}>My calls</Text>
            </TouchableOpacity>
          </View>
          <View style={s.heroRow}>
            <View style={s.heroIcon}><Icon name="phone-call" size={26} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Celebrity Call</Text>
              <Text style={s.heroSub}>A real call in their voice, on your loved one's phone.</Text>
            </View>
          </View>
          <View style={s.pills}>
            {['Their cloned voice', 'Rings their phone', 'Paid from wallet'].map(p => (
              <View key={p} style={s.pill}><Text style={s.pillText}>{p}</Text></View>
            ))}
          </View>
        </LinearGradient>

        {success ? (
          <View style={s.success}>
            <LinearGradient colors={gradient} style={s.successIcon}>
              <Icon name={success.scheduled ? 'calendar' : 'phone-call'} size={38} color="#fff" />
            </LinearGradient>
            <Text style={[s.successTitle, { color: colors.foreground }]}>{success.scheduled ? 'Call scheduled' : 'Calling now!'}</Text>
            <Text style={[s.successSub, { color: colors.mutedForeground, textAlign: 'center' }]}>{success.message}</Text>
            {selectedCeleb ? (
              <View style={[s.successCeleb, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <CelebrityPhoto uri={selectedCeleb.imageUrl} name={selectedCeleb.name} style={s.successAvatar} />
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{selectedCeleb.name}</Text>
              </View>
            ) : null}
            <View style={s.timeline}>
              {['Booked', success.scheduled ? 'Scheduled' : 'Ringing', 'Delivered'].map((step, i) => (
                <View key={step} style={s.timeStep}>
                  <View style={[s.timeDot, { backgroundColor: i === 0 ? '#22C55E' : colors.border }]}>
                    {i === 0 && <Icon name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[s.timeLabel, { color: i === 0 ? colors.foreground : colors.mutedForeground }]}>{step}</Text>
                </View>
              ))}
            </View>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/bookings', params: { tab: 'Calls' } } as never)} activeOpacity={0.9}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                  <Text style={s.gradBtnText}>View my calls</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm} style={[s.ghostBtn, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Book another call</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            {/* 1. Celebrity */}
            {renderSection(sections[0], 0, (<>
              <SubscribedCelebrityChips
                celebrities={callable}
                loading={loading || favLoading}
                hasNone={noSubscription}
                selectedId={selectedCeleb?.id}
                onSelect={c => { setSelectedCeleb(c); setCallError(null); unflag('celebrity'); }}
                priceFor={c => getDiscountedPrice(c.pricePerCall || 500)}
                accent={accent}
                onAccentText={onAccent}
                invalid={bad('celebrity')}
                emptyText="Subscribe to a celebrity to send a voice call."
              />
              {error && !loading && celebrities.length === 0 ? (
                <View style={[s.errorCard, { borderColor: neon.error + '66' }]}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Couldn't load celebrities</Text>
                  <TouchableOpacity onPress={refetch} style={[s.retry, { backgroundColor: accent }]} accessibilityRole="button">
                    <Text style={{ color: onAccent, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {selectedCeleb ? (
                <View style={[s.celebCard, { backgroundColor: accent + (isDark ? '1A' : '14'), borderColor: accent + '59' }]}>
                  <CelebrityPhoto uri={selectedCeleb.imageUrl} name={selectedCeleb.name} style={s.celebAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 }} numberOfLines={1}>{selectedCeleb.name}</Text>
                      {selectedCeleb.isVerified ? (
                        <View style={[s.tick, { backgroundColor: neon.accentF }]}><Icon name="check" size={10} color="#fff" /></View>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                      <Text style={{ color: accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>₹{finalPrice.toLocaleString('en-IN')} per call</Text>
                      {discountPercentage > 0 ? (
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, textDecorationLine: 'line-through' }}>₹{basePrice.toLocaleString('en-IN')}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Icon name="phone-call" size={20} color={accent} />
                </View>
              ) : null}
            </>))}

            {!noSubscription && (
              <>
                {/* 2. Call details */}
                {renderSection(sections[1], 1, (<>
                  <View style={s.field}>
                    {label('Your name', true)}
                    <TextInput
                      value={senderName}
                      onChangeText={v => { setSenderName(v); unflag('sender'); }}
                      placeholder="Your name"
                      placeholderTextColor={colors.mutedForeground}
                      style={inputBox('sender')}
                      accessibilityLabel="Your name"
                    />
                  </View>
                  <View style={s.field}>
                    {label("Recipient's name", true)}
                    <TextInput
                      value={recipientName}
                      onChangeText={v => { setRecipientName(v); unflag('recipient'); }}
                      placeholder="Who should we call?"
                      placeholderTextColor={colors.mutedForeground}
                      style={inputBox('recipient')}
                      accessibilityLabel="Recipient's name"
                    />
                  </View>
                  <View style={s.field}>
                    {label("Recipient's phone", true)}
                    <View style={[s.phoneRow, { backgroundColor: colors.input, borderColor: bad('phone') ? neon.error : colors.border }]}>
                      <View style={[s.prefix, { borderRightColor: colors.border }]}>
                        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>🇮🇳 +91</Text>
                      </View>
                      <TextInput
                        value={groupPhone(phoneDigits)}
                        onChangeText={v => { setPhoneDigits(v.replace(/\D/g, '').slice(0, 10)); unflag('phone'); }}
                        onBlur={() => setPhoneTouched(true)}
                        placeholder="98765 43210"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="phone-pad"
                        maxLength={11}
                        style={[s.phoneInput, { color: colors.foreground }]}
                        accessibilityLabel="Recipient's phone number, plus 91"
                      />
                    </View>
                    {phoneTouched && phoneDigits.length > 0 && !phone.ok ? (
                      <Text style={{ color: neon.error, fontSize: 12, marginTop: 6 }}>Enter a valid number starting with 6–9</Text>
                    ) : (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>10-digit mobile number</Text>
                    )}
                  </View>
                  <View style={s.field}>
                    {label('Occasion', true)}
                    <Chips options={OCCASIONS} value={occasion} onChange={v => { if (v) { setOccasion(v); unflag('occasion'); } }} accent={accent} />
                    {bad('occasion') ? <Text style={{ color: neon.error, fontSize: 12, marginTop: 6 }}>Choose an occasion</Text> : null}
                  </View>
                </>))}

                {/* 3. When */}
                {renderSection(sections[2], 2, (<>
                  <View style={[s.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {([['now', 'Call now', 'zap'], ['scheduled', 'Schedule', 'calendar']] as const).map(([key, label, icon]) => {
                      const on = callTiming === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setCallTiming(key)}
                          activeOpacity={0.85}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={[s.segBtn, on && { backgroundColor: accent }]}
                        >
                          <Icon name={icon} size={16} color={on ? onAccent : colors.mutedForeground} />
                          <Text style={[s.segText, { color: on ? onAccent : colors.mutedForeground }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {callTiming === 'now' ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 10 }}>Usually rings within 4–5 minutes.</Text>
                  ) : (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
                        {DAYS.map(d => {
                          const on = selectedDay.dateStr === d.dateStr;
                          return (
                            <TouchableOpacity
                              key={d.dateStr}
                              onPress={() => setSelectedDay(d)}
                              activeOpacity={0.8}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={d.spoken}
                              style={[s.day, on ? { backgroundColor: accent + (isDark ? '38' : '26'), borderColor: accent } : { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                              <Text style={{ color: on ? accent : colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{d.top}</Text>
                              <Text style={{ color: on ? accent : colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{d.num}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {TIME_GROUPS.map(g => {
                        if (g.late && !showLate) {
                          return (
                            <TouchableOpacity key={g.title} onPress={() => setShowLate(true)} style={[s.timeChip, { borderColor: colors.border, backgroundColor: 'transparent', alignSelf: 'flex-start', marginTop: 10 }]}>
                              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>+ Late night</Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <View key={g.title} style={{ marginTop: 12 }}>
                            <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{g.title.toUpperCase()}</Text>
                            <View style={s.timeWrap}>
                              {g.times.map(t => {
                                const on = selectedTime === t;
                                const past = slotIsPast(selectedDay.dateStr, t);
                                return (
                                  <TouchableOpacity
                                    key={t}
                                    disabled={past}
                                    onPress={() => setSelectedTime(t)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 4, bottom: 4 }}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: on, disabled: past }}
                                    accessibilityLabel={formatTimeLabel(t)}
                                    style={[s.timeChip, on ? { backgroundColor: accent + (isDark ? '38' : '26'), borderColor: accent } : { backgroundColor: colors.card, borderColor: colors.border }, past && { opacity: 0.4 }]}
                                  >
                                    <Text style={{ color: on ? accent : colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{formatTimeLabel(t)}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </>))}

                {/* 4. Personalise */}
                {renderSection(sections[3], 3, (<>
                  <View style={s.field}>
                    {label('Tone & style')}
                    <Chips options={TONES} value={tone} onChange={v => setTone(v ?? '')} accent={accent} />
                  </View>
                  <View style={s.field}>
                    {label('Relationship')}
                    <Chips options={RELATIONSHIPS} value={relationship} onChange={v => setRelationship(v ?? '')} accent={accent} />
                  </View>
                  <View style={s.field}>
                    {label('Language')}
                    <Chips options={LANGUAGES} value={language} onChange={v => { if (v) setLanguage(v); }} accent={accent} />
                  </View>
                  <View style={s.field}>
                    {label('Message & things to say')}
                    <TextInput
                      value={customMessage}
                      onChangeText={v => setCustomMessage(v.slice(0, 500))}
                      placeholder={selectedCeleb ? `Memories you want ${selectedCeleb.name} to talk about...` : 'Special memories, nicknames, or things to say...'}
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      textAlignVertical="top"
                      style={[inputBox(), { minHeight: 110 }]}
                      accessibilityLabel="Message and things to say"
                    />
                    <Text style={{ color: customMessage.length >= 450 ? neon.warning : colors.mutedForeground, fontSize: 11, textAlign: 'right', marginTop: 6 }}>
                      {customMessage.length} / 500
                    </Text>
                  </View>
                </>))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {!success && (
        <View style={[s.bar, { backgroundColor: colors.background, borderTopColor: colors.border, bottom: tabBarH, paddingBottom: MIC_ROOM }]}>
          {callError ? (
            <View
              accessibilityLiveRegion="polite"
              style={[s.banner, { backgroundColor: neon.error + '1F', borderColor: neon.error }]}
            >
              <Icon name="alert-circle" size={16} color={neon.error} />
              <Text style={{ flex: 1, color: neon.error, fontSize: 13 }}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)} hitSlop={10} accessibilityLabel="Dismiss">
                <Icon name="x" size={16} color={neon.error} />
              </TouchableOpacity>
            </View>
          ) : missing.length > 0 || noSubscription ? (
            <Text style={[s.barHint, { color: colors.mutedForeground }]}>
              {noSubscription ? 'Subscribe to a celebrity to book a call' : `${missing.length} required ${missing.length === 1 ? 'field' : 'fields'} left`}
            </Text>
          ) : null}
          <View style={s.barRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[s.barPrice, { color: colors.foreground }]}>{selectedCeleb ? `₹${finalPrice.toLocaleString('en-IN')}` : '—'}</Text>
                {selectedCeleb && discountPercentage > 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, textDecorationLine: 'line-through' }}>₹{basePrice.toLocaleString('en-IN')}</Text>
                ) : null}
              </View>
              {selectedCeleb && discountPercentage > 0 ? (
                <Text style={{ color: neon.success, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{discountPercentage}% {plan || ''} off</Text>
              ) : null}
              <Text style={[s.barWallet, { color: shortBy > 0 && missing.length === 0 ? neon.error : colors.mutedForeground }]}>
                Wallet ₹{wallet.balance.toLocaleString('en-IN')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={tryReview}
              activeOpacity={0.9}
              style={{ flex: 1, marginLeft: 16 }}
              accessibilityRole="button"
              accessibilityLabel={selectedCeleb ? `${barLabel}, ₹${finalPrice}` : barLabel}
            >
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                <Text style={s.gradBtnText}>{barLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={reviewing} transparent animationType="slide" onRequestClose={() => !submitting && setReviewing(false)}>
        <View style={s.sheetBackdrop}>
          <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 14 }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>Review your call</Text>
              <TouchableOpacity onPress={() => !submitting && setReviewing(false)} hitSlop={12} accessibilityLabel="Close">
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12, gap: 12 }}>
              {([
                { key: 'celebrity' as SectionKey, title: 'Celebrity', rows: [['Celebrity', selectedCeleb?.name ?? ''], ['Price per call', `₹${finalPrice.toLocaleString('en-IN')}`]] },
                { key: 'details' as SectionKey, title: 'Call details', rows: [['From', senderName.trim()], ['To', recipientName.trim()], ['Phone', phone.ok ? `+91 ${groupPhone(phoneDigits)}` : ''], ['Occasion', occasion]] },
                { key: 'when' as SectionKey, title: 'When', rows: [['Call', callTiming === 'now' ? 'Right now' : `${selectedDay.spoken}, ${formatTimeLabel(selectedTime)}`]] },
                ...(tone || relationship || customMessage.trim() || language !== 'english'
                  ? [{ key: 'personalise' as SectionKey, title: 'Personalise', rows: [['Tone', labelOf(TONES, tone)], ['Relationship', labelOf(RELATIONSHIPS, relationship)], ['Language', labelOf(LANGUAGES, language)], ['Message', customMessage.trim()]] }]
                  : []),
              ]).map(card => (
                <View key={card.key} style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.reviewHead}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>{card.title}</Text>
                    <TouchableOpacity onPress={() => { setReviewing(false); goTo(card.key); }} hitSlop={8}>
                      <Text style={{ color: accent, fontFamily: 'Inter_700Bold', fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  {card.rows.filter(([, v]) => v).map(([label, value]) => (
                    <View key={label} style={s.reviewRow}>
                      <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                      <Text style={[s.reviewValue, { color: colors.foreground }]} numberOfLines={4}>{value}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.reviewRow}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>Total</Text>
                  <Text style={{ color: accent, fontFamily: 'Inter_700Bold', fontSize: 16 }}>₹{finalPrice.toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.reviewRow}>
                  <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>Wallet after call</Text>
                  <Text style={[s.reviewValue, { color: colors.foreground }]}>₹{Math.max(0, wallet.balance - finalPrice).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity onPress={handleMakeCall} disabled={submitting} activeOpacity={0.9} style={{ opacity: submitting ? 0.7 : 1 }}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                {submitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={s.gradBtnText}>{callTiming === 'scheduled' ? 'Scheduling…' : 'Calling…'}</Text>
                  </View>
                ) : (
                  <Text style={s.gradBtnText}>{callTiming === 'scheduled' ? 'Schedule call' : 'Call now'} · ₹{finalPrice.toLocaleString('en-IN')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View></AmbientBackground>
  );
}

// ─── Styles: the same numbers the UGC order screens use ──────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  myCalls: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  myCallsText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 18 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  field: { marginTop: 16 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  prefix: { paddingHorizontal: 12, minHeight: 48, justifyContent: 'center', borderRightWidth: 1 },
  phoneInput: { flex: 1, minHeight: 48, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_400Regular' },

  celebCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 12 },
  celebAvatar: { width: 48, height: 48, borderRadius: 24 },
  tick: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  errorCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, gap: 10 },
  retry: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },

  segment: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1 },
  segBtn: { flex: 1, height: 40, borderRadius: 11, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  days: { gap: 8, paddingVertical: 14 },
  day: { width: 56, height: 64, borderRadius: 14, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  groupTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 8 },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 76, height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8 },
  barHint: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center' },
  barPrice: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  barWallet: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  gradBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  gradBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  ghostBtn: { height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  success: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, gap: 10 },
  successIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  successSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  successCeleb: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, padding: 10 },
  successAvatar: { width: 32, height: 32, borderRadius: 16 },
  timeline: { flexDirection: 'row', gap: 22, marginVertical: 8 },
  timeStep: { alignItems: 'center', gap: 6 },
  timeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timeLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  reviewLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0, maxWidth: '45%' },
  reviewValue: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1, textAlign: 'right' },
});
