import React, { useState } from 'react';
import {
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

// ─── Flight data ──────────────────────────────────────────────────────────────
export interface FlightResult {
  id: number;
  airline: string;
  logo: string;
  depart: string;
  arrive: string;
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

const FLIGHTS: FlightResult[] = [
  {
    id: 1,
    airline: 'IndiGo',
    logo: '🟦',
    depart: '05:30',
    arrive: '07:45',
    duration: '2h 15m',
    durationMins: 135,
    stops: 0,
    price: 4299,
    originalPrice: 5499,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 2,
    airline: 'Air India',
    logo: '🔴',
    depart: '07:30',
    arrive: '10:00',
    duration: '2h 30m',
    durationMins: 150,
    stops: 0,
    price: 5199,
    originalPrice: 6499,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 3,
    airline: 'SpiceJet',
    logo: '🟧',
    depart: '09:15',
    arrive: '12:45',
    duration: '3h 30m',
    durationMins: 210,
    stops: 1,
    price: 3899,
    originalPrice: 4799,
    refundable: false,
    depAirport: 'DEL',
    arrAirport: 'BOM',
    layoverAirport: 'AMD',
    layoverMins: 55,
  },
  {
    id: 4,
    airline: 'Akasa Air',
    logo: '🟨',
    depart: '11:00',
    arrive: '13:20',
    duration: '2h 20m',
    durationMins: 140,
    stops: 0,
    price: 4599,
    originalPrice: 5299,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 5,
    airline: 'Vistara',
    logo: '🟣',
    depart: '13:45',
    arrive: '16:30',
    duration: '2h 45m',
    durationMins: 165,
    stops: 0,
    price: 6299,
    originalPrice: 7499,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 6,
    airline: 'GoFirst',
    logo: '🟩',
    depart: '15:20',
    arrive: '19:50',
    duration: '4h 30m',
    durationMins: 270,
    stops: 1,
    price: 3299,
    originalPrice: 4199,
    refundable: false,
    depAirport: 'DEL',
    arrAirport: 'BOM',
    layoverAirport: 'HYD',
    layoverMins: 90,
  },
  {
    id: 7,
    airline: 'IndiGo',
    logo: '🟦',
    depart: '17:00',
    arrive: '21:40',
    duration: '4h 40m',
    durationMins: 280,
    stops: 1,
    price: 3599,
    originalPrice: 4799,
    refundable: true,
    depAirport: 'HDO',
    arrAirport: 'BOM',
    layoverAirport: 'PNQ',
    layoverMins: 70,
  },
  {
    id: 8,
    airline: 'Air India',
    logo: '🔴',
    depart: '20:00',
    arrive: '22:30',
    duration: '2h 30m',
    durationMins: 150,
    stops: 0,
    price: 5799,
    originalPrice: 6999,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 9,
    airline: 'Air India Express',
    logo: '🟤',
    depart: '22:15',
    arrive: '01:05',
    duration: '2h 50m',
    durationMins: 170,
    stops: 0,
    price: 3999,
    originalPrice: 4899,
    refundable: false,
    depAirport: 'DEL',
    arrAirport: 'BOM',
  },
  {
    id: 10,
    airline: 'Vistara',
    logo: '🟣',
    depart: '08:10',
    arrive: '14:55',
    duration: '6h 45m',
    durationMins: 405,
    stops: 2,
    price: 4999,
    originalPrice: 6100,
    refundable: true,
    depAirport: 'DEL',
    arrAirport: 'BOM',
    layoverAirport: 'BLR',
    layoverMins: 150,
  },
];

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
            {active && <Check size={11} color={C.blue} style={{ marginRight: 3 }} />}
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

const ft = StyleSheet.create({
  wrap: { flexGrow: 0, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  row: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.lightGray,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
  },
  chipTextActive: {
    color: C.blue,
    fontFamily: 'Inter_600SemiBold',
  },
  newBadge: {
    backgroundColor: C.red,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  newText: {
    color: C.white,
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
});

// ─── Flight card ──────────────────────────────────────────────────────────────
function FlightCard({
  flight,
  onViewPrices,
}: {
  flight: FlightResult;
  onViewPrices: (f: FlightResult) => void;
}) {
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
          <Plane size={14} color={C.blue} />
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
        <TouchableOpacity style={fc.bookBtn} activeOpacity={0.85} onPress={() => onViewPrices(flight)}>
          <Text style={fc.bookText}>View Prices</Text>
          <ArrowRight size={13} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  airlineRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { fontSize: 20 },
  airline: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  discountBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  discountText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.green },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBlock: { alignItems: 'flex-start' },
  time: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  timeLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: C.gray, marginTop: 1 },
  routeLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duration: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textLight },
  stopPill: {
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  stopPillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  stopText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.orange },
  stopTextGreen: { color: C.green },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.gray,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  perPax: { fontSize: 9, fontFamily: 'Inter_400Regular', color: C.gray, marginTop: 1 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bookText: { color: C.white, fontSize: 13, fontFamily: 'Inter_700Bold' },
});

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
  return (
    <TouchableOpacity style={ch.row} activeOpacity={0.7} onPress={onToggle}>
      <View style={[ch.box, checked && ch.boxChecked]}>
        {checked && <Check size={11} color={C.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ch.label}>{label}</Text>
        {!!sub && <Text style={ch.sub}>{sub}</Text>}
      </View>
      {!!right && <Text style={ch.right}>{right}</Text>}
    </TouchableOpacity>
  );
}

const ch = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  boxChecked: { backgroundColor: C.blue, borderColor: C.blue },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  right: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textLight },
});

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

const sl = StyleSheet.create({
  wrap: { marginBottom: 8 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.blue },
  track: {
    height: 4,
    backgroundColor: '#DCDFE5',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: C.blue, borderRadius: 2 },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  stepDot: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  stepDotActive: {},
  stepText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: C.gray },
  stepTextActive: { color: C.blue, fontFamily: 'Inter_700Bold' },
});

function TimeSlotGrid({
  selected,
  onToggle,
}: {
  selected: TimeSlot[];
  onToggle: (slot: TimeSlot) => void;
}) {
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
            <slot.Icon size={18} color={active ? C.blue : C.orange} />
            <Text style={[tsg.label, active && tsg.labelActive]}>{slot.label}</Text>
            <Text style={[tsg.sub, active && tsg.subActive]}>{slot.sub}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tsg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cardActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  label: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 4 },
  labelActive: { color: C.blue },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  subActive: { color: C.blue },
});

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
  onClose,
  onApply,
}: {
  visible: boolean;
  value: FilterState;
  onClose: () => void;
  onApply: (next: FilterState) => void;
}) {
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

  const previewCount = applyFlightFilters(FLIGHTS, filters).length;
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
                <RotateCcw size={13} color={C.orange} />
                <Text style={fm.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={C.text} />
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
                      right={`${FLIGHTS.filter((f) => f.stops === 0).length}`}
                      onToggle={() => setFilters((f) => ({ ...f, nonStop: !f.nonStop }))}
                    />
                    <View style={fm.separator} />
                    <Checkbox
                      checked={filters.oneStop}
                      label="1 Stop"
                      right={`${FLIGHTS.filter((f) => f.stops === 1).length}`}
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
                            ...FLIGHTS.filter((f) => f.airline === name).map((f) => f.price),
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
                        { key: 'nonStop' as const, label: 'Non Stop', count: FLIGHTS.filter((f) => f.stops === 0).length },
                        { key: 'oneStop' as const, label: '1 Stop', count: FLIGHTS.filter((f) => f.stops === 1).length },
                        { key: 'twoPlusStops' as const, label: '1+ Stop', count: FLIGHTS.filter((f) => f.stops >= 2).length },
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
                    <Search size={14} color={C.gray} />
                    <TextInput
                      style={fm.searchInput}
                      placeholder="Search airlines..."
                      placeholderTextColor={C.gray}
                      value={query}
                      onChangeText={setQuery}
                    />
                  </View>
                  <View style={fm.group}>
                    {airlineList.map((name, i) => {
                      const prices = FLIGHTS.filter((f) => f.airline === name).map((f) => f.price);
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
                    <Clock size={13} color={C.purpleLight} />
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
            >
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

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
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
    borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.orange },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: {
    width: 78,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: C.pageBg,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  sideItem: {
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sideItemActive: {
    backgroundColor: C.white,
    borderLeftColor: C.blue,
  },
  sideText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textLight },
  sideTextActive: { color: C.blue, fontFamily: 'Inter_700Bold' },
  content: { flex: 1, minWidth: 0 },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: C.textLight,
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  group: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  separator: { height: 1, backgroundColor: C.lightGray },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.lightGray,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    padding: 0,
  },
  stopsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.white,
  },
  stopChipActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  stopChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textLight },
  stopChipTextActive: { color: C.blue },
  stopCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.gray },
  stopCountActive: { color: C.blue },
  priceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  priceHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: C.purple,
    lineHeight: 15,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  applyBtn: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});

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
            {active && <Check size={11} color={C.blue} />}
            <Text style={[qf.text, active && qf.textActive]}>{q.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const qf = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  row: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.lightGray,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  text: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textLight },
  textActive: { color: C.blue, fontFamily: 'Inter_600SemiBold' },
});

// ─── Flight Results Screen ────────────────────────────────────────────────────
export function FlightResultsScreen({
  from,
  to,
  dateLabel,
  travellers,
  cabin,
  onBack,
  onViewPrices,
}: {
  from: string;
  to: string;
  dateLabel: string;
  travellers: string;
  cabin: string;
  onBack: () => void;
  onViewPrices: (flight: FlightResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedFare, setSelectedFare] = useState('regular');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortExpanded, setSortExpanded] = useState(false);
  const [sortLabel, setSortLabel] = useState('Price: Low to High');

  const SORT_OPTIONS = [
    'Price: Low to High',
    'Price: High to Low',
    'Departure: Early',
    'Duration: Shortest',
  ];

  const activeFilterCount = countActiveFilters(appliedFilters);

  const sortedFlights = applyFlightFilters(FLIGHTS, appliedFilters).sort((a, b) => {
    if (sortLabel === 'Price: Low to High') return a.price - b.price;
    if (sortLabel === 'Price: High to Low') return b.price - a.price;
    if (sortLabel === 'Departure: Early') return a.depart.localeCompare(b.depart);
    if (sortLabel === 'Duration: Shortest') return a.durationMins - b.durationMins;
    return 0;
  });

  return (
    <View style={rs.root}>
      {/* Header */}
      <View style={[rs.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={rs.routeRow}>
            <Text style={rs.routeCity}>{from}</Text>
            <Plane size={13} color={C.blue} style={{ marginHorizontal: 6 }} />
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
          <SlidersHorizontal size={15} color={C.blue} />
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
        <Filter size={13} color={C.textLight} />
        <Text style={rs.sortLabel}>Sort: </Text>
        <Text style={rs.sortValue}>{sortLabel}</Text>
        {sortExpanded ? (
          <ChevronUp size={14} color={C.textLight} />
        ) : (
          <ChevronDown size={14} color={C.textLight} />
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
              {sortLabel === opt && <Check size={14} color={C.blue} />}
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
        <View style={rs.resultHead}>
          <Text style={rs.resultCount}>{sortedFlights.length} flights found</Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={() => setAppliedFilters(DEFAULT_FILTERS)}>
              <Text style={rs.clearLink}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
        {sortedFlights.length === 0 ? (
          <View style={rs.empty}>
            <Text style={rs.emptyTitle}>No flights match</Text>
            <Text style={rs.emptySub}>Try removing some filters to see more options</Text>
            <TouchableOpacity
              style={rs.emptyBtn}
              onPress={() => setAppliedFilters(DEFAULT_FILTERS)}
            >
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
        onClose={() => setFiltersVisible(false)}
        onApply={setAppliedFilters}
      />
    </View>
  );
}

const rs = StyleSheet.create({
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
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  routeCity: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  routeMeta: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: C.textLight },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: C.blue,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.blueLight,
  },
  filterBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.blue },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: C.white, fontSize: 9, fontFamily: 'Inter_700Bold' },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sortLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textLight },
  sortValue: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: C.text },
  sortDropdown: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 14,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.lightGray,
  },
  sortOptionText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  sortOptionTextActive: { color: C.blue, fontFamily: 'Inter_700Bold' },
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
    color: C.textLight,
  },
  clearLink: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.orange },
  empty: {
    marginHorizontal: 14,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  emptyBtn: {
    backgroundColor: C.orange,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  emptyBtnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_700Bold' },
});
