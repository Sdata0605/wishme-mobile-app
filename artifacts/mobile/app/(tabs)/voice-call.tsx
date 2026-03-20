import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { Icon } from '@/components/Icon';
import { CELEBRITIES, Celebrity } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 52) / 2;

const OCCASIONS = ['Birthday', 'Anniversary', 'Motivation', 'Wedding', 'Corporate', 'Graduation', 'Festival'];
const TONES = ['Warm & Loving', 'Funny', 'Motivational', 'Inspirational'] as const;
const LANGUAGES = ['Hindi', 'English', 'Telugu', 'Tamil', 'Bengali', 'Punjabi', 'Marathi'];

const MOCK_WALLET = 3250;
const MOCK_CALL_MINUTES = 5;
const DISCOUNT_PCT = 10;

function StepIndicator({ step }: { step: 1 | 2 }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepRow}>
      {([1, 2] as const).map((n) => {
        const done = step > n;
        const active = step === n;
        return (
          <React.Fragment key={n}>
            <View style={[styles.stepCircle,
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
  search, setSearch, onSelect, colors,
}: {
  search: string;
  setSearch: (s: string) => void;
  onSelect: (c: Celebrity) => void;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
}) {
  const filtered = CELEBRITIES.filter(
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
              <Text style={[styles.rateText, { color: colors.primary }]}>₹{celeb.ratePerMinute}/min</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function CallDetailsForm({
  celeb,
  onBack,
  onCall,
  colors,
  bottomPad,
}: {
  celeb: Celebrity;
  onBack: () => void;
  onCall: () => void;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
  bottomPad: number;
}) {
  const [occasion, setOccasion] = useState('Birthday');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('Warm & Loving');
  const [lang, setLang] = useState('Hindi');
  const [schedDate, setSchedDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const basePrice = celeb.ratePerMinute * MOCK_CALL_MINUTES;
  const discountAmt = Math.round((basePrice * DISCOUNT_PCT) / 100);
  const finalPrice = basePrice - discountAmt;

  const mockDates = ['Today, 6:00 PM', 'Tomorrow, 10:00 AM', 'Tomorrow, 4:00 PM', 'Mar 22, 9:00 AM'];

  return (
    <ScrollView
      contentContainerStyle={[styles.formContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Icon name="arrow-left" size={18} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Change Celebrity</Text>
      </TouchableOpacity>

      <View style={[styles.selectedCeleb, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={{ uri: celeb.imageUrl }} style={styles.selectedAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedName, { color: colors.foreground }]}>{celeb.name}</Text>
          <Text style={[styles.selectedCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
          <Text style={[styles.selectedRate, { color: colors.primary }]}>₹{celeb.ratePerMinute}/min · {MOCK_CALL_MINUTES} min call</Text>
        </View>
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Occasion</Text>
        <View style={styles.chipRow}>
          {OCCASIONS.map((oc) => (
            <TouchableOpacity
              key={oc}
              onPress={() => setOccasion(oc)}
              style={[styles.chip, { borderColor: occasion === oc ? colors.primary : colors.border },
                occasion === oc && { backgroundColor: colors.primary + '18' }]}
            >
              <Text style={[styles.chipText, { color: occasion === oc ? colors.primary : colors.mutedForeground }]}>{oc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Recipient Name</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Who is this call for?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Special Message</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background, height: 90, alignItems: 'flex-start', paddingTop: 10 }]}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Any specific message or topic for the call..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.textInput, { color: colors.foreground, textAlignVertical: 'top', flex: 1, width: '100%' }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Tone</Text>
        <View style={styles.toneGroup}>
          {TONES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTone(t)}
              style={[styles.toneOption]}
            >
              <View style={[styles.radioOuter, { borderColor: tone === t ? colors.primary : colors.border }]}>
                {tone === t && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.toneLabel, { color: tone === t ? colors.foreground : colors.mutedForeground }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Schedule Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Icon name="calendar" size={15} color={colors.mutedForeground} />
          <Text style={[styles.dateText, { color: schedDate ? colors.foreground : colors.mutedForeground }]}>
            {schedDate || 'Select date & time'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={[styles.dateDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {mockDates.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => { setSchedDate(d); setShowDatePicker(false); }}
                style={[styles.dateOption, { borderBottomColor: colors.border }]}
              >
                <Icon name="clock" size={14} color={colors.primary} />
                <Text style={[styles.dateOptionText, { color: colors.foreground }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Language</Text>
        <View style={styles.chipRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLang(l)}
              style={[styles.chip, { borderColor: lang === l ? colors.primary : colors.border },
                lang === l && { backgroundColor: colors.primary + '18' }]}
            >
              <Text style={[styles.chipText, { color: lang === l ? colors.primary : colors.mutedForeground }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.pricingTitle, { color: colors.foreground }]}>Pricing Summary</Text>
        <View style={styles.pricingRow}>
          <Text style={[styles.pricingLabel, { color: colors.mutedForeground }]}>
            Base price ({MOCK_CALL_MINUTES} min × ₹{celeb.ratePerMinute})
          </Text>
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

      <TouchableOpacity onPress={onCall} activeOpacity={0.85} style={styles.callBtnWrap}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callCTA}>
          <Icon name="phone" size={18} color="#fff" />
          <Text style={styles.callCTAText}>Make Call</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CallModal({
  visible,
  celeb,
  onEnd,
}: {
  visible: boolean;
  celeb: Celebrity | null;
  onEnd: () => void;
}) {
  const { colors } = useTheme();
  const [callState, setCallState] = useState<'connecting' | 'in-progress'>('connecting');
  const [seconds, setSeconds] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPulse = useCallback(() => {
    if (pulseRef.current) {
      pulseRef.current.stop();
      pulseRef.current = null;
    }
  }, []);

  const startPulse = useCallback(() => {
    stopPulse();
    pulseAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulseRef.current = loop;
    loop.start();
  }, [pulseAnim, stopPulse]);

  useEffect(() => {
    if (visible) {
      setCallState('connecting');
      setSeconds(0);
      startPulse();
      const t = setTimeout(() => setCallState('in-progress'), 2500);
      return () => clearTimeout(t);
    } else {
      stopPulse();
    }
  }, [visible, startPulse, stopPulse]);

  useEffect(() => {
    if (callState === 'in-progress') {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(0);
    }
  }, [visible]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!celeb) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onEnd}>
      <LinearGradient colors={['#1a0030', '#0d0020']} style={styles.modalBg}>
        <View style={styles.modalContent}>
          <Text style={styles.modalStatus}>
            {callState === 'connecting' ? 'Connecting...' : 'Call in Progress'}
          </Text>

          <View style={styles.modalAvatarWrap}>
            <Animated.View style={[styles.pulseBg, {
              transform: [{ scale: pulseAnim }],
              opacity: callState === 'connecting' ? 0.5 : 0,
            }]} />
            <Image source={{ uri: celeb.imageUrl }} style={styles.modalAvatar} />
          </View>

          <Text style={styles.modalCelebName}>{celeb.name}</Text>
          <Text style={styles.modalCelebCat}>{celeb.category}</Text>

          {callState === 'in-progress' ? (
            <View style={styles.timerWrap}>
              <Icon name="clock" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.timerText}>{formatTime(seconds)}</Text>
            </View>
          ) : (
            <View style={styles.connectingDots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
          )}

          <View style={styles.modalActions}>
            <View style={styles.actionCol}>
              <TouchableOpacity style={[styles.circleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Icon name="volume-x" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Mute</Text>
            </View>
            <View style={styles.actionCol}>
              <TouchableOpacity onPress={onEnd} style={[styles.circleBtn, { backgroundColor: '#EF4444' }]}>
                <Icon name="phone-off" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>End Call</Text>
            </View>
            <View style={styles.actionCol}>
              <TouchableOpacity style={[styles.circleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Icon name="volume-2" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Speaker</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

export default function VoiceCallScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 24;

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [callVisible, setCallVisible] = useState(false);

  const handleSelectCeleb = (c: Celebrity) => {
    setSelectedCeleb(c);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedCeleb(null);
  };

  const handleCall = () => setCallVisible(true);
  const handleEndCall = () => setCallVisible(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>Celebrity Voice Calls</Text>
        <Text style={styles.headerSub}>Book a live 1-on-1 call with your favourite star</Text>
      </LinearGradient>

      <View style={[styles.stepBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabelText, { color: step === 1 ? colors.primary : colors.mutedForeground, fontFamily: step === 1 ? 'Inter_700Bold' : 'Inter_400Regular' }]}>
            Select Celebrity
          </Text>
          <Text style={[styles.stepLabelText, { color: step === 2 ? colors.primary : colors.mutedForeground, fontFamily: step === 2 ? 'Inter_700Bold' : 'Inter_400Regular' }]}>
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
            search={search}
            setSearch={setSearch}
            onSelect={handleSelectCeleb}
            colors={colors}
          />
        ) : selectedCeleb ? (
          <CallDetailsForm
            celeb={selectedCeleb}
            onBack={handleBack}
            onCall={handleCall}
            colors={colors}
            bottomPad={bottomPad}
          />
        ) : null}
      </ScrollView>

      <CallModal visible={callVisible} celeb={selectedCeleb} onEnd={handleEndCall} />
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

  scrollContent: { padding: 16, gap: 12 },

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

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  selectedCeleb: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  selectedAvatar: { width: 56, height: 56, borderRadius: 28 },
  selectedName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  selectedCat: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  selectedRate: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  formContent: { gap: 14 },
  formSection: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46,
  },
  textInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  dateText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  dateDropdown: {
    borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: 'hidden',
  },
  dateOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  dateOptionText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  toneGroup: { gap: 10 },
  toneOption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 9, height: 9, borderRadius: 4.5 },
  toneLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },

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

  callBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  callCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  callCTAText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  modalBg: { flex: 1 },
  modalContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  modalStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_500Medium' },
  modalAvatarWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  pulseBg: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#FF6B33' },
  modalAvatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#fff' },
  modalCelebName: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  modalCelebCat: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999 },
  timerText: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  connectingDots: { flexDirection: 'row', gap: 8, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  modalActions: { flexDirection: 'row', gap: 32, marginTop: 20 },
  actionCol: { alignItems: 'center', gap: 8 },
  circleBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter_500Medium' },
});
