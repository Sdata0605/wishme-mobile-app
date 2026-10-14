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
  Calendar,
  Check,
  CreditCard,
  Hotel as HotelIcon,
  MapPin,
  Percent,
  ShieldCheck,
  Smartphone,
  Tag,
  User,
  Wallet,
} from 'lucide-react-native';
import type { Hotel, HotelRoom, HotelSearchParams } from './hotelData';
import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';

export interface HotelGuestData {
  name: string;
  mobile: string;
  email: string;
  request?: string;
  payAtHotel: boolean;
}

export interface HotelBookingConfirmation {
  bookingId: string;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalAmount: number;
  paymentMethod: string;
  guestName: string;
  guestEmail: string;
  guestMobile: string;
}

interface HotelReviewAndPayScreenProps {
  hotel: Hotel;
  room: HotelRoom;
  search: HotelSearchParams;
  guest: HotelGuestData;
  onBack: () => void;
  onPaymentSuccess: (confirmation: HotelBookingConfirmation) => void;
}

const AVAILABLE_COUPONS = [
  { code: 'STAY10', discount: 600, desc: 'Flat ₹600 OFF on hotel stays' },
  { code: 'WISHME', discount: 1000, desc: 'Special ₹1,000 WishMe Exclusive discount' },
];

export function HotelReviewAndPayScreen({
  hotel,
  room,
  search,
  guest,
  onBack,
  onPaymentSuccess,
}: HotelReviewAndPayScreenProps) {
  const s = use_s();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | 'card' | 'pay_at_hotel'>(
    guest.payAtHotel ? 'pay_at_hotel' : 'wallet'
  );
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Price calculations
  const roomBaseTotal = room.price * search.nights * (search.rooms || 1);
  const taxes = Math.round(roomBaseTotal * 0.12);
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const grandTotal = Math.max(0, roomBaseTotal + taxes - couponDiscount);

  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    const found = AVAILABLE_COUPONS.find((c) => c.code === clean);
    if (found) {
      setAppliedCoupon(found);
      setCouponCode(found.code);
    } else {
      Alert.alert('Invalid Coupon', 'Please enter a valid coupon code like STAY10 or WISHME');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handlePay = async () => {
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1600));
    setIsProcessing(false);

    const bookingId = `WMH${Math.floor(100000 + Math.random() * 899999)}`;
    const confirmation: HotelBookingConfirmation = {
      bookingId,
      hotelName: hotel.name,
      roomName: room.name,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      nights: search.nights,
      guests: search.adults + search.children,
      totalAmount: grandTotal,
      paymentMethod:
        paymentMethod === 'wallet'
          ? 'WishMe Wallet'
          : paymentMethod === 'upi'
          ? 'UPI / Instant QR'
          : paymentMethod === 'card'
          ? 'Credit / Debit Card'
          : 'Pay at Check-in',
      guestName: guest.name,
      guestEmail: guest.email,
      guestMobile: guest.mobile,
    };

    onPaymentSuccess(confirmation);
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Review & Payment</Text>
          <Text style={s.headerSub}>Step 3 of 3 · Final confirmation</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hotel Details Card */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={s.hotelIconBox}>
              <HotelIcon size={24} color={T(C.green, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hotelName}>{hotel.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={12} color={T(C.textLight, 'fg')} />
                <Text style={s.hotelCity}>{hotel.city} · ★ {hotel.rating}</Text>
              </View>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.datesRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateLabel}>CHECK-IN</Text>
              <Text style={s.dateVal}>{search.checkIn}</Text>
              <Text style={s.dateHint}>From 2:00 PM</Text>
            </View>
            <View style={s.nightsBadge}>
              <Text style={s.nightsText}>{search.nights} Night{search.nights > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={s.dateLabel}>CHECK-OUT</Text>
              <Text style={s.dateVal}>{search.checkOut}</Text>
              <Text style={s.dateHint}>Until 11:00 AM</Text>
            </View>
          </View>

          <View style={s.roomMeta}>
            <Text style={s.roomName}>{room.name}</Text>
            <Text style={s.roomDetail}>
              {search.rooms || 1} Room · {search.adults} Adult{search.adults > 1 ? 's' : ''}
              {search.children > 0 ? ` · ${search.children} Child` : ''} · {room.amenities.join(', ')}
            </Text>
          </View>
        </View>

        {/* Primary Guest Info */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <User size={16} color={T(C.dark, 'fg')} />
            <Text style={s.cardTitle}>Guest Information</Text>
          </View>
          <Text style={s.guestName}>{guest.name}</Text>
          <Text style={s.guestSub}>{guest.email} · +91 {guest.mobile}</Text>
          {guest.request ? (
            <Text style={s.specialReq}>Note: &ldquo;{guest.request}&rdquo;</Text>
          ) : null}
        </View>

        {/* Coupon Code Section */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Tag size={16} color={T(C.green, 'fg')} />
            <Text style={s.cardTitle}>Offers & Promo Codes</Text>
          </View>

          {appliedCoupon ? (
            <View style={s.appliedBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.appliedCode}>&ldquo;{appliedCoupon.code}&rdquo; Applied!</Text>
                <Text style={s.appliedSavings}>You saved ₹{appliedCoupon.discount}</Text>
              </View>
              <TouchableOpacity onPress={removeCoupon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.removeCouponText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.couponInputRow}>
              <TextInput
                style={s.couponInput}
                placeholder="Enter Coupon Code"
                placeholderTextColor={T(C.gray, 'fg')}
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[s.applyBtn, !couponCode.trim() && { opacity: 0.5 }]}
                disabled={!couponCode.trim()}
                onPress={() => applyCoupon(couponCode)}
              >
                <Text style={s.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick clickable coupons */}
          {!appliedCoupon && (
            <View style={{ gap: 6, marginTop: 8 }}>
              {AVAILABLE_COUPONS.map((cp) => (
                <TouchableOpacity
                  key={cp.code}
                  style={s.promoRow}
                  activeOpacity={0.7}
                  onPress={() => applyCoupon(cp.code)}
                >
                  <Percent size={14} color={T(C.green, 'fg')} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.promoCode}>{cp.code}</Text>
                    <Text style={s.promoDesc}>{cp.desc}</Text>
                  </View>
                  <Text style={s.tapApply}>TAP TO APPLY</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Payment Methods */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payment Method</Text>

          <TouchableOpacity
            style={[s.payMethod, paymentMethod === 'wallet' && s.payMethodActive]}
            activeOpacity={0.7}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={s.radioCircle}>
              {paymentMethod === 'wallet' && <View style={s.radioInner} />}
            </View>
            <Wallet size={18} color={T(C.dark, 'fg')} />
            <View style={{ flex: 1 }}>
              <Text style={s.payMethodTitle}>WishMe Wallet</Text>
              <Text style={s.payMethodSub}>Instant 1-click checkout · Balance ₹25,000</Text>
            </View>
            <View style={s.instantBadge}>
              <Text style={s.instantText}>FASTEST</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.payMethod, paymentMethod === 'upi' && s.payMethodActive]}
            activeOpacity={0.7}
            onPress={() => setPaymentMethod('upi')}
          >
            <View style={s.radioCircle}>
              {paymentMethod === 'upi' && <View style={s.radioInner} />}
            </View>
            <Smartphone size={18} color={T(C.dark, 'fg')} />
            <View style={{ flex: 1 }}>
              <Text style={s.payMethodTitle}>UPI (GPay / PhonePe / Paytm)</Text>
              <Text style={s.payMethodSub}>Zero transaction fees</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.payMethod, paymentMethod === 'card' && s.payMethodActive]}
            activeOpacity={0.7}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={s.radioCircle}>
              {paymentMethod === 'card' && <View style={s.radioInner} />}
            </View>
            <CreditCard size={18} color={T(C.dark, 'fg')} />
            <View style={{ flex: 1 }}>
              <Text style={s.payMethodTitle}>Credit / Debit Card</Text>
              <Text style={s.payMethodSub}>Visa, MasterCard, RuPay, Amex</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.payMethod, paymentMethod === 'pay_at_hotel' && s.payMethodActive]}
            activeOpacity={0.7}
            onPress={() => setPaymentMethod('pay_at_hotel')}
          >
            <View style={s.radioCircle}>
              {paymentMethod === 'pay_at_hotel' && <View style={s.radioInner} />}
            </View>
            <HotelIcon size={18} color={T(C.dark, 'fg')} />
            <View style={{ flex: 1 }}>
              <Text style={s.payMethodTitle}>Pay at Hotel</Text>
              <Text style={s.payMethodSub}>Pay during check-in at reception</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Price Breakdown */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Price Breakup</Text>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>
              {room.name} × {search.nights} night(s)
            </Text>
            <Text style={s.priceValue}>₹{roomBaseTotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Taxes & Service Charges (12%)</Text>
            <Text style={s.priceValue}>₹{taxes.toLocaleString('en-IN')}</Text>
          </View>

          {appliedCoupon && (
            <View style={s.priceRow}>
              <Text style={[s.priceLabel, { color: T(C.green, 'fg') }]}>Promo Code ({appliedCoupon.code})</Text>
              <Text style={[s.priceValue, { color: T(C.green, 'fg') }]}>
                − ₹{appliedCoupon.discount.toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Grand Total</Text>
            <Text style={s.totalValue}>₹{grandTotal.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={s.taxNotice}>Inclusive of all GST and city taxes</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={s.footerLabel}>Total Payable</Text>
          <Text style={s.footerTotal}>₹{grandTotal.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={[s.payBtn, isProcessing && { opacity: 0.7 }]}
          disabled={isProcessing}
          activeOpacity={0.85}
          onPress={handlePay}
        ><BrandFill />
          {isProcessing ? (
            <ActivityIndicator size="small" color={T(C.white, 'fg')} />
          ) : (
            <Text style={s.payBtnText}>
              {paymentMethod === 'pay_at_hotel' ? 'Confirm Booking' : `Pay ₹${grandTotal.toLocaleString('en-IN')}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_s = () => StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  card: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 14,
    marginBottom: 10,
   ...glass(18), },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  hotelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotelName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  hotelCity: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginVertical: 10 },
  datesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: T(C.gray, 'fg'), letterSpacing: 0.5 },
  dateVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg'), marginTop: 2 },
  dateHint: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  nightsBadge: {
    backgroundColor: T('#F3F4F6', 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nightsText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.dark, 'fg') },
  roomMeta: {
    backgroundColor: T('#F8FAFC', 'bg'),
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  roomName: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  roomDetail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  guestName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg'), marginTop: 2 },
  guestSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  specialReq: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T('#4B5563', 'fg'),
    fontStyle: 'italic',
    marginTop: 4,
  },
  appliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T('#ECFDF5', 'bg'),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T('#A7F3D0', 'border'),
    padding: 10,
  },
  appliedCode: { fontSize: 12, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  appliedSavings: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T('#065F46', 'fg'), marginTop: 1 },
  removeCouponText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T('#EF4444', 'fg') },
  couponInputRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: T('#F9FAFB', 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.text, 'fg'),
  },
  applyBtn: {
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_700Bold' },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T('#F8FAFC', 'bg'),
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  promoCode: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.dark, 'fg') },
  promoDesc: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  tapApply: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  payMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T('#FAFAFA', 'bg'),
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  payMethodActive: { borderColor: T(C.green, 'border'), backgroundColor: T('#F0FDF4', 'bg') },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: T(C.border, 'border'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: T(C.green, 'bg') },
  payMethodTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  payMethodSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  instantBadge: {
    backgroundColor: T('#ECFDF5', 'bg'),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  instantText: { fontSize: 8, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  priceValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  totalValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  taxNotice: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg'), marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 16,
    paddingTop: 12,
   ...dockBar(), },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  footerTotal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  payBtn: {
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    minWidth: 150,
    alignItems: 'center',
   overflow: 'hidden', },
  payBtnText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
});
const use_s = () => useThemedStyles(make_s);
