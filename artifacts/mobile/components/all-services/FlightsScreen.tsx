import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  ArrowRightLeft,
  Armchair,
  Briefcase,
  Crown,
  Sofa,
  CalendarDays,
  Check,
  CircleQuestionMark,
  GraduationCap,
  Info,
  Stethoscope,
  TrendingDown,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Plane,
  Plus,
  Route,
  ShieldCheck,
  Tag,
  X,
  Zap,
} from 'lucide-react-native';

import { serviceColors as C } from './serviceColors';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { T, useThemedStyles, glass, dk, N } from './themed';
import { BrandFill } from './BrandFill';
import { P } from './bookingTheme';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Offer carousel ──────────────────────────────────────────────────────────
interface Banner {
  /** The short white tag above the headline, e.g. "For international trips:". */
  kicker: string;
  title: string;
  sub: string;
  /** The fine print in the strip under the photo. */
  terms: string;
  image: any;
  /** The destination "Book Now" fills in, when the offer is for one place. */
  to?: string;
}

const BANNER_W = SCREEN_WIDTH - 32;
const AUTO_SCROLL_MS = 4000;

const BANNERS: Banner[] = [
  {
    kicker: 'For international trips:',
    title: 'Fly business class',
    sub: 'Business class upgrades on sale',
    terms: 'Valid on select international routes · T&C apply',
    image: require('../../assets/images/flight-banner-premium-cabin.jpg'),
  },
  {
    kicker: 'Limited time:',
    title: 'Up to ₹1,500 off*',
    sub: 'on domestic & international flights',
    terms: 'Use code WISHFLY at checkout · T&C apply',
    image: require('../../assets/images/flight-banner-flight-sale.jpg'),
  },
  {
    kicker: 'Singapore special:',
    title: 'From ₹18,999*',
    sub: 'round trips to Singapore',
    terms: 'Fares vary by date and availability',
    image: require('../../assets/images/flight-banner-singapore-offer.jpg'),
    to: 'SIN',
  },
  {
    kicker: 'Discover Egypt:',
    title: 'From ₹24,499*',
    sub: 'fares to Cairo',
    terms: 'Fares vary by date and availability',
    image: require('../../assets/images/flight-banner-egypt-offer.jpg'),
    to: 'CAI',
  },
  {
    kicker: 'Beach getaways:',
    title: 'From ₹4,999*',
    sub: 'island hops to Goa and beyond',
    terms: 'Fares vary by date and availability',
    image: require('../../assets/images/flight-banner-beach-getaway.jpg'),
    to: 'GOI',
  },
  {
    kicker: 'International getaways:',
    title: 'Explore the world',
    sub: 'top destinations, one flight away',
    terms: 'Compare fares across leading airlines',
    image: require('../../assets/images/flight-banner-international-travel.jpg'),
  },
  {
    kicker: 'Family holidays:',
    title: 'Magical adventures',
    sub: 'flights for theme-park trips',
    terms: 'Child and infant fares available',
    image: require('../../assets/images/flight-banner-disney-adventure.jpg'),
  },
  {
    kicker: 'Book early:',
    title: 'Window seat views',
    sub: 'pick your favourite seat',
    terms: 'Seat selection on eligible fares',
    image: require('../../assets/images/flight-banner-airplane-window.jpg'),
  },
  {
    kicker: 'Fly with the best:',
    title: 'Top airlines',
    sub: 'at great fares',
    terms: 'Compare fares across leading airlines',
    image: require('../../assets/images/flight-banner-airline-brand.jpg'),
  },
  {
    kicker: 'Ready for takeoff:',
    title: 'Instant e-ticket',
    sub: 'confirmation right after booking',
    terms: 'E-ticket sent by email and in My Trips',
    image: require('../../assets/images/flight-banner-airplane-takeoff.jpg'),
  },
];

function BannerCarousel({ onBook }: { onBook: (b: Banner) => void }) {
  const bn = use_bn();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const draggingRef = useRef(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 10));
    if (p !== pageRef.current) {
      pageRef.current = p;
      setPage(p);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (draggingRef.current) return;
      const next = (pageRef.current + 1) % BANNERS.length;
      scrollRef.current?.scrollTo({ x: next * (BANNER_W + 10), animated: true });
      pageRef.current = next;
      setPage(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={bn.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={BANNER_W + 10}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={bn.row}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          draggingRef.current = false;
        }}
        scrollEventThrottle={16}
      >
        {BANNERS.map((b) => (
          <TouchableOpacity key={b.title} style={bn.card} activeOpacity={0.92} onPress={() => onBook(b)}>
            <View style={bn.photo}>
              <Image source={b.image} style={bn.image} resizeMode="cover" />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
                locations={[0.25, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={bn.pill}>
                <Text style={bn.pillText}>FLIGHTS</Text>
              </View>
              <View style={bn.caption}>
                <View style={bn.kicker}>
                  <Text style={bn.kickerText}>{b.kicker.toUpperCase()}</Text>
                </View>
                <Text style={bn.title} numberOfLines={1}>{b.title.toUpperCase()}</Text>
                <Text style={bn.sub} numberOfLines={1}>{b.sub}</Text>
              </View>
            </View>
            <View style={bn.terms}>
              <Tag size={14} color={T(C.textLight, 'fg')} />
              <View style={bn.termsDivider} />
              <Text style={bn.termsText} numberOfLines={1}>{b.terms}</Text>
            </View>
            <View style={bn.footer}>
              <Text style={bn.bookText}>Book Now</Text>
              <ChevronRight size={20} color={T(C.blue, 'fg')} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={bn.dots}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[bn.dot, i === page ? bn.dotActive : bn.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

const make_bn = () => StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { paddingHorizontal: 16, gap: 10, paddingBottom: 6 },
  card: {
    width: BANNER_W,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: dk(N().surface, C.white),
    borderWidth: 1,
    borderColor: dk(N().cardBorder, C.border),
  },
  photo: { height: Math.round(BANNER_W * 0.46), backgroundColor: T(C.dark, 'bg') },
  image: { width: '100%', height: '100%' },
  pill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.6 },
  caption: { position: 'absolute', left: 0, right: 12, bottom: 10 },
  kicker: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 3,
    marginBottom: 5,
  },
  kickerText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.2 },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    paddingLeft: 12,
    letterSpacing: 0.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    paddingLeft: 12,
    marginTop: 1,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  termsDivider: { width: 1, height: 18, backgroundColor: T(C.border, 'bg') },
  termsText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  bookText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg') },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  dot: { height: 5, borderRadius: 3 },
  dotActive: { width: 16, backgroundColor: T(C.blue, 'bg') },
  dotInactive: { width: 5, backgroundColor: T('#D1D5DB', 'bg') },
});
const use_bn = () => useThemedStyles(make_bn);

// ─── Trip type selector ──────────────────────────────────────────────────────
type TripType = 'oneWay' | 'roundTrip' | 'multiCity';

const TRIP_TYPES: { key: TripType; label: string }[] = [
  { key: 'oneWay', label: 'One way' },
  { key: 'roundTrip', label: 'Roundtrip' },
  { key: 'multiCity', label: 'Multicity' },
];


function TripTypeSelector({
  value,
  onChange,
}: {
  value: TripType;
  onChange: (t: TripType) => void;
}) {
  const tt = use_tt();
  return (
    <View style={tt.track}>
      {TRIP_TYPES.map((t) => {
        const selected = value === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[tt.segment, selected && tt.segmentActive]}
            activeOpacity={0.8}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            {selected && (
              <LinearGradient
                pointerEvents="none"
                colors={[P.purple, P.purpleDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {selected && <BrandFill />}
            <Text style={[tt.label, selected && tt.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const make_tt = () => StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    overflow: 'hidden',
  },
  segmentActive: {
    shadowColor: P.purple,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  labelActive: { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
});
const use_tt = () => useThemedStyles(make_tt);

// ─── Search form ─────────────────────────────────────────────────────────────
const CITIES = [
  { code: 'DEL', city: 'New Delhi', airport: 'Indira Gandhi International' },
  { code: 'BOM', city: 'Mumbai', airport: 'Chhatrapati Shivaji International' },
  { code: 'BLR', city: 'Bengaluru', airport: 'Kempegowda International' },
  { code: 'HYD', city: 'Hyderabad', airport: 'Rajiv Gandhi International' },
  { code: 'MAA', city: 'Chennai', airport: 'Chennai International' },
  { code: 'CCU', city: 'Kolkata', airport: 'Netaji Subhas Chandra Bose' },
  { code: 'GOI', city: 'Goa', airport: 'Dabolim Airport' },
  { code: 'SIN', city: 'Singapore', airport: 'Changi Airport' },
  { code: 'DXB', city: 'Dubai', airport: 'Dubai International' },
  { code: 'CAI', city: 'Cairo', airport: 'Cairo International' },
];

// ─── Calendar helpers ────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date | null, b: Date | null) {
  return (
    !!a && !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatDate(d: Date) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
function toIsoDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const TBO_CABIN_CLASS: Record<CabinKey, number> = {
  economy: 2,
  premiumEconomy: 3,
  business: 4,
  first: 6,
};
function formatDay(d: Date) {
  return DAY_FULL[d.getDay()];
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function MonthCalendar({
  selected,
  minDate,
  onPick,
}: {
  selected: Date | null;
  minDate: Date;
  onPick: (d: Date) => void;
}) {
  const cal = use_cal();
  const initial = selected && selected >= minDate ? selected : minDate;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());

  const canGoPrev =
    year > minDate.getFullYear() ||
    (year === minDate.getFullYear() && month > minDate.getMonth());

  const goPrev = () => {
    if (!canGoPrev) return;
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cal.wrap}>
      <View style={cal.headerRow}>
        <TouchableOpacity
          style={[cal.navBtn, !canGoPrev && cal.navBtnDisabled]}
          onPress={goPrev}
          disabled={!canGoPrev}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={canGoPrev ? T(C.text, 'fg') : T(C.gray, 'fg')} />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity style={cal.navBtn} onPress={goNext} activeOpacity={0.7}>
          <ChevronRight size={18} color={T(C.text, 'fg')} />
        </TouchableOpacity>
      </View>
      <View style={cal.weekRow}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={cal.weekDay}>
            {d}
          </Text>
        ))}
      </View>
      <View style={cal.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={cal.cell} />;
          const disabled = d < minDate;
          const active = sameDay(d, selected);
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, active && cal.cellActive]}
              disabled={disabled}
              activeOpacity={0.7}
              onPress={() => onPick(d)}
            >
              <Text
                style={[
                  cal.cellText,
                  disabled && cal.cellTextDisabled,
                  active && cal.cellTextActive,
                ]}
              >
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const make_cal = () => StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    padding: 10,
    backgroundColor: T(C.white, 'bg'),
   ...glass(18), },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  navBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellActive: { backgroundColor: T(C.blue, 'bg') },
  cellText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  cellTextDisabled: { color: T('#D1D5DB', 'fg') },
  cellTextActive: { color: T(C.white, 'fg'), fontFamily: 'Inter_700Bold' },
});
const use_cal = () => useThemedStyles(make_cal);

// ─── Travellers picker ───────────────────────────────────────────────────────
interface TravellerCounts {
  adults: number;
  children: number;
  infants: number;
}

function travellersLabel(t: TravellerCounts) {
  const parts: string[] = [];
  parts.push(`${t.adults} Adult${t.adults !== 1 ? 's' : ''}`);
  if (t.children > 0) parts.push(`${t.children} Child${t.children !== 1 ? 'ren' : ''}`);
  if (t.infants > 0) parts.push(`${t.infants} Infant${t.infants !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

function NumSelector({
  value,
  onChange,
  min,
  max,
  overflow,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  overflow: string; // e.g. ">9"
}) {
  const tp = use_tp();
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tp.numRow}
    >
      {items.map((n) => {
        const active = value === n;
        return (
          <TouchableOpacity
            key={n}
            style={[tp.numBtn, active && tp.numBtnActive]}
            activeOpacity={0.7}
            onPress={() => onChange(n)}
          >
            <Text style={[tp.numText, active && tp.numTextActive]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={tp.numBtn} activeOpacity={0.7}>
        <Text style={tp.numText}>{overflow}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TravellersPicker({
  initial,
  onApply,
}: {
  initial: TravellerCounts;
  onApply: (t: TravellerCounts) => void;
}) {
  const tp = use_tp();
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [infants, setInfants] = useState(initial.infants);

  return (
    <View style={tp.wrap}>
      {/* Adults */}
      <Text style={tp.label}>ADULTS (12y +)</Text>
      <Text style={tp.hint}>on the day of travel</Text>
      <NumSelector value={adults} onChange={setAdults} min={1} max={9} overflow=">9" />

      {/* Children + Infants side by side */}
      <View style={tp.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={tp.label}>CHILDREN (2y – 12y)</Text>
          <Text style={tp.hint}>on the day of travel</Text>
          <NumSelector value={children} onChange={setChildren} min={0} max={6} overflow=">6" />
        </View>
        <View style={tp.colDivider} />
        <View style={{ flex: 1 }}>
          <Text style={tp.label}>INFANTS (below 2y)</Text>
          <Text style={tp.hint}>on the day of travel</Text>
          <NumSelector value={infants} onChange={setInfants} min={0} max={6} overflow=">6" />
        </View>
      </View>

      <TouchableOpacity
        style={tp.applyBtn}
        activeOpacity={0.85}
        onPress={() => onApply({ adults, children, infants })}
      ><BrandFill />
        <Text style={tp.applyText}>APPLY</Text>
      </TouchableOpacity>
    </View>
  );
}

const make_tp = () => StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    padding: 14,
    backgroundColor: T(C.white, 'bg'),
   ...glass(18), },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    marginTop: 8,
  },
  hint: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginBottom: 6,
  },
  numRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  numBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  numBtnActive: { backgroundColor: T(C.blue, 'bg'), borderColor: T(C.blue, 'border') },
  numText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  numTextActive: { color: T(C.white, 'fg') },
  twoCol: { flexDirection: 'row', marginTop: 8, gap: 10 },
  colDivider: { width: 1, backgroundColor: T(C.border, 'bg'), marginTop: 4 },
  applyBtn: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: T(C.blue, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
   overflow: 'hidden', },
  applyText: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
});
const use_tp = () => useThemedStyles(make_tp);

// ─── Cabin class picker ──────────────────────────────────────────────────────
type CabinKey = 'economy' | 'premiumEconomy' | 'business' | 'first';

interface CabinOption {
  key: CabinKey;
  label: string;
  emoji: string;
  perks: string[];
}

const CABIN_OPTIONS: CabinOption[] = [
  { key: 'economy', label: 'Economy', emoji: '🪑', perks: ['Best value fares'] },
  {
    key: 'premiumEconomy',
    label: 'Premium Economy',
    emoji: '💺',
    perks: ['Extra Legroom', 'Extra Baggage', 'Premium Meals'],
  },
  {
    key: 'business',
    label: 'Business Class',
    emoji: '🛋️',
    perks: ['Luxury Lounges', 'Cabin Comfort', 'Premium Dining'],
  },
  {
    key: 'first',
    label: 'First Class',
    emoji: '👑',
    perks: ['Private Suites', 'Fine Dining', 'Highly Personalised Service'],
  },
];

function cabinLabel(k: CabinKey) {
  return CABIN_OPTIONS.find((c) => c.key === k)?.label ?? 'Economy';
}

function CabinClassPicker({
  value,
  onChange,
}: {
  value: CabinKey;
  onChange: (k: CabinKey) => void;
}) {
  const cb = use_cb();
  return (
    <View style={cb.wrap}>
      {CABIN_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[cb.card, active && cb.cardActive]}
            activeOpacity={0.8}
            onPress={() => onChange(opt.key)}
          >
            <View style={cb.cardLeft}>
              <View style={cb.radioOuter}>
                {active && <View style={cb.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cb.cardTitle, active && cb.cardTitleActive]}>{opt.label}</Text>
                {opt.perks.length > 0 && (
                  <Text style={cb.perk}>{opt.perks.join(' · ')}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const make_cb = () => StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: T(C.white, 'bg'),
   ...glass(18), },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  cardActive: { backgroundColor: T(C.blueLight, 'bg'), borderBottomColor: T(C.blue, 'border') },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: T(C.gray, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: T(C.blue, 'bg') },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  cardTitleActive: { color: T(C.blue, 'fg') },
  perksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  perk: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 3 },
  emoji: { fontSize: 28, marginLeft: 8 },
});
const use_cb = () => useThemedStyles(make_cb);

type PickerTarget = 'from' | 'to' | 'departure' | 'return' | 'travellers' | 'cabin' | null;

/** A route picked from "Popular routes"; `n` changes on every tap so picking the same route twice still applies. */
interface RoutePreset {
  /** null clears the origin when it would equal the new destination. */
  from?: number | null;
  to?: number;
  cabin?: CabinKey;
  n: number;
}

function AirportBox({
  label,
  city,
  placeholder,
  align,
  active,
  onPress,
}: {
  label: string;
  city: (typeof CITIES)[number] | null;
  placeholder: string;
  align: 'left' | 'right';
  active: boolean;
  onPress: () => void;
}) {
  const sf = use_sf();
  return (
    <TouchableOpacity
      style={[sf.box, sf.airportBox, align === 'right' && sf.airportBoxRight, active && sf.boxActive]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityLabel={`${label}: ${city ? `${city.city}, ${city.code}` : placeholder}`}
    >
      <Text style={sf.fieldLabel}>{label}</Text>
      {city ? (
        <>
          <Text style={sf.valueLine} numberOfLines={1}>
            <Text style={sf.cityText}>{city.city}</Text>
            <Text style={sf.codeText}>  {city.code}</Text>
          </Text>
          <Text style={sf.fieldSub} numberOfLines={1}>{city.airport}</Text>
        </>
      ) : (
        <>
          <Text style={[sf.cityText, sf.placeholder]} numberOfLines={1}>{placeholder}</Text>
          <Text style={sf.fieldSub} numberOfLines={1}>Tap to choose airport</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const CABIN_SHORT: Record<CabinKey, string> = {
  economy: 'Economy',
  premiumEconomy: 'Prem. Economy',
  business: 'Business',
  first: 'First Class',
};

// ─── Multi-city legs ─────────────────────────────────────────────────────────
const MAX_LEGS = 5;
/** Days between one flight and the next when a flight is added or a date pushes the next one back. */
const LEG_GAP_DAYS = 3;

interface Leg {
  from: number | null;
  to: number | null;
  date: Date;
}

type LegField = 'from' | 'to' | 'date';

function MultiCityLegs({
  legs,
  onChange,
  minDate,
  problem,
}: {
  legs: Leg[];
  onChange: (legs: Leg[]) => void;
  minDate: Date;
  /** The leg the last failed search complained about, outlined in red. */
  problem: number | null;
}) {
  const mc = use_mc();
  const [open, setOpen] = useState<{ leg: number; field: LegField } | null>(null);

  const update = (i: number, patch: Partial<Leg>) => {
    const next = legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
    // A flight's city chain: the next flight leaves from where this one lands, unless the traveller set it already.
    if (patch.to !== undefined && next[i + 1] && next[i + 1].from === null) next[i + 1] = { ...next[i + 1], from: patch.to };
    // Keep the dates in order: a later flight can never leave before an earlier one.
    for (let j = i + 1; j < next.length; j++) {
      if (next[j].date < next[j - 1].date) next[j] = { ...next[j], date: next[j - 1].date };
    }
    onChange(next);
  };

  const addLeg = () => {
    const last = legs[legs.length - 1];
    onChange([...legs, { from: last.to, to: null, date: addDays(last.date, LEG_GAP_DAYS) }]);
    setOpen({ leg: legs.length, field: last.to === null ? 'from' : 'to' });
  };

  const removeLeg = (i: number) => {
    onChange(legs.filter((_, j) => j !== i));
    setOpen(null);
  };

  const toggle = (leg: number, field: LegField) =>
    setOpen(open && open.leg === leg && open.field === field ? null : { leg, field });

  const codes = legs.reduce<string[]>((acc, l, i) => {
    const f = l.from !== null ? CITIES[l.from].code : '---';
    const t = l.to !== null ? CITIES[l.to].code : '---';
    if (i === 0) acc.push(f);
    else if (acc[acc.length - 1] !== f) acc.push(f);
    acc.push(t);
    return acc;
  }, []);
  const first = legs[0].date;
  const last = legs[legs.length - 1].date;

  return (
    <View>
      {legs.map((leg, i) => {
        const from = leg.from !== null ? CITIES[leg.from] : null;
        const to = leg.to !== null ? CITIES[leg.to] : null;
        const isOpen = (f: LegField) => open?.leg === i && open.field === f;
        return (
          <View key={i} style={[mc.legCard, problem === i && mc.legCardProblem]}>
            <View style={mc.legHead}>
              <View style={mc.legBadge}>
                <Text style={mc.legBadgeText}>{i + 1}</Text>
              </View>
              <Text style={mc.legTitle}>FLIGHT {i + 1}</Text>
              {from && to && (
                <Text style={mc.legRoute} numberOfLines={1}>
                  {from.city} to {to.city}
                </Text>
              )}
              <View style={{ flex: 1 }} />
              {legs.length > 2 && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => removeLeg(i)}
                  accessibilityLabel={`Remove flight ${i + 1}`}
                >
                  <X size={15} color={T(C.textLight, 'fg')} />
                </TouchableOpacity>
              )}
            </View>
            <View style={mc.legRow}>
              <TouchableOpacity
                style={[mc.cell, isOpen('from') && mc.cellActive]}
                activeOpacity={0.7}
                onPress={() => toggle(i, 'from')}
              >
                <Text style={mc.cellLabel}>FROM</Text>
                <Text style={[mc.cellCode, !from && mc.cellPlaceholder]}>{from ? from.code : 'Select'}</Text>
                <Text style={mc.cellSub} numberOfLines={1}>{from ? from.city : 'Origin'}</Text>
              </TouchableOpacity>
              <ArrowRight size={14} color={T(P.purpleSoft, 'fg')} />
              <TouchableOpacity
                style={[mc.cell, isOpen('to') && mc.cellActive]}
                activeOpacity={0.7}
                onPress={() => toggle(i, 'to')}
              >
                <Text style={mc.cellLabel}>TO</Text>
                <Text style={[mc.cellCode, !to && mc.cellPlaceholder]}>{to ? to.code : 'Select'}</Text>
                <Text style={mc.cellSub} numberOfLines={1}>{to ? to.city : 'Destination'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mc.cell, mc.dateCell, isOpen('date') && mc.cellActive]}
                activeOpacity={0.7}
                onPress={() => toggle(i, 'date')}
              >
                <Text style={mc.cellLabel}>DATE</Text>
                <Text style={mc.cellCode}>{shortDate(leg.date)}</Text>
                <Text style={mc.cellSub}>{shortDay(leg.date)}, {leg.date.getFullYear()}</Text>
              </TouchableOpacity>
            </View>
            {(isOpen('from') || isOpen('to')) && (
              <CityPicker
                title={`Flight ${i + 1}: ${isOpen('from') ? 'flying from' : 'flying to'}`}
                exclude={(isOpen('from') ? leg.to : leg.from) ?? -1}
                onPick={(c) => {
                  update(i, isOpen('from') ? { from: c } : { to: c });
                  setOpen(null);
                }}
              />
            )}
            {isOpen('date') && (
              <MonthCalendar
                selected={leg.date}
                minDate={i === 0 ? minDate : legs[i - 1].date}
                onPick={(d) => {
                  update(i, { date: d });
                  setOpen(null);
                }}
              />
            )}
          </View>
        );
      })}

      {legs.length < MAX_LEGS ? (
        <TouchableOpacity style={mc.addBtn} activeOpacity={0.8} onPress={addLeg}>
          <Plus size={15} color={T(P.purple, 'fg')} strokeWidth={2.5} />
          <Text style={mc.addText}>ADD ANOTHER FLIGHT</Text>
          <Text style={mc.addHint}>{MAX_LEGS - legs.length} more allowed</Text>
        </TouchableOpacity>
      ) : (
        <Text style={mc.maxNote}>You have added the maximum of {MAX_LEGS} flights.</Text>
      )}

      {/* Trip summary */}
      <View style={mc.summary}>
        <View style={mc.summaryHead}>
          <Route size={14} color={T(P.purple, 'fg')} />
          <Text style={mc.summaryTitle}>Your trip</Text>
          <Text style={mc.summaryMeta}>
            {legs.length} flights · {shortDate(first)}
            {sameDay(first, last) ? '' : ` – ${shortDate(last)}`}
          </Text>
        </View>
        <Text style={mc.summaryRoute} numberOfLines={2}>{codes.join('  →  ')}</Text>
        <View style={mc.summaryNote}>
          <Info size={12} color={T(C.textLight, 'fg')} />
          <Text style={mc.summaryNoteText}>
            Each flight is priced on its own. Baggage, cancellation and change rules can differ between flights.
          </Text>
        </View>
      </View>
    </View>
  );
}

const make_mc = () => StyleSheet.create({
  legCard: {
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    ...glass(12),
  },
  legCardProblem: { borderColor: T(C.red, 'border'), borderWidth: 1.5 },
  legHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  legBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T(P.purple, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  legBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  legTitle: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), letterSpacing: 0.6 },
  legRoute: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cell: {
    flex: 1,
    backgroundColor: dk(N().surfaceHigh, C.white),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dateCell: { flex: 1.1 },
  cellActive: { borderColor: T(P.purple, 'border'), borderWidth: 1.5 },
  cellLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg'), letterSpacing: 0.5 },
  cellCode: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 2 },
  cellPlaceholder: { fontSize: 13, color: T('#A1A1AA', 'fg') },
  cellSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T(P.purpleSoft, 'border'),
    borderRadius: 12,
    paddingVertical: 11,
  },
  addText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg'), letterSpacing: 0.4 },
  addHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  maxNote: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), textAlign: 'center', paddingVertical: 6 },
  summary: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    padding: 10,
    backgroundColor: T(C.white, 'bg'),
    ...glass(12),
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  summaryMeta: { flex: 1, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  summaryRoute: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg'), marginTop: 6, letterSpacing: 0.4 },
  summaryNote: { flexDirection: 'row', gap: 5, marginTop: 6 },
  summaryNoteText: { flex: 1, fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
});
const use_mc = () => useThemedStyles(make_mc);

function SearchForm({
  tripType,
  onTripType,
  onSearch,
  initialSearch,
  preset,
}: {
  tripType: TripType;
  onTripType: (t: TripType) => void;
  onSearch?: (params: FlightSearchParams) => void;
  initialSearch?: FlightSearchParams;
  preset?: RoutePreset | null;
}) {
  const sf = use_sf();
  const agentPrefill = useAgentPrefill();
  const today = startOfDay(new Date());

  const getInitialIdx = (name?: string, defaultIdx = -1) => {
    if (!name) return defaultIdx;
    const lower = name.toLowerCase();
    const found = CITIES.findIndex((c) => lower.includes(c.city.toLowerCase()) || lower.includes(c.code.toLowerCase()));
    return found >= 0 ? found : defaultIdx;
  };

  const [fromIdx, setFromIdx] = useState<number | null>(() => {
    const city = initialSearch?.from || agentPrefill.fromCity;
    const idx = getInitialIdx(city, -1);
    return idx >= 0 ? idx : null;
  });
  const [toIdx, setToIdx] = useState<number | null>(() => {
    const city = initialSearch?.to || agentPrefill.toCity;
    const idx = getInitialIdx(city, -1);
    return idx >= 0 ? idx : null;
  });
  const [depDate, setDepDate] = useState<Date>(addDays(today, 2));
  const [retDate, setRetDate] = useState<Date>(addDays(today, 5));
  const [travellers, setTravellers] = useState<TravellerCounts>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<CabinKey>('economy');
  const [fare, setFare] = useState<string | null>(null);
  const [priceDrop, setPriceDrop] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [error, setError] = useState<string | null>(null);
  // Coming back from the results keeps the flights the traveller entered.
  const [legs, setLegs] = useState<Leg[]>(() =>
    (initialSearch?.legs ?? []).map((l) => {
      const f = CITIES.findIndex((c) => c.code === l.fromCode);
      const t = CITIES.findIndex((c) => c.code === l.toCode);
      const [y, m, d] = l.departDate.split('-').map(Number);
      return { from: f >= 0 ? f : null, to: t >= 0 ? t : null, date: new Date(y, m - 1, d) };
    }),
  );
  const [problemLeg, setProblemLeg] = useState<number | null>(null);

  // Multi-city starts from what is already in the one-way form: flight 1 is that route, flight 2 leaves from its destination.
  useEffect(() => {
    if (tripType !== 'multiCity' || legs.length > 0) return;
    setLegs([
      { from: fromIdx, to: toIdx, date: depDate },
      { from: toIdx, to: null, date: addDays(depDate, LEG_GAP_DAYS) },
    ]);
  }, [tripType]);

  useEffect(() => {
    const fromCity = initialSearch?.from || agentPrefill.fromCity;
    const toCity = initialSearch?.to || agentPrefill.toCity;
    if (fromCity) {
      const idx = getInitialIdx(fromCity, -1);
      if (idx >= 0) setFromIdx(idx);
    }
    if (toCity) {
      const idx = getInitialIdx(toCity, -1);
      if (idx >= 0) setToIdx(idx);
    }
    if (agentPrefill.cabin) {
      const lower = agentPrefill.cabin.toLowerCase();
      if (lower.includes('business')) setCabin('business');
      else if (lower.includes('first')) setCabin('first');
      else if (lower.includes('premium')) setCabin('premiumEconomy');
      else setCabin('economy');
    }
  }, [initialSearch?.from, initialSearch?.to, agentPrefill.fromCity, agentPrefill.toCity, agentPrefill.cabin]);

  useEffect(() => {
    if (!preset) return;
    if (preset.to !== undefined) {
      if (preset.from !== undefined && preset.from !== null) setFromIdx(preset.from);
      else if (fromIdx === preset.to) setFromIdx(null);
      setToIdx(preset.to);
    }
    if (preset.cabin) setCabin(preset.cabin);
    setPicker(null);
    setError(null);
  }, [preset?.n]);

  const from = fromIdx !== null && fromIdx >= 0 ? CITIES[fromIdx] : null;
  const to = toIdx !== null && toIdx >= 0 ? CITIES[toIdx] : null;
  const roundTrip = tripType === 'roundTrip';
  const travellerTotal = travellers.adults + travellers.children + travellers.infants;

  const swap = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };

  const togglePicker = (t: PickerTarget) => setPicker(picker === t ? null : t);

  const searchMultiCity = () => {
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (l.from === null || l.to === null) {
        setError(`Choose ${l.from === null ? 'where flight ' + (i + 1) + ' leaves from' : 'where flight ' + (i + 1) + ' lands'}`);
        setProblemLeg(i);
        return;
      }
      if (l.from === l.to) {
        setError(`Flight ${i + 1} leaves from and lands in the same city`);
        setProblemLeg(i);
        return;
      }
    }
    setError(null);
    setProblemLeg(null);
    const legParams: FlightLeg[] = legs.map((l) => {
      const f = CITIES[l.from as number];
      const t = CITIES[l.to as number];
      return {
        from: `${f.city} (${f.code})`,
        to: `${t.city} (${t.code})`,
        fromCode: f.code,
        toCode: t.code,
        departDate: toIsoDate(l.date),
        dateLabel: formatDate(l.date),
      };
    });
    const first = legParams[0];
    onSearch?.({
      from: first.from,
      to: first.to,
      dateLabel: first.dateLabel,
      travellers: travellersLabel(travellers),
      cabin: cabinLabel(cabin),
      fromCode: first.fromCode,
      toCode: first.toCode,
      departDate: first.departDate,
      adults: travellers.adults,
      children: travellers.children,
      infants: travellers.infants,
      cabinClass: TBO_CABIN_CLASS[cabin],
      fareType: fare ?? 'regular',
      priceDropProtection: priceDrop,
      legs: legParams,
    });
  };

  const search = () => {
    if (tripType === 'multiCity') return searchMultiCity();
    if (!from || !to) {
      setError(!from ? 'Choose the city you are flying from' : 'Choose where you are flying to');
      setPicker(!from ? 'from' : 'to');
      return;
    }
    setError(null);
    onSearch?.({
      from: `${from.city} (${from.code})`,
      to: `${to.city} (${to.code})`,
      dateLabel: formatDate(depDate),
      travellers: travellersLabel(travellers),
      cabin: cabinLabel(cabin),
      fromCode: from.code,
      toCode: to.code,
      departDate: toIsoDate(depDate),
      returnDate: roundTrip ? toIsoDate(retDate) : undefined,
      adults: travellers.adults,
      children: travellers.children,
      infants: travellers.infants,
      cabinClass: TBO_CABIN_CLASS[cabin],
      fareType: fare ?? 'regular',
      priceDropProtection: priceDrop,
    });
  };

  return (
    <View style={sf.wrap}>
      {tripType === 'multiCity' ? (
        legs.length > 0 && (
          <MultiCityLegs
            legs={legs}
            onChange={(l) => {
              setLegs(l);
              setError(null);
              setProblemLeg(null);
            }}
            minDate={today}
            problem={problemLeg}
          />
        )
      ) : (
        <>
      {/* From / To */}
      <View style={sf.routeRow}>
        <AirportBox
          label="FROM"
          city={from}
          placeholder="Departure"
          align="left"
          active={picker === 'from'}
          onPress={() => togglePicker('from')}
        />
        <AirportBox
          label="TO"
          city={to}
          placeholder="Destination"
          align="right"
          active={picker === 'to'}
          onPress={() => togglePicker('to')}
        />
        <TouchableOpacity
          style={sf.swapBtn}
          onPress={swap}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Swap origin and destination"
        >
          <ArrowRightLeft size={16} color={T(P.purple, 'fg')} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
      {(picker === 'from' || picker === 'to') && (
        <CityPicker
          title={picker === 'from' ? 'Flying from' : 'Flying to'}
          exclude={(picker === 'from' ? toIdx : fromIdx) ?? -1}
          onPick={(i) => {
            if (picker === 'from') setFromIdx(i);
            else setToIdx(i);
            setError(null);
            setPicker(null);
          }}
        />
      )}

      {/* Dates */}
      <View style={sf.pairRow}>
        <TouchableOpacity
          style={[sf.box, sf.dateBox, picker === 'departure' && sf.boxActive]}
          activeOpacity={0.7}
          onPress={() => togglePicker('departure')}
        >
          <View style={{ flex: 1 }}>
            <Text style={sf.fieldLabel}>DEPARTURE DATE</Text>
            <Text style={sf.valueLine} numberOfLines={1}>
              <Text style={sf.dateText}>{shortDate(depDate)}</Text>
              <Text style={sf.dateYear}>  {shortDay(depDate)}, {depDate.getFullYear()}</Text>
            </Text>
          </View>
          <CalendarDays size={18} color={T(P.purpleSoft, 'fg')} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[sf.box, sf.dateBox, picker === 'return' && sf.boxActive]}
          activeOpacity={0.7}
          onPress={() => {
            if (!roundTrip) onTripType('roundTrip');
            setPicker(picker === 'return' && roundTrip ? null : 'return');
          }}
        >
          {roundTrip ? (
            <View style={{ flex: 1 }}>
              <View style={sf.labelRow}>
                <Text style={[sf.fieldLabel, { flex: 1 }]}>RETURN DATE</Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    onTripType('oneWay');
                    if (picker === 'return') setPicker(null);
                  }}
                  accessibilityLabel="Remove return flight"
                >
                  <X size={13} color={T(C.textLight, 'fg')} />
                </TouchableOpacity>
              </View>
              <Text style={sf.valueLine} numberOfLines={1}>
                <Text style={sf.dateText}>{shortDate(retDate)}</Text>
                <Text style={sf.dateYear}>  {shortDay(retDate)}, {retDate.getFullYear()}</Text>
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Text style={sf.addReturnText}>+ ADD RETURN DATE</Text>
                <Text style={sf.addReturnSub}>Save more on round trips!</Text>
              </View>
              <CalendarDays size={22} color={T(P.purpleSoft, 'fg')} />
            </>
          )}
        </TouchableOpacity>
      </View>
      {picker === 'departure' && (
        <MonthCalendar
          selected={depDate}
          minDate={today}
          onPick={(d) => {
            setDepDate(d);
            if (retDate < d) setRetDate(d);
            setPicker(null);
          }}
        />
      )}
      {picker === 'return' && roundTrip && (
        <MonthCalendar
          selected={retDate}
          minDate={depDate}
          onPick={(d) => {
            setRetDate(d);
            setPicker(null);
          }}
        />
      )}
        </>
      )}

      {/* Traveller & class */}
      <TouchableOpacity
        style={[sf.box, sf.travellerBox, picker === 'travellers' && sf.boxActive]}
        activeOpacity={0.7}
        onPress={() => togglePicker('travellers')}
      >
        <View style={{ flex: 1 }}>
          <Text style={sf.fieldLabel}>TRAVELLER & CLASS</Text>
          <Text style={sf.valueLine} numberOfLines={1}>
            <Text style={sf.dateText}>{travellerTotal},</Text>
            <Text style={sf.travellerCabin}> {CABIN_SHORT[cabin]}</Text>
          </Text>
          <Text style={sf.fieldSub} numberOfLines={1}>{travellersLabel(travellers)}</Text>
        </View>
        <ChevronRight size={18} color={T(P.purple, 'fg')} />
      </TouchableOpacity>
      {picker === 'travellers' && (
        <>
          <CabinClassPicker value={cabin} onChange={setCabin} />
          <TravellersPicker
            initial={travellers}
            onApply={(t) => {
              setTravellers(t);
              setPicker(null);
            }}
          />
        </>
      )}


      <SpecialFares selected={fare} onSelect={(k) => setFare(fare === k ? null : k)} />

      {/* Price drop protection */}
      <TouchableOpacity
        style={sf.protect}
        activeOpacity={0.8}
        onPress={() => setPriceDrop(!priceDrop)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: priceDrop }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', T('#EDE7FE', 'bg')]}
          start={{ x: 0.45, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={sf.protectArt} pointerEvents="none">
          <Plane size={18} color={T(P.purple, 'fg')} strokeWidth={2} />
          <View style={sf.protectBadge}>
            <TrendingDown size={10} color="#FFFFFF" strokeWidth={3} />
          </View>
        </View>
        <View style={[sf.checkbox, priceDrop && sf.checkboxOn]}>
          {priceDrop && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={sf.labelRow}>
            <Text style={sf.protectTitle}>Add Price Drop Protection</Text>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() =>
                Alert.alert(
                  'Price Drop Protection',
                  'If the fare for the same flight, date and cabin drops after you book, WISHME refunds the difference. T&C apply.',
                )
              }
              accessibilityLabel="About Price Drop Protection"
            >
              <Info size={14} color={T(P.purple, 'fg')} />
            </TouchableOpacity>
          </View>
          <Text style={sf.protectSub}>Price drops, we'll refund the difference.</Text>
        </View>
      </TouchableOpacity>

      {/* Consent */}
      <View style={sf.consent}>
        <Info size={14} color={T(C.textLight, 'fg')} />
        <Text style={sf.consentText}>
          By clicking on search, you agree that WISHME and its partners may share your details for login and
          optimization.{' '}
          <Text
            style={sf.link}
            onPress={() =>
              Alert.alert(
                'Terms & Conditions',
                'Fares are set by airlines and can change until payment. Cancellation and change fees follow the airline fare rules shown before you pay. Convenience fees, if any, are shown at checkout.',
              )
            }
          >
            T&C
          </Text>{' '}
          apply.
        </Text>
      </View>

      {error && <Text style={sf.error}>{error}</Text>}

      {/* Search button */}
      <TouchableOpacity style={sf.searchBtn} activeOpacity={0.85} onPress={search}>
        <LinearGradient
          pointerEvents="none"
          colors={['#8B5CF6', P.purpleDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BrandFill />
        <View style={sf.searchArt} pointerEvents="none">
          <Plane size={42} color="rgba(255,255,255,0.12)" fill="rgba(255,255,255,0.12)" />
        </View>
        <Text style={sf.searchBtnText}>SEARCH FLIGHTS</Text>
        <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function shortDate(d: Date) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}
function shortDay(d: Date) {
  return DAY_NAMES[d.getDay()];
}

function CityPicker({
  title,
  exclude,
  onPick,
}: {
  title: string;
  exclude: number;
  onPick: (i: number) => void;
}) {
  const sf = use_sf();
  return (
    <View style={sf.cityList}>
      <Text style={sf.cityListTitle}>{title}</Text>
      {CITIES.map((c, i) =>
        i === exclude ? null : (
          <TouchableOpacity key={c.code} style={sf.cityItem} activeOpacity={0.7} onPress={() => onPick(i)}>
            <View style={sf.cityIcon}>
              <Plane size={14} color={T(P.purple, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sf.cityName}>{c.city}</Text>
              <Text style={sf.cityAirport} numberOfLines={1}>{c.airport}</Text>
            </View>
            <Text style={sf.cityCodeText}>{c.code}</Text>
          </TouchableOpacity>
        ),
      )}
    </View>
  );
}

const make_sf = () => StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 12 },
  box: {
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...glass(12),
  },
  boxActive: { borderColor: T(P.purple, 'border'), borderWidth: 1.5 },
  routeRow: { flexDirection: 'row', gap: 10 },
  airportBox: { flex: 1 },
  airportBoxRight: { paddingLeft: 20 },
  valueLine: { marginTop: 3 },
  cityText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  codeText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  placeholder: { color: T('#A1A1AA', 'fg'), marginTop: 3 },
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
  pairRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 64 },
  travellerBox: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    letterSpacing: 0.5,
  },
  fieldSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 3 },
  dateText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  dateYear: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  travellerCabin: { fontSize: 14, fontFamily: 'Inter_400Regular', color: T(C.text, 'fg') },
  addReturnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(P.purple, 'fg'), letterSpacing: 0.3 },
  addReturnSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(P.purple, 'fg'), marginTop: 3 },
  cityList: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: T(C.white, 'bg'),
    ...glass(14),
  },
  cityListTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T(C.lightGray, 'border'),
  },
  cityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityCodeText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.textLight, 'fg'), letterSpacing: 0.5 },
  cityName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  cityAirport: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  protect: {
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
    overflow: 'hidden',
    ...glass(14),
  },
  protectArt: {
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
  protectBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T(C.green, 'bg'),
    borderWidth: 1.5,
    borderColor: dk(N().surface, C.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: T('#71717A', 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  checkboxOn: { backgroundColor: T(P.purple, 'bg'), borderColor: T(P.purple, 'border') },
  protectTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  protectSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  consent: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  consentText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  link: { textDecorationLine: 'underline', color: T(C.text, 'fg'), fontFamily: 'Inter_500Medium' },
  error: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: T(C.red, 'fg'),
    marginTop: 14,
    textAlign: 'center',
  },
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
  searchArt: { position: 'absolute', right: 16, top: -2, transform: [{ rotate: '-20deg' }] },
  searchBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
});
const use_sf = () => useThemedStyles(make_sf);

// ─── Special fares ───────────────────────────────────────────────────────────
interface Fare {
  key: string;
  title: string;
  sub: string;
  Icon: typeof Plane;
  /** Shown when the fare is picked, so the traveller knows what to carry. */
  needs: string;
}

const FARES: Fare[] = [
  { key: 'student', title: 'Student', sub: 'Extra discounts/ baggage', Icon: GraduationCap, needs: 'Carry a valid student ID (12+ years)' },
  { key: 'seniorCitizen', title: 'Senior Citizen', sub: 'Up to ₹ 600 off', Icon: UserRound, needs: 'For travellers aged 60+ with age proof' },
  { key: 'armedForces', title: 'Armed Forces', sub: 'Up to ₹ 600 off', Icon: ShieldCheck, needs: 'Carry a valid service ID or dependant card' },
  { key: 'doctorNurses', title: 'Doctors & Nurses', sub: 'Up to ₹ 600 off', Icon: Stethoscope, needs: 'Carry a valid medical registration ID' },
];

function SpecialFares({ selected, onSelect }: { selected: string | null; onSelect: (k: string) => void }) {
  const fr = use_fr();
  const picked = FARES.find((f) => f.key === selected);
  return (
    <View style={fr.section}>
      <Text style={fr.heading}>SPECIAL FARES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fr.row}
        style={fr.scroller}
      >
        {FARES.map((f) => {
          const active = selected === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[fr.card, active && fr.cardActive]}
              activeOpacity={0.8}
              onPress={() => onSelect(f.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <View style={fr.iconWrap}>
                <f.Icon size={16} color={T(P.purple, 'fg')} />
              </View>
              {active && (
                <View style={fr.tick}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
              <Text style={fr.title} numberOfLines={1}>{f.title}</Text>
              <Text style={fr.sub} numberOfLines={2}>{f.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {picked && (
        <View style={fr.note}>
          <Info size={14} color={T(P.purple, 'fg')} />
          <Text style={fr.noteText}>{picked.needs}. It is checked at the airport.</Text>
        </View>
      )}
    </View>
  );
}

const make_fr = () => StyleSheet.create({
  section: { marginTop: 18 },
  heading: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  scroller: { marginHorizontal: -16 },
  row: { paddingHorizontal: 16, gap: 8 },
  card: {
    width: 108,
    minHeight: 108,
    backgroundColor: T(P.lavender, 'bg'),
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    borderRadius: 12,
    padding: 10,
    ...glass(12),
  },
  cardActive: { borderColor: T(P.purple, 'border'), borderWidth: 1.5 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T(P.purple, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sub: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  noteText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: T(P.purple, 'fg') },
});
const use_fr = () => useThemedStyles(make_fr);

// ─── Photos ──────────────────────────────────────────────────────────────────
const FLIGHT_PHOTOS = {
  takeoff: require('../../assets/images/flight-banner-airplane-takeoff.jpg'),
  window: require('../../assets/images/flight-banner-airplane-window.jpg'),
  airlines: require('../../assets/images/flight-banner-airline-brand.jpg'),
  aboveClouds: require('../../assets/images/travel-flights.jpg'),
  businessCabin: require('../../assets/images/flight-banner-premium-cabin.jpg'),
  beach: require('../../assets/images/flight-banner-beach-getaway.jpg'),
  singapore: require('../../assets/images/flight-banner-singapore-offer.jpg'),
  egypt: require('../../assets/images/flight-banner-egypt-offer.jpg'),
};

// ─── Trust strip ─────────────────────────────────────────────────────────────
const TRUST = [
  { Icon: ShieldCheck, title: 'Secure payments', sub: 'Encrypted checkout' },
  { Icon: Zap, title: 'Instant e-ticket', sub: 'Sent on booking' },
  { Icon: Headphones, title: '24×7 support', sub: 'We are here to help' },
];

function TrustStrip() {
  const tr = use_tr();
  return (
    <View style={tr.wrap}>
      {TRUST.map(({ Icon, title, sub }, i) => (
        <React.Fragment key={title}>
          {i > 0 && <View style={tr.divider} />}
          <View style={tr.item}>
            <View style={tr.iconWrap}>
              <Icon size={15} color={T(P.purple, 'fg')} />
            </View>
            <Text style={tr.title}>{title}</Text>
            <Text style={tr.sub}>{sub}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const make_tr = () => StyleSheet.create({
  wrap: {
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
  item: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: T(P.lavenderBorder, 'bg'), marginVertical: 4 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), textAlign: 'center' },
  sub: { fontSize: 9.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1, textAlign: 'center' },
});
const use_tr = () => useThemedStyles(make_tr);

// ─── Popular routes ──────────────────────────────────────────────────────────
const POPULAR_ROUTES: { from: string; to: string; photo: any; tag: string }[] = [
  { from: 'DEL', to: 'BOM', photo: FLIGHT_PHOTOS.takeoff, tag: 'Busiest route' },
  { from: 'BLR', to: 'DEL', photo: FLIGHT_PHOTOS.aboveClouds, tag: 'Business favourite' },
  { from: 'BOM', to: 'GOI', photo: FLIGHT_PHOTOS.beach, tag: 'Weekend getaway' },
  { from: 'HYD', to: 'BLR', photo: FLIGHT_PHOTOS.window, tag: 'Short hop' },
  { from: 'DEL', to: 'DXB', photo: FLIGHT_PHOTOS.airlines, tag: 'International' },
  { from: 'MAA', to: 'SIN', photo: FLIGHT_PHOTOS.singapore, tag: 'International' },
];

function PopularRoutes({ onPick }: { onPick: (from: number, to: number) => void }) {
  const pr = use_pr();
  return (
    <View>
      <Text style={pr.heading}>Popular routes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pr.row}>
        {POPULAR_ROUTES.map((r) => {
          const fi = CITIES.findIndex((c) => c.code === r.from);
          const ti = CITIES.findIndex((c) => c.code === r.to);
          return (
            <TouchableOpacity
              key={`${r.from}-${r.to}`}
              style={pr.card}
              activeOpacity={0.9}
              onPress={() => onPick(fi, ti)}
            >
              <View style={pr.photo}>
                <Image source={r.photo} style={pr.img} resizeMode="cover" />
                <View style={pr.tag}>
                  <Text style={pr.tagText}>{r.tag.toUpperCase()}</Text>
                </View>
              </View>
              <View style={pr.body}>
                <View style={pr.codes}>
                  <Text style={pr.code}>{r.from}</Text>
                  <Plane size={12} color={dk(N().textLo, C.textLight)} />
                  <Text style={pr.code}>{r.to}</Text>
                </View>
                <Text style={pr.cities} numberOfLines={1}>
                  {CITIES[fi].city} to {CITIES[ti].city}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Popular destinations ────────────────────────────────────────────────────
const DESTINATIONS: { code: string; tag: string; photo: any }[] = [
  { code: 'SIN', tag: 'Gardens & skyline', photo: FLIGHT_PHOTOS.singapore },
  { code: 'CAI', tag: 'Pyramids & the Nile', photo: FLIGHT_PHOTOS.egypt },
  { code: 'GOI', tag: 'Beaches & sunsets', photo: FLIGHT_PHOTOS.beach },
];

function PopularDestinations({ onPick }: { onPick: (to: number) => void }) {
  const pr = use_pr();
  return (
    <View>
      <Text style={pr.heading}>Popular destinations</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pr.row}>
        {DESTINATIONS.map((d) => {
          const ti = CITIES.findIndex((c) => c.code === d.code);
          return (
            <TouchableOpacity key={d.code} style={pr.dest} activeOpacity={0.88} onPress={() => onPick(ti)}>
              <Image source={d.photo} style={pr.destImg} resizeMode="cover" />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                start={{ x: 0, y: 0.35 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={pr.destCaption}>
                <Text style={pr.destCity}>{CITIES[ti].city}</Text>
                <Text style={pr.destTag} numberOfLines={1}>{d.tag}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Cabin classes ───────────────────────────────────────────────────────────
const CABIN_TILES: { key: CabinKey; title: string; sub: string; Icon: typeof Plane }[] = [
  { key: 'economy', title: 'Economy', sub: 'Best value fares', Icon: Armchair },
  { key: 'premiumEconomy', title: 'Premium Economy', sub: 'Extra legroom & baggage', Icon: Sofa },
  { key: 'business', title: 'Business', sub: 'Lounges & flat beds', Icon: Briefcase },
  { key: 'first', title: 'First Class', sub: 'Private suites', Icon: Crown },
];

function CabinTiles({ onPick }: { onPick: (k: CabinKey) => void }) {
  const pr = use_pr();
  return (
    <View>
      <Text style={pr.heading}>Fly your way</Text>
      <View style={pr.grid}>
        {CABIN_TILES.map((t) => (
          <TouchableOpacity key={t.key} style={pr.tile} activeOpacity={0.88} onPress={() => onPick(t.key)}>
            <View style={pr.tileIcon}>
              <t.Icon size={18} color={T(P.purple, 'fg')} />
            </View>
            <View style={pr.tileBody}>
              <Text style={pr.tileTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={pr.tileSub} numberOfLines={1}>{t.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const TILE_W = (SCREEN_WIDTH - 32 - 10) / 2;

const make_pr = () => StyleSheet.create({
  heading: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  row: { paddingHorizontal: 16, gap: 10 },
  card: {
    width: 190,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dk(N().cardBorder, P.lavenderBorder),
    backgroundColor: dk(N().surface, C.white),
  },
  photo: { width: 190, height: 105, overflow: 'hidden', backgroundColor: T(C.lightGray, 'bg') },
  img: { position: 'absolute', top: 0, left: 0, width: 190, height: 105 },
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { fontSize: 8.5, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: 0.4 },
  body: { padding: 10, backgroundColor: dk(N().surface, C.white) },
  codes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { fontSize: 15, fontFamily: 'Inter_700Bold', color: dk(N().textHi, C.text), letterSpacing: 0.4 },
  cities: { fontSize: 11, fontFamily: 'Inter_400Regular', color: dk(N().textLo, C.textLight), marginTop: 2 },
  dest: {
    width: 130,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T(C.lightGray, 'bg'),
  },
  destImg: { position: 'absolute', top: 0, left: 0, width: 130, height: 160 },
  destCaption: { position: 'absolute', left: 10, right: 8, bottom: 9 },
  destCity: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  destTag: { fontSize: 10, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.88)', marginTop: 1 },
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
});
const use_pr = () => useThemedStyles(make_pr);

// ─── Flights Screen ──────────────────────────────────────────────────────────
export interface FlightSearchParams {
  from: string;
  to: string;
  dateLabel: string;
  travellers: string;
  cabin: string;
  /** Machine-readable fields the TBO search API needs. */
  fromCode: string;
  toCode: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: number;
  /** The special fare picked on the search screen ('regular' when none). */
  fareType?: string;
  priceDropProtection?: boolean;
  /** Multi-city only: every flight of the trip, in order (2 to 5). The top-level route and date are flight 1's. */
  legs?: FlightLeg[];
}

export interface FlightLeg {
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
  departDate: string;
  dateLabel: string;
}

const WISHME_MARK = require('../../assets/images/wishme-mark.png');

export function FlightsScreen({
  onBack,
  onSearch,
  initialSearch,
}: {
  onBack: () => void;
  onSearch?: (params: FlightSearchParams) => void;
  initialSearch?: FlightSearchParams;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [tripType, setTripType] = useState<TripType>(
    initialSearch?.legs?.length ? 'multiCity' : initialSearch?.returnDate ? 'roundTrip' : 'oneWay',
  );
  const [preset, setPreset] = useState<RoutePreset | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  /** Puts a route, destination or cabin picked further down into the search form, and scrolls up to it. */
  const putInForm = (p: Omit<RoutePreset, 'n'>) => {
    setPreset((prev) => ({ ...p, n: (prev?.n ?? 0) + 1 }));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={st.root}>
      {/* Top bar */}
      <View style={[st.topBar, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/support')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Help and support"
        >
          <CircleQuestionMark size={24} color={T(C.text, 'fg')} strokeWidth={1.8} />
        </TouchableOpacity>
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
            <Plane size={26} color="#FFFFFF" fill="#FFFFFF" style={{ transform: [{ rotate: '-10deg' }] }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.heroTitle}>Flights</Text>
            <View style={st.poweredRow}>
              <Text style={st.poweredBy}>Powered By</Text>
              <Image source={WISHME_MARK} style={st.mark} resizeMode="contain" />
              <Text style={st.brand}>WISHME</Text>
            </View>
          </View>
        </View>

        <TripTypeSelector value={tripType} onChange={setTripType} />
        <SearchForm
          tripType={tripType}
          onTripType={setTripType}
          onSearch={onSearch}
          initialSearch={initialSearch}
          preset={preset}
        />

        <TrustStrip />
        <PopularRoutes onPick={(from, to) => putInForm({ from, to })} />
        <PopularDestinations onPick={(to) => putInForm({ from: null, to })} />
        <CabinTiles onPick={(cabin) => putInForm({ cabin })} />
        <Text style={st.sectionHeading}>Offers for you</Text>
        <BannerCarousel
          onBook={(b) => {
            const to = b.to ? CITIES.findIndex((c) => c.code === b.to) : -1;
            if (to >= 0) putInForm({ from: null, to });
            else scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />

        <TouchableOpacity style={st.helpRow} activeOpacity={0.8} onPress={() => router.push('/support')}>
          <View style={st.helpIcon}>
            <Headphones size={18} color={T(P.purple, 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.helpTitle}>Need help with a booking?</Text>
            <Text style={st.helpSub}>Changes, cancellations and refunds — we're here 24×7</Text>
          </View>
          <ChevronRight size={20} color={T(C.textLight, 'fg')} />
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
  sectionHeading: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 16,
    marginTop: 20,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(P.lavenderBorder, 'border'),
    backgroundColor: T(P.lavender, 'bg'),
    ...glass(14),
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T(P.lavenderIcon, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  helpSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
});
const use_st = () => useThemedStyles(make_st);
