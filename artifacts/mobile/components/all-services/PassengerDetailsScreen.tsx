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
          <CheckCircle2 size={54} color={C.green} />
        </View>
        <Text style={st.successTitle}>Seat is booked</Text>
        <Text style={st.successSub}>
          {seats.map((s) => s.id).join(', ')} on {bus.company}
          {'\n'}
          {boarding.name} ({boarding.time}) → {dropping.name} ({dropping.time})
        </Text>
        <Text style={st.successFare}>₹{total} · {name.trim()}</Text>
        <TouchableOpacity style={st.doneBtn} activeOpacity={0.85} onPress={onBack}>
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
          <ArrowLeft size={24} color={C.text} />
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
              <Navigation size={14} color={C.orange} />
              <Text style={st.pointText} numberOfLines={1}>
                {boarding.name} · {boarding.time}
              </Text>
            </View>
            <View style={st.pointRow}>
              <MapPin size={14} color={C.green} />
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
            <View style={[st.sectionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Phone size={15} color={C.orange} />
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
              placeholderTextColor={C.gray}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={st.inputLabel}>Email</Text>
            <TextInput
              style={st.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.gray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={st.inputLabel}>State of residence</Text>
            <TextInput
              style={st.input}
              value={stateRes}
              onChangeText={setStateRes}
              placeholder="e.g. Maharashtra"
              placeholderTextColor={C.gray}
            />
            <View style={st.toggleRow}>
              <Text style={st.toggleText}>
                Notify me about this seat booking on SMS & email
              </Text>
              <Switch
                value={notify}
                onValueChange={setNotify}
                trackColor={{ false: '#D1D5DB', true: '#FDBA8C' }}
                thumbColor={notify ? C.orange : C.white}
              />
            </View>
          </View>

          {/* Passenger information */}
          <View style={st.sectionHead}>
            <View style={[st.sectionIcon, { backgroundColor: '#F5F3FF' }]}>
              <User size={15} color={C.purple} />
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
              placeholderTextColor={C.gray}
            />
            <Text style={st.inputLabel}>Age</Text>
            <TextInput
              style={st.input}
              value={age}
              onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
              placeholder="Age in years"
              placeholderTextColor={C.gray}
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
          >
            <BadgeCheck size={16} color={C.white} />
            <Text style={st.bookText}>Book seat</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  card: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  busName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  timesLine: {
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    marginTop: 2,
    marginBottom: 10,
  },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pointText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  seatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  seatId: { width: 46, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: C.text },
  seatMeta: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  seatPrice: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.text },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textLight },
  totalValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.green },
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
  sectionTitle: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: C.text },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: C.textLight,
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 9,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.text,
    backgroundColor: C.white,
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
    color: C.text,
    lineHeight: 16,
  },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: C.white,
  },
  genderChipActive: { borderColor: C.purple, backgroundColor: '#F5F3FF' },
  genderText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.textLight },
  genderTextActive: { color: C.purple },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textLight },
  footerTotal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 1 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  bookDisabled: { backgroundColor: '#FDBA8C' },
  bookText: { color: C.white, fontSize: 13.5, fontFamily: 'Inter_700Bold' },
  successWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  successSub: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  successFare: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.green, marginTop: 10 },
  doneBtn: {
    marginTop: 24,
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  doneText: { color: C.white, fontSize: 13.5, fontFamily: 'Inter_700Bold' },
});
