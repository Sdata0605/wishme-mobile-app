import { SheetBackdrop } from '@/components/SheetBackdrop';
import React, { useEffect, useRef, useState } from 'react';
import { useAgentPrefill } from '@/context/AgentStateContext';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serviceColors as C } from './serviceColors';
import {
  ArrowRight,
  ArrowRightLeft,
  Bus,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Clock,
  Headphones,
  Info,
  MapPin,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
  X,
  BedDouble,
  Snowflake,
  Sparkles,
  Armchair,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { T, useThemedStyles, glass, dk, N, glassSheet } from './themed';
import { BrandFill } from './BrandFill';
import { P } from './bookingTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



const CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Goa',
  'Lucknow',
  'Indore',
  'Nagpur',
  'Coimbatore',
  'Chandigarh',
];

// ─── Date helpers ────────────────────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function nextDays(count: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d);
  }
  return out;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// ─── City picker modal ───────────────────────────────────────────────────────
function CityPicker({
  visible,
  title,
  selected,
  exclude,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selected: string;
  exclude?: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const md = use_md();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={md.backdrop}>
        <SheetBackdrop onPress={onClose} />
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {CITIES.filter((c) => c !== exclude).map((city) => (
              <TouchableOpacity
                key={city}
                style={md.row}
                onPress={() => {
                  onSelect(city);
                  onClose();
                }}
              >
                <View style={md.cityIcon}>
                  <MapPin size={16} color={T(P.purple, 'fg')} />
                </View>
                <Text style={md.cityText}>{city}</Text>
                {selected === city && <Check size={18} color={T(P.purple, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Date picker modal ───────────────────────────────────────────────────────
function DatePicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const md = use_md();
  const days = nextDays(14);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={md.backdrop}>
        <SheetBackdrop onPress={onClose} />
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>Journey date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={md.row}
                onPress={() => {
                  onSelect(d);
                  onClose();
                }}
              >
                <View style={md.cityIcon}>
                  <Calendar size={16} color={T(P.purple, 'fg')} />
                </View>
                <Text style={md.cityText}>
                  {formatDate(d)}
                  {i === 0 ? '  ·  Today' : i === 1 ? '  ·  Tomorrow' : ''}
                </Text>
                {sameDay(selected, d) && <Check size={18} color={T(P.purple, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const make_md = () => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    ...glassSheet(),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  cityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
});
const use_md = () => useThemedStyles(make_md);

// ─── Search card ─────────────────────────────────────────────────────────────
/** The bus-type filters the results screen understands. */
export type BusType = 'any' | 'ac' | 'sleeper' | 'seater' | 'luxury';

const BUS_TYPE_CHIPS: { key: BusType; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'ac', label: 'AC' },
  { key: 'sleeper', label: 'Sleeper' },
  { key: 'seater', label: 'Seater' },
  { key: 'luxury', label: 'Luxury' },
];

/** A route or bus type picked further down the page, put into the form; `n` changes on every tap. */
interface FormPreset {
  from?: string;
  to?: string;
  type?: BusType;
  n: number;
}

function shortDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function dayYear(d: Date) {
  return `${d.toLocaleDateString('en-IN', { weekday: 'short' })}, ${d.getFullYear()}`;
}

function SearchCard({
  onSearch,
  preset,
}: {
  onSearch: (from: string, to: string, dateLabel: string, busType?: BusType) => void;
  preset: FormPreset | null;
}) {
  const sc = use_sc();
  const agentPrefill = useAgentPrefill();
  const [from, setFrom] = useState(agentPrefill.busFrom || 'Mumbai');
  const [to, setTo] = useState(agentPrefill.busTo || 'Pune');
  const [date, setDate] = useState(() => new Date());
  const [busType, setBusType] = useState<BusType>('any');
  const [picker, setPicker] = useState<'from' | 'to' | 'date' | null>(null);

  useEffect(() => {
    if (agentPrefill.busFrom) setFrom(agentPrefill.busFrom);
    if (agentPrefill.busTo) setTo(agentPrefill.busTo);
  }, [agentPrefill.busFrom, agentPrefill.busTo]);

  useEffect(() => {
    if (!preset) return;
    if (preset.from) setFrom(preset.from);
    if (preset.to) setTo(preset.to);
    if (preset.type) setBusType(preset.type);
  }, [preset?.n]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <View style={sc.wrap}>
      {/* From / To */}
      <View style={sc.routeRow}>
        <TouchableOpacity style={[sc.box, sc.half]} onPress={() => setPicker('from')} activeOpacity={0.7}>
          <Text style={sc.label}>FROM</Text>
          <Text style={sc.big} numberOfLines={1}>{from}</Text>
          <Text style={sc.sub} numberOfLines={1}>Any boarding point</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sc.box, sc.half, sc.halfRight]} onPress={() => setPicker('to')} activeOpacity={0.7}>
          <Text style={sc.label}>TO</Text>
          <Text style={sc.big} numberOfLines={1}>{to}</Text>
          <Text style={sc.sub} numberOfLines={1}>Any drop point</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={sc.swapBtn}
          onPress={swap}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Swap origin and destination"
        >
          <ArrowRightLeft size={16} color={T(P.purple, 'fg')} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* Date */}
      <TouchableOpacity style={[sc.box, sc.dateBox]} onPress={() => setPicker('date')} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={sc.label}>DATE OF JOURNEY</Text>
          <Text style={sc.line} numberOfLines={1}>
            <Text style={sc.big}>{shortDate(date)}</Text>
            <Text style={sc.light}>  {dayYear(date)}</Text>
          </Text>
        </View>
        <View style={sc.dayChips}>
          {[
            { label: 'Today', d: today },
            { label: 'Tomorrow', d: tomorrow },
          ].map(({ label, d }) => {
            const on = sameDay(date, d);
            return (
              <TouchableOpacity
                key={label}
                style={[sc.dayChip, on && sc.dayChipOn]}
                onPress={() => setDate(new Date(d))}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              >
                <Text style={[sc.dayChipText, on && sc.dayChipTextOn]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>

      {/* Bus type */}
      <Text style={sc.sectionLabel}>BUS TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.chips} style={sc.chipScroller}>
        {BUS_TYPE_CHIPS.map((t) => {
          const active = busType === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[sc.chip, active && sc.chipActive]}
              activeOpacity={0.8}
              onPress={() => setBusType(t.key)}
            >
              {active && <Check size={12} color={T(P.purple, 'fg')} strokeWidth={3} />}
              <Text style={[sc.chipText, active && sc.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Travelling as a woman */}
      <View style={sc.option}>
        <View style={sc.womenDot} />
        <View style={{ flex: 1 }}>
          <Text style={sc.optionTitle}>Travelling as a woman?</Text>
          <Text style={sc.optionSub}>Seats reserved for women are marked in pink on the seat map.</Text>
        </View>
        <View style={sc.optionArt} pointerEvents="none">
          <Users size={18} color={T(P.purple, 'fg')} />
        </View>
      </View>

      {/* Note */}
      <View style={sc.consent}>
        <Info size={14} color={T(C.textLight, 'fg')} />
        <Text style={sc.consentText}>
          Fares are set by bus operators. Boarding and drop points, and each operator's cancellation policy, are shown
          before you pay.
        </Text>
      </View>

      <TouchableOpacity style={sc.searchBtn} activeOpacity={0.85} onPress={() => onSearch(from, to, formatDate(date), busType)}>
        <LinearGradient
          pointerEvents="none"
          colors={['#8B5CF6', P.purpleDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BrandFill />
        <View style={sc.searchArt} pointerEvents="none">
          <Bus size={40} color="rgba(255,255,255,0.12)" />
        </View>
        <Text style={sc.searchText}>SEARCH BUSES</Text>
        <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      <CityPicker
        visible={picker === 'from'}
        title="Select departure city"
        selected={from}
        exclude={to}
        onSelect={setFrom}
        onClose={() => setPicker(null)}
      />
      <CityPicker
        visible={picker === 'to'}
        title="Select destination city"
        selected={to}
        exclude={from}
        onSelect={setTo}
        onClose={() => setPicker(null)}
      />
      <DatePicker
        visible={picker === 'date'}
        selected={date}
        onSelect={setDate}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const make_sc = () => StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 14 },
  box: {
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...glass(12),
  },
  routeRow: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  halfRight: { paddingLeft: 20 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg'), letterSpacing: 0.5 },
  line: { marginTop: 3 },
  big: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 3 },
  light: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  swapBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: dk(N().surfaceHigh, C.white),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.purple,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dayChips: { flexDirection: 'row', gap: 6 },
  dayChip: {
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: dk(N().surfaceHigh, C.white),
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayChipOn: { backgroundColor: T(P.purple, 'bg'), borderColor: T(P.purple, 'border') },
  dayChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  dayChipTextOn: { color: '#FFFFFF' },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  chipScroller: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { borderColor: T(P.purple, 'border'), borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  chipTextActive: { color: T(P.purple, 'fg'), fontFamily: 'Inter_700Bold' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingLeft: 12,
    paddingRight: 58,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    ...glass(12),
  },
  optionArt: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  womenDot: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: T(C.pinkBg, 'bg'),
    borderWidth: 1.5,
    borderColor: T(C.pinkBorder, 'border'),
  },
  optionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  optionSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  consent: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  consentText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    overflow: 'hidden',
    shadowColor: P.purple,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  searchArt: { position: 'absolute', right: 16, top: 2 },
  searchText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
});
const use_sc = () => useThemedStyles(make_sc);

// ─── Page content ────────────────────────────────────────────────────────────
const BUS_PHOTOS = {
  redHighway: require('../../assets/images/bus-poster-1.jpg'),
  cityNight: require('../../assets/images/bus-poster-2.jpg'),
  mountain: require('../../assets/images/bus-poster-3.jpg'),
  nightSleeper: require('../../assets/images/bus-poster-4.jpg'),
  station: require('../../assets/images/bus-poster-5.jpg'),
  coast: require('../../assets/images/bus-poster-6.jpg'),
  boarding: require('../../assets/images/bus-poster-7.jpg'),
  sunsetCoach: require('../../assets/images/seat-bus-hero.jpg'),
  hills: require('../../assets/images/travel-bus.jpg'),
  luxury: require('../../assets/images/travel-luxury-bus.jpg'),
};

const ROUTES = [
  { from: 'Mumbai', to: 'Pune', price: '₹349', time: '3h 30m', photo: BUS_PHOTOS.redHighway },
  { from: 'Delhi', to: 'Jaipur', price: '₹449', time: '5h 15m', photo: BUS_PHOTOS.sunsetCoach },
  { from: 'Bengaluru', to: 'Chennai', price: '₹549', time: '6h 00m', photo: BUS_PHOTOS.cityNight },
  { from: 'Hyderabad', to: 'Bengaluru', price: '₹699', time: '8h 30m', photo: BUS_PHOTOS.nightSleeper },
  { from: 'Mumbai', to: 'Goa', price: '₹799', time: '11h 00m', photo: BUS_PHOTOS.coast },
];

const TYPE_TILES: { type: BusType; title: string; sub: string; Icon: typeof Bus }[] = [
  { type: 'sleeper', title: 'Sleeper', sub: 'Lie-flat berths for night trips', Icon: BedDouble },
  { type: 'ac', title: 'AC Seater', sub: 'Cool, reclining seats', Icon: Snowflake },
  { type: 'luxury', title: 'Luxury', sub: 'Volvo & multi-axle coaches', Icon: Sparkles },
  { type: 'seater', title: 'Seater', sub: 'Budget day journeys', Icon: Armchair },
];

const OPERATORS = [
  { name: 'RedLine Travels', note: 'Sleeper & luxury', photo: BUS_PHOTOS.redHighway },
  { name: 'BlueWave Express', note: 'On-time city routes', photo: BUS_PHOTOS.cityNight },
  { name: 'GreenGo Coaches', note: 'Hill & ghat routes', photo: BUS_PHOTOS.mountain },
  { name: 'NightRider Sleepers', note: 'Overnight berths', photo: BUS_PHOTOS.nightSleeper },
  { name: 'Coastal Kings', note: 'Coastal routes', photo: BUS_PHOTOS.coast },
];

const TRUST = [
  { Icon: ShieldCheck, title: 'Verified operators', sub: 'Checked buses' },
  { Icon: Ticket, title: 'M-ticket', sub: 'Show it on your phone' },
  { Icon: Headphones, title: '24×7 support', sub: 'We are here to help' },
];

const WISHME_MARK = require('../../assets/images/wishme-mark.png');
const TILE_W = (SCREEN_WIDTH - 32 - 10) / 2;

// ─── Bus Tickets Screen ──────────────────────────────────────────────────────
export function BusTicketsScreen({
  onBack,
  onSearch,
  onOpenMyTickets,
}: {
  onBack: () => void;
  onSearch: (from: string, to: string, dateLabel: string, busType?: BusType) => void;
  onOpenMyTickets?: () => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [preset, setPreset] = useState<FormPreset | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const putInForm = (p: Omit<FormPreset, 'n'>) => {
    setPreset((prev) => ({ ...p, n: (prev?.n ?? 0) + 1 }));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={st.root}>
      {/* Top bar */}
      <View style={[st.topBar, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Back">
          <ChevronLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={st.topRight}>
          {onOpenMyTickets && (
            <TouchableOpacity style={st.myTickets} onPress={onOpenMyTickets} activeOpacity={0.8}>
              <Ticket size={13} color={T(P.purple, 'fg')} />
              <Text style={st.myTicketsText}>My Tickets</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/support')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Help and support"
          >
            <CircleQuestionMark size={24} color={T(C.text, 'fg')} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {/* Title */}
        <View style={st.hero}>
          <View style={st.heroIcon}>
            <LinearGradient
              pointerEvents="none"
              colors={['#8B5CF6', P.purpleDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Bus size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.heroTitle}>Bus Tickets</Text>
            <View style={st.poweredRow}>
              <Text style={st.poweredBy}>Powered By</Text>
              <Image source={WISHME_MARK} style={st.mark} resizeMode="contain" />
              <Text style={st.brand}>WISHME</Text>
            </View>
          </View>
        </View>

        <SearchCard onSearch={onSearch} preset={preset} />

        {/* Trust */}
        <View style={st.trust}>
          {TRUST.map(({ Icon, title, sub }, i) => (
            <React.Fragment key={title}>
              {i > 0 && <View style={st.trustDivider} />}
              <View style={st.trustItem}>
                <View style={st.trustIcon}>
                  <Icon size={15} color={T(P.purple, 'fg')} />
                </View>
                <Text style={st.trustTitle}>{title}</Text>
                <Text style={st.trustSub}>{sub}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Popular routes */}
        <Text style={st.heading}>Popular bus routes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hRow}>
          {ROUTES.map((r) => (
            <TouchableOpacity
              key={`${r.from}-${r.to}`}
              style={st.routeCard}
              activeOpacity={0.9}
              onPress={() => putInForm({ from: r.from, to: r.to })}
            >
              <View style={st.routePhoto}>
                <Image source={r.photo} style={st.routeImg} resizeMode="cover" />
                <View style={st.durTag}>
                  <Clock size={10} color="#111827" />
                  <Text style={st.durTagText}>{r.time}</Text>
                </View>
              </View>
              <View style={st.routeBody}>
                <View style={st.routeCities}>
                  <Text style={st.routeCity} numberOfLines={1}>{r.from}</Text>
                  <ArrowRight size={12} color={T(C.textLight, 'fg')} />
                  <Text style={st.routeCity} numberOfLines={1}>{r.to}</Text>
                </View>
                <View style={st.routePriceRow}>
                  <Text style={st.routeFrom}>from</Text>
                  <Text style={st.routePrice}>{r.price}</Text>
                  <Text style={st.routeDaily}>· daily buses</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bus types */}
        <Text style={st.heading}>Browse by bus type</Text>
        <View style={st.grid}>
          {TYPE_TILES.map((t) => (
            <TouchableOpacity key={t.title} style={st.tile} activeOpacity={0.88} onPress={() => putInForm({ type: t.type })}>
              <View style={st.tileIcon}>
                <t.Icon size={18} color={T(P.purple, 'fg')} />
              </View>
              <View style={st.tileBody}>
                <Text style={st.tileTitle}>{t.title}</Text>
                <Text style={st.tileSub} numberOfLines={1}>{t.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Operators */}
        <Text style={st.heading}>Top bus operators</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hRow}>
          {OPERATORS.map((o) => (
            <View key={o.name} style={st.opCard}>
              <Image source={o.photo} style={st.opImg} resizeMode="cover" />
              <Text style={st.opName} numberOfLines={1}>{o.name}</Text>
              <Text style={st.opNote} numberOfLines={1}>{o.note}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Offer */}
        <Text style={st.heading}>Offers for you</Text>
        <View style={st.offer}>
          <View style={st.offerPhoto}>
            <Image source={BUS_PHOTOS.boarding} style={st.offerImg} resizeMode="cover" />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
              locations={[0.25, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={st.offerPill}>
              <Text style={st.offerPillText}>BUS</Text>
            </View>
            <View style={st.offerCaption}>
              <View style={st.offerKicker}>
                <Text style={st.offerKickerText}>ON BUS TICKETS:</Text>
              </View>
              <Text style={st.offerTitle}>FLAT 10% OFF*</Text>
              <Text style={st.offerSub}>on AC, sleeper and luxury buses</Text>
            </View>
          </View>
          <View style={st.offerTerms}>
            <Tag size={14} color={T(C.textLight, 'fg')} />
            <View style={st.offerDivider} />
            <Text style={st.offerTermsText} numberOfLines={1}>Use code BUS10 at checkout · T&C apply</Text>
          </View>
          <TouchableOpacity
            style={st.offerFooter}
            activeOpacity={0.8}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          >
            <Text style={st.offerBook}>Book Now</Text>
            <ChevronRight size={20} color={T(C.blue, 'fg')} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Help */}
        <TouchableOpacity style={st.helpRow} activeOpacity={0.8} onPress={() => router.push('/support')}>
          <View style={st.trustIcon}>
            <Headphones size={16} color={T(P.purple, 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.helpTitle}>Need help with a trip?</Text>
            <Text style={st.helpSub}>Boarding, cancellations and refunds — we're here 24×7</Text>
          </View>
          <ChevronRight size={18} color={T(C.textLight, 'fg')} />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.white, 'page') },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  myTickets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  myTicketsText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(P.purple, 'fg') },
  content: { paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 4 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  poweredRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  poweredBy: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginRight: 6 },
  mark: { width: 16, height: 16, marginRight: 3 },
  brand: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg'), letterSpacing: 0.5 },
  trust: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    ...glass(12),
  },
  trustItem: { flex: 1, alignItems: 'center' },
  trustDivider: { width: 1, backgroundColor: T(P.lavenderBorder, 'bg'), marginVertical: 4 },
  trustIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trustTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), textAlign: 'center' },
  trustSub: { fontSize: 9.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), textAlign: 'center', marginTop: 1 },
  heading: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  hRow: { paddingHorizontal: 16, gap: 10 },
  routeCard: {
    width: 200,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dk(N().cardBorder, P.lavenderBorder),
    backgroundColor: dk(N().surface, C.white),
  },
  routePhoto: { width: 200, height: 110, overflow: 'hidden', backgroundColor: T(C.lightGray, 'bg') },
  routeImg: { position: 'absolute', top: 0, left: 0, width: 200, height: 110 },
  durTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durTagText: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: '#111827' },
  routeBody: { padding: 10, backgroundColor: dk(N().surface, C.white) },
  routeCities: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeCity: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: dk(N().textHi, C.text) },
  routePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  routeFrom: { fontSize: 10, fontFamily: 'Inter_400Regular', color: dk(N().textLo, C.textLight) },
  routePrice: { fontSize: 14, fontFamily: 'Inter_700Bold', color: dk(N().success, C.greenDark) },
  routeDaily: { fontSize: 10, fontFamily: 'Inter_400Regular', color: dk(N().textLo, C.textLight) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tile: {
    width: TILE_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dk(N().cardBorder, P.lavenderBorder),
    backgroundColor: dk(N().surface, P.lavender),
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { flex: 1 },
  tileTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: dk(N().textHi, C.text) },
  tileSub: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: dk(N().textLo, C.textLight), marginTop: 1 },
  opCard: { width: 140 },
  opImg: { width: 140, height: 90, borderRadius: 12, backgroundColor: T(C.lightGray, 'bg') },
  opName: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 6 },
  opNote: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  offer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dk(N().cardBorder, C.border),
    backgroundColor: dk(N().surface, C.white),
  },
  offerPhoto: { height: Math.round((SCREEN_WIDTH - 32) * 0.46), overflow: 'hidden', backgroundColor: T(C.dark, 'bg') },
  offerImg: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH - 32, height: Math.round((SCREEN_WIDTH - 32) * 0.46) },
  offerPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPillText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.6 },
  offerCaption: { position: 'absolute', left: 0, right: 12, bottom: 10 },
  offerKicker: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 3,
    marginBottom: 5,
  },
  offerKickerText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.2 },
  offerTitle: { color: '#FFFFFF', fontSize: 24, fontFamily: 'Inter_700Bold', paddingLeft: 12, letterSpacing: 0.2 },
  offerSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontFamily: 'Inter_500Medium', paddingLeft: 12, marginTop: 1 },
  offerTerms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  offerDivider: { width: 1, height: 18, backgroundColor: T(C.border, 'bg') },
  offerTermsText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  offerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  offerBook: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg') },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    ...glass(12),
  },
  helpTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  helpSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
});
const use_st = () => useThemedStyles(make_st);
