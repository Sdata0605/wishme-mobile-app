import React, { useEffect, useState } from 'react';
import { useAgentPrefill } from '@/context/AgentStateContext';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serviceColors as C } from './serviceColors';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bus,
  Calendar,
  Check,
  ChevronRight,
  Headphones,
  MapPin,
  Moon,
  Percent,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Tag,
  Ticket,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { T, useThemedStyles, glass, dk, N } from './themed';
import { BrandFill, BannerScrim } from './BrandFill';



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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
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
                  <MapPin size={16} color={T(C.orange, 'fg')} />
                </View>
                <Text style={md.cityText}>{city}</Text>
                {selected === city && <Check size={18} color={T(C.green, 'fg')} />}
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
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
                  <Calendar size={16} color={T(C.purpleLight, 'fg')} />
                </View>
                <Text style={md.cityText}>
                  {formatDate(d)}
                  {i === 0 ? '  ·  Today' : i === 1 ? '  ·  Tomorrow' : ''}
                </Text>
                {sameDay(selected, d) && <Check size={18} color={T(C.green, 'fg')} />}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T(C.white, 'bg'),
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
    backgroundColor: T('#F5F0FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
});
const use_md = () => useThemedStyles(make_md);

// ─── Search card ─────────────────────────────────────────────────────────────
function SearchCard({
  onSearch,
}: {
  onSearch: (from: string, to: string, dateLabel: string) => void;
}) {
  const sc = use_sc();
  const agentPrefill = useAgentPrefill();
  const [from, setFrom] = useState(agentPrefill.busFrom || 'Mumbai');
  const [to, setTo] = useState(agentPrefill.busTo || 'Pune');
  const [date, setDate] = useState(() => new Date());
  const [womenBooking, setWomenBooking] = useState(false);
  const [picker, setPicker] = useState<'from' | 'to' | 'date' | null>(null);

  useEffect(() => {
    if (agentPrefill.busFrom) setFrom(agentPrefill.busFrom);
    if (agentPrefill.busTo) setTo(agentPrefill.busTo);
  }, [agentPrefill.busFrom, agentPrefill.busTo]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <View style={sc.card}>
      {/* From / To */}
      <View style={sc.routeBox}>
        <TouchableOpacity style={sc.cityRow} onPress={() => setPicker('from')} activeOpacity={0.7}>
          <View style={sc.dotFrom} />
          <View style={{ flex: 1 }}>
            <Text style={sc.fieldLabel}>From</Text>
            <Text style={sc.cityValue}>{from}</Text>
          </View>
        </TouchableOpacity>
        <View style={sc.divider} />
        <TouchableOpacity style={sc.cityRow} onPress={() => setPicker('to')} activeOpacity={0.7}>
          <View style={sc.dotTo} />
          <View style={{ flex: 1 }}>
            <Text style={sc.fieldLabel}>To</Text>
            <Text style={sc.cityValue}>{to}</Text>
          </View>
        </TouchableOpacity>
        {/* Swap button */}
        <TouchableOpacity style={sc.swapBtn} onPress={swap} activeOpacity={0.8}>
          <ArrowUpDown size={16} color={T(C.white, 'fg')} />
        </TouchableOpacity>
      </View>

      {/* Date */}
      <TouchableOpacity style={sc.dateRow} onPress={() => setPicker('date')} activeOpacity={0.7}>
        <Calendar size={18} color={T(C.purpleLight, 'fg')} />
        <View style={{ flex: 1 }}>
          <Text style={sc.fieldLabel}>Date of journey</Text>
          <Text style={sc.cityValue}>{formatDate(date)}</Text>
        </View>
        <View style={sc.chipRow}>
          <TouchableOpacity
            style={[sc.chip, sameDay(date, today) && sc.chipActive]}
            onPress={() => setDate(new Date())}
          >
            <Text style={[sc.chipText, sameDay(date, today) && sc.chipTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sc.chip, sameDay(date, tomorrow) && sc.chipActive]}
            onPress={() => {
              const t = new Date();
              t.setDate(t.getDate() + 1);
              setDate(t);
            }}
          >
            <Text style={[sc.chipText, sameDay(date, tomorrow) && sc.chipTextActive]}>
              Tomorrow
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Women booking toggle */}
      <View style={sc.womenRow}>
        <View style={sc.womenIcon}>
          <Users size={16} color={T('#DB2777', 'fg')} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sc.womenTitle}>Booking for women</Text>
          <Text style={sc.womenSub}>Safer seat options & women-only deals</Text>
        </View>
        <Switch
          value={womenBooking}
          onValueChange={setWomenBooking}
          trackColor={{ false: T('#D1D5DB', 'bg'), true: T('#F9A8D4', 'bg') }}
          thumbColor={womenBooking ? T('#DB2777', 'fg') : T('#F9FAFB', 'fg')}
        />
      </View>

      {/* Search button */}
      <TouchableOpacity
        style={sc.searchBtn}
        activeOpacity={0.85}
        onPress={() => onSearch(from, to, formatDate(date))}
      ><BrandFill />
        <Search size={18} color={T(C.white, 'fg')} />
        <Text style={sc.searchBtnText}>Search Buses</Text>
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
  card: {
    backgroundColor: T(C.white, 'bg'),
    marginHorizontal: 14,
    marginTop: dk(14, -34),
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
   ...glass(22), },
  routeBox: {
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    position: 'relative',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dotFrom: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: T(C.green, 'bg'),
  },
  dotTo: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: T(C.orange, 'bg'),
  },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginLeft: 33 },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  cityValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 1 },
  swapBtn: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T(C.orange, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
  },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: T(C.white, 'bg'),
  },
  chipActive: { backgroundColor: T('#F5F0FF', 'bg'), borderColor: T(C.orange, 'border') },
  chipText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  chipTextActive: { color: T(C.orange, 'fg') },
  womenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: T('#FDF2F8', 'bg'),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: T('#FBCFE8', 'border'),
  },
  womenIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T('#FCE7F3', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  womenTitle: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  womenSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 14,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
   overflow: 'hidden', },
  searchBtnText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_sc = () => useThemedStyles(make_sc);

// ─── Bus type chips ──────────────────────────────────────────────────────────
const BUS_TYPES = [
  { label: 'AC', Icon: Snowflake, color: '#1F7BFF', bg: '#EFF6FF' },
  { label: 'Sleeper', Icon: Moon, color: T(C.purpleLight, 'fg'), bg: '#F5F3FF' },
  { label: 'Luxury', Icon: Sparkles, color: '#D97706', bg: '#FFFBEB' },
  { label: 'Seater', Icon: Bus, color: T(C.green, 'fg'), bg: '#ECFDF5' },
];

function BusTypes() {
  const bt = use_bt();
  return (
    <View style={bt.section}>
      <Text style={bt.heading}>Browse by bus type</Text>
      <View style={bt.row}>
        {BUS_TYPES.map((t) => (
          <TouchableOpacity key={t.label} style={bt.chipCard} activeOpacity={0.8}>
            <View style={[bt.iconBg, { backgroundColor: T(t.bg, 'bg') }]}>
              <t.Icon size={20} color={T(t.color, 'fg')} />
            </View>
            <Text style={bt.label}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const make_bt = () => StyleSheet.create({
  section: { marginTop: 20, paddingHorizontal: 14 },
  heading: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  chipCard: {
    flex: 1,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
});
const use_bt = () => useThemedStyles(make_bt);

// ─── Popular routes ──────────────────────────────────────────────────────────
const ROUTES = [
  { from: 'Mumbai', to: 'Pune', price: '₹349', time: '3h 30m' },
  { from: 'Delhi', to: 'Jaipur', price: '₹449', time: '5h 15m' },
  { from: 'Bengaluru', to: 'Chennai', price: '₹549', time: '6h 00m' },
  { from: 'Hyderabad', to: 'Bengaluru', price: '₹699', time: '8h 30m' },
];

function PopularRoutes() {
  const pr = use_pr();
  return (
    <View style={pr.section}>
      <View style={pr.head}>
        <Text style={pr.heading}>Popular bus routes</Text>
        <TouchableOpacity style={pr.viewAll}>
          <Text style={pr.viewAllText}>View All</Text>
          <ChevronRight size={14} color={T(C.orange, 'fg')} />
        </TouchableOpacity>
      </View>
      {ROUTES.map((r) => (
        <TouchableOpacity key={`${r.from}-${r.to}`} style={pr.card} activeOpacity={0.8}>
          <View style={pr.iconBox}>
            <Bus size={20} color={T(C.orange, 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={pr.routeRow}>
              <Text style={pr.city}>{r.from}</Text>
              <ArrowRight size={13} color={T(C.gray, 'fg')} />
              <Text style={pr.city}>{r.to}</Text>
            </View>
            <Text style={pr.time}>~ {r.time} · daily departures</Text>
          </View>
          <View style={pr.priceBox}>
            <Text style={pr.priceLabel}>from</Text>
            <Text style={pr.price}>{r.price}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const make_pr = () => StyleSheet.create({
  section: { marginTop: 20, paddingHorizontal: 14 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heading: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(18), },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: T('#F5F0FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  city: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  time: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  price: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
});
const use_pr = () => useThemedStyles(make_pr);

// ─── Offers strip ────────────────────────────────────────────────────────────
function BusOffer() {
  const ofr = use_ofr();
  return (
    <View style={ofr.container}><BrandFill />
      <View style={ofr.iconBox}>
        <Percent size={26} color={T('#FCD34D', 'fg')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ofr.headline}>Flat 10% off on bus tickets</Text>
        <View style={ofr.codePill}>
          <Tag size={10} color={T(C.white, 'fg')} />
          <Text style={ofr.codeText}> Use Code: BUS10</Text>
        </View>
      </View>
      <TouchableOpacity style={ofr.btn}><BrandFill />
        <Text style={ofr.btnText}>Claim</Text>
      </TouchableOpacity>
    </View>
  );
}

const make_ofr = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.purple, 'bg'),
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
   overflow: 'hidden', },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_700Bold' },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  codeText: { color: T(C.white, 'fg'), fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
const use_ofr = () => useThemedStyles(make_ofr);

// ─── Trust strip ─────────────────────────────────────────────────────────────
const TRUST = [
  { Icon: ShieldCheck, color: T(C.green, 'fg'), title: 'Safe Travel', sub: 'Verified operators' },
  { Icon: Ticket, color: '#FBBF24', title: 'Instant Ticket', sub: 'M-ticket on phone' },
  { Icon: Zap, color: '#25DFFF', title: 'Free Cancel', sub: 'On select buses' },
  { Icon: Headphones, color: T(C.green, 'fg'), title: '24x7 Help', sub: 'Trip support' },
];

function TrustStrip() {
  const ts = use_ts();
  return (
    <View style={ts.container}>
      {TRUST.map((b, i) => (
        <View key={b.title} style={[ts.item, i < TRUST.length - 1 && ts.itemBorder]}>
          <b.Icon size={20} color={T(b.color, 'fg')} />
          <Text style={ts.title}>{b.title}</Text>
          <Text style={ts.sub}>{b.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const make_ts = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.darkBg, 'bg'),
    marginTop: 20,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  itemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: {
    color: T(C.white, 'fg'),
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 11,
  },
});
const use_ts = () => useThemedStyles(make_ts);

// ─── Bus Tickets Screen ──────────────────────────────────────────────────────
export function BusTicketsScreen({
  onBack,
  onSearch,
  onOpenMyTickets,
}: {
  onBack: () => void;
  onSearch: (from: string, to: string, dateLabel: string) => void;
  onOpenMyTickets?: () => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Bus Tickets</Text>
          <Text style={st.headerSub}>10,000+ routes across India</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={st.myTicketsBtn}
          onPress={onOpenMyTickets}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={st.myTicketsText}>My Tickets</Text>
          <View style={st.headerIcon}>
            <Bus size={18} color={T(C.orange, 'fg')} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        bounces
      >
        {/* Banner */}
        <View style={st.bannerWrap}>
          <Image
            source={require('../../assets/images/travel-luxury-bus.jpg')}
            style={st.bannerImage}
            resizeMode="cover"
          />
          <View style={st.bannerOverlay} />
          <BannerScrim />
          <View style={st.bannerCaption}>
            <Text style={st.bannerTitle}>Book Bus Tickets</Text>
            <Text style={st.bannerSub}>AC, Sleeper & Luxury coaches</Text>
          </View>
        </View>

        <SearchCard onSearch={onSearch} />
        <BusTypes />
        <PopularRoutes />
        <BusOffer />
        <TrustStrip />
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const make_st = () => StyleSheet.create({
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 1,
  },
  myTicketsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  myTicketsText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.orange, 'fg'),
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T('#F5F0FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
  bannerWrap: {
    height: 170,
    backgroundColor: T(C.lightGray, 'bg'),
    position: 'relative',
    ...{ marginHorizontal: dk(14, 0), marginTop: dk(10, 0), borderRadius: dk(22, 0), borderWidth: dk(1.5, 0), borderColor: N().cardBorder, overflow: 'hidden' },
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.40)',
  },
  bannerCaption: { position: 'absolute', left: 16, top: 22 },
  bannerTitle: {
    color: T(C.white, 'fg'),
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
const use_st = () => useThemedStyles(make_st);
