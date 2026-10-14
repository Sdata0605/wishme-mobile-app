import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { FieldRenderer } from './FormFields';
import {
  displayValue,
  isEmptyValue,
  missingRequired,
  visibleFields,
  type CelebrityLite,
  type FormConfig,
  type SectionDef,
  type Values,
} from './types';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

interface Props {
  config: FormConfig;
  title: string;
  subtitle: string;
  headerIcon: IconName;
  pills: string[];
  /** Price after discount for the current answers, or null if it depends on something not chosen yet. */
  getPrice: (values: Values) => number | null;
  walletBalance: number;
  onSubmit: (values: Values) => Promise<{ id: string }>;
  onPaid: () => void;
  celebrityPrice?: (c: CelebrityLite) => number | null;
  /** Content of the "My orders" tab. */
  historySlot: (refreshKey: number, goToNew: () => void) => React.ReactNode;
  token: string | null;
  authUid: string;
  successTitle?: string;
  /** Names the order in the confirmation dialog, e.g. "UGC video for Ananya". */
  itemLabel: (values: Values) => string;
  initialValues?: Values;
}

// The keyboard-aware scroller is native only; web uses a plain ScrollView.
const Scroller: any = Platform.OS === 'web' ? ScrollView : KeyboardAwareScrollView;

type Tab = 'new' | 'orders';

const TIMELINE = ['Received', 'In production', 'Delivered'];

export function UgcOrderShell({
  config, title, subtitle, headerIcon, pills, getPrice, walletBalance, onSubmit, onPaid,
  celebrityPrice, historySlot, token, authUid, successTitle = 'Order placed', itemLabel, initialValues,
}: Props) {
  const { confirmOrder } = useOrderConfirm();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;

  const [tab, setTab] = useState<Tab>('new');
  const [values, setValues] = useState<Values>({ ...config.defaults, ...initialValues });
  const [open, setOpen] = useState<Record<string, boolean>>({ [config.sections[0].key]: true });
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ id: string } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const draftKey = `ugc-draft:${config.id}:${authUid}`;
  const loadedDraft = useRef(false);

  // Restore an unfinished order, and keep saving while the user types.
  useEffect(() => {
    if (!authUid) return;
    AsyncStorage.getItem(draftKey).then(raw => {
      loadedDraft.current = true;
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Values;
        setValues(prev => ({ ...prev, ...saved }));
        setDraftRestored(true);
      } catch {
        // ignore a corrupt draft
      }
    });
  }, [draftKey, authUid]);

  useEffect(() => {
    if (!loadedDraft.current || placed) return;
    const t = setTimeout(() => { AsyncStorage.setItem(draftKey, JSON.stringify(values)).catch(() => {}); }, 500);
    return () => clearTimeout(t);
  }, [values, draftKey, placed]);

  const set = useCallback((key: string, v: any) => {
    setValues(prev => ({ ...prev, [key]: v }));
    setFlagged(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const price = getPrice(values);
  const missing = missingRequired(config, values);
  const shortBy = price != null ? Math.max(0, price - walletBalance) : 0;

  const clearDraft = () => {
    AsyncStorage.removeItem(draftKey).catch(() => {});
    setValues({ ...config.defaults, ...initialValues });
    setDraftRestored(false);
    setFlagged(new Set());
  };

  const toggleSection = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const goToSection = (key: string) => {
    setOpen(prev => ({ ...prev, [key]: true }));
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 12), animated: true }), 60);
  };

  const sectionSummary = (section: SectionDef): { text: string; complete: boolean; left: number } => {
    const fields = visibleFields(section, values);
    const left = missing.filter(m => m.section.key === section.key).length;
    const answers = fields
      .filter(f => f.type !== 'toggle' && f.type !== 'images' && !isEmptyValue(values[f.key]))
      .map(f => displayValue(f, values[f.key]))
      .filter(Boolean);
    const hasRequired = fields.some(f => f.required);
    return { text: answers.slice(0, 3).join(' · '), complete: hasRequired && left === 0, left };
  };

  const tryReview = () => {
    if (missing.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFlagged(new Set(missing.map(m => m.field.key)));
      setOpen(prev => {
        const next = { ...prev };
        for (const m of missing) next[m.section.key] = true;
        return next;
      });
      goToSection(missing[0].section.key);
      return;
    }
    if (shortBy > 0) {
      router.push('/wallet' as never);
      return;
    }
    setReviewing(true);
  };

  const pay = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const label = itemLabel(values);
      const res = await onSubmit(values);
      AsyncStorage.removeItem(draftKey).catch(() => {});
      setReviewing(false);
      setPlaced(res);
      onPaid();
      confirmOrder({
        item: label,
        orderId: res.id,
        onView: () => { setRefreshKey(k => k + 1); setTab('orders'); },
      });
    } catch (e) {
      console.warn(`[ugc:${config.id}] order failed`, e);
      Alert.alert('Could not place order', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setValues({ ...config.defaults, ...initialValues });
    setOpen({ [config.sections[0].key]: true });
    setFlagged(new Set());
    setDraftRestored(false);
    setPlaced(null);
  };

  const GradientButton = ({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.9} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient colors={config.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.gradBtnText}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );

  const barLabel = missing.length === 0 && shortBy > 0 ? `Add ₹${shortBy.toLocaleString('en-IN')} & Pay` : 'Review & Pay';

  return (
    <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
      <Scroller
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tab === 'new' && !placed ? insets.bottom + 120 : insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={config.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: topPad + 10 }]}>
          <View style={[s.deco, { width: 150, height: 150, top: -40, right: -40, opacity: isDark ? 0.08 : 0.12 }]} />
          <View style={[s.deco, { width: 80, height: 80, bottom: -20, left: -16, opacity: isDark ? 0.08 : 0.12 }]} />
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel="Back">
            <Icon name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.heroRow}>
            <View style={s.heroIcon}><Icon name={headerIcon} size={26} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{title}</Text>
              <Text style={s.heroSub}>{subtitle}</Text>
            </View>
          </View>
          <View style={s.pills}>
            {pills.map(p => (
              <View key={p} style={s.pill}><Text style={s.pillText}>{p}</Text></View>
            ))}
          </View>
        </LinearGradient>

        <View style={[s.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['new', 'orders'] as Tab[]).map(t => {
            const on = tab === t;
            return (
              <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85} style={[s.segBtn, on && { backgroundColor: config.accent }]}>
                <Text style={[s.segText, { color: on ? '#fff' : colors.mutedForeground }]}>{t === 'new' ? 'New order' : 'My orders'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'orders' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>{historySlot(refreshKey, () => setTab('new'))}</View>
        ) : placed ? (
          <View style={s.success}>
            <LinearGradient colors={config.gradient} style={s.successIcon}><Icon name="check" size={40} color="#fff" /></LinearGradient>
            <Text style={[s.successTitle, { color: colors.foreground }]}>{successTitle}</Text>
            <Text style={[s.successSub, { color: colors.mutedForeground }]}>Order #{placed.id.slice(0, 8).toUpperCase()}</Text>
            <View style={s.timeline}>
              {TIMELINE.map((step, i) => (
                <View key={step} style={s.timeStep}>
                  <View style={[s.timeDot, { backgroundColor: i === 0 ? '#22C55E' : colors.border }]}>
                    {i === 0 && <Icon name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[s.timeLabel, { color: i === 0 ? colors.foreground : colors.mutedForeground }]}>{step}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.successSub, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Our team will make your video. You will find it under My orders, and you can save it to your Library.
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              <GradientButton label="View my orders" onPress={() => { setRefreshKey(k => k + 1); setTab('orders'); }} />
              <TouchableOpacity onPress={startAnother} style={[s.ghostBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Place another order</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 12 }}>
            {draftRestored && (
              <View style={[s.banner, { backgroundColor: config.accent + '1A', borderColor: config.accent + '55' }]}>
                <Icon name="info" size={15} color={config.accent} />
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>We restored your unfinished order.</Text>
                <TouchableOpacity onPress={clearDraft}><Text style={{ color: config.accent, fontFamily: 'Inter_700Bold', fontSize: 12 }}>Start over</Text></TouchableOpacity>
              </View>
            )}

            {config.sections.map((section, idx) => {
              const isOpen = !!open[section.key];
              const sum = sectionSummary(section);
              return (
                <View
                  key={section.key}
                  onLayout={e => { sectionY.current[section.key] = e.nativeEvent.layout.y + 280; }}
                  style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <TouchableOpacity onPress={() => toggleSection(section.key)} activeOpacity={0.8} style={s.cardHead}>
                    <View style={[s.num, { backgroundColor: sum.complete ? '#22C55E' : config.accent + '1F' }]}>
                      {sum.complete
                        ? <Icon name="check" size={14} color="#fff" />
                        : <Text style={{ color: config.accent, fontFamily: 'Inter_700Bold', fontSize: 12 }}>{idx + 1}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]}>{section.title}</Text>
                      {!isOpen && (
                        <Text style={{ color: sum.left > 0 ? '#EF4444' : colors.mutedForeground, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {sum.left > 0 ? `${sum.left} required left` : sum.text || 'Optional'}
                        </Text>
                      )}
                    </View>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.cardBody}>
                      {visibleFields(section, values).map(field => (
                        <FieldRenderer
                          key={field.key}
                          field={field}
                          value={values[field.key]}
                          onChange={v => set(field.key, v)}
                          accent={config.accent}
                          invalid={flagged.has(field.key)}
                          token={token}
                          authUid={authUid}
                          celebrityPrice={celebrityPrice}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Scroller>

      {tab === 'new' && !placed && (
        <View style={[s.bar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          {missing.length > 0 && (
            <Text style={[s.barHint, { color: colors.mutedForeground }]}>{missing.length} required {missing.length === 1 ? 'field' : 'fields'} left</Text>
          )}
          <View style={s.barRow}>
            <View>
              <Text style={[s.barPrice, { color: colors.foreground }]}>{price != null ? `₹${price.toLocaleString('en-IN')}` : '—'}</Text>
              <Text style={[s.barWallet, { color: shortBy > 0 && missing.length === 0 ? '#EF4444' : colors.mutedForeground }]}>
                Wallet ₹{walletBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <GradientButton label={barLabel} onPress={tryReview} />
            </View>
          </View>
        </View>
      )}

      <Modal visible={reviewing} transparent animationType="slide" onRequestClose={() => !submitting && setReviewing(false)}>
        <View style={s.sheetBackdrop}>
          <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 14 }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>Review your order</Text>
              <TouchableOpacity onPress={() => !submitting && setReviewing(false)} hitSlop={12}>
                <Icon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12, gap: 12 }}>
              {config.sections.map(section => {
                const rows = visibleFields(section, values).filter(f => {
                  const v = values[f.key];
                  return f.type === 'toggle' ? true : !isEmptyValue(v);
                });
                if (rows.length === 0) return null;
                return (
                  <View key={section.key} style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.reviewHead}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]}>{section.title}</Text>
                      <TouchableOpacity onPress={() => { setReviewing(false); goToSection(section.key); }} hitSlop={8}>
                        <Text style={{ color: config.accent, fontFamily: 'Inter_700Bold', fontSize: 12 }}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    {rows.map(f => (
                      <View key={f.key} style={s.reviewRow}>
                        <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                        <Text style={[s.reviewValue, { color: colors.foreground }]} numberOfLines={4}>{displayValue(f, values[f.key])}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
              <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.reviewRow}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>Total</Text>
                  <Text style={{ color: config.accent, fontFamily: 'Inter_700Bold', fontSize: 16 }}>₹{(price ?? 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.reviewRow}>
                  <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>Wallet after payment</Text>
                  <Text style={[s.reviewValue, { color: colors.foreground }]}>₹{Math.max(0, walletBalance - (price ?? 0)).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </ScrollView>
            <GradientButton label={`Pay ₹${(price ?? 0).toLocaleString('en-IN')} from wallet`} onPress={pay} disabled={submitting} busy={submitting} />
          </View>
        </View>
      </Modal>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  segment: { flexDirection: 'row', margin: 16, padding: 4, borderRadius: 14, borderWidth: 1 },
  segBtn: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 18 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8 },
  barHint: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center' },
  barPrice: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  barWallet: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  gradBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  gradBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  ghostBtn: { height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  success: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, gap: 10 },
  successIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  successSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  timeline: { flexDirection: 'row', gap: 18, marginVertical: 8 },
  timeStep: { alignItems: 'center', gap: 6 },
  timeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timeLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  reviewLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0, maxWidth: '45%' },
  reviewValue: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1, textAlign: 'right' },
});
