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
          <Shield size={12} color={C.green} />
          <Text style={fc.promoText} numberOfLines={2}>{tier.promo}</Text>
        </View>
      )}

      <View style={fc.divider} />

      {/* Baggage */}
      <Text style={fc.sectionHead}>Baggage</Text>
      <View style={fc.checkRow}>
        <View style={fc.checkIcon}><Check size={10} color={C.white} /></View>
        <Text style={fc.checkText}>{tier.baggage.cabin}</Text>
      </View>
      <View style={fc.checkRow}>
        <View style={fc.checkIcon}><Check size={10} color={C.white} /></View>
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
          {priceDropChecked && <Check size={10} color={C.white} />}
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
      >
        <Text style={fc.bookText}>BOOK NOW</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const fc = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    marginBottom: 8,
  },
  cardFeatured: {
    borderColor: C.amber,
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
    color: C.gray,
    textDecorationLine: 'line-through',
  },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  priceFeatured: { color: C.dark },
  perAdult: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2 },
  badge: {
    backgroundColor: C.dark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: C.orange, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  tierLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.textLight },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: C.greenLight,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  promoText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: C.green },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  sectionHead: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  checkIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.text, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'flex-start' },
  bullet: { fontSize: 10, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  benefitsWrap: {
    backgroundColor: C.amberLight,
    borderRadius: 10,
    padding: 10,
  },
  benefitsHead: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: C.amber,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2 },
  priceDropRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxActive: { backgroundColor: C.blue, borderColor: C.blue },
  priceDropTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  priceDropSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  bookBtn: {
    backgroundColor: C.blue,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  bookText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
});

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
          <ArrowLeft size={22} color={C.text} />
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

const fs = StyleSheet.create({
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
  headerTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  routeText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.blue },
  dot: { fontSize: 13, color: C.gray },
  logo: { fontSize: 14 },
  airline: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  cardRow: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: CARD_GAP,
    alignItems: 'flex-start',
  },
  swipeHint: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  swipeText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.gray },
});
