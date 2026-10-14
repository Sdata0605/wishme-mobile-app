import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
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
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  Plane,
  Plus,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react-native';
import { serviceColors as C } from './serviceColors';
import { useAuth } from '@/context/AuthContext';
import type { FlightResult } from './FlightResultsScreen';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';

export interface FlightPassenger {
  id: string;
  type: 'adult' | 'child' | 'infant';
  title: 'Mr' | 'Ms' | 'Mrs';
  firstName: string;
  lastName: string;
  gender: 'Male' | 'Female';
  dob: string;
  passportNo?: string;
}

export interface FlightContactInfo {
  email: string;
  phone: string;
  gstEnabled: boolean;
  gstNumber?: string;
  companyName?: string;
}

export function FlightPassengerScreen({
  flight,
  fareKey,
  adultsCount = 1,
  childrenCount = 0,
  infantsCount = 0,
  onBack,
  onContinue,
}: {
  flight: FlightResult;
  fareKey: string;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  onBack: () => void;
  onContinue: (passengers: FlightPassenger[], contact: FlightContactInfo) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user } = useAuth();

  const [passengers, setPassengers] = useState<FlightPassenger[]>(() => {
    const list: FlightPassenger[] = [];
    const userFirst = user?.firstName || 'Rahul';
    const userLast = user?.lastName || 'Sharma';

    for (let i = 0; i < Math.max(1, adultsCount); i++) {
      list.push({
        id: `pax_adult_${i + 1}`,
        type: 'adult',
        title: 'Mr',
        firstName: i === 0 ? userFirst : '',
        lastName: i === 0 ? userLast : '',
        gender: 'Male',
        dob: '1995-05-15',
      });
    }

    for (let i = 0; i < childrenCount; i++) {
      list.push({
        id: `pax_child_${i + 1}`,
        type: 'child',
        title: 'Master' as any,
        firstName: '',
        lastName: userLast,
        gender: 'Male',
        dob: '2016-08-20',
      });
    }

    for (let i = 0; i < infantsCount; i++) {
      list.push({
        id: `pax_infant_${i + 1}`,
        type: 'infant',
        title: 'Master' as any,
        firstName: '',
        lastName: userLast,
        gender: 'Male',
        dob: '2025-01-10',
      });
    }

    return list;
  });

  const [email, setEmail] = useState(user?.email || 'traveler@wishme.today');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const updatePax = (id: string, field: keyof FlightPassenger, val: any) => {
    setPassengers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    );
  };

  const handleProceed = () => {
    // Validate
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.firstName.trim()) {
        setErrorMsg(`Please enter First Name for Passenger ${i + 1}`);
        return;
      }
      if (!p.lastName.trim()) {
        setErrorMsg(`Please enter Last Name for Passenger ${i + 1}`);
        return;
      }
    }

    if (!email.trim() || !phone.trim()) {
      setErrorMsg('Please provide valid contact email and phone number for ticket delivery');
      return;
    }

    setErrorMsg('');
    onContinue(passengers, {
      email: email.trim(),
      phone: phone.trim(),
      gstEnabled,
      gstNumber: gstNumber.trim() || undefined,
      companyName: companyName.trim() || undefined,
    });
  };

  const airlineName = flight.airlineName || flight.airline || 'IndiGo';
  const airlineCode = flight.airlineCode || flight.airline?.slice(0, 2)?.toUpperCase() || '6E';
  const flightNumber = flight.flightNumber || '2041';
  const fromCode = flight.fromCode || flight.depAirport || 'DEL';
  const toCode = flight.toCode || flight.arrAirport || 'BOM';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T(C.pageBg, 'page') }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Traveller Details</Text>
          <Text style={st.headerSub}>
            {airlineName} · {passengers.length} Passenger{passengers.length > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={st.stepBadge}>
          <Text style={st.stepText}>Step 1 of 3</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Flight summary banner */}
        <View style={st.flightBanner}>
          <View style={st.fbLeft}>
            <Text style={st.fbAir}>{airlineName} ({airlineCode}-{flightNumber})</Text>
            <Text style={st.fbRoute}>{fromCode} ➔ {toCode}</Text>
          </View>
          <View style={st.fbRight}>
            <Text style={st.fbFare}>{fareKey.toUpperCase()} FARE</Text>
            <Text style={st.fbPrice}>₹{flight.price.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {errorMsg ? (
          <View style={st.errorBox}>
            <Text style={st.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Passenger Cards */}
        {passengers.map((pax, idx) => (
          <View key={pax.id} style={st.paxCard}>
            <View style={st.paxCardHead}>
              <View style={st.paxBadge}>
                <User size={14} color={T(C.purple, 'fg')} />
                <Text style={st.paxBadgeText}>
                  Passenger {idx + 1} ({pax.type.toUpperCase()})
                </Text>
              </View>
              {idx === 0 && <Text style={st.leadText}>Primary Contact</Text>}
            </View>

            {/* Title & Gender */}
            <View style={st.titleRow}>
              <View style={st.genderWrap}>
                {(['Mr', 'Ms', 'Mrs'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[st.titleBtn, pax.title === t && st.titleBtnActive]}
                    onPress={() => updatePax(pax.id, 'title', t)}
                  >
                    <Text style={[st.titleBtnText, pax.title === t && st.titleBtnTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ width: 12 }} />

              <View style={st.genderWrap}>
                {(['Male', 'Female'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[st.titleBtn, pax.gender === g && st.titleBtnActive]}
                    onPress={() => updatePax(pax.id, 'gender', g)}
                  >
                    <Text style={[st.titleBtnText, pax.gender === g && st.titleBtnTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* First & Last Name */}
            <View style={st.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.inputLabel}>First & Middle Name*</Text>
                <TextInput
                  style={st.input}
                  placeholder="e.g. Rahul"
                  placeholderTextColor={T(C.gray, 'fg')}
                  value={pax.firstName}
                  onChangeText={(v) => updatePax(pax.id, 'firstName', v)}
                />
              </View>

              <View style={{ width: 10 }} />

              <View style={{ flex: 1 }}>
                <Text style={st.inputLabel}>Last Name*</Text>
                <TextInput
                  style={st.input}
                  placeholder="e.g. Sharma"
                  placeholderTextColor={T(C.gray, 'fg')}
                  value={pax.lastName}
                  onChangeText={(v) => updatePax(pax.id, 'lastName', v)}
                />
              </View>
            </View>

            {/* Date of Birth */}
            <View style={{ marginTop: 10 }}>
              <Text style={st.inputLabel}>Date of Birth (YYYY-MM-DD)*</Text>
              <TextInput
                style={st.input}
                placeholder="1995-05-15"
                placeholderTextColor={T(C.gray, 'fg')}
                value={pax.dob}
                onChangeText={(v) => updatePax(pax.id, 'dob', v)}
              />
            </View>
          </View>
        ))}

        {/* Contact info card */}
        <View style={st.paxCard}>
          <Text style={st.cardTitle}>Contact Details</Text>
          <Text style={st.cardSub}>Your e-ticket and flight status alerts will be sent here</Text>

          <View style={{ marginTop: 12 }}>
            <Text style={st.inputLabel}>Email Address*</Text>
            <View style={st.iconInputWrap}>
              <Mail size={16} color={T(C.gray, 'fg')} />
              <TextInput
                style={st.iconInput}
                placeholder="your.email@example.com"
                placeholderTextColor={T(C.gray, 'fg')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={st.inputLabel}>Mobile Number*</Text>
            <View style={st.iconInputWrap}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') }}>+91</Text>
              <TextInput
                style={st.iconInput}
                placeholder="9876543210"
                placeholderTextColor={T(C.gray, 'fg')}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        </View>

        {/* GST Toggle */}
        <View style={st.paxCard}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => setGstEnabled(!gstEnabled)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Briefcase size={18} color={T(C.purple, 'fg')} />
              <View>
                <Text style={st.gstTitle}>Add GST Number (Optional)</Text>
                <Text style={st.gstSub}>Claim input tax credit on business travel</Text>
              </View>
            </View>
            <View style={[st.checkCircle, gstEnabled && st.checkCircleActive]}>
              {gstEnabled && <CheckCircle2 size={18} color={T(C.white, 'fg')} />}
            </View>
          </TouchableOpacity>

          {gstEnabled && (
            <View style={{ marginTop: 14, gap: 10 }}>
              <TextInput
                style={st.input}
                placeholder="GSTIN (e.g. 07AAAAA0000A1Z5)"
                placeholderTextColor={T(C.gray, 'fg')}
                value={gstNumber}
                onChangeText={setGstNumber}
                autoCapitalize="characters"
              />
              <TextInput
                style={st.input}
                placeholder="Company Name"
                placeholderTextColor={T(C.gray, 'fg')}
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={st.footerLabel}>Total Fare</Text>
          <Text style={st.footerPrice}>
            ₹{(flight.price * passengers.length).toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity style={st.continueBtn} activeOpacity={0.85} onPress={handleProceed}><BrandFill />
          <Text style={st.continueBtnText}>Select Seats & Add-ons</Text>
          <ChevronRight size={18} color={T(C.white, 'fg')} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  flightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T(C.darkBg, 'bg'),
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  fbLeft: { gap: 2 },
  fbAir: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)' },
  fbRoute: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.white, 'fg') },
  fbRight: { alignItems: 'flex-end', gap: 2 },
  fbFare: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T('#FCD34D', 'fg') },
  fbPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.white, 'fg') },
  errorBox: { backgroundColor: T('#FEE2E2', 'bg'), borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.red, 'fg') },
  paxCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  paxCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  paxBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paxBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  leadText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: T(C.purple, 'fg') },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  genderWrap: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: T(C.border, 'border'), overflow: 'hidden' },
  titleBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: T(C.white, 'bg') },
  titleBtnActive: { backgroundColor: T(C.purple, 'bg') },
  titleBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  titleBtnTextActive: { color: T(C.white, 'fg'), fontFamily: 'Inter_700Bold' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  inputLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg'), marginBottom: 5 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: T(C.text, 'fg'),
    backgroundColor: T('#FAFAFA', 'bg'),
  },
  iconInputWrap: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T('#FAFAFA', 'bg'),
  },
  iconInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  cardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  gstTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  gstSub: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: T(C.border, 'border'), alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { backgroundColor: T(C.purple, 'bg'), borderColor: T(C.purple, 'border') },
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
  continueBtn: {
    backgroundColor: T(C.orange, 'bg'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
   overflow: 'hidden', },
  continueBtnText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
