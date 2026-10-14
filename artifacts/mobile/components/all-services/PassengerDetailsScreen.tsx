import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
  MapPin,
  Navigation,
  Phone,
  User,
} from 'lucide-react-native';
import type { BusTicket } from './BusResultsScreen';
import type { Seat } from './SeatSelectionScreen';
import type { StopPoint } from './BoardingPointsScreen';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';

const GENDERS = ['Female', 'Male', 'Other'] as const;

export function PassengerDetailsScreen({
  bus,
  seats,
  boarding,
  dropping,
  onBack,
}: {
  bus: BusTicket;
  seats: Seat[];
  boarding: StopPoint;
  dropping: StopPoint;
  onBack: () => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [stateRes, setStateRes] = useState('');
  const [notify, setNotify] = useState(true);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const total = seats.reduce((sum, s) => sum + s.price, 0);
  const seatType = bus.sleeper ? 'Sleeper' : 'Seater';

  const canBook =
    mobile.trim().length >= 10 &&
    email.trim().includes('@') &&
    stateRes.trim().length > 0 &&
    name.trim().length > 0 &&
    age.trim().length > 0 &&
    gender !== null;

  if (booked) {
    return (
      <View style={[st.root, st.successWrap]}>
        <View style={st.successCircle}>
          <CheckCircle2 size={54} color={T(C.green, 'fg')} />
        </View>
        <Text style={st.successTitle}>Seat is booked</Text>
        <Text style={st.successSub}>
          {seats.map((s) => s.id).join(', ')} on {bus.company}
          {'\n'}
          {boarding.name} ({boarding.time}) → {dropping.name} ({dropping.time})
        </Text>
        <Text style={st.successFare}>₹{total} · {name.trim()}</Text>
        <TouchableOpacity style={st.doneBtn} activeOpacity={0.85} onPress={onBack}><BrandFill />
          <Text style={st.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.headerBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Passenger details</Text>
          <Text style={st.headerSub}>Review your booking and fill in details</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Booking summary */}
          <View style={st.card}>
            <Text style={st.busName}>{bus.company}</Text>
            <Text style={st.timesLine}>
              {bus.depart} → {bus.arrive} · {bus.duration}
            </Text>

            <View style={st.pointRow}>
              <Navigation size={14} color={T(C.orange, 'fg')} />
              <Text style={st.pointText} numberOfLines={1}>
                {boarding.name} · {boarding.time}
              </Text>
            </View>
            <View style={st.pointRow}>
              <MapPin size={14} color={T(C.green, 'fg')} />
              <Text style={st.pointText} numberOfLines={1}>
                {dropping.name} · {dropping.time}
              </Text>
            </View>

            <View style={st.divider} />

            {seats.map((s) => (
              <View key={s.id} style={st.seatRow}>
                <Text style={st.seatId}>{s.id}</Text>
                <Text style={st.seatMeta}>
                  {seatType} · {s.id.startsWith('U') ? 'Upper' : 'Lower'} deck
                </Text>
                <Text style={st.seatPrice}>₹{s.price}</Text>
              </View>
            ))}

            <View style={st.divider} />
            <View style={st.totalRow}>
              <Text style={st.totalLabel}>
                Total fare · {seats.length} seat{seats.length > 1 ? 's' : ''}
              </Text>
              <Text style={st.totalValue}>₹{total}</Text>
            </View>
          </View>

          {/* Contact details */}
          <View style={st.sectionHead}>
            <View style={[st.sectionIcon, { backgroundColor: T('#F5F0FF', 'bg') }]}>
              <Phone size={15} color={T(C.orange, 'fg')} />
            </View>
            <Text style={st.sectionTitle}>Contact details</Text>
          </View>
          <View style={st.card}>
            <Text style={st.inputLabel}>Mobile number</Text>
            <TextInput
              style={st.input}
              value={mobile}
              onChangeText={setMobile}
              placeholder="10-digit mobile number"
              placeholderTextColor={T(C.gray, 'fg')}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={st.inputLabel}>Email</Text>
            <TextInput
              style={st.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={T(C.gray, 'fg')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={st.inputLabel}>State of residence</Text>
            <TextInput
              style={st.input}
              value={stateRes}
              onChangeText={setStateRes}
              placeholder="e.g. Maharashtra"
              placeholderTextColor={T(C.gray, 'fg')}
            />
            <View style={st.toggleRow}>
              <Text style={st.toggleText}>
                Notify me about this seat booking on SMS & email
              </Text>
              <Switch
                value={notify}
                onValueChange={setNotify}
                trackColor={{ false: T('#D1D5DB', 'bg'), true: T('#E9D5FF', 'bg') }}
                thumbColor={notify ? T(C.orange, 'fg') : T(C.white, 'fg')}
              />
            </View>
          </View>

          {/* Passenger information */}
          <View style={st.sectionHead}>
            <View style={[st.sectionIcon, { backgroundColor: T('#F5F3FF', 'bg') }]}>
              <User size={15} color={T(C.purple, 'fg')} />
            </View>
            <Text style={st.sectionTitle}>Passenger information</Text>
          </View>
          <View style={st.card}>
            <Text style={st.inputLabel}>Full name</Text>
            <TextInput
              style={st.input}
              value={name}
              onChangeText={setName}
              placeholder="Name as per ID"
              placeholderTextColor={T(C.gray, 'fg')}
            />
            <Text style={st.inputLabel}>Age</Text>
            <TextInput
              style={st.input}
              value={age}
              onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
              placeholder="Age in years"
              placeholderTextColor={T(C.gray, 'fg')}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={st.inputLabel}>Gender</Text>
            <View style={st.genderRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[st.genderChip, gender === g && st.genderChipActive]}
                  activeOpacity={0.75}
                  onPress={() => setGender(g)}
                >
                  <Text style={[st.genderText, gender === g && st.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1 }}>
            <Text style={st.footerLabel}>Total fare</Text>
            <Text style={st.footerTotal}>₹{total}</Text>
          </View>
          <TouchableOpacity
            style={[st.bookBtn, !canBook && st.bookDisabled]}
            activeOpacity={0.85}
            disabled={!canBook}
            onPress={() => setBooked(true)}
          ><BrandFill />
            <BadgeCheck size={16} color={T(C.white, 'fg')} />
            <Text style={st.bookText}>Book seat</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: T(C.white, 'page'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'page'),
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  card: {
    backgroundColor: T(C.white, 'bg'),
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 14,
   ...glass(22), },
  busName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  timesLine: {
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
    marginBottom: 10,
  },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pointText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  divider: { height: 1, backgroundColor: T(C.border, 'bg'), marginVertical: 12 },
  seatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  seatId: { width: 46, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  seatMeta: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  seatPrice: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.textLight, 'fg') },
  totalValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg') },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.textLight, 'fg'),
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 9,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: T(C.text, 'fg'),
    backgroundColor: T(C.white, 'bg'),
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  toggleText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    color: T(C.text, 'fg'),
    lineHeight: 16,
  },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: T(C.white, 'bg'),
  },
  genderChipActive: { borderColor: T(C.purple, 'border'), backgroundColor: T('#F5F3FF', 'bg') },
  genderText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  genderTextActive: { color: T(C.purple, 'fg') },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 16,
    paddingTop: 12,
   ...dockBar(), },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  footerTotal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 1 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
   overflow: 'hidden', },
  bookDisabled: { backgroundColor: T('#E9D5FF', 'bg') },
  bookText: { color: T(C.white, 'fg'), fontSize: 13.5, fontFamily: 'Inter_700Bold' },
  successWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  successSub: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  successFare: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg'), marginTop: 10 },
  doneBtn: {
    marginTop: 24,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 12,
   overflow: 'hidden', },
  doneText: { color: T(C.white, 'fg'), fontSize: 13.5, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
