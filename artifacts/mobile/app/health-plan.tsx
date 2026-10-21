import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  LocateFixed,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useTheme } from '@/context/ThemeContext';

type Benefit = 'checkup' | 'doctor' | 'psych' | 'nutri';
type MemberKey = 'self' | 'spouse' | 'daughter' | 'son' | 'mother' | 'father' | 'motherInLaw' | 'fatherInLaw';

const GREEN = '#22C55E';
const GOLD = '#F59E0B';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** What the flow says and shows when it was opened from one of the "We care for you" cards. */
const BENEFITS: Record<Benefit, { label: string; short: string; img: number; line: string }> = {
  checkup: { label: 'Free health check-up', short: 'health check-up', img: require('@/assets/images/care-checkup.webp'), line: 'Free annual health check-up' },
  doctor: { label: 'Free doctor consultations', short: 'doctor consults', img: require('@/assets/images/care-doctor.webp'), line: 'Unlimited free doctor consultations' },
  psych: { label: 'Free psychologist sessions', short: 'psychologist sessions', img: require('@/assets/images/care-psychologist.webp'), line: 'Free sessions with a psychologist' },
  nutri: { label: 'Free nutritionist consults', short: 'nutritionist consults', img: require('@/assets/images/care-nutritionist.webp'), line: 'Free diet plans from a nutritionist' },
};

const MEMBERS: { key: MemberKey; label: (male: boolean) => string; age: number; child?: boolean; elder?: boolean; female: (male: boolean) => boolean }[] = [
  { key: 'self', label: () => 'Myself', age: 30, female: (m) => !m },
  { key: 'spouse', label: (m) => (m ? 'Wife' : 'Husband'), age: 28, female: (m) => m },
  { key: 'daughter', label: () => 'Daughter', age: 5, child: true, female: () => true },
  { key: 'son', label: () => 'Son', age: 5, child: true, female: () => false },
  { key: 'mother', label: () => 'Mother', age: 55, elder: true, female: () => true },
  { key: 'father', label: () => 'Father', age: 58, elder: true, female: () => false },
  { key: 'motherInLaw', label: () => 'Mother-in-law', age: 55, elder: true, female: () => true },
  { key: 'fatherInLaw', label: () => 'Father-in-law', age: 58, elder: true, female: () => false },
];

const COVERS = [5, 10, 15, 25]; // lakhs

const PLAN_INFO = {
  premium: {
    name: 'Premium plan', Icon: Crown, badge: ['#FCD34D', '#D97706'] as [string, string], grad: ['#1E1B6E', '#0B1A5C', '#081245'] as [string, string, string], tag: 'The complete cover for your family', tagColor: GOLD,
    perks: ['No limit on room rent', '100% hospital bill covered', '200% guaranteed bonus'],
    all: ['No limit on room rent', '100% hospital bill covered', '200% guaranteed bonus', 'Pre & post hospitalisation (60 / 180 days)', 'Day-care procedures covered', 'Ambulance cover', 'Cashless at network hospitals', 'Free health check-up, doctor, psychologist and nutritionist consults'],
  },
  essential: {
    name: 'Essential plan', Icon: Star, badge: ['#93C5FD', '#3B5BDB'] as [string, string], grad: ['#22217A', '#0E2266', '#0A1650'] as [string, string, string], tag: 'A plan with all essential benefits', tagColor: '#60A5FA',
    perks: ['No limit on room rent', '100% hospital bill covered'],
    all: ['No limit on room rent', '100% hospital bill covered', 'Pre & post hospitalisation (30 / 60 days)', 'Day-care procedures covered', 'Ambulance cover', 'Cashless at network hospitals'],
  },
} as const;

const UNDERSTAND: [string, string][] = [
  ['Policy brochure', 'A summary of everything the plan covers: hospitalisation, day-care procedures, pre- and post-hospitalisation costs, ambulance charges and the free wellness benefits. The full brochure will be available here once the plan is live.'],
  ['Prospectus', 'The prospectus explains the plan options, sum insured choices, eligibility (members from 91 days to 99 years), renewal terms and how claims are settled.'],
  ['What is not covered?', 'Cosmetic or aesthetic treatment, self-inflicted injuries, injuries from adventure sports, treatment outside India, and expenses not medically necessary. Check the policy wording for the complete list.'],
  ['Waiting period', 'Illnesses are covered 30 days after the policy starts (accidents from day one). Pre-existing diseases and some specific illnesses have a longer waiting period, as stated in the policy wording.'],
];

/** Indicative monthly premium (illustrative only: real prices come from the insurer). */
function monthly(ages: number[], coverL: number, premium: boolean) {
  const eldest = Math.max(...ages);
  const band = eldest < 25 ? 260 : eldest < 36 ? 330 : eldest < 46 ? 450 : eldest < 56 ? 680 : eldest < 66 ? 1050 : 1600;
  const extra = ages.length > 1 ? 1 + 0.45 * (ages.length - 1) : 1;
  const cover = { 5: 0.72, 10: 1, 15: 1.15, 25: 1.38 }[coverL] ?? 1;
  return Math.round(band * extra * cover * (premium ? 1.26 : 1));
}

const IMG = {
  myself: require('@/assets/images/member-myself.webp'),
  wife: require('@/assets/images/member-wife.webp'),
  daughter: require('@/assets/images/member-daughter.webp'),
  son: require('@/assets/images/member-son.webp'),
  mother: require('@/assets/images/member-mother.webp'),
  father: require('@/assets/images/member-father.webp'),
  motherInLaw: require('@/assets/images/member-mother-in-law.webp'),
  fatherInLaw: require('@/assets/images/member-father-in-law.webp'),
};

/** The picture for a member. "Myself" and the spouse swap pictures when the user is female. */
function memberImg(k: MemberKey, male: boolean) {
  if (k === 'self') return male ? IMG.myself : IMG.wife;
  if (k === 'spouse') return male ? IMG.wife : IMG.myself;
  return IMG[k];
}

function Avatar({ k, male, size }: { k: MemberKey; male: boolean; size: number; colors?: unknown }) {
  return <Image source={memberImg(k, male)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F2F2F4' }} resizeMode="cover" />;
}

export default function HealthPlanScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { benefit: b } = useLocalSearchParams<{ benefit?: Benefit }>();
  const benefit = b && BENEFITS[b] ? BENEFITS[b] : null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [male, setMale] = useState(true);
  const [picked, setPicked] = useState<MemberKey[]>(['self']);
  // How many sons / daughters (each one is a separate member with an age of their own).
  const [kids, setKids] = useState<{ son: number; daughter: number }>({ son: 1, daughter: 1 });
  // Ages by member id ('self', 'son-2'...); a member without an entry uses its default age.
  const [ages, setAges] = useState<Record<string, number>>({});
  const [agePicker, setAgePicker] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [place, setPlace] = useState<{ status: 'idle' | 'loading' | 'ok' | 'bad'; text: string }>({ status: 'idle', text: '' });

  // Plans step
  const [cover, setCover] = useState(10);
  const [plan, setPlan] = useState<'premium' | 'essential'>('premium');
  const [showMembers, setShowMembers] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [note, setNote] = useState('');

  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };
  const card = { backgroundColor: colors.card, borderColor: colors.border };

  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState('');
  const autoTried = React.useRef(false);

  // Fills the pincode from where the phone is. `ask` shows the permission prompt; the automatic try on step 3 asks once.
  const fillFromLocation = React.useCallback(async (ask: boolean) => {
    setLocErr('');
    setLocating(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocErr(perm.canAskAgain ? '' : 'Location is blocked for WishMe. Enter your pincode instead.');
        return;
      }
      // A cached fix is fine if it is recent; otherwise ask the GPS for a fresh one.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!pos) throw new Error('no position');
      const { latitude, longitude } = pos.coords;

      let code = '';
      let country = '';
      try {
        const g = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
        code = (g?.postalCode ?? '').replace(/\D/g, '');
        country = (g?.isoCountryCode ?? '').toUpperCase();
      } catch {
        // some phones have no built-in geocoder; the fallback below covers them
      }
      // Android's geocoder often has no postcode for Indian addresses: ask OpenStreetMap (free, no key) instead.
      if (!/^\d{6}$/.test(code) && (!country || country === 'IN')) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json', 'User-Agent': 'WishMe/1.0 (health plan pincode)' } },
          );
          const j = (await res.json()) as { address?: { postcode?: string; country_code?: string } };
          code = (j.address?.postcode ?? '').replace(/\D/g, '');
          country = country || (j.address?.country_code ?? '').toUpperCase();
        } catch {
          // fall through to the message below
        }
      }

      if (country && country !== 'IN') setLocErr('Your current location is outside India. Enter your Indian pincode below.');
      else if (/^\d{6}$/.test(code)) setPin(code);
      else setLocErr("Couldn't find a pincode for your location. Enter it below.");
    } catch {
      setLocErr("Couldn't get your location. Enter your pincode below.");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && !pin && !autoTried.current) {
      autoTried.current = true;
      void fillFromLocation(true);
    }
  }, [step, pin, fillFromLocation]);

  // Real area lookup from India Post's public pincode data (free, no key).
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) {
      setPlace({ status: 'idle', text: '' });
      return;
    }
    let alive = true;
    setPlace({ status: 'loading', text: '' });
    fetch(`https://api.postalpincode.in/pincode/${pin}`)
      .then((r) => r.json())
      .then((j: Array<{ Status: string; PostOffice?: Array<{ Block?: string; District?: string; State?: string }> }>) => {
        if (!alive) return;
        const po = j?.[0]?.Status === 'Success' ? j[0].PostOffice?.[0] : undefined;
        if (!po) return setPlace({ status: 'bad', text: 'We could not find this pincode' });
        const area = po.Block && po.Block !== 'NA' ? po.Block : po.District;
        setPlace({ status: 'ok', text: `${area}, ${(po.State ?? '').toUpperCase()}` });
      })
      .catch(() => alive && setPlace({ status: 'ok', text: 'Pincode noted' }));
    return () => {
      alive = false;
    };
  }, [pin]);

  const instances = MEMBERS.filter((m) => picked.includes(m.key)).flatMap((m) => {
    const n = m.key === 'son' || m.key === 'daughter' ? kids[m.key] : 1;
    return Array.from({ length: n }, (_, i) => ({
      id: n > 1 ? `${m.key}-${i + 1}` : m.key,
      key: m.key,
      label: n > 1 ? `${m.label(male)} ${i + 1}` : m.label(male),
      def: m.age,
    }));
  });
  const ageOf = (id: string) => ages[id] ?? instances.find((x) => x.id === id)?.def ?? 30;
  const memberAges = instances.length ? instances.map((x) => ageOf(x.id)) : [30];
  const price = useMemo(() => ({ premium: monthly(memberAges, cover, true), essential: monthly(memberAges, cover, false) }), [memberAges.join(','), cover]);

  const toggleMember = (k: MemberKey) => {
    if (k === 'son' || k === 'daughter') setKids((c) => ({ ...c, [k]: 1 }));
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const changeKids = (k: 'son' | 'daughter', d: number) => {
    const n = kids[k] + d;
    if (n < 1) return setPicked((p) => p.filter((x) => x !== k)); // "-" at 1 removes them
    setKids((c) => ({ ...c, [k]: Math.min(n, 4) }));
  };

  const next = () => {
    if (step === 1 && picked.length) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3 && place.status === 'ok') setStep(4);
  };
  const back = () => (step === 1 || step === 4 ? router.back() : setStep((s) => (s - 1) as 1 | 2 | 3));

  // Two tiles per row, sized from the grid's real width so borders and padding can't push the second one down.
  const [gridW, setGridW] = useState(0);
  const tileW = Math.floor(((gridW || width - 66) - 12) / 2);

  /* ─────────────── Steps 1–3 ─────────────── */
  if (step < 4) {
    return (
      <AmbientBackground>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={back} hitSlop={10} accessibilityLabel="Back" style={{ alignSelf: 'flex-start' }}>
              <ArrowLeft size={24} color={colors.foreground} />
            </TouchableOpacity>

            <View style={st.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[st.headTitle, hi]}>Let's find your right plan</Text>
                {benefit && (
                  <View style={[st.benefitChip, { backgroundColor: GREEN + '22' }]}>
                    <Check size={12} color={GREEN} strokeWidth={3} />
                    <Text style={st.benefitChipText}>Includes {benefit.label.toLowerCase()}</Text>
                  </View>
                )}
              </View>
              <Image
                source={benefit ? benefit.img : require('@/assets/images/insurance-health.webp')}
                style={{ width: 84, height: 84, borderRadius: 42 }}
                resizeMode="cover"
              />
            </View>

            <View style={[st.wizard, card]}>
              <View style={[st.stepper, { backgroundColor: colors.primary + '1A' }]}>
                {[1, 2, 3].map((n, i) => (
                  <React.Fragment key={n}>
                    {i > 0 && <View style={[st.stepLine, { backgroundColor: step > i ? colors.primary : colors.border }]} />}
                    <View
                      style={[
                        st.stepDot,
                        step > n
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { borderColor: step === n ? colors.primary : colors.border },
                      ]}
                    >
                      {step > n ? <Check size={16} color="#fff" strokeWidth={3} /> : <Text style={[st.stepNum, { color: step === n ? colors.primary : colors.mutedForeground }]}>{n}</Text>}
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <View style={{ padding: 16 }}>
                {step === 1 && (
                  <>
                    <View style={st.genderRow}>
                      <Text style={[st.body, lo]}>Your gender:</Text>
                      <View style={{ flexDirection: 'row', gap: 18 }}>
                        {[true, false].map((m) => (
                          <TouchableOpacity key={String(m)} style={st.radioRow} onPress={() => setMale(m)}>
                            <View style={[st.radio, { borderColor: male === m ? colors.primary : colors.border }]}>
                              {male === m && <View style={[st.radioDot, { backgroundColor: colors.primary }]} />}
                            </View>
                            <Text style={[st.body, male === m ? [hi, { fontFamily: 'Inter_700Bold' }] : lo]}>{m ? 'Male' : 'Female'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={[st.dash, { borderColor: colors.border }]} />
                    <Text style={[st.h3, hi]}>Select members</Text>
                    <View style={st.tiles} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
                      {MEMBERS.map((m) => {
                        const on = picked.includes(m.key);
                        return (
                          <TouchableOpacity
                            key={m.key}
                            style={[st.tile, { width: tileW, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '1A' : colors.input }]}
                            onPress={() => toggleMember(m.key)}
                            activeOpacity={0.85}
                          >
                            {on && (
                              <View style={[st.tick, { backgroundColor: colors.primary }]}>
                                <Check size={12} color="#fff" strokeWidth={3} />
                              </View>
                            )}
                            <Image
                              source={memberImg(m.key, male)}
                              style={{ width: tileW - 16, height: Math.round((tileW - 16) * 0.586), borderRadius: 8 }}
                              resizeMode="cover"
                              accessibilityLabel={m.label(male)}
                            />
                            {on && (m.key === 'son' || m.key === 'daughter') && (
                              <View style={[st.counter, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <TouchableOpacity style={[st.countBtn, { backgroundColor: colors.input }]} onPress={() => changeKids(m.key as 'son' | 'daughter', -1)} hitSlop={6}>
                                  <Text style={[st.countSign, hi]}>−</Text>
                                </TouchableOpacity>
                                <Text style={[st.countVal, hi]}>{kids[m.key as 'son' | 'daughter']}</Text>
                                <TouchableOpacity
                                  style={[st.countBtn, { backgroundColor: colors.input, opacity: kids[m.key as 'son' | 'daughter'] >= 4 ? 0.4 : 1 }]}
                                  onPress={() => changeKids(m.key as 'son' | 'daughter', 1)}
                                  hitSlop={6}
                                >
                                  <Text style={[st.countSign, hi]}>+</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            <Text style={[st.tileText, hi]}>{m.label(male)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Text style={[st.h3, hi, { marginTop: 0 }]}>Select age of member{instances.length > 1 ? 's' : ''}</Text>
                    {instances.map((x) => (
                      <TouchableOpacity key={x.id} style={[st.ageRow, { borderColor: colors.border }]} onPress={() => setAgePicker(x.id)}>
                        <Avatar k={x.key} male={male} size={40} />
                        <Text style={[st.body, hi, { flex: 1 }]}>{x.label}</Text>
                        <Text style={[st.ageVal, hi]}>{ageOf(x.id) === 0 ? '< 1' : ageOf(x.id)}</Text>
                        <ChevronDown size={18} color={colors.foreground} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {step === 3 && (
                  <>
                    <Text style={[st.h3, hi, { marginTop: 0 }]}>Enter pincode</Text>
                    <Text style={[st.small, lo]}>Of your current location</Text>
                    <View style={[st.pinBox, { borderColor: place.status === 'bad' ? '#EF4444' : colors.border, backgroundColor: colors.input }]}>
                      <TextInput
                        style={[st.pinInput, hi]}
                        value={pin}
                        onChangeText={(t) => {
                          setPin(t.replace(/\D/g, '').slice(0, 6));
                          setLocErr('');
                        }}
                        placeholder="6-digit pincode"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      {!!pin && (
                        <TouchableOpacity onPress={() => setPin('')} hitSlop={10}>
                          <X size={18} color={colors.foreground} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity style={st.locBtn} onPress={() => void fillFromLocation(true)} disabled={locating}>
                      {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <LocateFixed size={16} color={colors.primary} />}
                      <Text style={[st.small, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                        {locating ? 'Detecting your pincode…' : 'Use my current location'}
                      </Text>
                    </TouchableOpacity>
                    {!!locErr && place.status !== 'ok' && <Text style={st.err}>{locErr}</Text>}
                    {place.status === 'loading' && <ActivityIndicator style={{ alignSelf: 'flex-start', marginTop: 10 }} color={colors.primary} />}
                    {place.status === 'ok' && (
                      <View style={st.placeRow}>
                        <MapPin size={16} color={colors.mutedForeground} />
                        <Text style={[st.small, lo]}>{place.text}</Text>
                      </View>
                    )}
                    {place.status === 'bad' && <Text style={st.err}>{place.text}</Text>}
                    <View style={[st.infoBox, { backgroundColor: colors.input }]}>
                      <ShieldCheck size={22} color={GREEN} />
                      <View style={{ flex: 1 }}>
                        <Text style={[st.small, hi, { fontFamily: 'Inter_700Bold' }]}>Your policy covers you across India.</Text>
                        <Text style={[st.tiny, lo]}>We use the pincode to personalise your plan.</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={[st.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[st.cta, { backgroundColor: colors.primary, opacity: (step === 3 && place.status !== 'ok') || (step === 1 && !picked.length) ? 0.45 : 1 }]}
              onPress={next}
              activeOpacity={0.85}
            >
              <Text style={st.ctaText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={!!agePicker} transparent animationType="fade" onRequestClose={() => setAgePicker(null)} statusBarTranslucent>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <SheetBackdrop onPress={() => setAgePicker(null)} />
            {agePicker && (
              <View style={[st.sheet, { backgroundColor: '#240c40', borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
                <Text style={[st.h3, hi, { marginTop: 0, marginBottom: 10 }]}>Age of {instances.find((x) => x.id === agePicker)?.label}</Text>
                <ScrollView style={{ maxHeight: 340 }}>
                  {(MEMBERS.find((m) => m.key === instances.find((x) => x.id === agePicker)?.key)?.child ? Array.from({ length: 26 }, (_, i) => i) : Array.from({ length: 82 }, (_, i) => i + 18)).map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[st.ageOpt, { borderBottomColor: colors.border }, ageOf(agePicker) === a && { backgroundColor: colors.primary + '26' }]}
                      onPress={() => {
                        setAges((p) => ({ ...p, [agePicker]: a }));
                        setAgePicker(null);
                      }}
                    >
                      <Text style={[st.body, hi]}>{a === 0 ? 'Less than 1 year' : `${a} years`}</Text>
                      {ageOf(agePicker) === a && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </Modal>
      </AmbientBackground>
    );
  }

  /* ─────────────── Step 4: plans ─────────────── */
  const chosen = price[plan];
  return (
    <AmbientBackground>
      <View style={{ flex: 1 }}>
        <View style={[st.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
            <X size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[st.topTitle, hi]}>WishMe Health Insurance</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 170 }} showsVerticalScrollIndicator={false}>
          {benefit && (
            <View style={[st.benefitBanner, card]}>
              <Image source={benefit.img} style={{ width: 92, height: 62, borderRadius: 8 }} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[st.small, hi, { fontFamily: 'Inter_700Bold' }]}>{benefit.label}</Text>
                <Text style={[st.tiny, lo]}>Included with the Premium plan at no extra cost.</Text>
              </View>
            </View>
          )}

          <View style={[st.rowBetween, { marginTop: 18 }]}>
            <Text style={[st.h3, hi, { marginTop: 0 }]}>{instances.length} member{instances.length > 1 ? 's' : ''} covered</Text>
            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={[st.link, hi]}>Add / edit</Text>
            </TouchableOpacity>
          </View>
          <View style={[st.memberBox, card]}>
            <TouchableOpacity style={st.memberHead} onPress={() => setShowMembers((s) => !s)}>
              <View style={{ flexDirection: 'row' }}>
                {instances.slice(0, 4).map((x, i) => (
                  <View key={x.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar k={x.key} male={male} size={32} /></View>
                ))}
              </View>
              <Text style={[st.body, hi, { flex: 1 }]} numberOfLines={1}>{instances.map((x) => x.label).join(', ')}</Text>
              {showMembers ? <ChevronUp size={18} color={colors.foreground} /> : <ChevronDown size={18} color={colors.foreground} />}
            </TouchableOpacity>
            {showMembers &&
              instances.map((x) => (
                <View key={x.id} style={[st.memberLine, { borderTopColor: colors.border }]}>
                  <Text style={[st.small, hi]}>{x.label}</Text>
                  <Text style={[st.small, lo]}>{ageOf(x.id) === 0 ? 'Under 1 year' : `${ageOf(x.id)} years`}</Text>
                </View>
              ))}
          </View>

          <Text style={[st.h3, hi]}>Cover amount</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
            {COVERS.map((c) => {
              const on = cover === c;
              return (
                <TouchableOpacity key={c} style={[st.coverCard, { borderColor: on ? colors.primary : colors.border, backgroundColor: colors.card }]} onPress={() => setCover(c)} activeOpacity={0.85}>
                  <View style={[st.coverHead, { backgroundColor: on ? colors.primary + '33' : 'transparent', borderBottomColor: colors.border }]}>
                    <Text style={[st.coverAmt, on ? hi : lo]}>₹{c} Lakhs</Text>
                  </View>
                  {(['premium', 'essential'] as const).map((p) => (
                    <View key={p} style={st.coverLine}>
                      <Text style={[st.small, lo]}>{p === 'premium' ? 'Premium' : 'Essential'} :</Text>
                      <Text style={[st.small, on ? hi : lo]}>{inr(monthly(memberAges, c, p === 'premium'))} /mo</Text>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[st.h3, hi]}>Select your plan</Text>
          {(['premium', 'essential'] as const).map((p) => {
            const info = PLAN_INFO[p];
            const on = plan === p;
            const open = expanded === p;
            const perks = [...(open ? info.all : info.perks)];
            return (
              <TouchableOpacity
                key={p}
                activeOpacity={0.9}
                onPress={() => setPlan(p)}
                style={[st.planCard, { borderColor: on ? colors.primary : 'rgba(255,255,255,0.12)', borderWidth: on ? 2 : 1 }]}
              >
                <LinearGradient colors={info.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={st.planHead}>
                  <LinearGradient colors={info.badge} style={st.badge}>
                    <info.Icon size={18} color="#fff" fill="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.planName, st.onDark]}>{info.name}</Text>
                    <Text style={[st.planPrice, st.onDark]}>
                      {inr(price[p])} <Text style={[st.small, st.onDarkLo]}>/month</Text>
                    </Text>
                  </View>
                  <View style={[st.radio, { borderColor: on ? '#fff' : 'rgba(255,255,255,0.45)' }]}>
                    {on && <View style={[st.radioDot, { backgroundColor: '#fff' }]} />}
                  </View>
                </View>
                <View style={[st.tag, { backgroundColor: info.tagColor + '26', borderColor: info.tagColor + '66' }]}>
                  <Text style={[st.tagText, { color: info.tagColor }]}>{info.tag}</Text>
                </View>
                {benefit && (
                  <View style={st.perk}>
                    {p === 'premium' ? <Check size={16} color={GREEN} strokeWidth={3} /> : <X size={16} color="#EF4444" strokeWidth={3} />}
                    <Text style={[st.perkText, st.onDark, { fontFamily: 'Inter_700Bold' }]}>{benefit.line}</Text>
                    {p === 'premium' && <View style={st.free}><Text style={st.freeText}>FREE</Text></View>}
                  </View>
                )}
                {perks.map((t) => (
                  <View key={t} style={st.perk}>
                    <Check size={16} color={GREEN} strokeWidth={3} />
                    <Text style={[st.perkText, st.onDarkLo]}>{t}</Text>
                  </View>
                ))}
                <TouchableOpacity style={[st.allBtn, { backgroundColor: 'rgba(255,255,255,0.14)' }]} onPress={() => setExpanded(open ? null : p)}>
                  <Text style={[st.allText, st.onDark]}>{open ? 'Show less' : 'View all benefits'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[st.outline, { borderColor: colors.primary }]} onPress={() => setCompare(true)}>
            <Text style={[st.allText, hi]}>Compare plans</Text>
          </TouchableOpacity>

          <Text style={[st.h3, hi]}>Understand WishMe Health Insurance</Text>
          <View style={[st.accordion, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {UNDERSTAND.map(([q, a], i) => (
              <TouchableOpacity key={q} style={[st.accRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]} onPress={() => setOpenRow(openRow === i ? null : i)} activeOpacity={0.85}>
                <View style={st.rowBetween}>
                  <Text style={[st.body, hi]}>{q}</Text>
                  {openRow === i ? <ChevronUp size={18} color={colors.foreground} /> : <ChevronRight size={18} color={colors.foreground} />}
                </View>
                {openRow === i && <Text style={[st.small, lo, { marginTop: 8, lineHeight: 19 }]}>{a}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity style={[st.call, { backgroundColor: colors.primary, bottom: insets.bottom + 150 }]} onPress={() => router.push('/support' as Href)} accessibilityLabel="Talk to us">
          <Phone size={20} color="#fff" />
        </TouchableOpacity>

        <View style={[st.payFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={st.gstStrip}>
            <Text style={st.gstText}>0% GST on health insurance</Text>
          </View>
          {payOpen && (
            <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 4 }}>
              {[
                ['Plan', `${PLAN_INFO[plan].name} · ₹${cover} Lakhs`],
                ['Monthly premium', inr(chosen)],
                ['Yearly premium', inr(chosen * 12)],
                ['GST', '₹0'],
              ].map(([k, v]) => (
                <View key={k} style={st.rowBetween}>
                  <Text style={[st.small, lo]}>{k}</Text>
                  <Text style={[st.small, hi]}>{v}</Text>
                </View>
              ))}
            </View>
          )}
          {!!note && <Text style={[st.tiny, lo, { textAlign: 'center', paddingTop: 8 }]}>{note}</Text>}
          <View style={[st.payRow, { paddingBottom: insets.bottom + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.payPrice, hi]}>{inr(chosen)}<Text style={[st.small, lo]}>/month</Text></Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => setPayOpen((o) => !o)}>
                <Text style={[st.link, hi]}>Payment details</Text>
                {payOpen ? <ChevronDown size={14} color={colors.foreground} /> : <ChevronUp size={14} color={colors.foreground} />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[st.cta, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => setNote('Buying online is coming soon. Prices shown are indicative.')}
              activeOpacity={0.85}
            >
              <Text style={st.ctaText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={compare} transparent animationType="fade" onRequestClose={() => setCompare(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <SheetBackdrop onPress={() => setCompare(false)} />
          <View style={[st.sheet, { backgroundColor: '#240c40', borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={st.rowBetween}>
              <Text style={[st.h3, hi, { marginTop: 0 }]}>Compare plans</Text>
              <TouchableOpacity onPress={() => setCompare(false)} hitSlop={10}><X size={22} color={colors.foreground} /></TouchableOpacity>
            </View>
            <View style={[st.cmpRow, { borderBottomColor: colors.border }]}>
              <Text style={[st.cmpCell, lo, { flex: 1.6 }]}>Benefit</Text>
              <Text style={[st.cmpCell, hi, { fontFamily: 'Inter_700Bold' }]}>Premium</Text>
              <Text style={[st.cmpCell, hi, { fontFamily: 'Inter_700Bold' }]}>Essential</Text>
            </View>
            {[
              ['Monthly price', inr(price.premium), inr(price.essential)],
              ['Room rent limit', 'None', 'None'],
              ['Hospital bill covered', '100%', '100%'],
              ['Guaranteed bonus', '200%', '—'],
              ['Pre / post hospitalisation', '60 / 180 days', '30 / 60 days'],
              ['Free wellness consults', 'Yes', '—'],
            ].map(([k, a, c]) => (
              <View key={k} style={[st.cmpRow, { borderBottomColor: colors.border }]}>
                <Text style={[st.cmpCell, lo, { flex: 1.6 }]}>{k}</Text>
                <Text style={[st.cmpCell, hi]}>{a}</Text>
                <Text style={[st.cmpCell, hi]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </AmbientBackground>
  );
}

const R = 12;
const st = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 14 },
  headTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  benefitChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  benefitChipText: { color: GREEN, fontSize: 11, fontFamily: 'Inter_700Bold' },
  wizard: { borderRadius: R + 2, borderWidth: 1, overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6 },
  genderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  body: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  small: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tiny: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 16 },
  h3: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 22, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  tile: { alignItems: 'center', gap: 8, padding: 7, paddingBottom: 10, borderRadius: R, borderWidth: 1.5, overflow: 'hidden' },
  tick: { position: 'absolute', zIndex: 2, top: -1, right: -1, width: 22, height: 22, borderBottomLeftRadius: 8, borderTopRightRadius: R, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', left: 22, right: 22, bottom: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 7, borderWidth: 1, padding: 3, zIndex: 2 },
  countBtn: { width: 24, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  countSign: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  countVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  tileText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: R, padding: 10, marginBottom: 10 },
  ageVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  ageOpt: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1 },
  pinBox: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: R, borderWidth: 1, paddingHorizontal: 14, marginTop: 16 },
  pinInput: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  err: { color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 8 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: R, padding: 12, marginTop: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  cta: { height: 50, borderRadius: R, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  benefitBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: R, borderWidth: 1, padding: 10, marginTop: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  memberBox: { borderRadius: R, borderWidth: 1, marginTop: 10 },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  memberLine: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  coverCard: { width: 170, borderRadius: R, borderWidth: 1.5, overflow: 'hidden' },
  coverHead: { alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  coverAmt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  coverLine: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 },
  planCard: { borderRadius: R + 2, padding: 14, marginBottom: 14, overflow: 'hidden' },
  onDark: { color: '#fff' },
  onDarkLo: { color: 'rgba(255,255,255,0.82)' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  planPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 2 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, marginTop: 12, marginBottom: 6 },
  tagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  perkText: { fontSize: 13, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  free: { backgroundColor: GREEN, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  freeText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  allBtn: { height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  allText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  outline: { height: 46, borderRadius: R, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  accordion: { borderRadius: R, borderWidth: 1, overflow: 'hidden' },
  accRow: { padding: 14 },
  call: { position: 'absolute', right: 16, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  payFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1 },
  gstStrip: { backgroundColor: 'rgba(34,197,94,0.14)', paddingHorizontal: 16, paddingVertical: 8 },
  gstText: { color: GREEN, fontSize: 12, fontFamily: 'Inter_700Bold' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12 },
  payPrice: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  cmpRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, marginTop: 4 },
  cmpCell: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
});
