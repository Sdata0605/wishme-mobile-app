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
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';

interface HotelSuccessScreenProps {
  confirmation: HotelBookingConfirmation;
  onDone: () => void;
}

export function HotelSuccessScreen({ confirmation, onDone }: HotelSuccessScreenProps) {
  const s = use_s();
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
          <CheckCircle2 size={36} color={T('#059669', 'fg')} />
        </View>
        <Text style={s.successHeading}>Hotel Booking Confirmed!</Text>
        <Text style={s.successSub}>
          Voucher sent to <Text style={{ color: T(C.green, 'fg'), fontFamily: 'Inter_600SemiBold' }}>{confirmation.guestEmail}</Text>
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
                <HotelIcon size={22} color={T(C.green, 'fg')} />
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
              <User size={14} color={T(C.dark, 'fg')} />
              <Text style={s.guestName}>{confirmation.guestName}</Text>
            </View>
            <Text style={s.guestsCount}>{confirmation.guests} Guest(s)</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Phone size={13} color={T(C.textLight, 'fg')} />
            <Text style={s.guestContact}>+91 {confirmation.guestMobile}</Text>
            <Text style={{ color: T(C.gray, 'fg') }}>·</Text>
            <Mail size={13} color={T(C.textLight, 'fg')} />
            <Text style={s.guestContact}>{confirmation.guestEmail}</Text>
          </View>

          {/* QR & Payment method */}
          <View style={s.qrBox}>
            <QrCode size={48} color={T(C.dark, 'fg')} />
            <View style={{ flex: 1 }}>
              <Text style={s.qrTitle}>Show this voucher at reception</Text>
              <Text style={s.qrSub}>Paid ₹{confirmation.totalAmount.toLocaleString('en-IN')} via {confirmation.paymentMethod}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleDownload}>
            <Download size={16} color={T(C.green, 'fg')} />
            <Text style={s.actionBtnText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleShare}>
            <Share2 size={16} color={T(C.green, 'fg')} />
            <Text style={s.actionBtnText}>Share Voucher</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleAddToCalendar}>
            <Calendar size={16} color={T(C.green, 'fg')} />
            <Text style={s.actionBtnText}>Add Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Hotel Policies */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Check-in Policy & House Rules</Text>
          <View style={s.infoItem}>
            <MapPin size={14} color={T(C.textLight, 'fg')} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Government-issued ID required for all adult guests during check-in.
            </Text>
          </View>
          <View style={s.infoItem}>
            <CheckCircle2 size={14} color={T(C.textLight, 'fg')} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Free cancellation up to 24 hours prior to check-in time.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={s.doneBtn} activeOpacity={0.85} onPress={onDone}><BrandFill />
          <Text style={s.doneBtnText}>Back to Services</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  topBanner: {
    backgroundColor: T(C.white, 'bg'),
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successHeading: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  successSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 4,
    textAlign: 'center',
  },
  voucherCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
   ...glass(22), },
  voucherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  hotelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotelName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  roomName: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  bookingBadge: {
    backgroundColor: T('#ECFDF5', 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  bookingIdLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg'), letterSpacing: 0.5 },
  bookingIdVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.dark, 'fg') },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dateLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: T(C.gray, 'fg'), letterSpacing: 0.5 },
  dateText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg'), marginTop: 2 },
  timeText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  nightsPill: {
    backgroundColor: T('#F3F4F6', 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nightsPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.dark, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginVertical: 8 },
  guestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  guestsCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  guestContact: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T('#F8FAFC', 'bg'),
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  qrTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  qrSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
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
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg') },
  infoCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 14,
    marginTop: 12,
   ...glass(18), },
  infoTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginBottom: 8 },
  infoItem: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  infoText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), lineHeight: 16 },
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
   ...dockBar(), },
  doneBtn: {
    backgroundColor: T(C.green, 'bg'),
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
   overflow: 'hidden', },
  doneBtnText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_s = () => useThemedStyles(make_s);
