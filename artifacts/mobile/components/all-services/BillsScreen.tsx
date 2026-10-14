import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Headphones,
  Landmark,
  Percent,
  ShieldCheck,
  Smartphone,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import {
  servicesForGroup,
  type BillGroup,
  type BillKind,
} from './billData';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';

const HUB: Record<
  BillGroup,
  {
    title: string;
    sub: string;
    heroTitle: string;
    heroHighlight: string;
    heroSub: string;
    cta: string;
    ctaKind: BillKind;
    Icon: LucideIcon;
    accent: string;
    accentBg: string;
  }
> = {
  bills: {
    title: 'Bills',
    sub: 'Electricity · Water · Gas',
    heroTitle: 'Pay Utility',
    heroHighlight: 'Bills',
    heroSub: 'Clear electricity, water and gas bills instantly with cashback offers.',
    cta: 'Pay Electricity  ›',
    ctaKind: 'electricity',
    Icon: FileText,
    accent: C.orange,
    accentBg: '#F5F0FF',
  },
  recharge: {
    title: 'Recharge',
    sub: 'Mobile · DTH · FASTag',
    heroTitle: 'Instant',
    heroHighlight: 'Recharge',
    heroSub: 'Prepaid mobile, DTH and FASTag top-ups in a few taps — with live plans.',
    cta: 'Mobile Recharge  ›',
    ctaKind: 'mobile',
    Icon: Smartphone,
    accent: C.purple,
    accentBg: '#F5F3FF',
  },
  finance: {
    title: 'Financial Services',
    sub: 'Cards · EMI · Insurance',
    heroTitle: 'Cards, EMI &',
    heroHighlight: 'Premiums',
    heroSub: 'Pay credit card dues, loan EMIs and insurance premiums on time.',
    cta: 'Credit Card Bill  ›',
    ctaKind: 'creditCard',
    Icon: Landmark,
    accent: C.navy,
    accentBg: '#EFF6FF',
  },
};

export function ServiceCategoryScreen({
  group,
  onBack,
  onOpenBill,
}: {
  group: BillGroup;
  onBack: () => void;
  onOpenBill: (kind: BillKind) => void;
}) {
  const st = use_st(); const hero = use_hero(); const sec = use_sec(); const ofr = use_ofr(); const ts = use_ts();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const hub = HUB[group];
  const items = servicesForGroup(group);

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>{hub.title}</Text>
          <Text style={st.headerSub}>{hub.sub}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[st.headerIcon, { backgroundColor: T(hub.accentBg, 'bg') }]}>
          <hub.Icon size={18} color={T(hub.accent, 'fg')} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={st.content}>
        <View style={hero.wrap}>
          <View style={hero.left}>
            <Text style={hero.title}>
              {hub.heroTitle}
              {'\n'}
              <Text style={{ color: T(C.orange, 'fg') }}>{hub.heroHighlight}</Text>
            </Text>
            <Text style={hero.sub}>{hub.heroSub}</Text>
            <TouchableOpacity style={hero.btn} onPress={() => onOpenBill(hub.ctaKind)}><BrandFill />
              <Text style={hero.btnText}>{hub.cta}</Text>
            </TouchableOpacity>
          </View>
          <View style={hero.right}>
            <View style={[hero.mini, { backgroundColor: T(hub.accent, 'bg') }]}>
              <hub.Icon size={22} color={T(C.white, 'fg')} />
              <Text style={hero.miniLabel}>{hub.title.split(' ')[0]}</Text>
            </View>
            <View style={hero.miniPurple}><BrandFill />
              <Percent size={18} color={T(C.white, 'fg')} />
              <Text style={hero.miniLabel}>Offers</Text>
            </View>
          </View>
        </View>

        <View style={sec.section}>
          <Text style={sec.title}>Choose a service</Text>
          <Text style={sec.sub}>Only options from this category</Text>
          {items.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={sec.card}
              activeOpacity={0.8}
              onPress={() => onOpenBill(s.key)}
            >
              <View style={[sec.iconBox, { backgroundColor: T(s.bg, 'bg') }]}>
                <s.Icon size={24} color={T(s.color, 'fg')} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={sec.titleRow}>
                  <Text style={sec.cardTitle}>{s.title}</Text>
                  {s.badge && (
                    <View style={sec.badge}>
                      <Text style={sec.badgeText}>{s.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={sec.cardDesc}>{s.desc}</Text>
              </View>
              <ChevronRight size={18} color={T(C.gray, 'fg')} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={ofr.container}><BrandFill />
          <View style={ofr.iconBox}>
            <Tag size={22} color={T('#FCD34D', 'fg')} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ofr.headline}>Flat ₹75 cashback</Text>
            <Text style={ofr.sub}>on your first payment in this category</Text>
            <View style={ofr.code}>
              <Text style={ofr.codeText}>Use Code: WISH75</Text>
            </View>
          </View>
          <TouchableOpacity style={ofr.btn} onPress={() => onOpenBill(hub.ctaKind)}><BrandFill />
            <Text style={ofr.btnText}>Claim</Text>
          </TouchableOpacity>
        </View>

        <View style={ts.container}>
          {(
            [
              { Icon: ShieldCheck, color: T(C.green, 'fg'), title: 'Secure', sub: 'Safe payments' },
              { Icon: Zap, color: T('#FBBF24', 'fg'), title: 'Instant', sub: 'Quick confirm' },
              { Icon: Headphones, color: T('#60A5FA', 'fg'), title: '24x7', sub: 'Always help' },
              { Icon: Percent, color: T(C.orange, 'fg'), title: 'Offers', sub: 'Cashback deals' },
            ] as { Icon: LucideIcon; color: string; title: string; sub: string }[]
          ).map((b, i, arr) => (
            <View key={b.title} style={[ts.item, i < arr.length - 1 && ts.border]}>
              <b.Icon size={18} color={T(b.color, 'fg')} />
              <Text style={ts.title}>{b.title}</Text>
              <Text style={ts.sub}>{b.sub}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

/** @deprecated use ServiceCategoryScreen with group="bills" */
export function BillsScreen(props: {
  onBack: () => void;
  onOpenBill: (kind: BillKind) => void;
}) {
  return <ServiceCategoryScreen group="bills" {...props} />;
}

const make_hero = () => StyleSheet.create({
  wrap: {
    backgroundColor: T('#0D0C35', 'bg'),
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
  },
  left: { flex: 1 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.white, 'fg'), lineHeight: 28 },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 14,
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  right: { gap: 8, width: 72 },
  mini: { borderRadius: 12, padding: 10, alignItems: 'flex-start', gap: 6 },
  miniPurple: {
    backgroundColor: T(C.purple, 'bg'),
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
    gap: 6,
   overflow: 'hidden', },
  miniLabel: { color: T(C.white, 'fg'), fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
const use_hero = () => useThemedStyles(make_hero);

const make_sec = () => StyleSheet.create({
  section: { marginTop: 20, paddingHorizontal: 14 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  badge: {
    backgroundColor: T('#ECFDF5', 'bg'),
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: T(C.green, 'fg') },
  cardDesc: {
    fontSize: 11,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
});
const use_sec = () => useThemedStyles(make_sec);

const make_ofr = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.purple, 'bg'),
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
   overflow: 'hidden', },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
  sub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  code: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: { color: T(C.white, 'fg'), fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
const use_ofr = () => useThemedStyles(make_ofr);

const make_ts = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.darkBg, 'bg'),
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  border: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: { color: T(C.white, 'fg'), fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
const use_ts = () => useThemedStyles(make_ts);

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 40 },
});
const use_st = () => useThemedStyles(make_st);
