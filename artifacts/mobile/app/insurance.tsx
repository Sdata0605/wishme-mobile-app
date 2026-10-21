import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Brain,
  Building2,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  ClipboardList,
  Clock,
  Crown,
  FlaskConical,
  Headphones,
  HeartPulse,
  MapPin,
  MessageCircle,
  Navigation,
  Percent,
  Salad,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Stethoscope,
  Truck,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useTheme } from '@/context/ThemeContext';
import { nearbyGarages, type Garage, type GarageResult } from '@/services/insurance/garages';

type Tab = 'vehicle' | 'health';

const GREEN = '#22C55E';
const PLATE_RE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;

const WHY: { Icon: LucideIcon; a: string; b: string }[] = [
  { Icon: Headphones, a: '24/7', b: 'Claims support' },
  { Icon: Truck, a: 'Roadside', b: 'assistance' },
  { Icon: Clock, a: 'Instant', b: 'Policy issuance' },
  { Icon: Percent, a: 'Zero', b: 'Hidden charges' },
];

const CLAIM_STEPS: { img: number; title: string; sub: string }[] = [
  { img: require('@/assets/images/claim-step-1.webp'), title: 'Start your claim', sub: 'Right in the app' },
  { img: require('@/assets/images/claim-step-2.webp'), title: 'Submit documents', sub: '100% digitally' },
  { img: require('@/assets/images/claim-step-3.webp'), title: 'Choose a garage', sub: 'Across the city' },
  { img: require('@/assets/images/claim-step-4.webp'), title: 'Get settled', sub: 'Track every step' },
];

// Card gradient and badge colours per plan (deep navy-indigo, like the reference; gold vs blue badge).
const PLANS = [
  { name: 'PREMIUM', Icon: Crown, badge: ['#FCD34D', '#D97706'], grad: ['#1E1B6E', '#0B1A5C', '#081245'], perks: [['No limit', ' on room rent', true], ['100%', ' hospital bill covered', true], ['200%', ' guaranteed bonus', true]] },
  { name: 'ESSENTIAL', Icon: Star, badge: ['#93C5FD', '#3B5BDB'], grad: ['#22217A', '#0E2266', '#0A1650'], perks: [['No limit', ' on room rent', true], ['100%', ' hospital bill covered', true], ['Zero', ' guaranteed bonus', false]] },
] as const;

const COMPARE: [string, string, string, string][] = [
  ['Zero', 'Co-pay', 'Fixed', 'Co-pay'],
  ['No', 'Commission', 'Higher', 'Commission'],
  ['Instant', 'Policy issuance', 'Days', 'Policy issuance'],
];

const CARES: { key: string; Icon: LucideIcon; img: number; l1: string; l2: string; points: string[]; free: string; market: string }[] = [
  { key: 'checkup', Icon: FlaskConical, img: require('@/assets/images/care-checkup.webp'), l1: 'Health', l2: 'check-up', points: ['At-home sample collection', 'Providers across many pin codes', 'Digital issuance of reports'], free: 'for first check-up', market: 'Paid for every check-up' },
  { key: 'doctor', Icon: Stethoscope, img: require('@/assets/images/care-doctor.webp'), l1: 'Talk to a', l2: 'doctor', points: ['Book instant consultation', 'Consult from the comfort of your home', 'Qualified doctors available'], free: 'for every consultation', market: 'Paid for every consultation' },
  { key: 'psych', Icon: Brain, img: require('@/assets/images/care-psychologist.webp'), l1: 'Talk to a', l2: 'psychologist', points: ['Instant consultation', 'Consult from the comfort of your home', 'Qualified practitioners available'], free: 'for every consultation', market: 'Paid for every consultation' },
  { key: 'nutri', Icon: Salad, img: require('@/assets/images/care-nutritionist.webp'), l1: 'Talk to a', l2: 'nutritionist', points: ['Instant consultation', 'Consult from the comfort of your home', 'Personalised diet chart'], free: 'for every consultation', market: 'Paid for every consultation' },
];

const FAQS: [string, string][] = [
  ['What does a vehicle policy cover?', 'A comprehensive policy covers damage to your own vehicle, third-party liability and personal accident cover for the owner-driver. Exact cover depends on the plan you pick.'],
  ['Will claims be handled directly?', 'Claims are started from the app and tracked step by step. Our team coordinates with the insurer and the garage on your behalf.'],
  ['What if I drive with an expired policy?', 'Driving without valid third-party insurance is an offence under the Motor Vehicles Act, and any damage in that period will not be covered. Renew before the policy expires.'],
  ['What is No Claim Bonus (NCB)?', 'A discount on your own-damage premium for every claim-free year, which carries over when you renew or switch insurers.'],
];

const openMaps = (url: string) => void Linking.openURL(url).catch(() => {});

/** Real repair shops around the user, from OpenStreetMap. Location is only asked for when the user taps the button. */
function GaragesNearYou() {
  const { colors } = useTheme();
  const [state, setState] = useState<GarageResult | { status: 'loading' } | null>(null);

  const load = useCallback(async (ask: boolean) => {
    setState({ status: 'loading' });
    setState(await nearbyGarages(ask));
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };
  const list = state?.status === 'ok' ? state.garages : [];
  const shown = list.slice(0, 3);
  return (
    <View style={{ marginTop: 30 }}>
      <View style={[st.rowBetween, { marginTop: 0 }]}>
        <Text style={[st.h2, hi, { marginTop: 0 }]}>Garages near you</Text>
        {state?.status === 'ok' && list.length > 0 && (
          <View style={[st.liveTag, { borderColor: colors.border }]}>
            <View style={st.liveDot} />
            <Text style={[st.liveText, lo]}>Live</Text>
          </View>
        )}
      </View>

      <View style={[st.gCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {!state || state.status === 'loading' ? (
          <View style={st.gState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[st.gStateText, lo]}>Finding garages near you…</Text>
          </View>
        ) : state.status === 'no-permission' ? (
          <View style={st.gState}>
            <View style={[st.gBadge, { backgroundColor: colors.primary + '26' }]}>
              <MapPin size={22} color={colors.primary} />
            </View>
            <Text style={[st.gStateText, lo]}>Allow location to see repair garages around you.</Text>
            <TouchableOpacity
              style={[st.gBtn, { backgroundColor: colors.primary }]}
              onPress={() => (state.canAsk ? void load(true) : void Linking.openSettings())}
            >
              <Text style={st.gBtnText}>{state.canAsk ? 'Use my location' : 'Open settings'}</Text>
            </TouchableOpacity>
          </View>
        ) : state.status === 'error' ? (
          <View style={st.gState}>
            <Text style={[st.gStateText, lo]}>Couldn't load nearby garages right now.</Text>
            <TouchableOpacity style={[st.gBtn, { backgroundColor: colors.primary }]} onPress={() => void load(false)}>
              <Text style={st.gBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : list.length === 0 ? (
          <View style={st.gState}>
            <Text style={[st.gStateText, lo]}>No garages listed within 15 km yet. Tap Search garages to look further.</Text>
          </View>
        ) : (
          shown.map((g: Garage, i) => (
            <TouchableOpacity
              key={g.id}
              style={[st.gRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => openMaps(`https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lon}`)}
            >
              <View style={[st.gBadge, { backgroundColor: colors.primary + '26' }]}>
                {g.kind === 'bike' ? <Bike size={18} color={colors.primary} /> : <Car size={18} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.gName, hi]} numberOfLines={1}>{g.name}</Text>
                <Text style={[st.gAddr, lo]} numberOfLines={1}>{g.address || (g.kind === 'bike' ? 'Bike repair' : 'Car repair')}</Text>
              </View>
              <View style={[st.gKm, { backgroundColor: colors.input }]}>
                <Navigation size={11} color={colors.primary} />
                <Text style={[st.gKmText, hi]}>{g.km < 1 ? `${Math.round(g.km * 1000)} m` : `${g.km.toFixed(1)} km`}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={[st.gFoot, { borderTopColor: colors.border, backgroundColor: colors.primary + '14' }]}>
          <TouchableOpacity style={st.gFootBtn} onPress={() => router.push('/garages' as Href)}>
            <Search size={16} color={colors.primary} />
            <Text style={[st.gFootText, { color: colors.primary }]}>Search garages</Text>
          </TouchableOpacity>
        </View>
      </View>
      {state?.status === 'ok' && list.length > 0 && (
        <Text style={[st.osm, lo]}>Garage data © OpenStreetMap contributors</Text>
      )}
    </View>
  );
}

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('vehicle');
  const [plate, setPlate] = useState('');
  const [plateErr, setPlateErr] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const card = { backgroundColor: colors.card, borderColor: colors.border };
  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };

  // Every health Check price / Get insured opens the plan finder; a care card opens it for that benefit.
  const quote = (benefit?: string) =>
    router.push({ pathname: '/health-plan', params: benefit ? { benefit } : {} } as Href);

  const checkPlate = () => {
    const v = plate.replace(/[\s-]/g, '').toUpperCase();
    if (v && !PLATE_RE.test(v)) return setPlateErr('Enter a valid vehicle number, like MH12AB1234');
    setPlateErr('');
    router.push({ pathname: '/vehicle-number', params: v ? { plate: v } : {} } as Href);
  };

  const planW = Math.min(width - 56, 340);
  // The illustration spans the hero card edge to edge, so it follows the card's real width on any screen.
  const [heroW, setHeroW] = useState(0);
  const imgW = heroW || width - 32;
  const careW = Math.floor((imgW - 12) / 2);

  return (
    <AmbientBackground>
      <View style={[st.root, { paddingTop: insets.top + 8 }]}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[st.brand, hi]}>WISHME <Text style={{ color: colors.primary }}>INSURANCE</Text></Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (tab === 'health' ? 96 : 40) }}>
          <View style={[st.tabs, card]}>
            {([['vehicle', 'Car / Bike'], ['health', 'Health']] as const).map(([k, label]) => (
              <TouchableOpacity key={k} style={[st.tab, tab === k && { backgroundColor: colors.primary }]} onPress={() => setTab(k)} activeOpacity={0.85}>
                {k === 'vehicle' ? <Car size={16} color={tab === k ? '#fff' : colors.foreground} /> : <HeartPulse size={16} color={tab === k ? '#fff' : colors.foreground} />}
                <Text style={[st.tabText, { color: tab === k ? '#fff' : colors.foreground }]}>{label}</Text>
                {k === 'health' && <View style={st.gst}><Text style={st.gstText}>0% GST</Text></View>}
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'vehicle' ? (
            <>
              <View style={st.heroCard} onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
                <Text style={st.heroTitle}>Get covered.</Text>
                <Text style={[st.heroTitle, { color: '#7C3AED' }]}>Drive worry-free.</Text>
                <Text style={st.heroSub}>Get your policy in</Text>
                <View style={st.heroPill}>
                  <Zap size={14} color="#7C3AED" fill="#7C3AED" />
                  <Text style={st.heroPillText}>minutes!</Text>
                </View>
                <Text style={st.heroFine}>Reliable policies. Hassle-free process.</Text>
                <View style={[st.heroImg, { width: imgW, height: imgW / 2 }]}>
                  <Image
                    source={require('@/assets/images/insurance-vehicle.webp')}
                    style={{ width: imgW, height: imgW / 2 }}
                    resizeMode="cover"
                    accessibilityLabel="Car and bike protected by insurance"
                  />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.heroTint]} />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['#DDD3F7', 'rgba(221,211,247,0)']}
                    style={st.heroFade}
                  />
                </View>
                <View style={st.plateBox}>
                  <View style={st.plateRow}>
                    <View style={[st.plateWrap, { backgroundColor: '#F1EEFA', borderColor: plateErr ? '#EF4444' : '#E3DDF5' }]}>
                      <View style={[st.ind, { backgroundColor: '#7C3AED' }]}><Text style={st.indText}>IND</Text></View>
                      <TextInput
                        style={[st.plateInput, { color: '#1A0A2E' }]}
                        value={plate}
                        onChangeText={(t) => { setPlate(t.toUpperCase()); setPlateErr(''); }}
                        placeholder="Eg. MH99AB1234"
                        placeholderTextColor="#9A93B5"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={12}
                      />
                    </View>
                    <TouchableOpacity style={[st.go, { backgroundColor: '#2A0A4A' }]} onPress={checkPlate} accessibilityLabel="Check price">
                      <ArrowRight size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {!!plateErr && <Text style={st.err}>{plateErr}</Text>}
                </View>
              </View>

              <Text style={[st.h2, hi]}>Why choose us?</Text>
              <View style={st.grid}>
                {WHY.map(({ Icon, a, b }) => (
                  <View key={a} style={[st.whyCard, card]}>
                    <Icon size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.whySmA, hi]}>{a}</Text>
                      <Text style={[st.whySmB, lo]}>{b}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={[st.h2, hi]}>Understand claims</Text>
              <Text style={[st.p, lo, { marginTop: 2 }]}>With 4 easy steps</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 14 }}>
                {CLAIM_STEPS.map(({ img, title, sub }, i) => (
                  <View key={title} style={[st.stepCard, card]}>
                    <View style={st.stepArt}>
                      <Image source={img} style={st.stepImg} resizeMode="cover" accessibilityLabel={title} />
                      <View style={[st.stepNoBox, { backgroundColor: colors.primary }]}>
                        <Text style={st.stepNo}>{i + 1}</Text>
                      </View>
                    </View>
                    <Text style={[st.stepTitle, hi]}>{title}</Text>
                    <Text style={[st.stepSub, lo]}>{sub}</Text>
                  </View>
                ))}
              </ScrollView>

              <GaragesNearYou />
            </>
          ) : (
            <>
              <View style={[st.heroCard, st.healthCard]} onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Text style={[st.heroTitle, { color: '#7C3AED' }]}>Health insurance</Text>
                  <Text style={st.heroTitle}>for you & your loved ones</Text>
                  <View style={st.heroPill}>
                    <Percent size={14} color="#7C3AED" />
                    <Text style={st.heroPillText}>0% GST</Text>
                  </View>
                  <Text style={st.heroFine}>Cashless treatment. Cover for the whole family.</Text>
                  <TouchableOpacity style={st.healthBtn} onPress={() => quote()} activeOpacity={0.85}>
                    <Text style={st.healthBtnText}>Check price</Text>
                    <ChevronsRight size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Image
                  source={require('@/assets/images/insurance-health.webp')}
                  style={{ width: Math.round(imgW * 0.42), height: Math.round(imgW * 0.42), borderRadius: Math.round(imgW * 0.21) }}
                  resizeMode="cover"
                  accessibilityLabel="A family protected by health insurance"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 20 }}>
                {[['No GST on premiums', Percent], ['Cashless at network hospitals', Building2], ['Instant policy issuance', Clock]].map(([t, I]) => {
                  const Icon = I as LucideIcon;
                  return (
                    <View key={t as string} style={[st.chip, card]}>
                      <Icon size={22} color={colors.primary} />
                      <Text style={[st.chipText, hi]}>{t as string}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={st.rowBetween}>
                <Text style={[st.h2, hi, { marginTop: 0 }]}>Health plans</Text>
                <TouchableOpacity onPress={() => quote()}><Text style={[st.underline, { color: colors.primary }]}>Compare plans</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 14 }}>
                {PLANS.map((p) => (
                  <LinearGradient
                    key={p.name}
                    colors={p.grad as unknown as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[st.plan, { width: planW }]}
                  >
                    <View style={st.planHead}>
                      <LinearGradient colors={p.badge as unknown as [string, string]} style={st.planIcon}>
                        <p.Icon size={20} color="#fff" fill="#fff" />
                      </LinearGradient>
                      <Text style={st.planName}>{p.name}</Text>
                    </View>
                    {p.perks.map(([b, rest, ok]) => (
                      <View key={b + rest} style={st.perk}>
                        {ok ? <Check size={18} color={GREEN} strokeWidth={3} /> : <X size={18} color="#EF4444" strokeWidth={3} />}
                        <Text style={st.perkText}><Text style={st.perkBold}>{b}</Text>{rest}</Text>
                      </View>
                    ))}
                    <View style={st.planBtns}>
                      <TouchableOpacity style={[st.planBtn, { backgroundColor: 'rgba(255,255,255,0.14)' }]} onPress={() => quote()}>
                        <Text style={[st.planBtnText, { color: '#fff' }]}>View benefits</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[st.planBtn, { backgroundColor: '#fff' }]} onPress={() => quote()}>
                        <Text style={[st.planBtnText, { color: '#0B1A5C' }]}>Check price</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                ))}
              </ScrollView>

              <Text style={[st.h2, hi]}>More benefits, less price</Text>
              <View style={[st.table, card]}>
                <View style={st.tHead}>
                  <View style={[st.tCell, { borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.primary + '22' }]}>
                    <Text style={[st.tBrand, { color: colors.primary }]}>WishMe</Text>
                  </View>
                  <View style={[st.tCell, { borderBottomWidth: 1, borderColor: colors.border }]}>
                    <Text style={[st.tBrand, hi]}>Others</Text>
                  </View>
                </View>
                {COMPARE.map(([a1, a2, b1, b2]) => (
                  <View key={a1} style={st.tRow}>
                    <View style={st.tCell}>
                      <Text style={[st.tBig, { color: colors.primary }]}>{a1}</Text>
                      <Text style={[st.whyB, lo]}>{a2}</Text>
                    </View>
                    <View style={st.tCell}>
                      <Text style={[st.tBig, hi]}>{b1}</Text>
                      <Text style={[st.whyB, lo]}>{b2}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={st.rowBetween}>
                <Text style={[st.h2, hi]}>Hospitals near you</Text>
                <View style={st.cashless}><Text style={st.gstText}>Cashless</Text></View>
              </View>
              <TouchableOpacity style={[st.linkCard, card]} activeOpacity={0.85} onPress={() => router.push('/support' as Href)}>
                <Building2 size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.whyA, hi]}>Search network hospitals</Text>
                  <Text style={[st.whyB, lo]}>Find cashless hospitals in your city</Text>
                </View>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <Text style={[st.h2, hi]}>We care for you</Text>
              <Text style={[st.p, lo, { marginTop: 2 }]}>Get free additional health benefits</Text>
              <View style={[st.grid, { marginTop: 14 }]}>
                {CARES.map((c) => (
                  <TouchableOpacity key={c.key} style={[st.careCard, card]} activeOpacity={0.85} onPress={() => quote(c.key)}>
                    <Image source={c.img} style={{ width: careW, height: Math.round(careW * 0.62) }} resizeMode="cover" accessibilityLabel={`${c.l1} ${c.l2}`} />
                    <View style={st.careBody}>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.careL, hi]}>{c.l1}</Text>
                        <Text style={[st.careL, { color: colors.primary }]}>{c.l2}</Text>
                      </View>
                      <View style={[st.careGo, { backgroundColor: colors.primary }]}><ChevronRight size={16} color="#fff" /></View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={[st.h2, hi]}>Frequently asked questions</Text>
          {FAQS.map(([q, a], i) => (
            <TouchableOpacity key={q} style={[st.faq, { borderColor: colors.border }]} activeOpacity={0.8} onPress={() => setOpen(open === i ? null : i)}>
              <View style={st.rowBetween}>
                <Text style={[st.faqQ, hi, { flex: 1 }]}>{q}</Text>
                <ChevronDown size={20} color={colors.foreground} style={{ transform: [{ rotate: open === i ? '180deg' : '0deg' }] }} />
              </View>
              {open === i && <Text style={[st.faqA, lo]}>{a}</Text>}
            </TouchableOpacity>
          ))}

          <View style={[st.cover, card]}>
            <ShieldCheck size={44} color={colors.primary} />
            <Text style={[st.coverText, hi]}>{tab === 'vehicle' ? 'Keep your ride protected' : 'Cover your family members health'}</Text>
            <TouchableOpacity style={[st.coverBtn, { borderColor: colors.primary }]} onPress={() => setTab(tab === 'vehicle' ? 'health' : 'vehicle')}>
              <Text style={[st.coverBtnText, hi]}>{tab === 'vehicle' ? 'Explore health insurance' : 'Explore car / bike insurance'}</Text>
              <ChevronRight size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {tab === 'health' && (
          <View style={[st.sticky, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[st.cta, { backgroundColor: colors.primary, marginTop: 0 }]} onPress={() => quote()} activeOpacity={0.85}>
              <Text style={st.ctaText}>Check price</Text>
              <ChevronsRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[st.help, { backgroundColor: colors.primary, bottom: insets.bottom + (tab === 'health' ? 90 : 24) }]}
          onPress={() => router.push('/support' as Href)}
          activeOpacity={0.85}
        >
          <MessageCircle size={20} color="#fff" />
          <Text style={st.helpText}>Get help</Text>
        </TouchableOpacity>
      </View>

    </AmbientBackground>
  );
}

const R = 12;
const st = StyleSheet.create({
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  liveText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  gCard: { borderRadius: R + 2, borderWidth: 1, overflow: 'hidden', marginTop: 14 },
  gState: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 20 },
  gStateText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  gBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  gBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  gRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  gBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  gAddr: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  gKm: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  gKmText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  gFoot: { flexDirection: 'row', borderTopWidth: 1 },
  gFootBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  gFootText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  osm: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'right' },
  root: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: R + 4, borderWidth: 1 },
  tab: { flex: 1, height: 36, borderRadius: R - 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  gst: { backgroundColor: GREEN, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  gstText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  h1: { fontSize: 24, lineHeight: 32, fontFamily: 'Inter_700Bold' },
  p: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 },
  heroArt: { width: 104, height: 104, borderRadius: R + 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: '#DDD3F7', borderRadius: 18, paddingTop: 16, paddingHorizontal: 16, marginTop: 20, overflow: 'hidden' },
  heroTitle: { color: '#1A0A2E', fontSize: 20, lineHeight: 25, fontFamily: 'Inter_700Bold' },
  heroSub: { color: '#3E3660', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 10 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E2D8FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 },
  heroPillText: { color: '#7C3AED', fontSize: 15, fontFamily: 'Inter_700Bold' },
  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12 },
  healthBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2A0A4A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 12 },
  healthBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  heroFine: { color: '#3E3660', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 8 },
  heroImg: { marginHorizontal: -16, marginTop: 6, overflow: 'hidden' },
  heroFade: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },
  heroTint: { backgroundColor: 'rgba(45,12,100,0.28)' },
  plateBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 8, marginHorizontal: -6, marginBottom: 12, marginTop: -26 },
  plateRow: { flexDirection: 'row', gap: 10 },
  plateWrap: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: R, borderWidth: 1, overflow: 'hidden' },
  ind: { width: 42, height: '100%', alignItems: 'center', justifyContent: 'center' },
  indText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  plateInput: { flex: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  go: { width: 44, height: 44, borderRadius: R, alignItems: 'center', justifyContent: 'center' },
  err: { color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 6 },
  h2: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  whyCard: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: R, borderWidth: 1 },
  whySmA: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  whySmB: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  whyA: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  whyB: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  stepCard: { width: 190, padding: 12, borderRadius: R, borderWidth: 1 },
  stepArt: { width: 166, height: 111, borderRadius: R - 2, overflow: 'hidden', marginBottom: 12 },
  stepImg: { width: 166, height: 111 },
  stepNoBox: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stepNo: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  stepTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stepSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: R, borderWidth: 1, marginTop: 14 },
  cta: { height: 56, borderRadius: R, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  ctaText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56, borderRadius: R, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30 },
  underline: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  plan: { borderRadius: R + 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 18, overflow: 'hidden' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  planIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  planName: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  perkText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  perkBold: { color: '#fff', fontFamily: 'Inter_700Bold' },
  planBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  planBtn: { flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  table: { borderRadius: R, borderWidth: 1, overflow: 'hidden', marginTop: 14 },
  tHead: { flexDirection: 'row' },
  tRow: { flexDirection: 'row' },
  tCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  tBrand: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  tBig: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  cashless: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 30 },
  careCard: { width: '48%', flexGrow: 1, borderRadius: R, borderWidth: 1, overflow: 'hidden' },
  careBody: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  careL: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  careGo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  faq: { paddingVertical: 18, borderBottomWidth: 1 },
  faqQ: { fontSize: 15, fontFamily: 'Inter_600SemiBold', paddingRight: 12, marginTop: 0 },
  faqA: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10 },
  cover: { alignItems: 'center', gap: 14, padding: 24, borderRadius: R + 4, borderWidth: 1, marginTop: 30 },
  coverText: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  coverBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: R, paddingHorizontal: 20, height: 50 },
  coverBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(15,5,30,0.96)' },
  help: { position: 'absolute', right: 16, height: 48, borderRadius: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 },
  helpText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: 20 },
  sheetTop: { paddingTop: 4 },
  freeTag: { position: 'absolute', right: -20, top: -20, backgroundColor: GREEN, borderBottomLeftRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  sheetPt: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  sheetArt: { height: 150, borderRadius: R, marginTop: 16 },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 22 },
  sBtn: { flex: 1, height: 52, borderRadius: R, alignItems: 'center', justifyContent: 'center' },
});
