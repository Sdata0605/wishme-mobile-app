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
import { tboBookAndTicket, type TBOBookingConfirmation } from '@/services/tboService';
import type { FlightResult } from './FlightResultsScreen';
import type { FlightPassenger, FlightContactInfo } from './FlightPassengerScreen';
import type { SelectedFlightAddons } from './FlightAddonsScreen';

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

      const airlineName = flight.airlineName || flight.airline || 'IndiGo';
      const airlineCode = flight.airlineCode || flight.airline?.slice(0, 2)?.toUpperCase() || '6E';
      const flightNumber = flight.flightNumber || '2041';
      const fromCode = flight.fromCode || flight.depAirport || 'DEL';
      const toCode = flight.toCode || flight.arrAirport || 'BOM';
      const departTime = flight.departTime || flight.depart || '06:00';
      const arriveTime = flight.arriveTime || flight.arrive || '08:15';

      const confirmation = await tboBookAndTicket({
        flight: {
          airline: airlineName,
          airlineCode: airlineCode,
          code: flightNumber,
          from: fromCode,
          to: toCode,
          depart: departTime,
          arrive: arriveTime,
          price: flight.price,
        },
        fareTier: fareKey,
        passengers: formattedPax,
        contact: { email: contact.email, phone: contact.phone },
        insurance: addons.insurance,
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
    <View style={{ flex: 1, backgroundColor: C.pageBg }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={C.text} />
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
        {/* Flight summary card */}
        <View style={st.card}>
          <View style={st.airRow}>
            <View style={st.airLogoBox}>
              <Plane size={18} color={C.purple} />
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
                <CheckCircle2 size={16} color={C.green} />
              </View>
            );
          })}
        </View>

        {/* Coupon Card */}
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Tag size={16} color={C.purple} />
            <Text style={st.cardHeading}>Offers & Promo Code</Text>
          </View>
          <View style={st.couponInputWrap}>
            <TextInput
              style={st.couponInput}
              placeholder="Enter coupon code"
              placeholderTextColor={C.gray}
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
              <Percent size={14} color={C.green} />
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
              <Wallet size={20} color={paymentMethod === 'wallet' ? C.white : C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>WishMe Wallet</Text>
              <Text style={st.paySub}>
                Available Balance: <Text style={{ fontFamily: 'Inter_700Bold', color: C.green }}>₹{walletBalance.toLocaleString('en-IN')}</Text>
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
              <Zap size={20} color={paymentMethod === 'upi' ? C.white : C.orange} />
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
              <CreditCard size={20} color={paymentMethod === 'card' ? C.white : '#3B82F6'} />
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
          {couponDiscount > 0 && <View style={st.fareRow}><Text style={[st.fareLabel, { color: C.green }]}>Promo Discount</Text><Text style={[st.fareVal, { color: C.green }]}>-₹{couponDiscount.toLocaleString('en-IN')}</Text></View>}
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
        >
          {processing ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <Text style={st.payBtnText}>Pay & Book Now</Text>
              <ChevronRight size={18} color={C.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  stepBadge: { backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  stepText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.purple },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeading: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 12 },
  airRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  airLogoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  airName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
  fareType: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.purple, marginTop: 2 },
  nonStopPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nonStopText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.green },
  routeGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  codeText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textLight, marginTop: 2 },
  midDuration: { alignItems: 'center', flex: 1, paddingHorizontal: 16 },
  durText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: C.textLight, marginBottom: 4 },
  durLine: { height: 2, width: '100%', backgroundColor: C.border },
  paxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  paxName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  paxSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2 },
  couponInputWrap: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    backgroundColor: '#FAFAFA',
  },
  applyBtn: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_700Bold' },
  appliedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8 },
  appliedText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.green },
  payOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    gap: 12,
  },
  payOptActive: { borderColor: C.purple, backgroundColor: '#FAF5FF' },
  payIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  payTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
  paySub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.gray, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: C.purple },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.purple },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  fareLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textLight },
  fareVal: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  totalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  totalVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.green },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  payBtn: {
    backgroundColor: C.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  payBtnText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
});
