import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Shield } from 'lucide-react-native';
import type { FlightResult } from './FlightResultsScreen';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Fare data ────────────────────────────────────────────────────────────────
interface FareTier {
  key: string;
  label: string;
  badge?: string;
  featured: boolean;
  priceOffset: number; // added to base price
  promo?: string;
  baggage: { cabin: string; checkin: string };
  cancellation: string;
  dateChange: string;
  benefits?: string[];
  seatsAndMore?: boolean;
}

const FARE_TIERS: FareTier[] = [
  {
    key: 'saver',
    label: 'SAVER',
    featured: false,
    priceOffset: -600,
    promo: 'Get Flat 10% OFF using WISH10 code',
    baggage: { cabin: '7 Kgs Cabin Baggage', checkin: '15 Kgs Check-in Baggage' },
    cancellation: 'Cancellation fee starts at ₹ 4,999 (up to 3 hours before departure)',
    dateChange: 'Date Change fee starts at ₹ 2,999 up to 3 hrs before departure',
  },
  {
    key: 'wishspecial',
    label: 'FARE BY WISHME',
    badge: 'WISHSPECIAL',
    featured: true,
    priceOffset: 0,
    baggage: { cabin: '7 Kgs Cabin Baggage', checkin: '15 Kgs Check-in Baggage' },
    cancellation: 'Cancellation fee starts at ₹ 4,999 (up to 3 hours before departure)',
    dateChange: 'Date Change fee starts at ₹ 2,999 up to 3 hrs before departure',
    benefits: ['Free Date Change worth ₹ 2,999', 'Trip Secure worth ₹ 2,500'],
  },
  {
    key: 'flexi',
    label: 'FLEXI',
    featured: false,
    priceOffset: 500,
    baggage: { cabin: '7 Kgs Cabin Baggage', checkin: '15 Kgs Check-in Baggage' },
    cancellation: 'Lower Cancellation fee of ₹ 3,499 (up to 3 hours before departure)',
    dateChange: 'Lower Date Change fee ₹ 999 up to 3 hrs before departure',
    seatsAndMore: true,
  },
];

const CARD_W = SCREEN_WIDTH * 0.8;
const CARD_GAP = 12;

// ─── FareCard ─────────────────────────────────────────────────────────────────
function FareCard({
  tier,
  basePrice,
  originalPrice,
  animVal,
  index,
  onSelect,
}: {
  tier: FareTier;
  basePrice: number;
  originalPrice: number;
  animVal: Animated.Value;
  index: number;
  onSelect?: () => void;
}) {
  const fc = use_fc();
  const price = basePrice + tier.priceOffset;
  const strikePrice = originalPrice + tier.priceOffset;
  const [priceDropChecked, setPriceDropChecked] = React.useState(false);

  const translateY = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [80 + index * 20, 0],
  });
  const opacity = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        fc.card,
        tier.featured && fc.cardFeatured,
        { transform: [{ translateY }], opacity },
      ]}
    >
      {/* Price row */}
      <View style={fc.priceRow}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            {tier.featured && (
              <Text style={fc.strikePrice}>₹{strikePrice.toLocaleString('en-IN')}</Text>
            )}
            <Text style={[fc.price, tier.featured && fc.priceFeatured]}>
              ₹{price.toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={fc.perAdult}>per adult</Text>
        </View>
        {tier.badge ? (
          <View style={fc.badge}>
            <Text style={fc.badgeText}>{tier.badge}</Text>
          </View>
        ) : (
          <Text style={fc.tierLabel}>{tier.label}</Text>
        )}
      </View>

      {/* Promo */}
      {tier.promo && (
        <View style={fc.promoRow}>
          <Shield size={12} color={T(C.green, 'fg')} />
          <Text style={fc.promoText} numberOfLines={2}>{tier.promo}</Text>
        </View>
      )}

      <View style={fc.divider} />

      {/* Baggage */}
      <Text style={fc.sectionHead}>Baggage</Text>
      <View style={fc.checkRow}>
        <View style={fc.checkIcon}><Check size={10} color={T(C.white, 'fg')} /></View>
        <Text style={fc.checkText}>{tier.baggage.cabin}</Text>
      </View>
      <View style={fc.checkRow}>
        <View style={fc.checkIcon}><Check size={10} color={T(C.white, 'fg')} /></View>
        <Text style={fc.checkText}>{tier.baggage.checkin}</Text>
      </View>

      <View style={fc.divider} />

      {/* Flexibility */}
      <Text style={fc.sectionHead}>Flexibility</Text>
      <View style={fc.bulletRow}>
        <Text style={fc.bullet}>🟠</Text>
        <Text style={fc.bulletText}>{tier.cancellation}</Text>
      </View>
      <View style={fc.bulletRow}>
        <Text style={fc.bullet}>🟠</Text>
        <Text style={fc.bulletText}>{tier.dateChange}</Text>
      </View>

      {/* Benefits Included (featured only) */}
      {tier.benefits && tier.benefits.length > 0 && (
        <>
          <View style={fc.divider} />
          <View style={fc.benefitsWrap}>
            <Text style={fc.benefitsHead}>BENEFITS INCLUDED</Text>
            {tier.benefits.map((b) => (
              <View key={b} style={fc.bulletRow}>
                <Text style={fc.bullet}>🟡</Text>
                <Text style={fc.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Seats Meals & More */}
      {tier.seatsAndMore && (
        <>
          <View style={fc.divider} />
          <Text style={fc.sectionHead}>Seats, Meals & More</Text>
          <Text style={fc.subText}>Add seat preference and meals to your booking</Text>
        </>
      )}

      <View style={fc.divider} />

      {/* Price drop protection */}
      <TouchableOpacity
        style={fc.priceDropRow}
        activeOpacity={0.7}
        onPress={() => setPriceDropChecked(!priceDropChecked)}
      >
        <View style={[fc.checkBox, priceDropChecked && fc.checkBoxActive]}>
          {priceDropChecked && <Check size={10} color={T(C.white, 'fg')} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fc.priceDropTitle}>Add Price Drop Protection at ₹ 199</Text>
          <Text style={fc.priceDropSub}>See a fare drop? We refund the difference.</Text>
        </View>
      </TouchableOpacity>

      <View style={fc.divider} />

      {/* Book Now */}
      <TouchableOpacity
        style={fc.bookBtn}
        activeOpacity={0.85}
        onPress={onSelect}
      ><BrandFill />
        <Text style={fc.bookText}>BOOK NOW</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const make_fc = () => StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    padding: 16,
    marginBottom: 8,
   ...glass(22), },
  cardFeatured: {
    borderColor: T(C.amber, 'border'),
    borderWidth: 2,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strikePrice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.gray, 'fg'),
    textDecorationLine: 'line-through',
  },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  priceFeatured: { color: T(C.dark, 'fg') },
  perAdult: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  badge: {
    backgroundColor: T(C.dark, 'bg'),
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: T(C.orange, 'fg'), fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  tierLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.textLight, 'fg') },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: T(C.greenLight, 'bg'),
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  promoText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.green, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginVertical: 10 },
  sectionHead: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginBottom: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  checkIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T(C.green, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.text, 'fg'), flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'flex-start' },
  bullet: { fontSize: 10, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  benefitsWrap: {
    backgroundColor: T(C.amberLight, 'bg'),
    borderRadius: 10,
    padding: 10,
  },
  benefitsHead: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: T(C.amber, 'fg'),
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  priceDropRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxActive: { backgroundColor: T(C.blue, 'bg'), borderColor: T(C.blue, 'border') },
  priceDropTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  priceDropSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  bookBtn: {
    backgroundColor: T(C.blue, 'bg'),
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
   overflow: 'hidden', },
  bookText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
});
const use_fc = () => useThemedStyles(make_fc);

// ─── FareOptionsScreen ────────────────────────────────────────────────────────
export function FareOptionsScreen({
  flight,
  fromCode,
  toCode,
  dateLabel,
  onBack,
  onSelectFare,
}: {
  flight: FlightResult;
  fromCode: string;
  toCode: string;
  dateLabel: string;
  onBack: () => void;
  onSelectFare?: (fareKey: string) => void;
}) {
  const fs = use_fs();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate cards in
    Animated.timing(animVal, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Pre-scroll to center the featured (middle) card
    const offset = CARD_W + CARD_GAP;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: offset, animated: true });
    }, 200);
  }, []);

  // Extract city codes from the passed strings like "New Delhi (DEL)"
  const fromDisplay = fromCode.includes('(')
    ? fromCode.split('(')[0].trim().slice(0, 3).toUpperCase()
    : fromCode.slice(0, 3).toUpperCase();
  const toDisplay = toCode.includes('(')
    ? toCode.split('(')[0].trim().slice(0, 3).toUpperCase()
    : toCode.slice(0, 3).toUpperCase();

  return (
    <View style={fs.root}>
      {/* Header */}
      <View style={[fs.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={fs.headerTitle}>Flight Details and Fare Options</Text>
          <Text style={fs.headerSub}>available for you!</Text>
        </View>
      </View>

      {/* Sub-header: flight summary */}
      <View style={fs.subHeader}>
        <Text style={fs.routeText}>
          {fromDisplay}–{toDisplay}
        </Text>
        <Text style={fs.dot}>·</Text>
        <Text style={fs.logo}>{flight.logo}</Text>
        <Text style={fs.airline}>{flight.airline}</Text>
        <Text style={fs.dot}>·</Text>
        <Text style={fs.meta}>{dateLabel}</Text>
        <Text style={fs.dot}>·</Text>
        <Text style={fs.meta}>
          {flight.depart} – {flight.arrive}
        </Text>
      </View>

      {/* Horizontally scrollable fare cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fs.cardRow}
        style={{ flex: 1 }}
      >
        {FARE_TIERS.map((tier, i) => (
          <FareCard
            key={tier.key}
            tier={tier}
            basePrice={flight.price}
            originalPrice={flight.originalPrice}
            animVal={animVal}
            index={i}
            onSelect={() => onSelectFare?.(tier.key)}
          />
        ))}
      </ScrollView>

      {/* Swipe hint */}
      <View style={[fs.swipeHint, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={fs.swipeText}>← Swipe to compare fare options →</Text>
      </View>
    </View>
  );
}

const make_fs = () => StyleSheet.create({
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
  headerTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T(C.white, 'bg'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  routeText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg') },
  dot: { fontSize: 13, color: T(C.gray, 'fg') },
  logo: { fontSize: 14 },
  airline: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  cardRow: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: CARD_GAP,
    alignItems: 'flex-start',
  },
  swipeHint: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
  },
  swipeText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg') },
});
const use_fs = () => useThemedStyles(make_fs);
