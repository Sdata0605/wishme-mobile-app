import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { Celebrity, useCelebrities } from '@/hooks/useCelebrities';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 52) / 2;

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Graduation', 'New Year', 'Diwali', 'Christmas',
  'Eid', 'Holi', 'Promotion', 'Wedding', 'Engagement', 'Baby Shower',
  'Retirement', 'Get Well Soon', 'Thank You', 'Congratulations', 'Good Luck', 'Other',
];

const TONES: Array<{ label: string; value: string }> = [
  { label: 'Warm & Loving', value: 'warm_loving' },
  { label: 'Funny & Playful', value: 'funny_playful' },
  { label: 'Inspirational', value: 'inspirational' },
  { label: 'Formal', value: 'formal' },
  { label: 'Casual', value: 'casual' },
  { label: 'Emotional', value: 'emotional' },
];

const RELATIONSHIPS: Array<{ label: string; value: string }> = [
  { label: 'Friend', value: 'friend' },
  { label: 'Parent', value: 'parent' },
  { label: 'Child', value: 'child' },
  { label: 'Spouse', value: 'spouse' },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Colleague', value: 'colleague' },
  { label: 'Boss', value: 'boss' },
  { label: 'Relative', value: 'relative' },
  { label: 'Other', value: 'other' },
];

const LANGUAGES: Array<{ label: string; value: string }> = [
  { label: 'English', value: 'english' },
  { label: 'Hindi', value: 'hindi' },
  { label: 'Tamil', value: 'tamil' },
  { label: 'Telugu', value: 'telugu' },
  { label: 'Kannada', value: 'kannada' },
  { label: 'Malayalam', value: 'malayalam' },
  { label: 'Marathi', value: 'marathi' },
  { label: 'Bengali', value: 'bengali' },
  { label: 'Gujarati', value: 'gujarati' },
  { label: 'Punjabi', value: 'punjabi' },
];

const MOCK_WALLET = 3250;
const DISCOUNT_PCT = 10;

function generateDates(): Array<{ label: string; dateStr: string }> {
  const result: Array<{ label: string; dateStr: string }> = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
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

const DATES = generateDates();

function generateTimes(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
}

const TIMES = generateTimes();

function buildScheduledAt(dateStr: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}


function StepIndicator({ step }: { step: 1 | 2 }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepRow}>
      {([1, 2] as const).map((n) => {
        const done = step > n;
        const active = step === n;
        return (
          <React.Fragment key={n}>
            <View style={[
              styles.stepCircle,
              done && { backgroundColor: colors.primary, borderColor: colors.primary },
              active && { borderColor: colors.primary },
              !done && !active && { borderColor: colors.border },
            ]}>
              {done ? (
                <Icon name="check" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, { color: active ? colors.primary : colors.mutedForeground }]}>{n}</Text>
              )}
            </View>
            {n === 1 && (
              <View style={[styles.stepLine, { backgroundColor: step >= 2 ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}


function CelebSelectGrid({
  celebrities,
  loading,
  error,
  onRetry,
  search,
  setSearch,
  onSelect,
  colors,
}: {
  celebrities: Celebrity[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  setSearch: (s: string) => void;
  onSelect: (c: Celebrity) => void;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
}) {
  const filtered = celebrities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search celebrities..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading celebrities...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Icon name="alert-circle" size={40} color={colors.primary} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Could not load celebrities</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onRetry}>
            <Icon name="refresh-cw" size={14} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((celeb) => (
            <TouchableOpacity
              key={celeb.id}
              activeOpacity={0.82}
              onPress={() => onSelect(celeb)}
              style={[styles.celebCard, { backgroundColor: colors.card, borderColor: colors.border, width: CARD_W }]}
            >
              <View style={styles.celebAvatarWrap}>
                <Image source={{ uri: celeb.imageUrl }} style={styles.celebAvatar} />
                {celeb.isAvailable && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.celebInfo}>
                <View style={styles.celebNameRow}>
                  <Text style={[styles.celebName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
                  {celeb.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Icon name="check" size={8} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.celebCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={11} color="#F59E0B" />
                  <Text style={[styles.ratingText, { color: colors.foreground }]}>{celeb.rating}</Text>
                </View>
                <Text style={[styles.rateText, { color: colors.primary }]}>₹{celeb.pricePerCall || 500}/call</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}


type SuccessResult =
  | { scheduled: false; callId?: string; message: string }
  | { scheduled: true; scheduledAt: string; message: string };

function CallDetailsForm({
  celeb,
  onBack,
  colors,
  bottomPad,
}: {
  celeb: Celebrity;
  onBack: () => void;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
  bottomPad: number;
}) {
  const { user, session } = useAuth();

  const [senderName, setSenderName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  );

  useEffect(() => {
    if (user && !senderName.trim()) {
      setSenderName(`${user.firstName} ${user.lastName}`.trim());
    }
  }, [user]);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [occasion, setOccasion] = useState('Birthday');

  const [callTiming, setCallTiming] = useState<'now' | 'later'>('now');
  const [selectedDate, setSelectedDate] = useState<{ label: string; dateStr: string }>(DATES[0]);
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
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  const basePrice = celeb.pricePerCall || 500;
  const discountAmt = Math.round((basePrice * DISCOUNT_PCT) / 100);
  const finalPrice = basePrice - discountAmt;

  async function handleMakeCall() {
    if (!senderName.trim() || !recipientName.trim() || !recipientPhone.trim()) {
      setCallError('Please fill in Your Name, Recipient Name, and Phone Number.');
      return;
    }
    const phoneDigits = recipientPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setCallError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!celeb.vapiVoiceId) {
      setCallError('This celebrity is not yet set up for voice calls. Please choose a different celebrity.');
      return;
    }
    if (callTiming === 'later' && (!selectedDate || !selectedTime)) {
      setCallError('Please select a date and time for scheduling.');
      return;
    }
    setCallError(null);
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        occasion,
        senderName: senderName.trim(),
        celebrityId: celeb.id,
        celebrityName: celeb.name,
        price: celeb.pricePerCall || 500,
        language,
        voiceId: celeb.vapiVoiceId,
        scheduledAt: callTiming === 'later'
          ? buildScheduledAt(selectedDate.dateStr, selectedTime)
          : null,
      };
      if (celeb.vapiPhoneId) body.celebrityPhoneId = celeb.vapiPhoneId;
      if (customMessage.trim()) body.customMessage = customMessage.trim();
      if (tone) body.tone = tone;
      if (relationship) body.relationship = relationship;
      if (thingsToAvoid.trim()) body.thingsToAvoid = thingsToAvoid.trim();
      if (additionalContext.trim()) body.additionalContext = additionalContext.trim();

      const res = await supabaseFetch(
        '/functions/v1/vapi-celebrity-call',
        { method: 'POST', body: JSON.stringify(body) },
        session?.access_token,
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error ?? json.message ?? `Request failed (${res.status})`;
        setCallError(msg);
        return;
      }

      if (json.scheduled) {
        const scheduledAt: string = json.scheduledAt ?? buildScheduledAt(selectedDate.dateStr, selectedTime);
        const fallbackMsg = `Your call from ${celeb.name} to ${recipientName.trim()} has been scheduled!`;
        setSuccess({ scheduled: true, scheduledAt, message: json.message || fallbackMsg });
      } else {
        const fallbackMsg = `${celeb.name} will call ${recipientName.trim()} shortly. Fingers crossed! 🤞`;
        setSuccess({ scheduled: false, callId: json.callId, message: json.message || fallbackMsg });
      }
    } catch (err: unknown) {
      setCallError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.successIconWrap}
        >
          <Icon name={success.scheduled ? 'calendar' : 'phone-call'} size={36} color="#fff" />
        </LinearGradient>

        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          {success.scheduled ? 'Call Scheduled!' : 'Call Initiated!'}
        </Text>

        <Text style={[styles.successMsg, { color: colors.mutedForeground }]}>
          {success.message}
        </Text>

        {success.scheduled && (
          <View style={[styles.successMetaRow, { backgroundColor: colors.backgroundSecondary ?? colors.muted }]}>
            <Icon name="clock" size={14} color={colors.primary} />
            <Text style={[styles.successMetaText, { color: colors.foreground }]}>
              {new Date(success.scheduledAt).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
              })}
            </Text>
          </View>
        )}

        <View style={[styles.successMetaRow, { backgroundColor: colors.backgroundSecondary ?? colors.muted, marginTop: 8 }]}>
          <Image source={{ uri: celeb.imageUrl }} style={styles.successAvatar} />
          <Text style={[styles.successMetaText, { color: colors.foreground }]}>{celeb.name}</Text>
        </View>

        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.85}
          style={styles.bookAnotherBtnWrap}
        >
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookAnotherBtn}>
            <Icon name="phone" size={16} color="#fff" />
            <Text style={styles.bookAnotherText}>Book Another Call</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.formContent, { paddingBottom: bottomPad }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Icon name="arrow-left" size={18} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Change Celebrity</Text>
      </TouchableOpacity>

      <View style={[styles.selectedCeleb, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={{ uri: celeb.imageUrl }} style={styles.selectedAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedName, { color: colors.foreground }]}>{celeb.name}</Text>
          <Text style={[styles.selectedCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
          <Text style={[styles.selectedRate, { color: colors.primary }]}>₹{basePrice.toLocaleString('en-IN')} / call</Text>
        </View>
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Required Details</Text>

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Your Name *</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Icon name="user" size={15} color={colors.mutedForeground} />
          <TextInput
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Your full name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Recipient's Name *</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Icon name="user" size={15} color={colors.mutedForeground} />
          <TextInput
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Who is this call for?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Phone Number *</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Icon name="phone" size={15} color={colors.mutedForeground} />
          <TextInput
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            placeholder="+91 XXXXXXXXXX"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Occasion *</Text>
        <View style={styles.chipRow}>
          {OCCASIONS.map((oc) => (
            <TouchableOpacity
              key={oc}
              onPress={() => setOccasion(oc)}
              style={[
                styles.chip,
                { borderColor: occasion === oc ? colors.primary : colors.border },
                occasion === oc && { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={[styles.chipText, { color: occasion === oc ? colors.primary : colors.mutedForeground }]}>{oc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>When to Make the Call</Text>

        <View style={styles.timingToggle}>
          {(['now', 'later'] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setCallTiming(opt)}
              style={[
                styles.timingBtn,
                { borderColor: callTiming === opt ? colors.primary : colors.border },
                callTiming === opt && { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Icon
                name={opt === 'now' ? 'phone-call' : 'calendar'}
                size={15}
                color={callTiming === opt ? colors.primary : colors.mutedForeground}
              />
              <Text numberOfLines={1} style={[styles.timingBtnText, { color: callTiming === opt ? colors.primary : colors.mutedForeground }]}>
                {opt === 'now' ? 'Call Now' : 'Schedule for Later'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {callTiming === 'later' && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Select Date</Text>
            <TouchableOpacity
              onPress={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
              style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Icon name="calendar" size={15} color={colors.mutedForeground} />
              <Text style={[styles.dateText, { color: selectedDate ? colors.foreground : colors.mutedForeground }]}>
                {selectedDate.label}
              </Text>
              <Icon name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showDatePicker && (
              <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {DATES.map((d) => (
                  <TouchableOpacity
                    key={d.dateStr}
                    onPress={() => { setSelectedDate(d); setShowDatePicker(false); }}
                    style={[
                      styles.pickerOption,
                      { borderBottomColor: colors.border },
                      selectedDate.dateStr === d.dateStr && { backgroundColor: colors.primary + '10' },
                    ]}
                  >
                    <Icon name="calendar" size={14} color={colors.primary} />
                    <Text style={[styles.pickerOptionText, { color: selectedDate.dateStr === d.dateStr ? colors.primary : colors.foreground }]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Select Time</Text>
            <TouchableOpacity
              onPress={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
              style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Icon name="clock" size={15} color={colors.mutedForeground} />
              <Text style={[styles.dateText, { color: colors.foreground }]}>{selectedTime}</Text>
              <Icon name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showTimePicker && (
              <View style={[styles.pickerDropdown, styles.timeDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                  {TIMES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => { setSelectedTime(t); setShowTimePicker(false); }}
                      style={[
                        styles.pickerOption,
                        { borderBottomColor: colors.border },
                        selectedTime === t && { backgroundColor: colors.primary + '10' },
                      ]}
                    >
                      <Icon name="clock" size={14} color={colors.primary} />
                      <Text style={[styles.pickerOptionText, { color: selectedTime === t ? colors.primary : colors.foreground }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personalization <Text style={[styles.optionalTag, { color: colors.mutedForeground }]}>(Optional)</Text></Text>

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Custom Message</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background, height: 90, alignItems: 'flex-start', paddingTop: 10 }]}>
          <TextInput
            value={customMessage}
            onChangeText={setCustomMessage}
            placeholder="Specific wishes, memories, or things to mention..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.textInput, { color: colors.foreground, textAlignVertical: 'top', flex: 1, width: '100%' }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Tone & Style</Text>
        <View style={styles.chipRow}>
          {TONES.map((t) => (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTone(tone === t.value ? '' : t.value)}
              style={[
                styles.chip,
                { borderColor: tone === t.value ? colors.primary : colors.border },
                tone === t.value && { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={[styles.chipText, { color: tone === t.value ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Relationship to Recipient</Text>
        <View style={styles.chipRow}>
          {RELATIONSHIPS.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setRelationship(relationship === r.value ? '' : r.value)}
              style={[
                styles.chip,
                { borderColor: relationship === r.value ? colors.primary : colors.border },
                relationship === r.value && { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={[styles.chipText, { color: relationship === r.value ? colors.primary : colors.mutedForeground }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Language</Text>
        <View style={styles.chipRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.value}
              onPress={() => setLanguage(l.value)}
              style={[
                styles.chip,
                { borderColor: language === l.value ? colors.primary : colors.border },
                language === l.value && { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={[styles.chipText, { color: language === l.value ? colors.primary : colors.mutedForeground }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Things to Avoid</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={thingsToAvoid}
            onChangeText={setThingsToAvoid}
            placeholder="Topics or phrases to exclude..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Additional Context</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background, height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
          <TextInput
            value={additionalContext}
            onChangeText={setAdditionalContext}
            placeholder="Any extra info about the recipient..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.textInput, { color: colors.foreground, textAlignVertical: 'top', flex: 1, width: '100%' }]}
          />
        </View>
      </View>

      <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.pricingTitle, { color: colors.foreground }]}>Pricing Summary</Text>
        <View style={styles.pricingRow}>
          <Text style={[styles.pricingLabel, { color: colors.mutedForeground }]}>Voice call price</Text>
          <Text style={[styles.pricingValue, { color: colors.foreground }]}>₹{basePrice.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.pricingRow}>
          <View style={styles.discountRow}>
            <Text style={[styles.pricingLabel, { color: colors.mutedForeground }]}>Discount</Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{DISCOUNT_PCT}% OFF</Text>
            </View>
          </View>
          <Text style={[styles.pricingValue, { color: '#22C55E' }]}>-₹{discountAmt}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.pricingRow}>
          <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>₹{finalPrice.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={[styles.pricingLabel, { color: colors.mutedForeground }]}>Wallet Balance</Text>
          <Text style={[styles.pricingValue, { color: MOCK_WALLET >= finalPrice ? '#22C55E' : '#EF4444' }]}>
            ₹{MOCK_WALLET.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {callError && (
        <View style={[styles.callErrorBanner, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
          <Icon name="alert-circle" size={16} color="#EF4444" />
          <Text style={[styles.callErrorText, { color: '#EF4444' }]}>{callError}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleMakeCall}
        disabled={submitting}
        activeOpacity={0.85}
        style={[styles.callBtnWrap, submitting && { opacity: 0.7 }]}
      >
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callCTA}>
          {submitting ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.callCTAText}>Initiating...</Text>
            </>
          ) : (
            <>
              <Icon name="phone" size={18} color="#fff" />
              <Text style={styles.callCTAText}>Make Call</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}


export default function VoiceCallScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 24;

  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 50 });

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);

  const handleSelectCeleb = (c: Celebrity) => {
    setSelectedCeleb(c);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedCeleb(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#FF6B33', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={styles.headerTitle}>Celebrity Voice Calls</Text>
        <Text style={styles.headerSub}>Book a live 1-on-1 call with your favourite star</Text>
      </LinearGradient>

      <View style={[styles.stepBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabelText, {
            color: step === 1 ? colors.primary : colors.mutedForeground,
            fontFamily: step === 1 ? 'Inter_700Bold' : 'Inter_400Regular',
          }]}>
            Select Celebrity
          </Text>
          <Text style={[styles.stepLabelText, {
            color: step === 2 ? colors.primary : colors.mutedForeground,
            fontFamily: step === 2 ? 'Inter_700Bold' : 'Inter_400Regular',
          }]}>
            Call Details
          </Text>
        </View>
        <StepIndicator step={step} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <CelebSelectGrid
            celebrities={celebrities}
            loading={loading}
            error={error}
            onRetry={refetch}
            search={search}
            setSearch={setSearch}
            onSelect={handleSelectCeleb}
            colors={colors}
          />
        ) : selectedCeleb ? (
          <CallDetailsForm
            celeb={selectedCeleb}
            onBack={handleBack}
            colors={colors}
            bottomPad={bottomPad}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)' },

  stepBarWrap: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stepLabelText: { fontSize: 13 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },

  scrollContent: { padding: 16, gap: 14 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  celebCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', paddingBottom: 10 },
  celebAvatarWrap: { position: 'relative' },
  celebAvatar: { width: 48, height: 48, alignSelf: 'center', marginTop: 12, borderRadius: 24 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: (CARD_W - 48) / 2 - 2,
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#fff',
  },
  celebInfo: { paddingHorizontal: 10, paddingTop: 8, gap: 2 },
  celebNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  celebName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  verifiedBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  celebCat: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  rateText: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  errorWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12, paddingHorizontal: 20 },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  errorSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  selectedCeleb: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  selectedAvatar: { width: 56, height: 56, borderRadius: 28 },
  selectedName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  selectedCat: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  selectedRate: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  formContent: { gap: 14 },
  formSection: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  optionalTag: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46,
  },
  textInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  dateText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },

  timingToggle: { flexDirection: 'row', gap: 10 },
  timingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden',
  },
  timingBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },

  pickerDropdown: { borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: 'hidden' },
  timeDropdown: {},
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  pickerOptionText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  pricingCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 10 },
  pricingTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  pricingValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  discountBadge: { backgroundColor: '#22C55E20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  discountText: { color: '#22C55E', fontSize: 11, fontFamily: 'Inter_700Bold' },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 },
  totalValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },

  callErrorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12,
  },
  callErrorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },

  callBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  callCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  callCTAText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  successCard: {
    borderRadius: 20, borderWidth: 1, padding: 28,
    alignItems: 'center', gap: 14,
  },
  successIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  successMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  successMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'stretch',
  },
  successMetaText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  successAvatar: { width: 28, height: 28, borderRadius: 14 },
  bookAnotherBtnWrap: { borderRadius: 12, overflow: 'hidden', alignSelf: 'stretch', marginTop: 6 },
  bookAnotherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  bookAnotherText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
