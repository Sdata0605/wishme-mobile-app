import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  CheckCircle2,
  Download,
  Hotel as HotelIcon,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Share2,
  User,
} from 'lucide-react-native';
import type { HotelBookingConfirmation } from './HotelReviewAndPayScreen';
import { serviceColors as C } from './serviceColors';

interface HotelSuccessScreenProps {
  confirmation: HotelBookingConfirmation;
  onDone: () => void;
}

export function HotelSuccessScreen({ confirmation, onDone }: HotelSuccessScreenProps) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🏨 Hotel Booking Confirmed!\nBooking ID: ${confirmation.bookingId}\nHotel: ${confirmation.hotelName}\nRoom: ${confirmation.roomName}\nDates: ${confirmation.checkIn} to ${confirmation.checkOut} (${confirmation.nights} night(s))\nBooked with WishMe!`,
      });
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    Alert.alert(
      'Hotel Voucher Saved',
      `Booking confirmation voucher has been saved and sent to ${confirmation.guestEmail}.`,
      [{ text: 'OK' }]
    );
  };

  const handleAddToCalendar = () => {
    Alert.alert(
      'Added to Calendar',
      `Stay at ${confirmation.hotelName} (${confirmation.checkIn} - ${confirmation.checkOut}) added to your calendar.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={s.root}>
      {/* Top Banner */}
      <View style={[s.topBanner, { paddingTop: topPad + 12 }]}>
        <View style={s.successBadge}>
          <CheckCircle2 size={36} color="#059669" />
        </View>
        <Text style={s.successHeading}>Hotel Booking Confirmed!</Text>
        <Text style={s.successSub}>
          Voucher sent to <Text style={{ color: C.green, fontFamily: 'Inter_600SemiBold' }}>{confirmation.guestEmail}</Text>
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Voucher Card */}
        <View style={s.voucherCard}>
          <View style={s.voucherHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.hotelIconBox}>
                <HotelIcon size={22} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hotelName}>{confirmation.hotelName}</Text>
                <Text style={s.roomName}>{confirmation.roomName}</Text>
              </View>
            </View>
            <View style={s.bookingBadge}>
              <Text style={s.bookingIdLabel}>BOOKING ID</Text>
              <Text style={s.bookingIdVal}>{confirmation.bookingId}</Text>
            </View>
          </View>

          {/* Dates */}
          <View style={s.datesRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateLabel}>CHECK-IN</Text>
              <Text style={s.dateText}>{confirmation.checkIn}</Text>
              <Text style={s.timeText}>After 2:00 PM</Text>
            </View>
            <View style={s.nightsPill}>
              <Text style={s.nightsPillText}>{confirmation.nights} Night(s)</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={s.dateLabel}>CHECK-OUT</Text>
              <Text style={s.dateText}>{confirmation.checkOut}</Text>
              <Text style={s.timeText}>Before 11:00 AM</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Guest details */}
          <View style={s.guestRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <User size={14} color={C.dark} />
              <Text style={s.guestName}>{confirmation.guestName}</Text>
            </View>
            <Text style={s.guestsCount}>{confirmation.guests} Guest(s)</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Phone size={13} color={C.textLight} />
            <Text style={s.guestContact}>+91 {confirmation.guestMobile}</Text>
            <Text style={{ color: C.gray }}>·</Text>
            <Mail size={13} color={C.textLight} />
            <Text style={s.guestContact}>{confirmation.guestEmail}</Text>
          </View>

          {/* QR & Payment method */}
          <View style={s.qrBox}>
            <QrCode size={48} color={C.dark} />
            <View style={{ flex: 1 }}>
              <Text style={s.qrTitle}>Show this voucher at reception</Text>
              <Text style={s.qrSub}>Paid ₹{confirmation.totalAmount.toLocaleString('en-IN')} via {confirmation.paymentMethod}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleDownload}>
            <Download size={16} color={C.green} />
            <Text style={s.actionBtnText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleShare}>
            <Share2 size={16} color={C.green} />
            <Text style={s.actionBtnText}>Share Voucher</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleAddToCalendar}>
            <Calendar size={16} color={C.green} />
            <Text style={s.actionBtnText}>Add Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Hotel Policies */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Check-in Policy & House Rules</Text>
          <View style={s.infoItem}>
            <MapPin size={14} color={C.textLight} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Government-issued ID required for all adult guests during check-in.
            </Text>
          </View>
          <View style={s.infoItem}>
            <CheckCircle2 size={14} color={C.textLight} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Free cancellation up to 24 hours prior to check-in time.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={s.doneBtn} activeOpacity={0.85} onPress={onDone}>
          <Text style={s.doneBtnText}>Back to Services</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  topBanner: {
    backgroundColor: C.white,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successHeading: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  successSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  voucherCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  voucherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  hotelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotelName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  roomName: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  bookingBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  bookingIdLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: C.green, letterSpacing: 0.5 },
  bookingIdVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.dark },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dateLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: C.gray, letterSpacing: 0.5 },
  dateText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 2 },
  timeText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  nightsPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nightsPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.dark },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  guestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  guestsCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  guestContact: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  qrTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.text },
  qrSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.green },
  infoCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 12,
  },
  infoTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 8 },
  infoItem: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  infoText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, lineHeight: 16 },
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
  },
  doneBtn: {
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: C.white, fontSize: 15, fontFamily: 'Inter_700Bold' },
});
