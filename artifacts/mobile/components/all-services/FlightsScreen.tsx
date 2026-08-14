import React, { useEffect, useRef, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Search,
  Users,
} from 'lucide-react-native';

import { serviceColors as C } from './serviceColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Banner carousel ─────────────────────────────────────────────────────────
interface Banner {
  title: string;
  sub: string;
  image: any;
  tint: string;
}

const BANNER_W = SCREEN_WIDTH - 28;
const AUTO_SCROLL_MS = 3000;

const BANNERS: Banner[] = [
  {
    title: 'Fly with the Best',
    sub: 'Top airlines at unbeatable fares',
    image: require('../../assets/images/flight-banner-airline-brand.jpg'),
    tint: 'rgba(91,33,182,0.30)',
  },
  {
    title: 'International Getaways',
    sub: 'Explore the world, one flight away',
    image: require('../../assets/images/flight-banner-international-travel.jpg'),
    tint: 'rgba(2,132,199,0.25)',
  },
  {
    title: 'Singapore Special',
    sub: 'Round trips from ₹18,999',
    image: require('../../assets/images/flight-banner-singapore-offer.jpg'),
    tint: 'rgba(17,24,39,0.30)',
  },
  {
    title: 'Discover Egypt',
    sub: 'Cairo fares starting ₹24,499',
    image: require('../../assets/images/flight-banner-egypt-offer.jpg'),
    tint: 'rgba(249,115,22,0.25)',
  },
  {
    title: 'Magical Adventures',
    sub: 'Family theme-park packages',
    image: require('../../assets/images/flight-banner-disney-adventure.jpg'),
    tint: 'rgba(91,33,182,0.30)',
  },
  {
    title: 'Window Seat Views',
    sub: 'Book early, pick your seat free',
    image: require('../../assets/images/flight-banner-airplane-window.jpg'),
    tint: 'rgba(17,24,39,0.25)',
  },
  {
    title: 'Ready for Takeoff',
    sub: 'Instant confirmation, zero hassle',
    image: require('../../assets/images/flight-banner-airplane-takeoff.jpg'),
    tint: 'rgba(2,132,199,0.25)',
  },
  {
    title: 'Beach Getaways',
    sub: 'Island hops from ₹4,999',
    image: require('../../assets/images/flight-banner-beach-getaway.jpg'),
    tint: 'rgba(5,150,105,0.25)',
  },
  {
    title: 'Fly Premium',
    sub: 'Business class upgrades on sale',
    image: require('../../assets/images/flight-banner-premium-cabin.jpg'),
    tint: 'rgba(17,24,39,0.30)',
  },
  {
    title: 'Mega Flight Sale',
    sub: 'Up to ₹1,500 off with WISHFLY',
    image: require('../../assets/images/flight-banner-flight-sale.jpg'),
    tint: 'rgba(249,115,22,0.25)',
  },
];

function BannerCarousel() {
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
          <View key={b.title} style={bn.card}>
            <Image source={b.image} style={bn.image} resizeMode="cover" />
            <View style={[bn.overlay, { backgroundColor: b.tint }]} />
            <View style={bn.caption}>
              <Text style={bn.title}>{b.title}</Text>
              <Text style={bn.sub}>{b.sub}</Text>
            </View>
          </View>
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

const bn = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: BANNER_W,
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.lightGray,
  },
  image: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  caption: { position: 'absolute', left: 14, bottom: 12 },
  title: {
    color: C.white,
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: { height: 5, borderRadius: 3 },
  dotActive: { width: 16, backgroundColor: C.orange },
  dotInactive: { width: 5, backgroundColor: '#D1D5DB' },
});

// ─── Trip type selector ──────────────────────────────────────────────────────
type TripType = 'oneWay' | 'roundTrip' | 'multiCity';

const TRIP_TYPES: { key: TripType; label: string }[] = [
  { key: 'oneWay', label: 'One Way' },
  { key: 'roundTrip', label: 'Round Trip' },
  { key: 'multiCity', label: 'Multi City' },
];

function TripTypeSelector({
  value,
  onChange,
}: {
  value: TripType;
  onChange: (t: TripType) => void;
}) {
  return (
    <View style={tt.row}>
      {TRIP_TYPES.map((t) => {
        const selected = value === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={tt.option}
            activeOpacity={0.7}
            onPress={() => onChange(t.key)}
          >
            <View style={[tt.radioOuter, selected && tt.radioOuterActive]}>
              {selected && <View style={tt.radioInner} />}
            </View>
            <Text style={[tt.label, selected && tt.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: C.blue },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.blue,
  },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textLight },
  labelActive: { color: C.text, fontFamily: 'Inter_600SemiBold' },
});

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
          <ChevronLeft size={18} color={canGoPrev ? C.text : C.gray} />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity style={cal.navBtn} onPress={goNext} activeOpacity={0.7}>
          <ChevronRight size={18} color={C.text} />
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

const cal = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 10,
    backgroundColor: C.white,
  },
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
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  navBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: C.textLight,
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
  cellActive: { backgroundColor: C.blue },
  cellText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  cellTextDisabled: { color: '#D1D5DB' },
  cellTextActive: { color: C.white, fontFamily: 'Inter_700Bold' },
});

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
      >
        <Text style={tp.applyText}>APPLY</Text>
      </TouchableOpacity>
    </View>
  );
}

const tp = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: C.white,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginTop: 8,
  },
  hint: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginBottom: 6,
  },
  numRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  numBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  numBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  numText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  numTextActive: { color: C.white },
  twoCol: { flexDirection: 'row', marginTop: 8, gap: 10 },
  colDivider: { width: 1, backgroundColor: C.border, marginTop: 4 },
  applyBtn: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: C.blue,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  applyText: { color: C.white, fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
});

// ─── Cabin class picker ──────────────────────────────────────────────────────
type CabinKey = 'economy' | 'premiumEconomy' | 'business' | 'first';

interface CabinOption {
  key: CabinKey;
  label: string;
  emoji: string;
  perks: string[];
}

const CABIN_OPTIONS: CabinOption[] = [
  { key: 'economy', label: 'Economy / Premium Economy', emoji: '🪑', perks: [] },
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
                  <View style={cb.perksRow}>
                    {opt.perks.map((p) => (
                      <Text key={p} style={cb.perk}>💺 {p}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
            <Text style={cb.emoji}>{opt.emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const cb = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.white,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardActive: { backgroundColor: C.blueLight, borderBottomColor: C.blue },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.blue },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  cardTitleActive: { color: C.blue },
  perksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  perk: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  emoji: { fontSize: 28, marginLeft: 8 },
});

type PickerTarget = 'from' | 'to' | 'departure' | 'return' | 'travellers' | 'cabin' | null;

function SearchForm({
  tripType,
  onSearch,
}: {
  tripType: TripType;
  onSearch?: (params: FlightSearchParams) => void;
}) {
  const today = startOfDay(new Date());
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [depDate, setDepDate] = useState<Date>(addDays(today, 2));
  const [retDate, setRetDate] = useState<Date>(addDays(today, 5));
  const [travellers, setTravellers] = useState<TravellerCounts>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<CabinKey>('economy');
  const [picker, setPicker] = useState<PickerTarget>(null);

  const from = CITIES[fromIdx];
  const to = CITIES[toIdx];

  const swap = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };

  const togglePicker = (t: PickerTarget) => setPicker(picker === t ? null : t);

  return (
    <View style={sf.card}>
      {/* From */}
      <TouchableOpacity style={sf.fieldRow} activeOpacity={0.7} onPress={() => togglePicker('from')}>
        <PlaneTakeoff size={18} color={C.blue} />
        <View style={{ flex: 1 }}>
          <Text style={sf.fieldLabel}>From</Text>
          <Text style={sf.fieldValue}>
            {from.city} <Text style={sf.code}>({from.code})</Text>
          </Text>
          <Text style={sf.fieldSub}>{from.airport}</Text>
        </View>
      </TouchableOpacity>
      {picker === 'from' && (
        <CityPicker
          exclude={toIdx}
          onPick={(i) => {
            setFromIdx(i);
            setPicker(null);
          }}
        />
      )}

      <View style={sf.dividerRow}>
        <View style={sf.divider} />
        <TouchableOpacity style={sf.swapBtn} onPress={swap} activeOpacity={0.8}>
          <ArrowRightLeft size={15} color={C.blue} />
        </TouchableOpacity>
      </View>

      {/* To */}
      <TouchableOpacity style={sf.fieldRow} activeOpacity={0.7} onPress={() => togglePicker('to')}>
        <PlaneLanding size={18} color={C.orange} />
        <View style={{ flex: 1 }}>
          <Text style={sf.fieldLabel}>To</Text>
          <Text style={sf.fieldValue}>
            {to.city} <Text style={sf.code}>({to.code})</Text>
          </Text>
          <Text style={sf.fieldSub}>{to.airport}</Text>
        </View>
      </TouchableOpacity>
      {picker === 'to' && (
        <CityPicker
          exclude={fromIdx}
          onPick={(i) => {
            setToIdx(i);
            setPicker(null);
          }}
        />
      )}

      <View style={sf.dividerPlain} />

      {/* Dates */}
      <View style={sf.dateRow}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}
          activeOpacity={0.7}
          onPress={() => togglePicker('departure')}
        >
          <Calendar size={18} color={C.purpleLight} />
          <View>
            <Text style={sf.fieldLabel}>Departure</Text>
            <Text style={sf.fieldValue}>{formatDate(depDate)}</Text>
            <Text style={sf.fieldSub}>{formatDay(depDate)}</Text>
          </View>
        </TouchableOpacity>
        {tripType === 'roundTrip' && (
          <>
            <View style={sf.dateDivider} />
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}
              activeOpacity={0.7}
              onPress={() => togglePicker('return')}
            >
              <Calendar size={18} color={C.green} />
              <View>
                <Text style={sf.fieldLabel}>Return</Text>
                <Text style={sf.fieldValue}>{formatDate(retDate)}</Text>
                <Text style={sf.fieldSub}>{formatDay(retDate)}</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
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
      {picker === 'return' && (
        <MonthCalendar
          selected={retDate}
          minDate={depDate}
          onPick={(d) => {
            setRetDate(d);
            setPicker(null);
          }}
        />
      )}

      <View style={sf.dividerPlain} />

      {/* Travellers + Cabin row */}
      <View style={sf.travelCabinRow}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}
          activeOpacity={0.7}
          onPress={() => togglePicker('travellers')}
        >
          <Users size={17} color={C.blue} />
          <View style={{ flex: 1 }}>
            <Text style={sf.fieldLabel}>Travellers</Text>
            <Text style={sf.fieldValueSm} numberOfLines={1}>
              {travellersLabel(travellers)}
            </Text>
          </View>
          <ChevronDown size={14} color={C.gray} />
        </TouchableOpacity>

        <View style={sf.dateDivider} />

        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}
          activeOpacity={0.7}
          onPress={() => togglePicker('cabin')}
        >
          <Text style={sf.cabinEmoji}>💺</Text>
          <View style={{ flex: 1 }}>
            <Text style={sf.fieldLabel}>Cabin Class</Text>
            <Text style={sf.fieldValueSm} numberOfLines={1}>
              {cabinLabel(cabin)}
            </Text>
          </View>
          <ChevronDown size={14} color={C.gray} />
        </TouchableOpacity>
      </View>

      {picker === 'travellers' && (
        <TravellersPicker
          initial={travellers}
          onApply={(t) => {
            setTravellers(t);
            setPicker(null);
          }}
        />
      )}
      {picker === 'cabin' && (
        <CabinClassPicker
          value={cabin}
          onChange={(k) => {
            setCabin(k);
            setPicker(null);
          }}
        />
      )}

      {tripType === 'multiCity' && (
        <View style={sf.multiNote}>
          <Plane size={13} color={C.textLight} />
          <Text style={sf.multiNoteText}>
            Add up to 5 flights in one booking — coming soon
          </Text>
        </View>
      )}

      {/* Search button */}
      <TouchableOpacity
        style={sf.searchBtn}
        activeOpacity={0.85}
        onPress={() => {
          const from = CITIES[fromIdx];
          const to = CITIES[toIdx];
          onSearch?.({
            from: `${from.city} (${from.code})`,
            to: `${to.city} (${to.code})`,
            dateLabel: formatDate(depDate),
            travellers: travellersLabel(travellers),
            cabin: cabinLabel(cabin),
          });
        }}
      >
        <Search size={18} color={C.white} />
        <Text style={sf.searchBtnText}>Search Flights</Text>
      </TouchableOpacity>
    </View>
  );
}

function CityPicker({ exclude, onPick }: { exclude: number; onPick: (i: number) => void }) {
  return (
    <View style={sf.cityList}>
      {CITIES.map((c, i) =>
        i === exclude ? null : (
          <TouchableOpacity key={c.code} style={sf.cityItem} activeOpacity={0.7} onPress={() => onPick(i)}>
            <View style={sf.cityCode}>
              <Text style={sf.cityCodeText}>{c.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sf.cityName}>{c.city}</Text>
              <Text style={sf.cityAirport}>{c.airport}</Text>
            </View>
          </TouchableOpacity>
        ),
      )}
    </View>
  );
}

const sf = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  fieldRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 2 },
  code: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textLight },
  fieldSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.gray, marginTop: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  divider: { flex: 1, height: 1, backgroundColor: C.border },
  dividerPlain: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateDivider: { width: 1, height: 36, backgroundColor: C.border, marginHorizontal: 10 },
  cityList: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.lightGray,
  },
  cityCode: {
    backgroundColor: C.lightGray,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  cityCodeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.text },
  cityName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  cityAirport: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  travelCabinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  fieldValueSm: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 2 },
  cabinEmoji: { fontSize: 16 },
  multiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: C.lightGray,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  multiNoteText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textLight },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.orange,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
  },
  searchBtnText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});

// ─── Special fares ───────────────────────────────────────────────────────────
interface Fare {
  key: string;
  title: string;
  sub: string;
}

const FARES: Fare[] = [
  { key: 'regular', title: 'Regular', sub: 'Regular fares' },
  { key: 'student', title: 'Student', sub: 'Extra discounts/baggage' },
  { key: 'armedForces', title: 'Armed Forces', sub: 'Up to ₹ 600 off' },
  { key: 'seniorCitizen', title: 'Senior Citizen', sub: 'Up to ₹ 600 off' },
  { key: 'doctorNurses', title: 'Doctor and Nurses', sub: 'Up to ₹ 600 off' },
];

function SpecialFares() {
  const [selected, setSelected] = useState('regular');
  return (
    <View style={fr.section}>
      <Text style={fr.heading}>Select a special fare</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fr.row}
      >
        {FARES.map((f) => {
          const active = selected === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[fr.card, active && fr.cardActive]}
              activeOpacity={0.8}
              onPress={() => setSelected(f.key)}
            >
              <Text style={[fr.title, active && fr.titleActive]}>{f.title}</Text>
              <Text style={fr.sub}>{f.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const fr = StyleSheet.create({
  section: { marginTop: 18 },
  heading: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 130,
  },
  cardActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  titleActive: { color: C.blue },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 3 },
});

// ─── Flights Screen ──────────────────────────────────────────────────────────
export interface FlightSearchParams {
  from: string;
  to: string;
  dateLabel: string;
  travellers: string;
  cabin: string;
}

export function FlightsScreen({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch?: (params: FlightSearchParams) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [tripType, setTripType] = useState<TripType>('oneWay');

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Flights</Text>
          <Text style={st.headerSub}>Book domestic & international flights</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.headerIcon}>
          <Plane size={18} color={C.blue} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        bounces
      >
        <BannerCarousel />
        <TripTypeSelector value={tripType} onChange={setTripType} />
        <SearchForm tripType={tripType} onSearch={onSearch} />
        <SpecialFares />

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.orange,
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
  },
  searchBtnText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});
