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
  Luggage,
  MapPin,
  Plane,
  QrCode,
  Share2,
  ShieldCheck,
  User,
  Utensils,
} from 'lucide-react-native';
import type { FlightResult } from './FlightResultsScreen';
import type { FlightContactInfo, FlightPassenger } from './FlightPassengerScreen';
import type { SelectedFlightAddons } from './FlightAddonsScreen';
import type { TBOBookingConfirmation } from '../../services/tboService';
import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';
import { DemoFareNotice } from './DemoFareNotice';
import { isDemoTrace } from '@/services/tboDemo';

interface FlightSuccessScreenProps {
  flight: FlightResult;
  fromCode: string;
  toCode: string;
  dateLabel: string;
  passengers: FlightPassenger[];
  contact: FlightContactInfo;
  addons: SelectedFlightAddons;
  confirmation: TBOBookingConfirmation;
  onDone: () => void;
}

export function FlightSuccessScreen({
  flight,
  fromCode,
  toCode,
  dateLabel,
  passengers,
  contact,
  addons,
  confirmation,
  onDone,
}: FlightSuccessScreenProps) {
  const s = use_s();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const airlineName = flight.airlineName || flight.airline || 'IndiGo';
  const flightNumber = flight.flightNumber || '6E-2041';
  const pnr = confirmation.PNR || 'WM7K9P';
  const ticketNo = confirmation.TicketNo || 'ETKT-983274619';

  const fromDisplay = fromCode.includes('(')
    ? fromCode.split('(')[0].trim().slice(0, 3).toUpperCase()
    : fromCode.slice(0, 3).toUpperCase();
  const toDisplay = toCode.includes('(')
    ? toCode.split('(')[0].trim().slice(0, 3).toUpperCase()
    : toCode.slice(0, 3).toUpperCase();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `✈️ ${isDemoTrace(flight.traceId) ? 'DEMO booking (not a real ticket)' : 'Flight Confirmed!'} PNR: ${pnr}\n${airlineName} (${flightNumber}): ${fromDisplay} ➔ ${toDisplay}\nDeparture: ${dateLabel} at ${flight.depart}\nTicket No: ${ticketNo}\nBooked with WishMe!`,
      });
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    Alert.alert(
      'E-Ticket Downloaded',
      `Your E-Ticket PDF has been saved to your downloads and sent to ${contact.email}.`,
      [{ text: 'OK' }]
    );
  };

  const handleAddToCalendar = () => {
    Alert.alert(
      'Added to Calendar',
      `Flight ${airlineName} ${flightNumber} scheduled for ${dateLabel} added to your device calendar.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={s.root}>
      {/* Top Banner */}
      <View style={[s.topBanner, { paddingTop: topPad + 12 }]}>
        <View style={s.successBadge}>
          <CheckCircle2 size={36} color={T('#10B981', 'fg')} />
        </View>
        <Text style={s.successHeading}>Flight Confirmed!</Text>
        <Text style={s.successSub}>
          {isDemoTrace(flight.traceId) ? 'Demo booking: no e-ticket was sent' : 'E-ticket has been sent to '}{isDemoTrace(flight.traceId) ? null : <Text style={{ color: T(C.blue, 'fg'), fontFamily: 'Inter_600SemiBold' }}>{contact.email}</Text>}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {isDemoTrace(flight.traceId) && <DemoFareNotice booked />}
        {/* Boarding Pass Style Card */}
        <View style={s.ticketCard}>
          {/* Header */}
          <View style={s.ticketHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>{flight.logo}</Text>
              <View>
                <Text style={s.airlineName}>{airlineName}</Text>
                <Text style={s.flightNum}>{flightNumber} · Economy</Text>
              </View>
            </View>
            <View style={s.pnrBadge}>
              <Text style={s.pnrLabel}>PNR</Text>
              <Text style={s.pnrCode}>{pnr}</Text>
            </View>
          </View>

          {/* Route & Times */}
          <View style={s.routeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.airportCode}>{fromDisplay}</Text>
              <Text style={s.timeText}>{flight.depart}</Text>
              <Text style={s.terminalText}>Terminal 3</Text>
            </View>

            <View style={s.durationCol}>
              <Text style={s.durationText}>{flight.duration}</Text>
              <View style={s.flightLine}>
                <View style={s.lineDot} />
                <View style={s.dashLine} />
                <Plane size={14} color={T(C.blue, 'fg')} style={{ transform: [{ rotate: '90deg' }] }} />
                <View style={s.dashLine} />
                <View style={s.lineDot} />
              </View>
              <Text style={s.stopsText}>{flight.stops === 0 ? 'Non-Stop' : `${flight.stops} Stop`}</Text>
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={s.airportCode}>{toDisplay}</Text>
              <Text style={s.timeText}>{flight.arrive}</Text>
              <Text style={s.terminalText}>Terminal 2</Text>
            </View>
          </View>

          <View style={s.ticketDivider}>
            <View style={s.notchLeft} />
            <View style={s.dashedSep} />
            <View style={s.notchRight} />
          </View>

          {/* Passengers List */}
          <View style={s.passengersBlock}>
            <Text style={s.sectionMini}>PASSENGERS & SEATS</Text>
            {passengers.map((p, idx) => {
              const assignedSeat = addons.seats.find((st) => st.paxIndex === idx);
              const seatLabel = assignedSeat?.seatNo || (idx === 0 ? '12A' : `12${String.fromCharCode(66 + idx)}`);
              return (
                <View key={p.id} style={s.passItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <User size={14} color={T(C.blue, 'fg')} />
                    <Text style={s.passName}>
                      {p.title} {p.firstName} {p.lastName}
                    </Text>
                  </View>
                  <View style={s.seatBadge}>
                    <Text style={s.seatBadgeText}>
                      Seat {seatLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Add-ons badges if selected */}
          {(addons.meals.length > 0 || addons.extraBaggageKg > 0 || addons.insurance) && (
            <View style={s.addonsIncluded}>
              {addons.meals.length > 0 && (
                <View style={s.addonChip}>
                  <Utensils size={12} color={T('#D97706', 'fg')} />
                  <Text style={s.addonChipText}>{addons.meals.length} Meal(s)</Text>
                </View>
              )}
              {addons.extraBaggageKg > 0 && (
                <View style={s.addonChip}>
                  <Luggage size={12} color={T('#059669', 'fg')} />
                  <Text style={s.addonChipText}>+{addons.extraBaggageKg}kg Extra Baggage</Text>
                </View>
              )}
              {addons.insurance && (
                <View style={s.addonChip}>
                  <ShieldCheck size={12} color={T('#FF5F1F', 'fg')} />
                  <Text style={s.addonChipText}>Trip Insurance Active</Text>
                </View>
              )}
            </View>
          )}

          {/* Barcode / QR Section */}
          <View style={s.qrSection}>
            <View style={s.qrBox}>
              <QrCode size={54} color={T(C.dark, 'fg')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eTicketNum}>E-TICKET NO</Text>
              <Text style={s.eTicketVal}>{ticketNo}</Text>
              <Text style={s.barcodeHint}>Scan at airport self-service kiosk or gate</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleDownload}>
            <Download size={16} color={T(C.blue, 'fg')} />
            <Text style={s.actionBtnText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleShare}>
            <Share2 size={16} color={T(C.blue, 'fg')} />
            <Text style={s.actionBtnText}>Share Ticket</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleAddToCalendar}>
            <Calendar size={16} color={T(C.blue, 'fg')} />
            <Text style={s.actionBtnText}>Add Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Important Airport Guidelines */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Important Guidelines</Text>
          <View style={s.infoItem}>
            <MapPin size={14} color={T(C.textLight, 'fg')} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Reach airport at least 2 hours before domestic flight departure.
            </Text>
          </View>
          <View style={s.infoItem}>
            <Luggage size={14} color={T(C.textLight, 'fg')} style={{ marginTop: 2 }} />
            <Text style={s.infoText}>
              Standard cabin baggage: 7kg per passenger. Valid Govt photo ID required at gate.
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
  ticketCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
   ...glass(22), },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  airlineName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  flightNum: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  pnrBadge: {
    backgroundColor: T('#EFF6FF', 'bg'),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  pnrLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: T(C.blue, 'fg'), letterSpacing: 0.5 },
  pnrCode: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.dark, 'fg') },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  airportCode: { fontSize: 24, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  timeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T(C.dark, 'fg'), marginTop: 2 },
  terminalText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  durationCol: { alignItems: 'center', paddingHorizontal: 10 },
  durationText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg'), marginBottom: 4 },
  flightLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: T(C.blue, 'bg') },
  dashLine: { width: 22, height: 1, backgroundColor: T(C.blue, 'bg') },
  stopsText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: T('#059669', 'fg'), marginTop: 4 },
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -16,
    marginVertical: 4,
    position: 'relative',
  },
  notchLeft: {
    width: 14,
    height: 28,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: T(C.pageBg, 'bg'),
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: T(C.border, 'border'),
  },
  dashedSep: {
    flex: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    height: 0,
    marginHorizontal: 4,
  },
  notchRight: {
    width: 14,
    height: 28,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: T(C.pageBg, 'bg'),
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: T(C.border, 'border'),
  },
  passengersBlock: { paddingVertical: 10 },
  sectionMini: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.gray, 'fg'), letterSpacing: 0.8, marginBottom: 8 },
  passItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  passName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  seatBadge: {
    backgroundColor: T('#F3F4F6', 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seatBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  addonsIncluded: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
  },
  addonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T('#F8FAFC', 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  addonChipText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  qrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: T('#F8FAFC', 'bg'),
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  qrBox: {
    backgroundColor: T(C.white, 'bg'),
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  eTicketNum: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.textLight, 'fg'), letterSpacing: 0.5 },
  eTicketVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 1 },
  barcodeHint: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.gray, 'fg'), marginTop: 2 },
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
  actionBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.blue, 'fg') },
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
    backgroundColor: T(C.blue, 'bg'),
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
   overflow: 'hidden', },
  doneBtnText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
});
const use_s = () => useThemedStyles(make_s);
