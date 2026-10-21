import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clearOptionSet, setOptionSet } from '@/services/assistant/bridge';
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
import { serviceColors as C } from './serviceColors';
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  Bus,
  Moon,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Users,
} from 'lucide-react-native';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



// ─── Auto-scrolling poster banner ────────────────────────────────────────────
const BANNER_W = SCREEN_WIDTH - 28;
const AUTO_SCROLL_MS = 3000;

interface Poster {
  image: any;
  company: string;
  tagline: string;
}

const POSTERS: Poster[] = [
  { image: require('../../assets/images/bus-poster-1.jpg'), company: 'RedLine Travels', tagline: 'Best service · 4.8 ★ rated by travellers' },
  { image: require('../../assets/images/bus-poster-2.jpg'), company: 'BlueWave Express', tagline: 'Top customer reviews · On-time promise' },
  { image: require('../../assets/images/bus-poster-3.jpg'), company: 'GreenGo Coaches', tagline: 'Eco-friendly fleet · Loved by 1M+ riders' },
  { image: require('../../assets/images/bus-poster-4.jpg'), company: 'NightRider Sleepers', tagline: 'Best night service · Cozy sleeper berths' },
  { image: require('../../assets/images/bus-poster-5.jpg'), company: 'SunCity Travels', tagline: 'Best-in-class comfort · 4.7 ★ reviews' },
  { image: require('../../assets/images/bus-poster-6.jpg'), company: 'Coastal Kings', tagline: 'Premium coastal routes · Top rated crew' },
  { image: require('../../assets/images/bus-poster-7.jpg'), company: 'MorningStar Bus Co.', tagline: 'Happiest travellers · Best reviewed 2026' },
];

function PosterCarousel() {
  const pc = use_pc();
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
      const next = (pageRef.current + 1) % POSTERS.length;
      scrollRef.current?.scrollTo({ x: next * (BANNER_W + 10), animated: true });
      pageRef.current = next;
      setPage(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={pc.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={BANNER_W + 10}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pc.row}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          draggingRef.current = false;
        }}
        scrollEventThrottle={16}
      >
        {POSTERS.map((p) => (
          <View key={p.company} style={pc.card}>
            <Image source={p.image} style={pc.image} resizeMode="cover" />
            <View style={pc.overlay} />
            <View style={pc.badge}>
              <Star size={10} color={T('#FDE68A', 'fg')} fill={T('#FDE68A', 'fg')} />
              <Text style={pc.badgeText}> Top Rated</Text>
            </View>
            <View style={pc.caption}>
              <Text style={pc.company}>{p.company}</Text>
              <Text style={pc.tagline}>{p.tagline}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={pc.dots}>
        {POSTERS.map((_, i) => (
          <View key={i} style={[pc.dot, i === page ? pc.dotActive : pc.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

const make_pc = () => StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: BANNER_W,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: T(C.lightGray, 'bg'),
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.30)',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: T(C.white, 'fg'), fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  caption: { position: 'absolute', left: 14, bottom: 12 },
  company: {
    color: T(C.white, 'fg'),
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  dot: { height: 5, borderRadius: 3 },
  dotActive: { width: 16, backgroundColor: T(C.orange, 'bg') },
  dotInactive: { width: 5, backgroundColor: T('#D1D5DB', 'bg') },
});
const use_pc = () => useThemedStyles(make_pc);

// ─── Bus data ────────────────────────────────────────────────────────────────
export interface BusTicket {
  id: number;
  company: string;
  ac: boolean;
  sleeper: boolean;
  luxury: boolean;
  layout: string;
  price: number;
  discounted: number;
  seatsLeft: number;
  rating: number;
  depart: string;
  arrive: string;
  duration: string;
  night: boolean;
}

const BUSES: BusTicket[] = [
  { id: 1, company: 'RedLine Travels', ac: true, sleeper: true, luxury: true, layout: '1+1', price: 1499, discounted: 1199, seatsLeft: 8, rating: 4.8, depart: '21:30', arrive: '05:45', duration: '8h 15m', night: true },
  { id: 2, company: 'BlueWave Express', ac: true, sleeper: false, luxury: false, layout: '2+2', price: 749, discounted: 649, seatsLeft: 14, rating: 4.6, depart: '06:15', arrive: '11:30', duration: '5h 15m', night: false },
  { id: 3, company: 'GreenGo Coaches', ac: false, sleeper: false, luxury: false, layout: '2+2', price: 449, discounted: 379, seatsLeft: 22, rating: 4.2, depart: '07:00', arrive: '12:40', duration: '5h 40m', night: false },
  { id: 4, company: 'NightRider Sleepers', ac: true, sleeper: true, luxury: false, layout: '1+2', price: 999, discounted: 849, seatsLeft: 5, rating: 4.7, depart: '22:45', arrive: '06:10', duration: '7h 25m', night: true },
  { id: 5, company: 'SunCity Travels', ac: true, sleeper: false, luxury: true, layout: '2+2', price: 899, discounted: 799, seatsLeft: 11, rating: 4.7, depart: '09:30', arrive: '15:00', duration: '5h 30m', night: false },
  { id: 6, company: 'Coastal Kings', ac: true, sleeper: true, luxury: true, layout: '1+1', price: 1699, discounted: 1399, seatsLeft: 4, rating: 4.9, depart: '20:00', arrive: '04:30', duration: '8h 30m', night: true },
  { id: 7, company: 'MorningStar Bus Co.', ac: false, sleeper: false, luxury: false, layout: '3+2', price: 349, discounted: 299, seatsLeft: 31, rating: 4.0, depart: '05:45', arrive: '11:15', duration: '5h 30m', night: false },
  { id: 8, company: 'Highway Hopper', ac: true, sleeper: false, luxury: false, layout: '2+2', price: 699, discounted: 599, seatsLeft: 17, rating: 4.4, depart: '13:15', arrive: '18:50', duration: '5h 35m', night: false },
  { id: 9, company: 'DreamLiner Sleepers', ac: true, sleeper: true, luxury: false, layout: '1+2', price: 1099, discounted: 949, seatsLeft: 9, rating: 4.5, depart: '23:30', arrive: '07:00', duration: '7h 30m', night: true },
  { id: 10, company: 'Metro Connect', ac: false, sleeper: true, luxury: false, layout: '1+2', price: 649, discounted: 549, seatsLeft: 13, rating: 4.1, depart: '21:00', arrive: '04:50', duration: '7h 50m', night: true },
  { id: 11, company: 'Royal Roadways', ac: true, sleeper: false, luxury: true, layout: '2+2', price: 949, discounted: 829, seatsLeft: 7, rating: 4.6, depart: '10:45', arrive: '16:20', duration: '5h 35m', night: false },
  { id: 12, company: 'Swift Shuttle', ac: false, sleeper: false, luxury: false, layout: '2+3', price: 399, discounted: 339, seatsLeft: 26, rating: 3.9, depart: '14:30', arrive: '20:10', duration: '5h 40m', night: false },
];

// ─── Filters ─────────────────────────────────────────────────────────────────
type FilterKey =
  | 'all'
  | 'ac'
  | 'nonAc'
  | 'sleeper'
  | 'seater'
  | 'luxury'
  | 'morning'
  | 'night'
  | 'topRated';

const FILTERS: { key: FilterKey; label: string; Icon: any }[] = [
  { key: 'all', label: 'All', Icon: Bus },
  { key: 'ac', label: 'AC', Icon: Snowflake },
  { key: 'nonAc', label: 'Non-AC', Icon: Sun },
  { key: 'sleeper', label: 'Sleeper', Icon: Moon },
  { key: 'seater', label: 'Seater', Icon: Armchair },
  { key: 'luxury', label: 'Luxury', Icon: Sparkles },
  { key: 'morning', label: 'Morning', Icon: Sun },
  { key: 'night', label: 'Night', Icon: Moon },
  { key: 'topRated', label: 'Top Rated', Icon: Star },
];

function matchesFilter(b: BusTicket, f: FilterKey): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'ac':
      return b.ac;
    case 'nonAc':
      return !b.ac;
    case 'sleeper':
      return b.sleeper;
    case 'seater':
      return !b.sleeper;
    case 'luxury':
      return b.luxury;
    case 'morning':
      return !b.night;
    case 'night':
      return b.night;
    case 'topRated':
      return b.rating >= 4.5;
  }
}

function FilterRow({
  active,
  onChange,
}: {
  active: FilterKey;
  onChange: (f: FilterKey) => void;
}) {
  const fl = use_fl();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={fl.row}
      style={fl.wrap}
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <TouchableOpacity
            key={f.key}
            style={[fl.chip, isActive && fl.chipActive]}
            onPress={() => onChange(f.key)}
            activeOpacity={0.8}
          >
            <f.Icon size={13} color={isActive ? T(C.white, 'fg') : T(C.textLight, 'fg')} />
            <Text style={[fl.chipText, isActive && fl.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const make_fl = () => StyleSheet.create({
  wrap: { marginTop: 16, flexGrow: 0 },
  row: { paddingHorizontal: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: T(C.orange, 'bg'), borderColor: T(C.orange, 'border') },
  chipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  chipTextActive: { color: T(C.white, 'fg') },
});
const use_fl = () => useThemedStyles(make_fl);

// ─── Ticket card (real-ticket look with side notches) ───────────────────────
const NOTCH = 12;

function TicketCard({ bus, onSelect }: { bus: BusTicket; onSelect: (bus: BusTicket) => void }) {
  const tk = use_tk();
  const pct = Math.round(((bus.price - bus.discounted) / bus.price) * 100);
  return (
    <View style={tk.outer}>
      <View style={tk.card}>
        {/* Top row: company + rating */}
        <View style={tk.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={tk.company}>{bus.company}</Text>
            <Text style={tk.type}>
              {bus.ac ? 'AC' : 'Non-AC'} · {bus.sleeper ? 'Sleeper' : 'Seater'}
              {bus.luxury ? ' · Luxury' : ''} · {bus.layout}
            </Text>
          </View>
          <View style={tk.ratingPill}>
            <Star size={10} color={T(C.white, 'fg')} fill={T(C.white, 'fg')} />
            <Text style={tk.ratingText}> {bus.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Times */}
        <View style={tk.timesRow}>
          <Text style={tk.time}>{bus.depart}</Text>
          <View style={tk.timeLine}>
            <View style={tk.lineDot} />
            <View style={tk.line} />
            <Bus size={12} color={T(C.gray, 'fg')} />
            <View style={tk.line} />
            <View style={tk.lineDot} />
          </View>
          <Text style={tk.time}>{bus.arrive}</Text>
          <Text style={tk.duration}>{bus.duration}</Text>
        </View>

        {/* Dashed divider with the notches */}
        <View style={tk.dividerRow}>
          <View style={tk.notchLeft} />
          <View style={tk.dashed} />
          <View style={tk.notchRight} />
        </View>

        {/* Bottom row: price + seats */}
        <View style={tk.bottomRow}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Text style={tk.priceOld}>₹{bus.price}</Text>
              <Text style={tk.price}>₹{bus.discounted}</Text>
            </View>
            <Text style={tk.priceOff}>{pct}% off · per seat</Text>
          </View>
          <View style={tk.seatBox}>
            <Users size={12} color={bus.seatsLeft <= 5 ? T('#DC2626', 'fg') : T(C.green, 'fg')} />
            <Text style={[tk.seats, bus.seatsLeft <= 5 && { color: T('#DC2626', 'fg') }]}>
              {' '}
              {bus.seatsLeft} seats left
            </Text>
          </View>
          <TouchableOpacity style={tk.selectBtn} activeOpacity={0.85} onPress={() => onSelect(bus)}><BrandFill />
            <Text style={tk.selectText}>View Seats</Text>
            <ArrowRight size={13} color={T(C.white, 'fg')} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const make_tk = () => StyleSheet.create({
  outer: { paddingHorizontal: 14, marginBottom: 12 },
  card: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
   ...glass(22), },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
  },
  company: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  type: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), marginTop: 2 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: { color: T(C.white, 'fg'), fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  time: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  timeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  line: { flex: 1, height: 1, backgroundColor: T(C.border, 'bg') },
  lineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T(C.orange, 'bg') },
  duration: { fontSize: 10, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    height: NOTCH * 2,
  },
  notchLeft: {
    width: NOTCH,
    height: NOTCH * 2,
    borderTopRightRadius: NOTCH,
    borderBottomRightRadius: NOTCH,
    backgroundColor: T(C.pageBg, 'bg'),
    marginLeft: -1,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: T(C.border, 'border'),
  },
  notchRight: {
    width: NOTCH,
    height: NOTCH * 2,
    borderTopLeftRadius: NOTCH,
    borderBottomLeftRadius: NOTCH,
    backgroundColor: T(C.pageBg, 'bg'),
    marginRight: -1,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: T(C.border, 'border'),
  },
  dashed: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderColor: T('#D1D5DB', 'border'),
    borderStyle: 'dashed',
    marginHorizontal: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  priceOld: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.gray, 'fg'),
    textDecorationLine: 'line-through',
    marginBottom: 1,
  },
  price: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  priceOff: { fontSize: 9.5, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg'), marginTop: 2 },
  seatBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  seats: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg') },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  selectText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
});
const use_tk = () => useThemedStyles(make_tk);

// ─── Bus Results Screen ──────────────────────────────────────────────────────
export function BusResultsScreen({
  from,
  to,
  dateLabel,
  busType,
  onBack,
  onSelectBus,
}: {
  from: string;
  to: string;
  dateLabel: string;
  /** The bus type picked on the search screen; it starts as the selected filter. */
  busType?: 'ac' | 'sleeper' | 'seater' | 'luxury';
  onBack: () => void;
  onSelectBus: (bus: BusTicket) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [filter, setFilter] = useState<FilterKey>(busType ?? 'all');

  const buses = useMemo(() => BUSES.filter((b) => matchesFilter(b, filter)), [filter]);

  // Let the voice assistant read out and pick from what is on screen.
  useEffect(() => {
    setOptionSet({
      kind: 'buses',
      loading: false,
      items: buses.map((b) => ({
        title: b.company,
        detail: `${b.ac ? 'AC' : 'Non-AC'} ${b.sleeper ? 'sleeper' : 'seater'}, departs ${b.depart}, arrives ${b.arrive}, ${b.duration}, ₹${b.discounted}, ${b.seatsLeft} seats left`,
      })),
      select: (i) => {
        const b = buses[i];
        if (b) onSelectBus(b);
      },
    });
    return () => clearOptionSet('buses');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buses]);

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <View style={st.routeRow}>
            <Text style={st.headerTitle}>{from}</Text>
            <ArrowRight size={15} color={T(C.textLight, 'fg')} />
            <Text style={st.headerTitle}>{to}</Text>
          </View>
          <Text style={st.headerSub}>{dateLabel} · {BUSES.length} buses found</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.headerIcon}>
          <Bus size={18} color={T(C.orange, 'fg')} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
      >
        <PosterCarousel />
        <FilterRow active={filter} onChange={setFilter} />

        <Text style={st.listHeading}>
          {buses.length} {buses.length === 1 ? 'bus' : 'buses'}
          {filter !== 'all' ? ` · ${FILTERS.find((f) => f.key === filter)?.label}` : ''}
        </Text>

        {buses.length === 0 ? (
          <View style={st.empty}>
            <Bus size={28} color={T(C.gray, 'fg')} />
            <Text style={st.emptyText}>No buses match this filter</Text>
          </View>
        ) : (
          buses.map((b) => <TicketCard key={b.id} bus={b} onSelect={onSelectBus} />)
        )}
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
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 1,
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
  listHeading: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
});
const use_st = () => useThemedStyles(make_st);
