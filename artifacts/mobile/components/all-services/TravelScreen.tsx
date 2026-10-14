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
import { serviceColors as C } from './serviceColors';
import {
  ArrowLeft,
  BedDouble,
  Bus,
  ChevronRight,
  Headphones,
  Hotel,
  MapPin,
  Percent,
  Plane,
  ShieldCheck,
  Tag,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { T, useThemedStyles, glass, dk, N } from './themed';
import { BrandFill, BannerScrim } from './BrandFill';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



// ─── Banner carousel ─────────────────────────────────────────────────────────
interface Banner {
  title: string;
  sub: string;
  image: any;
  tint: string;
}

const BANNER_W = SCREEN_WIDTH - 28;

const BANNERS: Banner[] = [
  {
    title: 'Flights',
    sub: 'Fly anywhere at the best fares',
    image: require('../../assets/images/travel-flights.jpg'),
    tint: 'rgba(91,33,182,0.35)',
  },
  {
    title: 'Luxury Buses',
    sub: 'Premium sleeper coaches for comfort',
    image: require('../../assets/images/travel-luxury-bus.jpg'),
    tint: 'rgba(17,24,39,0.35)',
  },
  {
    title: 'Buses',
    sub: 'Affordable rides to every city',
    image: require('../../assets/images/travel-bus.jpg'),
    tint: 'rgba(249,115,22,0.30)',
  },
  {
    title: 'Hotels',
    sub: 'Cozy stays to luxury resorts',
    image: require('../../assets/images/travel-hotels.jpg'),
    tint: 'rgba(5,150,105,0.30)',
  },
];

const AUTO_SCROLL_MS = 3500;

function BannerCarousel() {
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
        pagingEnabled={false}
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
            <View style={[bn.overlay, { backgroundColor: T(b.tint, 'bg') }]} />
            <BannerScrim />
            <View style={bn.caption}>
              <Text style={bn.title}>{b.title}</Text>
              <Text style={bn.sub}>{b.sub}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={bn.dots}>
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={[bn.dot, i === page ? bn.dotActive : bn.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const make_bn = () => StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: BANNER_W,
    height: 160,
    borderRadius: dk(22, 18),
    borderWidth: dk(1.5, 0),
    borderColor: N().cardBorder,
    overflow: 'hidden',
    backgroundColor: T(C.lightGray, 'bg'),
  },
  image: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  caption: { position: 'absolute', left: 14, bottom: 12 },
  title: {
    color: T(C.white, 'fg'),
    fontSize: 20,
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
  dotActive: { width: 16, backgroundColor: T(C.orange, 'bg') },
  dotInactive: { width: 5, backgroundColor: T('#D1D5DB', 'bg') },
});
const use_bn = () => useThemedStyles(make_bn);

// ─── Service cards ───────────────────────────────────────────────────────────
interface Service {
  key: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  badge?: string;
}

const SERVICES: Service[] = [
  {
    key: 'flights',
    title: 'Flights',
    desc: 'Domestic & international flights at lowest fares',
    Icon: Plane,
    color: T(C.purpleLight, 'fg'),
    bg: '#F5F3FF',
    badge: 'Upto ₹1,500 off',
  },
  {
    key: 'bus',
    title: 'Bus Tickets',
    desc: 'AC, sleeper & luxury buses across 10,000+ routes',
    Icon: Bus,
    color: T(C.orange, 'fg'),
    bg: '#F5F0FF',
    badge: 'Flat 10% off',
  },
  {
    key: 'hotels',
    title: 'Hotels',
    desc: 'Budget stays to 5-star resorts, best price promise',
    Icon: Hotel,
    color: T(C.green, 'fg'),
    bg: '#ECFDF5',
    badge: 'Save upto 40%',
  },
];

function ServiceCards({
  onOpenBus,
  onOpenFlights,
  onOpenHotels,
}: {
  onOpenBus?: () => void;
  onOpenFlights?: () => void;
  onOpenHotels?: () => void;
}) {
  const sv = use_sv();
  return (
    <View style={sv.section}>
      <Text style={sv.heading}>What would you like to book?</Text>
      {SERVICES.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={sv.card}
          activeOpacity={0.8}
          onPress={
            s.key === 'bus'
              ? onOpenBus
              : s.key === 'flights'
                ? onOpenFlights
                : s.key === 'hotels'
                  ? onOpenHotels
                  : undefined
          }
        >
          <View style={[sv.iconBox, { backgroundColor: T(s.bg, 'bg') }]}>
            <s.Icon size={26} color={T(s.color, 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={sv.titleRow}>
              <Text style={sv.title}>{s.title}</Text>
              {s.badge && (
                <View style={sv.badge}>
                  <Text style={sv.badgeText}>{s.badge}</Text>
                </View>
              )}
            </View>
            <Text style={sv.desc}>{s.desc}</Text>
          </View>
          <ChevronRight size={18} color={T(C.gray, 'fg')} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const make_sv = () => StyleSheet.create({
  section: { marginTop: 18, paddingHorizontal: 14 },
  heading: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  badge: {
    backgroundColor: T('#ECFDF5', 'bg'),
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg') },
  desc: {
    fontSize: 11,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
    lineHeight: 15,
  },
});
const use_sv = () => useThemedStyles(make_sv);

// ─── Popular destinations ────────────────────────────────────────────────────
const DESTINATIONS = [
  { city: 'Goa', tag: 'Beaches', color: T(C.orange, 'fg'), bg: '#F5F0FF' },
  { city: 'Manali', tag: 'Mountains', color: '#2563EB', bg: '#EFF6FF' },
  { city: 'Jaipur', tag: 'Heritage', color: '#DC2626', bg: '#FEE2E2' },
  { city: 'Kerala', tag: 'Backwaters', color: T(C.green, 'fg'), bg: '#ECFDF5' },
  { city: 'Mumbai', tag: 'City life', color: T(C.purpleLight, 'fg'), bg: '#F5F3FF' },
];

function PopularDestinations() {
  const pd = use_pd();
  return (
    <View style={pd.section}>
      <View style={pd.head}>
        <Text style={pd.title}>Popular Destinations</Text>
        <TouchableOpacity style={pd.viewAll}>
          <Text style={pd.viewAllText}>View All</Text>
          <ChevronRight size={14} color={T(C.orange, 'fg')} />
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pd.row}
      >
        {DESTINATIONS.map((d) => (
          <TouchableOpacity key={d.city} style={pd.card} activeOpacity={0.85}>
            <View style={[pd.iconBg, { backgroundColor: T(d.bg, 'bg') }]}>
              <MapPin size={18} color={T(d.color, 'fg')} />
            </View>
            <Text style={pd.city}>{d.city}</Text>
            <Text style={pd.tag}>{d.tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const make_pd = () => StyleSheet.create({
  section: { marginTop: 10 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.orange, 'fg') },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    width: 92,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(18), },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  city: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  tag: { fontSize: 9, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
});
const use_pd = () => useThemedStyles(make_pd);

// ─── Offers strip ────────────────────────────────────────────────────────────
function OffersBanner() {
  const of = use_of();
  return (
    <View style={of.container}><BrandFill />
      <View style={of.iconBox}>
        <Percent size={26} color={T('#FCD34D', 'fg')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={of.headline}>Flat ₹500 off on your first booking</Text>
        <View style={of.codePill}>
          <Tag size={10} color={T(C.white, 'fg')} />
          <Text style={of.codeText}> Use Code: TRAVEL500</Text>
        </View>
      </View>
      <TouchableOpacity style={of.btn}><BrandFill />
        <Text style={of.btnText}>Claim</Text>
      </TouchableOpacity>
    </View>
  );
}

const make_of = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.purple, 'bg'),
    marginHorizontal: 14,
    marginTop: 18,
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
const use_of = () => useThemedStyles(make_of);

// ─── Why book with us ────────────────────────────────────────────────────────
const TRUST = [
  { Icon: ShieldCheck, color: T(C.green, 'fg'), title: 'Secure Booking', sub: 'Bank-grade payment safety' },
  { Icon: Zap, color: '#FBBF24', title: 'Instant Confirm', sub: 'Tickets in seconds' },
  { Icon: Headphones, color: '#60A5FA', title: '24x7 Support', sub: 'Help anytime, anywhere' },
  { Icon: Users, color: T(C.green, 'fg'), title: 'Trusted', sub: '2M+ happy travellers' },
];

function TrustStrip() {
  const tr = use_tr();
  return (
    <View style={tr.container}>
      {TRUST.map((b, i) => (
        <View key={b.title} style={[tr.item, i < TRUST.length - 1 && tr.itemBorder]}>
          <b.Icon size={20} color={T(b.color, 'fg')} />
          <Text style={tr.title}>{b.title}</Text>
          <Text style={tr.sub}>{b.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const make_tr = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.darkBg, 'bg'),
    marginTop: 18,
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
const use_tr = () => useThemedStyles(make_tr);

// ─── Travel Screen ───────────────────────────────────────────────────────────
export function TravelScreen({
  onBack,
  onOpenBus,
  onOpenFlights,
  onOpenHotels,
}: {
  onBack: () => void;
  onOpenBus?: () => void;
  onOpenFlights?: () => void;
  onOpenHotels?: () => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Travel</Text>
          <Text style={st.headerSub}>Flights · Buses · Hotels</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.headerIcon}>
          <BedDouble size={18} color={T(C.purpleLight, 'fg')} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        bounces
      >
        <BannerCarousel />
        <ServiceCards
          onOpenBus={onOpenBus}
          onOpenFlights={onOpenFlights}
          onOpenHotels={onOpenHotels}
        />
        <PopularDestinations />
        <OffersBanner />
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
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T('#F5F3FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
});
const use_st = () => useThemedStyles(make_st);
