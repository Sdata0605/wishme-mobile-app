import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Moon,
  Plane,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sun,
  Sunrise,
  Sunset,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { serviceColors as C } from './serviceColors';
import { tboSearchFlights } from '@/services/tboService';
import { clearOptionSet, setOptionSet } from '@/services/assistant/bridge';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';
import { DemoFareNotice } from './DemoFareNotice';
import { isDemoTrace } from '@/services/tboDemo';

export interface FlightSearchQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: number;
}

// ─── Flight data ──────────────────────────────────────────────────────────────
export interface FlightResult {
  id: number;
  /** TBO fare reference — required to re-price and book this exact itinerary. */
  resultIndex?: string;
  traceId?: string;
  isLCC?: boolean;
  baseFare?: number;
  tax?: number;
  baggage?: string;
  cabinBaggage?: string;
  seatsAvailable?: number;
  fareClass?: string;
  depTerminal?: string;
  arrTerminal?: string;
  depCity?: string;
  arrCity?: string;
  airline: string;
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  logo: string;
  depart: string;
  arrive: string;
  departTime?: string;
  arriveTime?: string;
  fromCode?: string;
  toCode?: string;
  duration: string;
  durationMins: number;
  stops: 0 | 1 | 2;
  price: number;
  originalPrice: number;
  refundable: boolean;
  depAirport: string;
  arrAirport: string;
  layoverAirport?: string;
  layoverMins?: number;
}

type TimeSlot = 'before6' | '6to12' | '12to6' | 'after6';


function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getTimeSlot(t: string): TimeSlot {
  const mins = timeToMins(t);
  if (mins < 6 * 60) return 'before6';
  if (mins < 12 * 60) return '6to12';
  if (mins < 18 * 60) return '12to6';
  return 'after6';
}

const TIME_SLOTS: {
  key: TimeSlot;
  label: string;
  sub: string;
  Icon: LucideIcon;
}[] = [
  { key: 'before6', label: 'Before 6 AM', sub: 'Early morning', Icon: Sunrise },
  { key: '6to12', label: '6 AM – 12 PM', sub: 'Morning', Icon: Sun },
  { key: '12to6', label: '12 PM – 6 PM', sub: 'Afternoon', Icon: Sunset },
  { key: 'after6', label: 'After 6 PM', sub: 'Evening / Night', Icon: Moon },
];

const AIRLINES = [
  'IndiGo',
  'Air India',
  'SpiceJet',
  'Akasa Air',
  'Vistara',
  'GoFirst',
  'Air India Express',
] as const;

const DEP_AIRPORTS = [
  { code: 'DEL', name: 'Indira Gandhi Intl (DEL)', nearby: false },
  { code: 'HDO', name: 'Hindon Airport (32 km)', nearby: true },
] as const;

const PRICE_MIN = 3000;
const PRICE_MAX = 7000;
const PRICE_STEPS = [3000, 4000, 5000, 6000, 7000];
const DURATION_STEPS = [120, 180, 240, 300, 420];
const LAYOVER_STEPS = [30, 60, 90, 120, 180];

// ─── Fare type bar ────────────────────────────────────────────────────────────
interface FareType {
  key: string;
  label: string;
  isNew?: boolean;
}

const FARE_TYPES: FareType[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'student', label: 'Student' },
  { key: 'armedForces', label: 'Armed Forces' },
  { key: 'gst', label: 'Have a GST number?', isNew: true },
  { key: 'seniorCitizen', label: 'Senior Citizen' },
  { key: 'doctorNurses', label: 'Doctor and Nurses' },
];

function FareTypeBar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (k: string) => void;
}) {
  const ft = use_ft();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ft.row}
      style={ft.wrap}
    >
      {FARE_TYPES.map((f) => {
        const active = f.key === selected;
        return (
          <TouchableOpacity
            key={f.key}
            style={[ft.chip, active && ft.chipActive]}
            activeOpacity={0.8}
            onPress={() => onSelect(f.key)}
          >
            {active && <Check size={11} color={T(C.blue, 'fg')} style={{ marginRight: 3 }} />}
            <Text style={[ft.chipText, active && ft.chipTextActive]}>{f.label}</Text>
            {f.isNew && (
              <View style={ft.newBadge}>
                <Text style={ft.newText}>NEW</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const make_ft = () => StyleSheet.create({
  wrap: { flexGrow: 0, backgroundColor: T(C.white, 'bg'), borderBottomWidth: 1, borderBottomColor: T(C.border, 'border') },
  row: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T(C.lightGray, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: T(C.blueLight, 'bg'),
    borderColor: T(C.blue, 'border'),
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
  },
  chipTextActive: {
    color: T(C.blue, 'fg'),
    fontFamily: 'Inter_600SemiBold',
  },
  newBadge: {
    backgroundColor: T(C.red, 'bg'),
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  newText: {
    color: T(C.white, 'fg'),
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
});
const use_ft = () => useThemedStyles(make_ft);

// ─── Flight card ──────────────────────────────────────────────────────────────
function FlightCard({
  flight,
  onViewPrices,
}: {
  flight: FlightResult;
  onViewPrices: (f: FlightResult) => void;
}) {
  const fc = use_fc();
  const stopLabel =
    flight.stops === 0 ? 'Non Stop' : flight.stops === 1 ? '1 Stop' : '2 Stops';
  const discount = Math.round(((flight.originalPrice - flight.price) / flight.originalPrice) * 100);

  return (
    <View style={fc.card}>
      {/* Airline row */}
      <View style={fc.topRow}>
        <View style={fc.airlineRow}>
          <Text style={fc.logo}>{flight.logo}</Text>
          <Text style={fc.airline}>{flight.airline}</Text>
        </View>
        {discount > 0 && (
          <View style={fc.discountBadge}>
            <Text style={fc.discountText}>{discount}% off</Text>
          </View>
        )}
      </View>

      {/* Times row */}
      <View style={fc.timesRow}>
        <View style={fc.timeBlock}>
          <Text style={fc.time}>{flight.depart}</Text>
          <Text style={fc.timeLabel}>Departure</Text>
        </View>

        <View style={fc.routeLine}>
          <View style={fc.dot} />
          <View style={fc.line} />
          <Plane size={14} color={T(C.blue, 'fg')} />
          <View style={fc.line} />
          <View style={fc.dot} />
        </View>

        <View style={[fc.timeBlock, { alignItems: 'flex-end' }]}>
          <Text style={fc.time}>{flight.arrive}</Text>
          <Text style={fc.timeLabel}>Arrival</Text>
        </View>
      </View>

      {/* Duration + stops row */}
      <View style={fc.infoRow}>
        <Text style={fc.duration}>{flight.duration}</Text>
        <View style={[fc.stopPill, flight.stops === 0 && fc.stopPillGreen]}>
          <Text style={[fc.stopText, flight.stops === 0 && fc.stopTextGreen]}>{stopLabel}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={fc.divider} />

      {/* Price + book row */}
      <View style={fc.priceRow}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <Text style={fc.originalPrice}>₹{flight.originalPrice.toLocaleString('en-IN')}</Text>
            <Text style={fc.price}>₹{flight.price.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={fc.perPax}>per person</Text>
        </View>
        <TouchableOpacity style={fc.bookBtn} activeOpacity={0.85} onPress={() => onViewPrices(flight)}><BrandFill />
          <Text style={fc.bookText}>View Prices</Text>
          <ArrowRight size={13} color={T(C.white, 'fg')} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_fc = () => StyleSheet.create({
  card: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
   ...glass(18), },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  airlineRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { fontSize: 20 },
  airline: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  discountBadge: {
    backgroundColor: T('#ECFDF5', 'bg'),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: T('#6EE7B7', 'border'),
  },
  discountText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBlock: { alignItems: 'flex-start' },
  time: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  timeLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg'), marginTop: 1 },
  routeLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T(C.blue, 'bg') },
  line: { flex: 1, height: 1, backgroundColor: T(C.border, 'bg') },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duration: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  stopPill: {
    backgroundColor: T('#F5F0FF', 'bg'),
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: T('#FED7AA', 'border'),
  },
  stopPillGreen: {
    backgroundColor: T('#ECFDF5', 'bg'),
    borderColor: T('#6EE7B7', 'border'),
  },
  stopText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  stopTextGreen: { color: T(C.green, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginBottom: 12 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.gray, 'fg'),
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  perPax: { fontSize: 9, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg'), marginTop: 1 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
   overflow: 'hidden', },
  bookText: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_700Bold' },
});
const use_fc = () => useThemedStyles(make_fc);

// ─── Filters panel ────────────────────────────────────────────────────────────
type FilterCategory =
  | 'popular'
  | 'price'
  | 'stops'
  | 'departure'
  | 'arrival'
  | 'airlines'
  | 'airports'
  | 'duration';

interface FilterState {
  nonStop: boolean;
  oneStop: boolean;
  twoPlusStops: boolean;
  hideNearby: boolean;
  refundable: boolean;
  airlines: string[];
  depSlots: TimeSlot[];
  arrSlots: TimeSlot[];
  airports: string[];
  maxPrice: number;
  maxDuration: number;
  maxLayover: number;
}

const DEFAULT_FILTERS: FilterState = {
  nonStop: false,
  oneStop: false,
  twoPlusStops: false,
  hideNearby: false,
  refundable: false,
  airlines: [],
  depSlots: [],
  arrSlots: [],
  airports: [],
  maxPrice: PRICE_MAX,
  maxDuration: DURATION_STEPS[DURATION_STEPS.length - 1],
  maxLayover: LAYOVER_STEPS[LAYOVER_STEPS.length - 1],
};

function countActiveFilters(f: FilterState) {
  let n = 0;
  if (f.nonStop) n += 1;
  if (f.oneStop) n += 1;
  if (f.twoPlusStops) n += 1;
  if (f.hideNearby) n += 1;
  if (f.refundable) n += 1;
  n += f.airlines.length;
  n += f.depSlots.length;
  n += f.arrSlots.length;
  n += f.airports.length;
  if (f.maxPrice < PRICE_MAX) n += 1;
  if (f.maxDuration < DURATION_STEPS[DURATION_STEPS.length - 1]) n += 1;
  if (f.maxLayover < LAYOVER_STEPS[LAYOVER_STEPS.length - 1]) n += 1;
  return n;
}

function applyFlightFilters(flights: FlightResult[], f: FilterState) {
  return flights.filter((flight) => {
    const stopOk =
      (!f.nonStop && !f.oneStop && !f.twoPlusStops) ||
      (f.nonStop && flight.stops === 0) ||
      (f.oneStop && flight.stops === 1) ||
      (f.twoPlusStops && flight.stops >= 2);
    if (!stopOk) return false;

    if (f.hideNearby && flight.depAirport !== 'DEL') return false;
    if (f.refundable && !flight.refundable) return false;
    if (f.airlines.length > 0 && !f.airlines.includes(flight.airline)) return false;
    if (f.depSlots.length > 0 && !f.depSlots.includes(getTimeSlot(flight.depart))) return false;
    if (f.arrSlots.length > 0 && !f.arrSlots.includes(getTimeSlot(flight.arrive))) return false;
    if (f.airports.length > 0 && !f.airports.includes(flight.depAirport)) return false;
    if (flight.price > f.maxPrice) return false;
    if (flight.durationMins > f.maxDuration) return false;
    if ((flight.layoverMins ?? 0) > f.maxLayover && flight.stops > 0) return false;
    return true;
  });
}

function Checkbox({
  checked,
  label,
  sub,
  right,
  onToggle,
}: {
  checked: boolean;
  label: string;
  sub?: string;
  right?: string;
  onToggle: () => void;
}) {
  const ch = use_ch();
  return (
    <TouchableOpacity style={ch.row} activeOpacity={0.7} onPress={onToggle}>
      <View style={[ch.box, checked && ch.boxChecked]}>
        {checked && <Check size={11} color={T(C.white, 'fg')} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ch.label}>{label}</Text>
        {!!sub && <Text style={ch.sub}>{sub}</Text>}
      </View>
      {!!right && <Text style={ch.right}>{right}</Text>}
    </TouchableOpacity>
  );
}

const make_ch = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  boxChecked: { backgroundColor: T(C.blue, 'bg'), borderColor: T(C.blue, 'border') },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  right: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
});
const use_ch = () => useThemedStyles(make_ch);

function StepSlider({
  label,
  value,
  steps,
  format,
  onChange,
}: {
  label: string;
  value: number;
  steps: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const sl = use_sl();
  const idx = Math.max(0, steps.findIndex((s) => s >= value));
  const pct = steps.length <= 1 ? 100 : (idx / (steps.length - 1)) * 100;

  return (
    <View style={sl.wrap}>
      <View style={sl.head}>
        <Text style={sl.label}>{label}</Text>
        <Text style={sl.value}>Up to {format(value)}</Text>
      </View>
      <View style={sl.track}>
        <View style={[sl.fill, { width: `${pct}%` }]} />
      </View>
      <View style={sl.steps}>
        {steps.map((s) => {
          const active = value >= s;
          return (
            <TouchableOpacity
              key={s}
              style={[sl.stepDot, active && sl.stepDotActive]}
              onPress={() => onChange(s)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={[sl.stepText, active && sl.stepTextActive]}>{format(s)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const make_sl = () => StyleSheet.create({
  wrap: { marginBottom: 8 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.blue, 'fg') },
  track: {
    height: 4,
    backgroundColor: T('#DCDFE5', 'bg'),
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: T(C.blue, 'bg'), borderRadius: 2 },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  stepDot: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  stepDotActive: {},
  stepText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: T(C.gray, 'fg') },
  stepTextActive: { color: T(C.blue, 'fg'), fontFamily: 'Inter_700Bold' },
});
const use_sl = () => useThemedStyles(make_sl);

function TimeSlotGrid({
  selected,
  onToggle,
}: {
  selected: TimeSlot[];
  onToggle: (slot: TimeSlot) => void;
}) {
  const tsg = use_tsg();
  return (
    <View style={tsg.grid}>
      {TIME_SLOTS.map((slot) => {
        const active = selected.includes(slot.key);
        return (
          <TouchableOpacity
            key={slot.key}
            style={[tsg.card, active && tsg.cardActive]}
            activeOpacity={0.8}
            onPress={() => onToggle(slot.key)}
          >
            <slot.Icon size={18} color={active ? T(C.blue, 'fg') : T(C.orange, 'fg')} />
            <Text style={[tsg.label, active && tsg.labelActive]}>{slot.label}</Text>
            <Text style={[tsg.sub, active && tsg.subActive]}>{slot.sub}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const make_tsg = () => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    padding: 12,
    gap: 4,
   ...glass(18), },
  cardActive: { borderColor: T(C.blue, 'border'), backgroundColor: T(C.blueLight, 'bg') },
  label: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 4 },
  labelActive: { color: T(C.blue, 'fg') },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  subActive: { color: T(C.blue, 'fg') },
});
const use_tsg = () => useThemedStyles(make_tsg);

const FILTER_TABS: { key: FilterCategory; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'price', label: 'Price' },
  { key: 'stops', label: 'Stops' },
  { key: 'departure', label: 'Departure' },
  { key: 'arrival', label: 'Arrival' },
  { key: 'airlines', label: 'Airlines' },
  { key: 'airports', label: 'Airports' },
  { key: 'duration', label: 'Duration' },
];

function formatMins(m: number) {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return mins ? `${h}h ${mins}m` : `${h}h`;
}

function FiltersModal({
  visible,
  value,
  flights,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: FilterState;
  flights: FlightResult[];
  onClose: () => void;
  onApply: (next: FilterState) => void;
}) {
  const fm = use_fm();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<FilterState>(value);
  const [activeTab, setActiveTab] = useState<FilterCategory>('popular');
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    if (visible) {
      setFilters(value);
      setActiveTab('popular');
      setQuery('');
    }
  }, [visible, value]);

  const toggleAirline = (name: string) =>
    setFilters((f) => ({
      ...f,
      airlines: f.airlines.includes(name)
        ? f.airlines.filter((a) => a !== name)
        : [...f.airlines, name],
    }));

  const toggleSlot = (key: 'depSlots' | 'arrSlots', slot: TimeSlot) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(slot) ? f[key].filter((s) => s !== slot) : [...f[key], slot],
    }));

  const toggleAirport = (code: string) =>
    setFilters((f) => ({
      ...f,
      airports: f.airports.includes(code)
        ? f.airports.filter((a) => a !== code)
        : [...f.airports, code],
    }));

  const previewCount = applyFlightFilters(flights, filters).length;
  const activeCount = countActiveFilters(filters);

  const airlineList = AIRLINES.filter((a) =>
    a.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={[fm.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={fm.header}>
            <View>
              <Text style={fm.title}>Filters</Text>
              <Text style={fm.subtitle}>
                {activeCount > 0 ? `${activeCount} selected · ${previewCount} flights` : 'Refine your flight search'}
              </Text>
            </View>
            <View style={fm.headerActions}>
              <TouchableOpacity
                style={fm.clearBtn}
                onPress={() => setFilters(DEFAULT_FILTERS)}
                activeOpacity={0.8}
              >
                <RotateCcw size={13} color={T(C.orange, 'fg')} />
                <Text style={fm.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={T(C.text, 'fg')} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={fm.body}>
            <View style={fm.side}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 6 }}
              >
                {FILTER_TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[fm.sideItem, active && fm.sideItemActive]}
                      onPress={() => setActiveTab(tab.key)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[fm.sideText, active && fm.sideTextActive]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              style={fm.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 }}
            >
              {activeTab === 'popular' && (
                <>
                  <Text style={fm.sectionHint}>Quick picks — tap to turn on</Text>
                  <View style={fm.group}>
                    <Checkbox
                      checked={filters.nonStop}
                      label="Non Stop"
                      right={`${flights.filter((f) => f.stops === 0).length}`}
                      onToggle={() => setFilters((f) => ({ ...f, nonStop: !f.nonStop }))}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.oneStop}
                      label="1 Stop"
                      right={`${flights.filter((f) => f.stops === 1).length}`}
                      onToggle={() => setFilters((f) => ({ ...f, oneStop: !f.oneStop }))}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.refundable}
                      label="Refundable Fares"
                      onToggle={() => setFilters((f) => ({ ...f, refundable: !f.refundable }))}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.hideNearby}
                      label="Hide Nearby Airport Flights"
                      sub="Show only main airport departures"
                      onToggle={() => setFilters((f) => ({ ...f, hideNearby: !f.hideNearby }))}
                    />
                  </View>

                  <Text style={fm.groupLabel}>Popular departure times</Text>
                  <View style={fm.group}>
                    <Checkbox
                      checked={filters.depSlots.includes('before6')}
                      label="Early Morning Departures"
                      sub="Before 6 AM"
                      onToggle={() => toggleSlot('depSlots', 'before6')}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.depSlots.includes('12to6')}
                      label="Afternoon Departure"
                      sub="12 PM – 6 PM"
                      onToggle={() => toggleSlot('depSlots', '12to6')}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.depSlots.includes('after6')}
                      label="Late Departures"
                      sub="After 6 PM"
                      onToggle={() => toggleSlot('depSlots', 'after6')}
                    />
                  </View>

                  <Text style={fm.groupLabel}>Popular airlines</Text>
                  <View style={fm.group}>
                    {['IndiGo', 'Air India', 'SpiceJet', 'Akasa Air'].map((name, i) => (
                      <React.Fragment key={name}>
                        {i > 0 && <View style={fm.separator} />}
                        <Checkbox
                          checked={filters.airlines.includes(name)}
                          label={name}
                          right={`₹${Math.min(
                            ...flights.filter((f) => f.airline === name).map((f) => f.price),
                            99999,
                          ).toLocaleString('en-IN')}`}
                          onToggle={() => toggleAirline(name)}
                        />
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}

              {activeTab === 'price' && (
                <>
                  <Text style={fm.sectionHint}>One-way price per adult</Text>
                  <StepSlider
                    label="Maximum price"
                    value={filters.maxPrice}
                    steps={PRICE_STEPS}
                    format={(v) => `₹${v.toLocaleString('en-IN')}`}
                    onChange={(maxPrice) => setFilters((f) => ({ ...f, maxPrice }))}
                  />
                  <View style={fm.priceHint}>
                    <Text style={fm.priceHintText}>
                      Showing fares from ₹{PRICE_MIN.toLocaleString('en-IN')} to ₹
                      {filters.maxPrice.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </>
              )}

              {activeTab === 'stops' && (
                <>
                  <Text style={fm.sectionHint}>Choose how many stops you want</Text>
                  <View style={fm.stopsRow}>
                    {(
                      [
                        { key: 'nonStop' as const, label: 'Non Stop', count: flights.filter((f) => f.stops === 0).length },
                        { key: 'oneStop' as const, label: '1 Stop', count: flights.filter((f) => f.stops === 1).length },
                        { key: 'twoPlusStops' as const, label: '1+ Stop', count: flights.filter((f) => f.stops >= 2).length },
                      ] as const
                    ).map((opt) => {
                      const active = filters[opt.key];
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[fm.stopChip, active && fm.stopChipActive]}
                          onPress={() => setFilters((f) => ({ ...f, [opt.key]: !f[opt.key] }))}
                          activeOpacity={0.8}
                        >
                          <Text style={[fm.stopChipText, active && fm.stopChipTextActive]}>
                            {opt.label}
                          </Text>
                          <Text style={[fm.stopCount, active && fm.stopCountActive]}>
                            ({opt.count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {activeTab === 'departure' && (
                <>
                  <Text style={fm.sectionHint}>Departure time from origin</Text>
                  <TimeSlotGrid
                    selected={filters.depSlots}
                    onToggle={(slot) => toggleSlot('depSlots', slot)}
                  />
                </>
              )}

              {activeTab === 'arrival' && (
                <>
                  <Text style={fm.sectionHint}>Arrival time at destination</Text>
                  <TimeSlotGrid
                    selected={filters.arrSlots}
                    onToggle={(slot) => toggleSlot('arrSlots', slot)}
                  />
                </>
              )}

              {activeTab === 'airlines' && (
                <>
                  <View style={fm.searchBox}>
                    <Search size={14} color={T(C.gray, 'fg')} />
                    <TextInput
                      style={fm.searchInput}
                      placeholder="Search airlines..."
                      placeholderTextColor={T(C.gray, 'fg')}
                      value={query}
                      onChangeText={setQuery}
                    />
                  </View>
                  <View style={fm.group}>
                    {airlineList.map((name, i) => {
                      const prices = flights.filter((f) => f.airline === name).map((f) => f.price);
                      const minPrice = prices.length ? Math.min(...prices) : 0;
                      return (
                        <React.Fragment key={name}>
                          {i > 0 && <View style={fm.separator} />}
                          <Checkbox
                            checked={filters.airlines.includes(name)}
                            label={name}
                            right={minPrice ? `₹${minPrice.toLocaleString('en-IN')}` : undefined}
                            onToggle={() => toggleAirline(name)}
                          />
                        </React.Fragment>
                      );
                    })}
                  </View>
                </>
              )}

              {activeTab === 'airports' && (
                <>
                  <Text style={fm.sectionHint}>Departure airports</Text>
                  <View style={fm.group}>
                    {DEP_AIRPORTS.map((ap, i) => (
                      <React.Fragment key={ap.code}>
                        {i > 0 && <View style={fm.separator} />}
                        <Checkbox
                          checked={filters.airports.includes(ap.code)}
                          label={ap.name}
                          sub={ap.nearby ? 'Nearby airport' : 'Main airport'}
                          onToggle={() => toggleAirport(ap.code)}
                        />
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}

              {activeTab === 'duration' && (
                <>
                  <StepSlider
                    label="Total trip duration"
                    value={filters.maxDuration}
                    steps={DURATION_STEPS}
                    format={formatMins}
                    onChange={(maxDuration) => setFilters((f) => ({ ...f, maxDuration }))}
                  />
                  <View style={{ height: 14 }} />
                  <StepSlider
                    label="Layover duration"
                    value={filters.maxLayover}
                    steps={LAYOVER_STEPS}
                    format={formatMins}
                    onChange={(maxLayover) => setFilters((f) => ({ ...f, maxLayover }))}
                  />
                  <View style={fm.priceHint}>
                    <Clock size={13} color={T(C.purpleLight, 'fg')} />
                    <Text style={fm.priceHintText}>
                      Shorter layovers help you reach faster with fewer waits
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>

          <View style={fm.footer}>
            <TouchableOpacity
              style={fm.applyBtn}
              activeOpacity={0.85}
              onPress={() => {
                onApply(filters);
                onClose();
              }}
            ><BrandFill />
              <Text style={fm.applyText}>
                Show {previewCount} flight{previewCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const make_fm = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T(C.white, 'bg'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T('#F5F0FF', 'bg'),
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: {
    width: 78,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: T(C.pageBg, 'bg'),
    borderRightWidth: 1,
    borderRightColor: T(C.border, 'border'),
  },
  sideItem: {
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sideItemActive: {
    backgroundColor: T(C.white, 'bg'),
    borderLeftColor: T(C.blue, 'border'),
  },
  sideText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  sideTextActive: { color: T(C.blue, 'fg'), fontFamily: 'Inter_700Bold' },
  content: { flex: 1, minWidth: 0 },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: T(C.textLight, 'fg'),
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  group: {
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
   ...glass(18), },
  separator: { height: 1, backgroundColor: T(C.lightGray, 'bg') },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T(C.lightGray, 'bg'),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T(C.text, 'fg'),
    padding: 0,
  },
  stopsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: T(C.white, 'bg'),
  },
  stopChipActive: { borderColor: T(C.blue, 'border'), backgroundColor: T(C.blueLight, 'bg') },
  stopChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  stopChipTextActive: { color: T(C.blue, 'fg') },
  stopCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg') },
  stopCountActive: { color: T(C.blue, 'fg') },
  priceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T('#F5F3FF', 'bg'),
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  priceHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.purple, 'fg'),
    lineHeight: 15,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  applyBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
   overflow: 'hidden', },
  applyText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_fm = () => useThemedStyles(make_fm);

// ─── Quick filter chips (MMT-style popular filters on results) ────────────────
const QUICK_FILTERS: {
  key: string;
  label: string;
  apply: (f: FilterState) => FilterState;
  isActive: (f: FilterState) => boolean;
}[] = [
  {
    key: 'nonStop',
    label: 'Non Stop',
    apply: (f) => ({ ...f, nonStop: !f.nonStop }),
    isActive: (f) => f.nonStop,
  },
  {
    key: 'refundable',
    label: 'Refundable',
    apply: (f) => ({ ...f, refundable: !f.refundable }),
    isActive: (f) => f.refundable,
  },
  {
    key: 'early',
    label: 'Early Morning',
    apply: (f) => ({
      ...f,
      depSlots: f.depSlots.includes('before6')
        ? f.depSlots.filter((s) => s !== 'before6')
        : [...f.depSlots, 'before6'],
    }),
    isActive: (f) => f.depSlots.includes('before6'),
  },
  {
    key: 'late',
    label: 'Late Departure',
    apply: (f) => ({
      ...f,
      depSlots: f.depSlots.includes('after6')
        ? f.depSlots.filter((s) => s !== 'after6')
        : [...f.depSlots, 'after6'],
    }),
    isActive: (f) => f.depSlots.includes('after6'),
  },
  {
    key: 'indigo',
    label: 'IndiGo',
    apply: (f) => ({
      ...f,
      airlines: f.airlines.includes('IndiGo')
        ? f.airlines.filter((a) => a !== 'IndiGo')
        : [...f.airlines, 'IndiGo'],
    }),
    isActive: (f) => f.airlines.includes('IndiGo'),
  },
  {
    key: 'hideNearby',
    label: 'Hide Nearby',
    apply: (f) => ({ ...f, hideNearby: !f.hideNearby }),
    isActive: (f) => f.hideNearby,
  },
];

function QuickFiltersBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const qf = use_qf();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={qf.row}
      style={qf.wrap}
    >
      {QUICK_FILTERS.map((q) => {
        const active = q.isActive(filters);
        return (
          <TouchableOpacity
            key={q.key}
            style={[qf.chip, active && qf.chipActive]}
            activeOpacity={0.8}
            onPress={() => onChange(q.apply(filters))}
          >
            {active && <Check size={11} color={T(C.blue, 'fg')} />}
            <Text style={[qf.text, active && qf.textActive]}>{q.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const make_qf = () => StyleSheet.create({
  wrap: {
    flexGrow: 0,
    backgroundColor: T(C.white, 'bg'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  row: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T(C.lightGray, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: T(C.blueLight, 'bg'), borderColor: T(C.blue, 'border') },
  text: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  textActive: { color: T(C.blue, 'fg'), fontFamily: 'Inter_600SemiBold' },
});
const use_qf = () => useThemedStyles(make_qf);

// ─── Flight Results Screen ────────────────────────────────────────────────────
export function FlightResultsScreen({
  from,
  to,
  dateLabel,
  travellers,
  cabin,
  search,
  accessToken,
  onBack,
  onViewPrices,
}: {
  from: string;
  to: string;
  dateLabel: string;
  travellers: string;
  cabin: string;
  search?: FlightSearchQuery;
  accessToken?: string | null;
  onBack: () => void;
  onViewPrices: (flight: FlightResult) => void;
}) {
  const rs = use_rs();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedFare, setSelectedFare] = useState('regular');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortExpanded, setSortExpanded] = useState(false);
  const [sortLabel, setSortLabel] = useState('Price: Low to High');

  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!search) {
      setFlights([]);
      setLoading(false);
      setLoadError('Start a new search to see live fares.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    tboSearchFlights(search, accessToken)
      .then((res) => {
        if (cancelled) return;
        setFlights(res.outbound as FlightResult[]);
        if (res.outbound.length === 0) {
          setLoadError('No flights found for this route and date.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFlights([]);
        setLoadError(err instanceof Error ? err.message : 'Could not load flights.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [search, accessToken, reloadKey]);

  const SORT_OPTIONS = [
    'Price: Low to High',
    'Price: High to Low',
    'Departure: Early',
    'Duration: Shortest',
  ];

  const activeFilterCount = countActiveFilters(appliedFilters);

  const sortedFlights = applyFlightFilters(flights, appliedFilters).sort((a, b) => {
    if (sortLabel === 'Price: Low to High') return a.price - b.price;
    if (sortLabel === 'Price: High to Low') return b.price - a.price;
    if (sortLabel === 'Departure: Early') return a.depart.localeCompare(b.depart);
    if (sortLabel === 'Duration: Shortest') return a.durationMins - b.durationMins;
    return 0;
  });

  // Let the voice assistant read out and pick from what is on screen.
  useEffect(() => {
    setOptionSet({
      kind: 'flights',
      loading,
      error: loadError || undefined,
      items: sortedFlights.map((f) => ({
        title: `${f.airlineName ?? f.airline}${f.flightNumber ? ' ' + f.flightNumber : ''}`,
        detail: `departs ${f.depart}, arrives ${f.arrive}, ${f.duration}, ${
          f.stops === 0 ? 'non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`
        }, ₹${f.price}`,
      })),
      select: (i) => {
        const f = sortedFlights[i];
        if (f) onViewPrices(f);
      },
    });
    return () => clearOptionSet('flights');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights, appliedFilters, sortLabel, loading, loadError]);

  return (
    <View style={rs.root}>
      {/* Header */}
      <View style={[rs.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={rs.routeRow}>
            <Text style={rs.routeCity}>{from}</Text>
            <Plane size={13} color={T(C.blue, 'fg')} style={{ marginHorizontal: 6 }} />
            <Text style={rs.routeCity}>{to}</Text>
          </View>
          <Text style={rs.routeMeta}>
            {dateLabel} · {travellers} · {cabin}
          </Text>
        </View>
        <TouchableOpacity
          style={rs.filterBtn}
          activeOpacity={0.8}
          onPress={() => setFiltersVisible(true)}
        >
          <SlidersHorizontal size={15} color={T(C.blue, 'fg')} />
          <Text style={rs.filterBtnText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={rs.filterBadge}>
              <Text style={rs.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Fare type bar */}
      <FareTypeBar selected={selectedFare} onSelect={setSelectedFare} />

      {/* Quick popular filters */}
      <QuickFiltersBar filters={appliedFilters} onChange={setAppliedFilters} />

      {/* Sort bar */}
      <TouchableOpacity
        style={rs.sortBar}
        activeOpacity={0.8}
        onPress={() => setSortExpanded(!sortExpanded)}
      >
        <Filter size={13} color={T(C.textLight, 'fg')} />
        <Text style={rs.sortLabel}>Sort: </Text>
        <Text style={rs.sortValue}>{sortLabel}</Text>
        {sortExpanded ? (
          <ChevronUp size={14} color={T(C.textLight, 'fg')} />
        ) : (
          <ChevronDown size={14} color={T(C.textLight, 'fg')} />
        )}
      </TouchableOpacity>

      {sortExpanded && (
        <View style={rs.sortDropdown}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={rs.sortOption}
              activeOpacity={0.7}
              onPress={() => {
                setSortLabel(opt);
                setSortExpanded(false);
              }}
            >
              <Text style={[rs.sortOptionText, sortLabel === opt && rs.sortOptionTextActive]}>
                {opt}
              </Text>
              {sortLabel === opt && <Check size={14} color={T(C.blue, 'fg')} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results list */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={rs.list}
      >
        {!loading && flights.some((f) => isDemoTrace(f.traceId)) && <DemoFareNotice />}
        <View style={rs.resultHead}>
          <Text style={rs.resultCount}>
            {loading ? 'Searching live fares…' : `${sortedFlights.length} flights found`}
          </Text>
          {activeFilterCount > 0 && !loading && (
            <TouchableOpacity onPress={() => setAppliedFilters(DEFAULT_FILTERS)}>
              <Text style={rs.clearLink}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
        {loading ? (
          <View style={rs.empty}>
            <ActivityIndicator size="large" color={T(C.blue, 'fg')} />
            <Text style={[rs.emptySub, { marginTop: 14 }]}>
              Fetching live fares from airlines. This can take a few seconds.
            </Text>
          </View>
        ) : loadError && flights.length === 0 ? (
          <View style={rs.empty}>
            <Text style={rs.emptyTitle}>Couldn’t load flights</Text>
            <Text style={rs.emptySub}>{loadError}</Text>
            <TouchableOpacity style={rs.emptyBtn} onPress={() => setReloadKey((k) => k + 1)}><BrandFill />
              <Text style={rs.emptyBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : sortedFlights.length === 0 ? (
          <View style={rs.empty}>
            <Text style={rs.emptyTitle}>No flights match</Text>
            <Text style={rs.emptySub}>Try removing some filters to see more options</Text>
            <TouchableOpacity
              style={rs.emptyBtn}
              onPress={() => setAppliedFilters(DEFAULT_FILTERS)}
            ><BrandFill />
              <Text style={rs.emptyBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sortedFlights.map((f) => (
            <FlightCard key={f.id} flight={f} onViewPrices={onViewPrices} />
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Filters modal */}
      <FiltersModal
        visible={filtersVisible}
        value={appliedFilters}
        flights={flights}
        onClose={() => setFiltersVisible(false)}
        onApply={setAppliedFilters}
      />
    </View>
  );
}

const make_rs = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: T(C.white, 'page'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'page'),
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  routeCity: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  routeMeta: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: T(C.blue, 'border'),
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: T(C.blueLight, 'bg'),
  },
  filterBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg') },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T(C.orange, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: T(C.white, 'fg'), fontSize: 9, fontFamily: 'Inter_700Bold' },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T(C.white, 'bg'),
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  sortLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  sortValue: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sortDropdown: {
    backgroundColor: T(C.white, 'bg'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
    paddingHorizontal: 14,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  sortOptionText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  sortOptionTextActive: { color: T(C.blue, 'fg'), fontFamily: 'Inter_700Bold' },
  list: { paddingTop: 12 },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  resultCount: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
  },
  clearLink: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  empty: {
    marginHorizontal: 14,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 24,
    alignItems: 'center',
   ...glass(18), },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  emptyBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
   overflow: 'hidden', },
  emptyBtnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
});
const use_rs = () => useThemedStyles(make_rs);
