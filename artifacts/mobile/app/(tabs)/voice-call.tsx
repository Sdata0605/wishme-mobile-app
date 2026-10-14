import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { Icon, type IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { useVoiceCallCelebrities, type VoiceCallCelebrity } from '@/hooks/useVoiceCallCelebrities';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';

const PAGE_BG = '#0A0A14';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const MUTED = 'rgba(255,255,255,0.4)';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Graduation', 'New Year', 'Diwali', 'Christmas',
  'Eid', 'Holi', 'Promotion', 'Wedding', 'Engagement', 'Baby Shower',
  'Retirement', 'Get Well Soon', 'Thank You', 'Congratulations', 'Good Luck', 'Other',
];

const TONES: Array<{ label: string; value: string }> = [
  { label: 'Warm & Loving', value: 'warm_loving' },
  { label: 'Funny & Playful', value: 'funny_playful' },
  { label: 'Inspirational & Motivational', value: 'inspirational' },
  { label: 'Formal & Professional', value: 'formal' },
  { label: 'Casual & Friendly', value: 'casual' },
  { label: 'Emotional & Heartfelt', value: 'emotional' },
  { label: 'Enthusiastic & High Energy', value: 'enthusiastic' },
];

const RELATIONSHIPS: Array<{ label: string; value: string }> = [
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

const LANGUAGES: Array<{ label: string; value: string }> = [
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

const JOURNEY: Array<{ icon: IconName; label: string; desc: string }> = [
  { icon: 'search', label: 'Select Celebrity', desc: 'Choose from our curated roster.' },
  { icon: 'sparkles', label: 'Choose Occasion', desc: 'Birthday, anniversary, or just because.' },
  { icon: 'edit', label: 'Enter Details', desc: 'Tell us who and what to say.' },
  { icon: 'shield', label: 'Secure Pay', desc: 'Paid from your wallet.' },
  { icon: 'phone-call', label: 'Call Delivered', desc: 'The magic happens on the phone.' },
];

function formatInPhone(raw: string): { ok: true; e164: string } | { ok: false } {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  const digits = cleaned.replace(/^\+?(91)?/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false };
  return { ok: true, e164: `+91${digits}` };
}

function generateDates(): Array<{ label: string; dateStr: string }> {
  const result: Array<{ label: string; dateStr: string }> = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label =
      i === 0 ? `Today, ${monthNames[d.getMonth()]} ${d.getDate()}` :
      i === 1 ? `Tomorrow, ${monthNames[d.getMonth()]} ${d.getDate()}` :
      `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result.push({ label, dateStr: `${yyyy}-${mm}-${dd}` });
  }
  return result;
}

function generateTimes(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
}

function formatTimeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function buildScheduledAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const DATES = generateDates();
const TIMES = generateTimes();

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function TextField({
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon?: IconName;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={[styles.inputWrap, multiline && styles.inputMultiline]}>
      {icon && !multiline ? <Icon name={icon} size={15} color={MUTED} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.22)"
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.textInput, multiline && styles.textArea]}
      />
    </View>
  );
}

function CelebrityPickerModal({
  visible,
  onClose,
  celebrities,
  loading,
  error,
  onRetry,
  search,
  setSearch,
  favoriteIds,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  celebrities: VoiceCallCelebrity[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  setSearch: (s: string) => void;
  favoriteIds: Set<string>;
  onSelect: (c: VoiceCallCelebrity) => void;
}) {
  const insets = useSafeAreaInsets();
  const filtered = celebrities
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const aS = favoriteIds.has(a.id) ? 0 : 1;
      const bS = favoriteIds.has(b.id) ? 0 : 1;
      return aS - bS;
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>Select Celebrity</Text>
            <Text style={styles.modalSub}>Choose a subscribed celebrity to send a voice call</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={16} color={MUTED} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or category..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#F472B6" />
            <Text style={styles.helper}>Loading celebrities...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>Could not load celebrities</Text>
            <Text style={styles.helper}>{error}</Text>
            <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={[styles.helper, { textAlign: 'center', marginTop: 32 }]}>
                No celebrities with voice calling are available yet.
              </Text>
            ) : filtered.map((celeb) => {
              const subscribed = favoriteIds.has(celeb.id);
              return (
                <TouchableOpacity
                  key={celeb.id}
                  activeOpacity={0.85}
                  onPress={() => onSelect(celeb)}
                  style={[styles.pickerRow, !subscribed && { opacity: 0.7 }]}
                >
                  <Image source={{ uri: celeb.imageUrl }} style={styles.pickerAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.pickerName} numberOfLines={1}>{celeb.name}</Text>
                      {celeb.isVerified ? (
                        <View style={styles.verified}><Icon name="check" size={8} color="#fff" /></View>
                      ) : null}
                    </View>
                    <Text style={styles.pickerCat}>{celeb.category}</Text>
                    <Text style={styles.pickerPrice}>₹{celeb.pricePerCall || 500} per call</Text>
                  </View>
                  {subscribed ? (
                    <View style={styles.subBadge}><Text style={styles.subBadgeText}>Subscribed</Text></View>
                  ) : (
                    <View style={styles.lockWrap}>
                      <Icon name="lock" size={12} color="#fff" />
                      <Text style={styles.lockText}>Subscribe</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export default function VoiceCallScreen() {
  const insets = useSafeAreaInsets();
  const { celebrity: celebrityParam } = useLocalSearchParams<{ celebrity?: string | string[] }>();
  const celebrityId = Array.isArray(celebrityParam) ? celebrityParam[0] : celebrityParam;
  const { user, session, getValidSession } = useAuth();
  const wallet = useWallet();
  const { confirmOrder } = useOrderConfirm();
  const { discountPercentage, getDiscountedPrice, plan } = usePlan();
  const agentPrefill = useAgentPrefill();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 88;

  const { celebrities, loading, error, refetch } = useVoiceCallCelebrities();
  const { favoriteIds, loading: favLoading } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCeleb, setSelectedCeleb] = useState<VoiceCallCelebrity | null>(null);

  const [senderName, setSenderName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [occasion, setOccasion] = useState('');
  const [callTiming, setCallTiming] = useState<'now' | 'scheduled'>('now');
  const [selectedDate, setSelectedDate] = useState(DATES[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [tone, setTone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [language, setLanguage] = useState('english');
  const [thingsToAvoid, setThingsToAvoid] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ scheduled: boolean; message: string; when?: string } | null>(null);

  // Auto-fill from agent prefill
  useEffect(() => {
    if (agentPrefill.recipientName) setRecipientName(agentPrefill.recipientName);
    if (agentPrefill.occasion) setOccasion(agentPrefill.occasion);
    if (agentPrefill.tone) setTone(agentPrefill.tone);
    if (agentPrefill.language) setLanguage(agentPrefill.language.toLowerCase());
    if (agentPrefill.message) setCustomMessage(agentPrefill.message);
  }, [agentPrefill.recipientName, agentPrefill.occasion, agentPrefill.tone, agentPrefill.language, agentPrefill.message]);

  useEffect(() => {
    if (user && !senderName.trim()) {
      setSenderName(`${user.firstName} ${user.lastName}`.trim());
    }
  }, [user]);

  useEffect(() => {
    if (!celebrityId || loading || favLoading || celebrities.length === 0) return;
    const found = celebrities.find((c) => c.id === celebrityId);
    if (!found?.vapiVoiceId) {
      setShowPicker(true);
      return;
    }
    if (!favoriteIds.has(found.id)) {
      router.push(`/celebrity/${found.id}` as never);
      return;
    }
    setSelectedCeleb(found);
  }, [celebrityId, celebrities, favoriteIds, loading, favLoading]);

  useEffect(() => {
    if (!celebrityId && !selectedCeleb && !loading && !favLoading) {
      setShowPicker(true);
    }
  }, [celebrityId, selectedCeleb, loading, favLoading]);

  const basePrice = selectedCeleb?.pricePerCall || 500;
  const finalPrice = selectedCeleb ? getDiscountedPrice(basePrice) : 0;
  const canSubmit = Boolean(
    selectedCeleb &&
    senderName.trim() &&
    recipientName.trim() &&
    recipientPhone.trim() &&
    occasion &&
    (callTiming === 'now' || selectedDate),
  );

  const handleSelectCeleb = (c: VoiceCallCelebrity) => {
    if (!favoriteIds.has(c.id)) {
      setShowPicker(false);
      router.push(`/celebrity/${c.id}` as never);
      return;
    }
    setSelectedCeleb(c);
    setShowPicker(false);
    setCallError(null);
  };

  const resetForm = () => {
    setRecipientName('');
    setRecipientPhone('');
    setOccasion('');
    setCustomMessage('');
    setTone('');
    setRelationship('');
    setThingsToAvoid('');
    setAdditionalContext('');
    setSelectedCeleb(null);
    setCallTiming('now');
    setSelectedDate(DATES[0]);
    setSelectedTime('10:00');
    setSuccess(null);
    setShowPicker(true);
  };

  async function handleMakeCall() {
    if (!selectedCeleb) {
      setCallError('Please select a celebrity first.');
      setShowPicker(true);
      return;
    }
    if (!senderName.trim() || !recipientName.trim() || !recipientPhone.trim() || !occasion) {
      setCallError('Please fill in all required fields.');
      return;
    }
    const phone = formatInPhone(recipientPhone);
    if (!phone.ok) {
      setCallError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (!selectedCeleb.vapiVoiceId) {
      setCallError('This celebrity is not yet set up for voice calls. Please choose another.');
      return;
    }
    if (callTiming === 'scheduled' && !selectedDate) {
      setCallError('Please select a date for the scheduled call.');
      return;
    }
    if (wallet.balance < finalPrice) {
      setCallError(`Insufficient wallet balance. You need ₹${finalPrice}.`);
      router.push('/wallet' as never);
      return;
    }

    setCallError(null);
    setSubmitting(true);
    try {
      const valid = await getValidSession();
      const token = valid?.access_token ?? session?.access_token;
      const scheduledAt = callTiming === 'scheduled'
        ? buildScheduledAt(selectedDate.dateStr, selectedTime)
        : null;
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
        thingsToAvoid: thingsToAvoid.trim(),
        additionalContext: additionalContext.trim(),
        scheduledAt,
      };

      const res = await supabaseFetch(
        '/functions/v1/vapi-celebrity-call',
        { method: 'POST', body: JSON.stringify(body) },
        token,
      );
      const json = await res.json();
      if (!res.ok || json.error || !json.success) {
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
      if (json.scheduled) {
        const when = json.scheduledAt ?? scheduledAt ?? '';
        setSuccess({
          scheduled: true,
          when,
          message: json.message || `Your call has been scheduled for ${new Date(when).toLocaleString('en-IN')}`,
        });
      } else {
        setSuccess({
          scheduled: false,
          message: json.message || `${selectedCeleb.name} is now calling ${recipientName.trim()} to wish them!`,
        });
      }
    } catch (err: unknown) {
      setCallError(err instanceof Error ? err.message : 'Failed to initiate call. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.root, { paddingTop: topPad + 24, paddingBottom: bottomPad }]}>
        <View style={styles.successCard}>
          <LinearGradient colors={['#F97316', '#EC4899', '#7B5CFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successIcon}>
            <Icon name={success.scheduled ? 'calendar' : 'phone-call'} size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.successTitle}>{success.scheduled ? 'Call scheduled!' : 'Call initiated!'}</Text>
          <Text style={styles.successMsg}>{success.message}</Text>
          {selectedCeleb ? (
            <View style={styles.successCeleb}>
              <Image source={{ uri: selectedCeleb.imageUrl }} style={styles.successAvatar} />
              <Text style={styles.successCelebName}>{selectedCeleb.name}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={resetForm} activeOpacity={0.85} style={{ width: '100%' }}>
            <LinearGradient colors={['#F97316', '#EC4899', '#7B5CFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Icon name="phone" size={16} color="#fff" />
              <Text style={styles.ctaText}>Book another call</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: bottomPad, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroItalic}>Experience Stardom:</Text>
          <Text style={styles.heroGradient}>Celebrity Voice Calls</Text>
          <Text style={styles.heroSub}>
            Transform any occasion into a legendary memory with a personalized voice call from your favorite icon.
          </Text>
        </View>

        <Text style={styles.journeyTitle}>
          The Journey to a <Text style={styles.pinkItalic}>Moment</Text>
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.journeyRow}>
          {JOURNEY.map((step) => (
            <View key={step.label} style={styles.journeyCard}>
              <View style={styles.journeyIcon}>
                <Icon name={step.icon} size={18} color="#F472B6" />
              </View>
              <Text style={styles.journeyLabel}>{step.label}</Text>
              <Text style={styles.journeyDesc}>{step.desc}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Icon name="star" size={14} color="#F472B6" />
            <Text style={styles.sectionTitle}>Select a Celebrity</Text>
          </View>
          {selectedCeleb ? (
            <>
              <View style={styles.selectedRow}>
                <Image source={{ uri: selectedCeleb.imageUrl }} style={styles.selectedAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.selectedName}>{selectedCeleb.name}</Text>
                    {selectedCeleb.isVerified ? (
                      <View style={styles.verified}><Icon name="check" size={8} color="#fff" /></View>
                    ) : null}
                  </View>
                  <Text style={styles.pickerPrice}>₹{basePrice} per call</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowPicker(true)}>
                <Text style={styles.changeLink}>View all artists →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.dashedPick} onPress={() => setShowPicker(true)}>
              <Icon name="phone" size={22} color={MUTED} />
              <Text style={styles.helper}>Tap to select a celebrity</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.premiumCard}>
          <Text style={styles.premiumTitle}>Premium Quality</Text>
          <Text style={styles.helper}>
            Every call uses the celebrity’s cloned voice and is delivered to the recipient’s phone.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={[styles.numBadge, { backgroundColor: '#F97316' }]}><Text style={styles.numText}>1</Text></View>
            <Text style={styles.sectionTitle}>Call Details</Text>
          </View>
          <FieldLabel>YOUR NAME *</FieldLabel>
          <TextField value={senderName} onChangeText={setSenderName} placeholder="e.g. Rahul Sharma" icon="user" />
          <FieldLabel>RECIPIENT'S NAME *</FieldLabel>
          <TextField value={recipientName} onChangeText={setRecipientName} placeholder="Who are they calling?" icon="user" />
          <FieldLabel>PHONE NUMBER *</FieldLabel>
          <TextField value={recipientPhone} onChangeText={setRecipientPhone} placeholder="+91 00000 00000" icon="phone" keyboardType="phone-pad" />
          <FieldLabel>OCCASION *</FieldLabel>
          <View style={styles.chipRow}>
            {OCCASIONS.map((oc) => (
              <Chip key={oc} label={oc} selected={occasion === oc} onPress={() => setOccasion(oc)} />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={[styles.numBadge, { backgroundColor: '#EC4899' }]}><Text style={styles.numText}>2</Text></View>
            <Text style={styles.sectionTitle}>Scheduling</Text>
          </View>
          <View style={styles.timingRow}>
            <TouchableOpacity
              style={[styles.timingCard, callTiming === 'now' && styles.timingCardActive]}
              onPress={() => setCallTiming('now')}
            >
              <Icon name="zap" size={18} color={callTiming === 'now' ? '#FB923C' : MUTED} />
              <View>
                <Text style={styles.timingTitle}>Call Now</Text>
                <Text style={styles.journeyDesc}>Estimated wait: 4–5 mins</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timingCard, callTiming === 'scheduled' && styles.timingCardPurple]}
              onPress={() => setCallTiming('scheduled')}
            >
              <Icon name="calendar" size={18} color={callTiming === 'scheduled' ? '#C084FC' : MUTED} />
              <View>
                <Text style={styles.timingTitle}>Schedule Later</Text>
                <Text style={styles.journeyDesc}>Pick a future date & time</Text>
              </View>
            </TouchableOpacity>
          </View>

          {callTiming === 'scheduled' ? (
            <>
              <FieldLabel>SELECT DATE</FieldLabel>
              <TouchableOpacity
                style={styles.inputWrap}
                onPress={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
              >
                <Icon name="calendar" size={15} color={MUTED} />
                <Text style={styles.dateText}>{selectedDate.label}</Text>
                <Icon name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
              </TouchableOpacity>
              {showDatePicker ? (
                <View style={styles.dropdown}>
                  {DATES.map((d) => (
                    <TouchableOpacity
                      key={d.dateStr}
                      style={styles.dropdownRow}
                      onPress={() => { setSelectedDate(d); setShowDatePicker(false); }}
                    >
                      <Text style={[styles.dropdownText, selectedDate.dateStr === d.dateStr && { color: '#F472B6' }]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <FieldLabel>PREFERRED TIME</FieldLabel>
              <TouchableOpacity
                style={styles.inputWrap}
                onPress={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
              >
                <Icon name="clock" size={15} color={MUTED} />
                <Text style={styles.dateText}>{formatTimeLabel(selectedTime)}</Text>
                <Icon name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
              </TouchableOpacity>
              {showTimePicker ? (
                <View style={[styles.dropdown, { maxHeight: 200 }]}>
                  <ScrollView nestedScrollEnabled>
                    {TIMES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={styles.dropdownRow}
                        onPress={() => { setSelectedTime(t); setShowTimePicker(false); }}
                      >
                        <Text style={[styles.dropdownText, selectedTime === t && { color: '#F472B6' }]}>{formatTimeLabel(t)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={[styles.numBadge, { backgroundColor: '#8B5CF6' }]}><Text style={styles.numText}>3</Text></View>
            <Text style={styles.sectionTitle}>Personalization</Text>
          </View>
          <FieldLabel>TONE & STYLE</FieldLabel>
          <View style={styles.chipRow}>
            {TONES.map((t) => (
              <Chip key={t.value} label={t.label} selected={tone === t.value} onPress={() => setTone(tone === t.value ? '' : t.value)} />
            ))}
          </View>
          <FieldLabel>RELATIONSHIP</FieldLabel>
          <View style={styles.chipRow}>
            {RELATIONSHIPS.map((r) => (
              <Chip key={r.value} label={r.label} selected={relationship === r.value} onPress={() => setRelationship(relationship === r.value ? '' : r.value)} />
            ))}
          </View>
          <FieldLabel>LANGUAGE</FieldLabel>
          <View style={styles.chipRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l.value} label={l.label} selected={language === l.value} onPress={() => setLanguage(l.value)} />
            ))}
          </View>
          <FieldLabel>CUSTOM MESSAGE / THINGS TO SAY</FieldLabel>
          <TextField
            value={customMessage}
            onChangeText={(v) => setCustomMessage(v.slice(0, 500))}
            placeholder={selectedCeleb ? `Mention memories you want ${selectedCeleb.name} to talk about...` : 'Mention special memories, nicknames, or things to say...'}
            multiline
          />
          <Text style={styles.charCount}>{customMessage.length} / 500 characters</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.estLabel}>ESTIMATED TOTAL</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceNow}>{selectedCeleb ? `₹${finalPrice.toLocaleString('en-IN')}` : '—'}</Text>
            {selectedCeleb && discountPercentage > 0 ? (
              <Text style={styles.priceOld}>₹{basePrice.toLocaleString('en-IN')}</Text>
            ) : null}
          </View>
          {selectedCeleb && discountPercentage > 0 ? (
            <Text style={styles.discountNote}>{discountPercentage}% {plan || ''} discount applied</Text>
          ) : null}
          <Text style={styles.walletLine}>Wallet: ₹{wallet.balance.toLocaleString('en-IN')}</Text>

          {callError ? (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={16} color="#F87171" />
              <Text style={styles.errorBannerText}>{callError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleMakeCall}
            disabled={submitting || !canSubmit}
            activeOpacity={0.85}
            style={[(!canSubmit || submitting) && { opacity: 0.4 }]}
          >
            <LinearGradient colors={['#F97316', '#EC4899', '#7B5CFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              {submitting ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.ctaText}>{callTiming === 'scheduled' ? 'Scheduling...' : 'Initiating...'}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.ctaText}>BOOK YOUR CALL</Text>
                  <Icon name="arrow-right" size={16} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CelebrityPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        celebrities={celebrities}
        loading={loading}
        error={error}
        onRetry={refetch}
        search={search}
        setSearch={setSearch}
        favoriteIds={favoriteIds}
        onSelect={handleSelectCeleb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  hero: { paddingVertical: 18, alignItems: 'center' },
  heroItalic: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: '#fff',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  heroGradient: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: '#F472B6',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
  heroSub: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    maxWidth: 340,
  },
  journeyTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginBottom: 14,
  },
  pinkItalic: { color: '#F472B6', fontStyle: 'italic' },
  journeyRow: { gap: 10, paddingBottom: 8 },
  journeyCard: {
    width: 128,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  journeyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  journeyLabel: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  journeyDesc: { color: MUTED, fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, lineHeight: 14 },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  premiumCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(236,72,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.15)',
  },
  premiumTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#F472B6',
    marginBottom: 6,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  numBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: 10, minHeight: 90 },
  textInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { textAlignVertical: 'top', minHeight: 70 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  chipSelected: { borderColor: 'rgba(236,72,153,0.5)', backgroundColor: 'rgba(236,72,153,0.12)' },
  chipText: { color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium' },
  chipTextSelected: { color: '#F472B6' },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(236,72,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.2)',
  },
  selectedAvatar: { width: 44, height: 44, borderRadius: 22 },
  selectedName: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  changeLink: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 12, fontFamily: 'Inter_500Medium' },
  dashedPick: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CARD_BORDER,
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  helper: { color: MUTED, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verified: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  timingRow: { gap: 10 },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  timingCardActive: { borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.08)' },
  timingCardPurple: { borderColor: 'rgba(123,92,250,0.4)', backgroundColor: 'rgba(123,92,250,0.08)' },
  timingTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  dateText: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    backgroundColor: '#151528',
    overflow: 'hidden',
  },
  dropdownRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: CARD_BORDER },
  dropdownText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'right', marginTop: 6 },
  estLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  priceNow: { color: '#fff', fontSize: 32, fontFamily: 'Inter_700Bold' },
  priceOld: { color: MUTED, fontSize: 14, textDecorationLine: 'line-through' },
  discountNote: { color: '#34D399', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4 },
  walletLine: { color: MUTED, fontSize: 12, marginTop: 8, marginBottom: 14, fontFamily: 'Inter_400Regular' },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { flex: 1, color: '#F87171', fontSize: 13, fontFamily: 'Inter_400Regular' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  successCard: {
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  successIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  successMsg: { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22, fontFamily: 'Inter_400Regular' },
  successCeleb: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10 },
  successAvatar: { width: 32, height: 32, borderRadius: 16 },
  successCelebName: { color: '#fff', fontFamily: 'Inter_500Medium' },
  modalRoot: { flex: 1, backgroundColor: PAGE_BG, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  modalTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalSub: { color: MUTED, fontSize: 12, marginTop: 4, fontFamily: 'Inter_400Regular' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  pickerList: { paddingBottom: 24, gap: 10 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  pickerAvatar: { width: 48, height: 48, borderRadius: 24 },
  pickerName: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  pickerCat: { color: MUTED, fontSize: 12, marginTop: 2 },
  pickerPrice: { color: '#F472B6', fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  subBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  subBadgeText: { color: '#4ADE80', fontSize: 10, fontFamily: 'Inter_700Bold' },
  lockWrap: { alignItems: 'center', gap: 4 },
  lockText: { color: MUTED, fontSize: 10, fontFamily: 'Inter_500Medium' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  errorTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  retryBtn: { backgroundColor: '#EC4899', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
});
