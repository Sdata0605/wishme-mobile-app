import React, { useState } from 'react';
import {
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
  BadgeCheck,
  CheckCircle2,
  Hotel as HotelIcon,
  Mail,
  Phone,
  User,
} from 'lucide-react-native';
import type { Hotel, HotelRoom, HotelSearchParams } from './hotelData';

import { serviceColors as C } from './serviceColors';

export function HotelGuestScreen({
  hotel,
  room,
  search,
  onBack,
  onDone,
}: {
  hotel: Hotel;
  room: HotelRoom;
  search: HotelSearchParams;
  onBack: () => void;
  onDone?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [request, setRequest] = useState('');
  const [payAtHotel, setPayAtHotel] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId] = useState(() => `WMH${Math.floor(100000 + Math.random() * 899999)}`);

  const roomTotal = room.price * search.nights;
  const taxes = Math.round(roomTotal * 0.12);
  const discount = Math.round((room.originalPrice - room.price) * search.nights);
  const grand = roomTotal + taxes;

  const canBook =
    name.trim().length > 2 &&
    mobile.trim().length >= 10 &&
    email.trim().includes('@');

  if (booked) {
    return (
      <View style={[st.root, st.successWrap, { paddingTop: topPad + 40 }]}>
        <View style={st.successIcon}>
          <CheckCircle2 size={42} color={C.green} />
        </View>
        <Text style={st.successTitle}>Booking Confirmed!</Text>
        <Text style={st.successSub}>
          Your stay at {hotel.name} is locked in. Confirmation sent to your email.
        </Text>

        <View style={st.successCard}>
          <Text style={st.successLabel}>Booking ID</Text>
          <Text style={st.successPnr}>{bookingId}</Text>
          <View style={st.successSep} />
          <Text style={st.successHotel}>{hotel.name}</Text>
          <Text style={st.successMeta}>
            {search.checkIn} → {search.checkOut} · {room.name}
          </Text>
          <Text style={st.successMeta}>
            {search.rooms} Room · {search.adults} Adults · ₹{grand.toLocaleString('en-IN')}
          </Text>
        </View>

        <TouchableOpacity style={st.doneBtn} onPress={onDone ?? onBack}>
          <Text style={st.doneText}>Back to Hotels</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Guest Details</Text>
          <Text style={st.headerSub}>Almost done — review & book</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.summary}>
          <View style={st.summaryIcon}>
            <HotelIcon size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.summaryHotel}>{hotel.name}</Text>
            <Text style={st.summaryMeta}>
              {room.name} · {search.checkIn} → {search.checkOut}
            </Text>
            <Text style={st.summaryMeta}>
              {search.nights} night{search.nights > 1 ? 's' : ''} · {search.adults} adults
            </Text>
          </View>
        </View>

        <Text style={st.section}>Primary guest</Text>
        <View style={st.field}>
          <User size={16} color={C.textLight} />
          <TextInput
            style={st.input}
            placeholder="Full name"
            placeholderTextColor={C.gray}
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={st.field}>
          <Phone size={16} color={C.textLight} />
          <TextInput
            style={st.input}
            placeholder="Mobile number"
            placeholderTextColor={C.gray}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
            maxLength={10}
          />
        </View>
        <View style={st.field}>
          <Mail size={16} color={C.textLight} />
          <TextInput
            style={st.input}
            placeholder="Email address"
            placeholderTextColor={C.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Text style={st.section}>Special requests (optional)</Text>
        <View style={[st.field, { alignItems: 'flex-start', minHeight: 80 }]}>
          <TextInput
            style={[st.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="Early check-in, high floor, extra pillows..."
            placeholderTextColor={C.gray}
            multiline
            value={request}
            onChangeText={setRequest}
          />
        </View>

        <Text style={st.section}>Payment preference</Text>
        <TouchableOpacity
          style={[st.payOpt, !payAtHotel && st.payOptOn]}
          onPress={() => setPayAtHotel(false)}
        >
          <View style={[st.radio, !payAtHotel && st.radioOn]} />
          <View style={{ flex: 1 }}>
            <Text style={st.payTitle}>Pay now</Text>
            <Text style={st.paySub}>Secure your room instantly</Text>
          </View>
          <BadgeCheck size={18} color={C.green} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.payOpt, payAtHotel && st.payOptOn]}
          onPress={() => setPayAtHotel(true)}
        >
          <View style={[st.radio, payAtHotel && st.radioOn]} />
          <View style={{ flex: 1 }}>
            <Text style={st.payTitle}>Pay at hotel</Text>
            <Text style={st.paySub}>No advance payment needed</Text>
          </View>
        </TouchableOpacity>

        <Text style={st.section}>Price breakup</Text>
        <View style={st.breakup}>
          <View style={st.breakRow}>
            <Text style={st.breakLabel}>
              Room × {search.nights} night{search.nights > 1 ? 's' : ''}
            </Text>
            <Text style={st.breakVal}>₹{roomTotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={st.breakRow}>
            <Text style={st.breakLabel}>Taxes & fees</Text>
            <Text style={st.breakVal}>₹{taxes.toLocaleString('en-IN')}</Text>
          </View>
          {discount > 0 && (
            <View style={st.breakRow}>
              <Text style={[st.breakLabel, { color: C.green }]}>Discount saved</Text>
              <Text style={[st.breakVal, { color: C.green }]}>
                − ₹{discount.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
          <View style={st.breakSep} />
          <View style={st.breakRow}>
            <Text style={st.breakTotal}>Total amount</Text>
            <Text style={st.breakTotalVal}>₹{grand.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={st.footerLabel}>{payAtHotel ? 'Pay at hotel' : 'Pay now'}</Text>
          <Text style={st.footerPrice}>₹{grand.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={[st.bookBtn, !canBook && st.bookBtnDisabled]}
          disabled={!canBook}
          activeOpacity={0.85}
          onPress={() => setBooked(true)}
        >
          <Text style={st.bookText}>Confirm Booking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  summary: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHotel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  summaryMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 2,
  },
  section: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginTop: 14,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: C.text,
    padding: 0,
  },
  payOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  payOptOn: { borderColor: C.green, backgroundColor: '#F0FDF4' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  radioOn: { borderColor: C.green, borderWidth: 5 },
  payTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
  paySub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  breakup: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textLight },
  breakVal: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  breakSep: { height: 1, backgroundColor: C.border, marginVertical: 6 },
  breakTotal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  breakTotalVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.green },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
  },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  bookBtn: {
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bookBtnDisabled: { opacity: 0.45 },
  bookText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
  successWrap: { alignItems: 'center', paddingHorizontal: 24 },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
  successSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 20,
  },
  successCard: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 20,
  },
  successLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  successPnr: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.purple, marginTop: 2 },
  successSep: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  successHotel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  successMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 4,
  },
  doneBtn: {
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  doneText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
});
