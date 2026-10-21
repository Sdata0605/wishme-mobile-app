import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bike, Car, Check, ChevronDown, ChevronRight, ChevronUp, Info, ShieldCheck, X } from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useTheme } from '@/context/ThemeContext';
import {
  idvFor,
  lookupVehicle,
  ownDamageEstimate,
  thirdPartyPremium,
  type LookupResult,
  type Vehicle,
  type VehicleKind,
} from '@/services/insurance/vehicle';

const GREEN = '#22C55E';
const RED = '#EF4444';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
// Long-term own-damage discounts used for the 2 / 3 year estimates.
const YEAR_DISCOUNT: Record<number, number> = { 1: 0, 2: 0.05, 3: 0.08 };

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A minimal draggable slider (the project has no slider package). */
function IdvSlider({ min, max, value, onChange, color, track }: { min: number; max: number; value: number; onChange: (v: number) => void; color: string; track: string }) {
  const [w, setW] = useState(0);
  const ref = useRef({ w: 0, min, max, onChange });
  ref.current = { w, min, max, onChange };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => move(e.nativeEvent.locationX),
        onPanResponderMove: (e) => move(e.nativeEvent.locationX),
      }),
    [],
  );
  function move(x: number) {
    const { w: tw, min: lo, max: hi, onChange: cb } = ref.current;
    if (!tw) return;
    const p = Math.min(1, Math.max(0, x / tw));
    cb(Math.round((lo + p * (hi - lo)) / 100) * 100);
  }
  const p = max > min ? (value - min) / (max - min) : 1;
  return (
    <View style={st.sliderHit} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View pointerEvents="none" style={[st.sliderTrack, { backgroundColor: track }]} />
      <View pointerEvents="none" style={[st.sliderFill, { width: `${p * 100}%`, backgroundColor: color }]} />
      <View pointerEvents="none" style={[st.sliderKnob, { left: Math.max(0, p * w - 11), backgroundColor: color }]} />
    </View>
  );
}

export default function VehicleQuoteScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ plate?: string; kind?: VehicleKind }>();
  const plate = params.plate ?? '';

  const [res, setRes] = useState<LookupResult | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [idv, setIdv] = useState(0);
  const [years, setYears] = useState(1);
  const [plan, setPlan] = useState<'comp' | 'tp'>('comp');

  useEffect(() => {
    let alive = true;
    lookupVehicle(plate, params.kind).then((r) => {
      if (!alive) return;
      setRes(r);
      setVehicle(r.vehicle);
      setIdv(idvFor(r.vehicle));
    });
    return () => {
      alive = false;
    };
  }, [plate, params.kind]);

  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };

  if (!vehicle || !res) {
    return (
      <AmbientBackground>
        <View style={st.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[st.loadingText, lo]}>Fetching details for {plate || 'your new vehicle'}…</Text>
        </View>
      </AmbientBackground>
    );
  }

  const v = vehicle;
  const noun = v.kind === 'bike' ? 'bike' : 'car';
  const maxIdv = idvFor(v);
  const minIdv = Math.round((maxIdv * 0.75) / 100) * 100;
  const tp = thirdPartyPremium(v.kind, v.cc);
  const compFor = (y: number) => Math.round(ownDamageEstimate(v.kind, idv) * y * (1 - YEAR_DISCOUNT[y]) + tp * y);
  const comp = compFor(years);
  const saving = (y: number) => Math.round(ownDamageEstimate(v.kind, idv) * y * YEAR_DISCOUNT[y]);
  const expired = v.policyExpiry ? new Date(`${v.policyExpiry}T23:59:59`) < new Date() : false;
  const cardW = Math.min(width - 96, 270);
  const KindIcon = v.kind === 'bike' ? Bike : Car;

  const benefits = (which: 'comp' | 'tp') =>
    Alert.alert(
      which === 'comp' ? 'Comprehensive cover' : 'Third party cover',
      which === 'comp'
        ? 'Covers damage to your own vehicle (accident, fire, theft, natural calamities), damage or injury to third parties, and personal accident cover for the owner-driver.'
        : 'Covers damage or injury you cause to other people and their property. It is the minimum cover required by law, and does not pay for damage to your own vehicle.',
    );

  return (
    <AmbientBackground>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
          <View style={[st.top, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
              <X size={26} color={colors.foreground} />
            </TouchableOpacity>

            {res.source === 'demo' && (
              <View style={st.demo}>
                <Text style={st.demoTitle}>Demo vehicle details</Text>
                <Text style={st.demoBody}>
                  Live vehicle lookup isn't connected yet, so these details are samples. Tap "Edit {noun} details" to enter your own. Third-party prices are the real legal rates; comprehensive prices are estimates.
                </Text>
              </View>
            )}

            <View style={st.vehRow}>
              <View style={{ flex: 1 }}>
                <View style={st.makeRow}>
                  <View style={[st.makeBadge, { backgroundColor: colors.primary + '26' }]}>
                    <Text style={[st.makeBadgeText, { color: colors.primary }]}>{v.make.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={[st.model, hi]} numberOfLines={1}>{v.make} {v.model}</Text>
                </View>
                <View style={[st.plate, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={[st.plateInd, { backgroundColor: colors.primary }]}>
                    <View style={st.plateDot} />
                    <Text style={st.plateIndText}>IND</Text>
                  </View>
                  <Text style={[st.plateText, hi]}>{v.plate || 'NEW'}</Text>
                </View>
              </View>
              <View style={[st.vehArt, { backgroundColor: colors.primary + '1F', borderColor: colors.border }]}>
                <KindIcon size={38} color={colors.primary} />
              </View>
            </View>

            <View style={st.expRow}>
              <Text style={[st.expText, hi]}>
                {v.policyExpiry ? (
                  <>
                    {expired ? 'Expired on ' : 'Expires on '}
                    <Text style={{ color: expired ? RED : GREEN, fontFamily: 'Inter_700Bold' }}>{fmtDate(v.policyExpiry)}</Text>
                  </>
                ) : (
                  'New vehicle'
                )}
              </Text>
              <TouchableOpacity style={st.toggle} onPress={() => setShowDetails((s) => !s)}>
                <Text style={[st.toggleText, hi]}>{showDetails ? 'Hide details' : `View / Edit ${noun}`}</Text>
                <View style={[st.toggleIcon, { backgroundColor: colors.primary }]}>
                  {showDetails ? <ChevronUp size={16} color="#fff" /> : <ChevronDown size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            </View>

            {showDetails && (
              <View style={[st.details, { borderTopColor: colors.border }]}>
                <View style={st.grid}>
                  {[
                    ['Variant', v.variant],
                    ['Reg. year', String(v.regYear)],
                    ['Fuel type', v.fuel],
                    ['Usage', v.usage],
                    ['Engine', `${v.cc} cc`],
                    ['State', v.state || '—'],
                  ].map(([k, val]) => (
                    <View key={k} style={st.cell}>
                      <Text style={[st.cellK, lo]}>{k}</Text>
                      <Text style={[st.cellV, hi]}>{val}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[st.outline, { borderColor: colors.primary }]} onPress={() => setEditing(true)}>
                  <Text style={[st.outlineText, hi]}>Edit {noun} details</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[st.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[st.idvCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={st.idvHead}>
                <Text style={[st.idvTitle, hi]}>IDV: {inr(idv)}</Text>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert('Insured Declared Value', `The most your insurer pays if the ${noun} is stolen or totally damaged: roughly its current market value. A higher IDV means a slightly higher premium.`)
                  }
                >
                  <Info size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {idv === maxIdv && (
                  <View style={[st.best, { borderColor: colors.primary }]}>
                    <Text style={[st.bestText, hi]}>Best for you</Text>
                  </View>
                )}
              </View>
              <IdvSlider min={minIdv} max={maxIdv} value={idv} onChange={setIdv} color={colors.primary} track={colors.border} />
              <View style={st.idvRange}>
                <Text style={[st.rangeText, lo]}>{inr(minIdv)}</Text>
                <Text style={[st.rangeText, lo]}>{inr(maxIdv)}</Text>
              </View>
            </View>

            <Text style={[st.h2, hi]}>Plans for you</Text>
            <View style={st.years}>
              {[1, 2, 3].map((y) => (
                <View key={y} style={{ flex: 1, alignItems: 'center' }}>
                  {y > 1 && plan === 'comp' ? (
                    <View style={st.save}><Text style={st.saveText}>Save {inr(saving(y))}</Text></View>
                  ) : (
                    <View style={{ height: 22 }} />
                  )}
                  <TouchableOpacity
                    style={[st.year, { borderColor: years === y ? colors.primary : colors.border, backgroundColor: years === y ? colors.primary + '26' : 'transparent' }]}
                    onPress={() => setYears(y)}
                  >
                    <Text style={[st.yearText, years === y ? hi : lo]}>{y} year{y > 1 ? 's' : ''}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 14 }} snapToInterval={cardW + 12} decelerationRate="fast">
              {(['comp', 'tp'] as const).map((k) => {
                const on = plan === k;
                const lines: [string, boolean][] =
                  k === 'comp'
                    ? [[`Damages to your ${noun}`, true], ['Damages to third party', true], ['Avoid challans', true]]
                    : [[`Damages to your ${noun}`, false], ['Damages to third party', true], ['Avoid challans', true]];
                return (
                  <TouchableOpacity
                    key={k}
                    activeOpacity={0.9}
                    onPress={() => setPlan(k)}
                    style={[st.plan, { width: cardW, borderColor: on ? colors.primary : colors.border, backgroundColor: colors.card }]}
                  >
                    <View style={st.planTop}>
                      {k === 'comp' ? (
                        <View style={[st.tagPopular, { backgroundColor: colors.primary }]}><Text style={st.tagPopularText}>Popular choice</Text></View>
                      ) : (
                        <View style={[st.tagLaw, { backgroundColor: colors.input }]}><Text style={[st.tagLawText, hi]}>Mandatory by law</Text></View>
                      )}
                      <View style={[st.radio, { borderColor: on ? colors.primary : colors.border }]}>
                        {on && <View style={[st.radioDot, { backgroundColor: colors.primary }]} />}
                      </View>
                    </View>
                    <ShieldCheck size={46} color={(k === 'comp' ? '#F59E0B' : colors.primary) + '55'} style={st.planArt} />
                    <Text style={[st.planName, hi]}>{k === 'comp' ? 'Comprehensive cover' : 'Third party cover'}</Text>
                    <Text style={[st.price, hi]}>
                      {inr(k === 'comp' ? comp : tp * years)} <Text style={[st.gst, lo]}>+GST</Text>
                    </Text>
                    {k === 'comp' && <Text style={[st.estimate, lo]}>Estimate</Text>}
                    {lines.map(([t, ok]) => (
                      <View key={t} style={[st.line, { borderBottomColor: colors.border }]}>
                        {ok ? <Check size={14} color={GREEN} /> : <X size={14} color={RED} />}
                        <Text style={[st.lineText, hi]}>{t}</Text>
                      </View>
                    ))}
                    {k === 'comp' && (
                      <View style={[st.line, { borderBottomWidth: 0 }]}>
                        <Check size={14} color={colors.mutedForeground} />
                        <Text style={[st.lineText, lo]}>0% NCB applied</Text>
                      </View>
                    )}
                    <TouchableOpacity style={[st.benefits, { borderTopColor: colors.border }]} onPress={() => benefits(k)}>
                      <Text style={[st.benefitsText, hi]}>View benefits</Text>
                      <ChevronRight size={14} color={colors.foreground} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={[st.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Text style={[st.footNote, lo]}>
            {plan === 'comp' ? 'Comprehensive' : 'Third party'} · {years} year{years > 1 ? 's' : ''} ·{' '}
            <Text style={[st.footPrice, hi]}>{inr(plan === 'comp' ? comp : tp * years)}</Text> +GST
          </Text>
          <TouchableOpacity
            style={[st.cta, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Coming soon', 'Add-ons and buying a policy online are not available yet.')}
          >
            <Text style={st.ctaText}>Select add-ons</Text>
          </TouchableOpacity>
        </View>
      </View>

      <EditVehicle
        visible={editing}
        vehicle={v}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          setVehicle(next);
          setIdv(idvFor(next));
          setEditing(false);
        }}
      />
    </AmbientBackground>
  );
}

function EditVehicle({ visible, vehicle, onClose, onSave }: { visible: boolean; vehicle: Vehicle; onClose: () => void; onSave: (v: Vehicle) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState({ make: '', model: '', variant: '', regYear: '', cc: '', price: '', expiry: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible)
      setF({
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        regYear: String(vehicle.regYear),
        cc: String(vehicle.cc),
        price: String(vehicle.exShowroom),
        expiry: vehicle.policyExpiry ?? '',
      });
    setErr('');
  }, [visible, vehicle]);

  const save = () => {
    const year = Number(f.regYear);
    const cc = Number(f.cc);
    const price = Number(f.price);
    const now = new Date().getFullYear();
    if (!f.make.trim() || !f.model.trim()) return setErr('Enter the make and model');
    if (!Number.isInteger(year) || year < 1990 || year > now) return setErr(`Enter a registration year between 1990 and ${now}`);
    if (!cc || cc < 50 || cc > 8000) return setErr('Enter the engine size in cc');
    if (!price || price < 10000) return setErr('Enter the ex-showroom price');
    if (f.expiry && !/^\d{4}-\d{2}-\d{2}$/.test(f.expiry)) return setErr('Enter the expiry as YYYY-MM-DD, or leave it empty');
    onSave({ ...vehicle, make: f.make.trim(), model: f.model.trim(), variant: f.variant.trim(), regYear: year, cc, exShowroom: price, policyExpiry: f.expiry || null });
  };

  const fields: [keyof typeof f, string, 'default' | 'number-pad'][] = [
    ['make', 'Make (e.g. Honda)', 'default'],
    ['model', 'Model (e.g. Dio)', 'default'],
    ['variant', 'Variant', 'default'],
    ['regYear', 'Registration year', 'number-pad'],
    ['cc', 'Engine (cc)', 'number-pad'],
    ['price', 'Ex-showroom price (₹)', 'number-pad'],
    ['expiry', 'Policy expiry (YYYY-MM-DD)', 'default'],
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <SheetBackdrop onPress={onClose} />
        <View style={[st.editSheet, { backgroundColor: '#240c40', borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={st.editHead}>
            <Text style={[st.h2, { color: colors.foreground, marginTop: 0 }]}>Edit {vehicle.kind === 'bike' ? 'bike' : 'car'} details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {fields.map(([k, label, kb]) => (
              <View key={k} style={{ marginBottom: 10 }}>
                <Text style={[st.cellK, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput
                  style={[st.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                  value={f[k]}
                  onChangeText={(t) => setF((p) => ({ ...p, [k]: t }))}
                  keyboardType={kb}
                  autoCorrect={false}
                />
              </View>
            ))}
          </ScrollView>
          {!!err && <Text style={st.editErr}>{err}</Text>}
          <TouchableOpacity style={[st.cta, { backgroundColor: colors.primary, marginTop: 8 }]} onPress={save}>
            <Text style={st.ctaText}>Save details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const R = 12;
const st = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  top: { paddingHorizontal: 16, paddingBottom: 16 },
  demo: { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.55)', borderWidth: 1, borderRadius: R, padding: 10, marginTop: 14 },
  demoTitle: { color: '#F59E0B', fontSize: 12, fontFamily: 'Inter_700Bold' },
  demoBody: { color: '#FBBF24', fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 2 },
  vehRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  makeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  makeBadge: { width: 30, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  makeBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  model: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold' },
  plate: { alignSelf: 'flex-start', flexDirection: 'row', borderWidth: 1, borderRadius: 6, overflow: 'hidden', marginTop: 12 },
  plateInd: { width: 26, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2 },
  plateDot: { width: 5, height: 5, borderRadius: 1, backgroundColor: '#fff' },
  plateIndText: { color: '#fff', fontSize: 8, fontFamily: 'Inter_700Bold' },
  plateText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  vehArt: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  expRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  expText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  toggleIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  details: { borderTopWidth: 1, borderStyle: 'dashed', marginTop: 14, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 10 },
  cellK: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  cellV: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  outline: { height: 42, borderRadius: R, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 18, minHeight: 500 },
  idvCard: { borderRadius: R, borderWidth: 1, padding: 12 },
  idvHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idvTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  best: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  bestText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sliderHit: { height: 30, justifyContent: 'center', marginTop: 8 },
  sliderTrack: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3 },
  sliderFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3 },
  sliderKnob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#fff' },
  idvRange: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rangeText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  h2: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 18 },
  years: { flexDirection: 'row', gap: 10, marginTop: 8 },
  save: { backgroundColor: 'rgba(34,197,94,0.16)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4, height: 18 + 4 },
  saveText: { color: GREEN, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  year: { width: '100%', height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  yearText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  plan: { borderRadius: R, borderWidth: 1.5, overflow: 'hidden' },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12, paddingTop: 0, minHeight: 36 },
  tagPopular: { borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tagPopularText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  tagLaw: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 12, marginTop: 10 },
  tagLawText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planArt: { position: 'absolute', right: 12, top: 48 },
  planName: { fontSize: 14, fontFamily: 'Inter_700Bold', paddingHorizontal: 12, marginTop: 8 },
  price: { fontSize: 20, fontFamily: 'Inter_700Bold', paddingHorizontal: 12, marginTop: 4 },
  gst: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  estimate: { fontSize: 10, fontFamily: 'Inter_400Regular', paddingHorizontal: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1 },
  lineText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  benefits: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: 1, paddingVertical: 10, marginTop: 8 },
  benefitsText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  footNote: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular' },
  footPrice: { fontFamily: 'Inter_700Bold' },
  cta: { height: 48, borderRadius: R, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  editSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: 18 },
  editHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  editInput: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  editErr: { color: RED, fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 6 },
});
