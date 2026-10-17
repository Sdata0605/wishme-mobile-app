import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Luggage,
  Percent,
  Plane,
  ShieldCheck,
  Tag,
  User,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { serviceColors as C } from './serviceColors';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/context/AuthContext';
import { tboBookAndTicket, tboFareQuote, type TBOBookingConfirmation } from '@/services/tboService';
import type { FlightResult } from './FlightResultsScreen';
import type { FlightPassenger, FlightContactInfo } from './FlightPassengerScreen';
import type { SelectedFlightAddons } from './FlightAddonsScreen';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';
import { DemoFareNotice } from './DemoFareNotice';
import { isDemoTrace } from '@/services/tboDemo';

export function FlightReviewAndPayScreen({
  flight,
  fareKey,
  passengers,
  contact,
  addons,
  onBack,
  onBookingSuccess,
}: {
  flight: FlightResult;
  fareKey: string;
  passengers: FlightPassenger[];
  contact: FlightContactInfo;
  addons: SelectedFlightAddons;
  onBack: () => void;
  onBookingSuccess: (confirmation: TBOBookingConfirmation) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user } = useAuth();
  const { balance: walletBalance, refetch: refreshWallet } = useWallet();

  const [coupon, setCoupon] = useState('FLY500');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>('FLY500');
  const [couponDiscount, setCouponDiscount] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | 'card'>('wallet');
  const [processing, setProcessing] = useState(false);

  // Pricing calculations
  const baseFlightTotal = flight.price * passengers.length;
  const taxesTotal = Math.round(baseFlightTotal * 0.12);
  const seatsTotal = addons.seats.reduce((s, x) => s + x.price, 0);
  const mealsTotal = addons.meals.reduce((s, x) => s + x.price, 0);
  const baggageTotal =
    addons.extraBaggageKg === 5 ? 1499 : addons.extraBaggageKg === 10 ? 2799 : addons.extraBaggageKg === 15 ? 3999 : 0;
  const insuranceTotal = addons.insurance ? 249 * passengers.length : 0;

  const subTotal = baseFlightTotal + taxesTotal + seatsTotal + mealsTotal + baggageTotal + insuranceTotal;
  const finalTotal = Math.max(0, subTotal - couponDiscount);

  const applyCouponCode = () => {
    const code = coupon.trim().toUpperCase();
    if (code === 'FLY500') {
      setAppliedCoupon(code);
      setCouponDiscount(500);
    } else if (code === 'WISHME' || code === 'WISH10') {
      const disc = Math.round(subTotal * 0.1);
      setAppliedCoupon(code);
      setCouponDiscount(disc);
    } else {
      Alert.alert('Invalid Coupon', 'Coupon code is not valid or has expired.');
    }
  };

  const handlePayAndBook = async () => {
    setProcessing(true);
    try {
      // Simulate/execute TBO Book & Ticket call
      const formattedPax = passengers.map((p, idx) => ({
        Title: p.title,
        FirstName: p.firstName,
        LastName: p.lastName,
        PaxType: p.type === 'adult' ? 1 : (p.type === 'child' ? 2 : 3) as 1 | 2 | 3,
        DateOfBirth: p.dob,
        Gender: p.gender === 'Male' ? 1 : 2 as 1 | 2,
        ContactNo: contact.phone,
        Email: contact.email,
        IsLeadPax: idx === 0,
        Seat: addons.seats.find((s) => s.paxIndex === idx) ? {
          SeatNo: addons.seats.find((s) => s.paxIndex === idx)!.seatNo,
          Price: addons.seats.find((s) => s.paxIndex === idx)!.price,
        } : undefined,
        Meal: addons.meals.find((m) => m.paxIndex === idx) ? {
          Code: addons.meals.find((m) => m.paxIndex === idx)!.code,
          Price: addons.meals.find((m) => m.paxIndex === idx)!.price,
        } : undefined,
      }));

      if (!flight.traceId || !flight.resultIndex) {
        throw new Error('This fare is no longer held. Please search again and reselect your flight.');
      }

      // Re-price immediately before ticketing — TBO fares can move between search and book.
      const quote = await tboFareQuote(flight.traceId, flight.resultIndex);
      if (quote.isPriceChanged) {
        throw new Error(
          `The airline changed this fare to ₹${quote.flight.price.toLocaleString('en-IN')}. ` +
          'Please go back and reselect to continue at the new price.',
        );
      }

      const confirmation = await tboBookAndTicket({
        traceId: flight.traceId,
        resultIndex: flight.resultIndex,
        isLCC: !!flight.isLCC,
        passengers: formattedPax,
        totalAmount: finalTotal,
      });

      refreshWallet();
      onBookingSuccess(confirmation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      Alert.alert('Booking Error', msg);
    } finally {
      setProcessing(false);
    }
  };

  const airlineName = flight.airlineName || flight.airline || 'IndiGo';
  const airlineCode = flight.airlineCode || flight.airline?.slice(0, 2)?.toUpperCase() || '6E';
  const flightNumber = flight.flightNumber || '2041';
  const fromCode = flight.fromCode || flight.depAirport || 'DEL';
  const toCode = flight.toCode || flight.arrAirport || 'BOM';
  const departTime = flight.departTime || flight.depart || '06:00';
  const arriveTime = flight.arriveTime || flight.arrive || '08:15';

  return (
    <View style={{ flex: 1, backgroundColor: T(C.pageBg, 'page') }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Review & Payment</Text>
          <Text style={st.headerSub}>Final step before confirmation</Text>
        </View>
        <View style={st.stepBadge}>
          <Text style={st.stepText}>Step 3 of 3</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {isDemoTrace(flight.traceId) && <DemoFareNotice />}
        {/* Flight summary card */}
        <View style={st.card}>
          <View style={st.airRow}>
            <View style={st.airLogoBox}>
              <Plane size={18} color={T(C.purple, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.airName}>{airlineName} · {airlineCode}-{flightNumber}</Text>
              <Text style={st.fareType}>{fareKey.toUpperCase()} FARE</Text>
            </View>
            <View style={st.nonStopPill}>
              <Text style={st.nonStopText}>{flight.stops === 0 ? 'Non-stop' : `${flight.stops} Stop`}</Text>
            </View>
          </View>

          <View style={st.routeGrid}>
            <View>
              <Text style={st.timeText}>{departTime}</Text>
              <Text style={st.codeText}>{fromCode}</Text>
            </View>
            <View style={st.midDuration}>
              <Text style={st.durText}>{flight.duration}</Text>
              <View style={st.durLine} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.timeText}>{arriveTime}</Text>
              <Text style={st.codeText}>{toCode}</Text>
            </View>
          </View>
        </View>

        {/* Travellers & Addons Breakdown */}
        <View style={st.card}>
          <Text style={st.cardHeading}>Traveller Summary</Text>
          {passengers.map((p, idx) => {
            const seat = addons.seats.find((s) => s.paxIndex === idx);
            const meal = addons.meals.find((m) => m.paxIndex === idx);
            return (
              <View key={p.id} style={st.paxRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.paxName}>{p.title} {p.firstName} {p.lastName}</Text>
                  <Text style={st.paxSub}>
                    {p.type.toUpperCase()} · Seat: {seat ? seat.seatNo : 'Auto'} {meal ? `· Meal: ${meal.label.slice(0, 15)}...` : ''}
                  </Text>
                </View>
                <CheckCircle2 size={16} color={T(C.green, 'fg')} />
              </View>
            );
          })}
        </View>

        {/* Coupon Card */}
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Tag size={16} color={T(C.purple, 'fg')} />
            <Text style={st.cardHeading}>Offers & Promo Code</Text>
          </View>
          <View style={st.couponInputWrap}>
            <TextInput
              style={st.couponInput}
              placeholder="Enter coupon code"
              placeholderTextColor={T(C.gray, 'fg')}
              value={coupon}
              onChangeText={setCoupon}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={st.applyBtn} onPress={applyCouponCode}>
              <Text style={st.applyBtnText}>APPLY</Text>
            </TouchableOpacity>
          </View>
          {appliedCoupon && (
            <View style={st.appliedBox}>
              <Percent size={14} color={T(C.green, 'fg')} />
              <Text style={st.appliedText}>
                Code <Text style={{ fontFamily: 'Inter_700Bold' }}>{appliedCoupon}</Text> applied! You saved ₹{couponDiscount}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Method Selector */}
        <View style={st.card}>
          <Text style={st.cardHeading}>Select Payment Method</Text>

          {/* WishMe Wallet Option */}
          <TouchableOpacity
            style={[st.payOpt, paymentMethod === 'wallet' && st.payOptActive]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={st.payIconBox}>
              <Wallet size={20} color={paymentMethod === 'wallet' ? T(C.white, 'fg') : T(C.purple, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>WishMe Wallet</Text>
              <Text style={st.paySub}>
                Available Balance: <Text style={{ fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') }}>₹{walletBalance.toLocaleString('en-IN')}</Text>
              </Text>
            </View>
            <View style={[st.radioOuter, paymentMethod === 'wallet' && st.radioOuterActive]}>
              {paymentMethod === 'wallet' && <View style={st.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* UPI Option */}
          <TouchableOpacity
            style={[st.payOpt, paymentMethod === 'upi' && st.payOptActive]}
            onPress={() => setPaymentMethod('upi')}
          >
            <View style={st.payIconBox}>
              <Zap size={20} color={paymentMethod === 'upi' ? T(C.white, 'fg') : T(C.orange, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>UPI / Google Pay / PhonePe</Text>
              <Text style={st.paySub}>Instant bank transfer</Text>
            </View>
            <View style={[st.radioOuter, paymentMethod === 'upi' && st.radioOuterActive]}>
              {paymentMethod === 'upi' && <View style={st.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Card Option */}
          <TouchableOpacity
            style={[st.payOpt, paymentMethod === 'card' && st.payOptActive]}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={st.payIconBox}>
              <CreditCard size={20} color={paymentMethod === 'card' ? T(C.white, 'fg') : T('#3B82F6', 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>Credit / Debit Card</Text>
              <Text style={st.paySub}>Visa, Mastercard, RuPay</Text>
            </View>
            <View style={[st.radioOuter, paymentMethod === 'card' && st.radioOuterActive]}>
              {paymentMethod === 'card' && <View style={st.radioInner} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Itemized Fare Summary */}
        <View style={st.card}>
          <Text style={st.cardHeading}>Fare Breakdown</Text>
          <View style={st.fareRow}><Text style={st.fareLabel}>Base Fare ({passengers.length} Traveller{passengers.length > 1 ? 's' : ''})</Text><Text style={st.fareVal}>₹{baseFlightTotal.toLocaleString('en-IN')}</Text></View>
          <View style={st.fareRow}><Text style={st.fareLabel}>Taxes & Airline Surcharges</Text><Text style={st.fareVal}>₹{taxesTotal.toLocaleString('en-IN')}</Text></View>
          {seatsTotal > 0 && <View style={st.fareRow}><Text style={st.fareLabel}>Seat Selection</Text><Text style={st.fareVal}>+₹{seatsTotal.toLocaleString('en-IN')}</Text></View>}
          {mealsTotal > 0 && <View style={st.fareRow}><Text style={st.fareLabel}>In-flight Meals</Text><Text style={st.fareVal}>+₹{mealsTotal.toLocaleString('en-IN')}</Text></View>}
          {baggageTotal > 0 && <View style={st.fareRow}><Text style={st.fareLabel}>Extra Baggage</Text><Text style={st.fareVal}>+₹{baggageTotal.toLocaleString('en-IN')}</Text></View>}
          {insuranceTotal > 0 && <View style={st.fareRow}><Text style={st.fareLabel}>Travel Insurance</Text><Text style={st.fareVal}>+₹{insuranceTotal.toLocaleString('en-IN')}</Text></View>}
          {couponDiscount > 0 && <View style={st.fareRow}><Text style={[st.fareLabel, { color: T(C.green, 'fg') }]}>Promo Discount</Text><Text style={[st.fareVal, { color: T(C.green, 'fg') }]}>-₹{couponDiscount.toLocaleString('en-IN')}</Text></View>}
          <View style={st.divider} />
          <View style={st.fareRow}><Text style={st.totalLabel}>Total Payable</Text><Text style={st.totalVal}>₹{finalTotal.toLocaleString('en-IN')}</Text></View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={st.footerLabel}>Total Amount</Text>
          <Text style={st.footerPrice}>₹{finalTotal.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={[st.payBtn, processing && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handlePayAndBook}
          disabled={processing}
        ><BrandFill />
          {processing ? (
            <ActivityIndicator size="small" color={T(C.white, 'fg')} />
          ) : (
            <>
              <Text style={st.payBtnText}>Pay & Book Now</Text>
              <ChevronRight size={18} color={T(C.white, 'fg')} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_st = () => StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  stepBadge: { backgroundColor: T('#F3E8FF', 'bg'), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  stepText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.purple, 'fg') },
  card: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  cardHeading: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginBottom: 12 },
  airRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  airLogoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: T('#F3E8FF', 'bg'), alignItems: 'center', justifyContent: 'center' },
  airName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  fareType: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T(C.purple, 'fg'), marginTop: 2 },
  nonStopPill: { backgroundColor: T('#ECFDF5', 'bg'), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nonStopText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  routeGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  codeText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), marginTop: 2 },
  midDuration: { alignItems: 'center', flex: 1, paddingHorizontal: 16 },
  durText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), marginBottom: 4 },
  durLine: { height: 2, width: '100%', backgroundColor: T(C.border, 'bg') },
  paxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T('#F3F4F6', 'border'),
  },
  paxName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  paxSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  couponInputWrap: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    backgroundColor: T('#FAFAFA', 'bg'),
  },
  applyBtn: { backgroundColor: T(C.purple, 'bg'), borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
  appliedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: T('#ECFDF5', 'bg'), padding: 8, borderRadius: 8 },
  appliedText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.green, 'fg') },
  payOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    marginBottom: 8,
    gap: 12,
  },
  payOptActive: { borderColor: T(C.purple, 'border'), backgroundColor: T('#FAF5FF', 'bg') },
  payIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: T('#F3F4F6', 'bg'), alignItems: 'center', justifyContent: 'center' },
  payTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  paySub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T(C.gray, 'border'), alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: T(C.purple, 'border') },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: T(C.purple, 'bg') },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  fareLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  fareVal: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginVertical: 8 },
  totalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  totalVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
   ...dockBar(), },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  payBtn: {
    backgroundColor: T(C.green, 'bg'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
   overflow: 'hidden', },
  payBtnText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
