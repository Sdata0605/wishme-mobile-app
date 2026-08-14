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
    accentBg: '#FFF7ED',
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
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const hub = HUB[group];
  const items = servicesForGroup(group);

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>{hub.title}</Text>
          <Text style={st.headerSub}>{hub.sub}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[st.headerIcon, { backgroundColor: hub.accentBg }]}>
          <hub.Icon size={18} color={hub.accent} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={st.content}>
        <View style={hero.wrap}>
          <View style={hero.left}>
            <Text style={hero.title}>
              {hub.heroTitle}
              {'\n'}
              <Text style={{ color: C.orange }}>{hub.heroHighlight}</Text>
            </Text>
            <Text style={hero.sub}>{hub.heroSub}</Text>
            <TouchableOpacity style={hero.btn} onPress={() => onOpenBill(hub.ctaKind)}>
              <Text style={hero.btnText}>{hub.cta}</Text>
            </TouchableOpacity>
          </View>
          <View style={hero.right}>
            <View style={[hero.mini, { backgroundColor: hub.accent }]}>
              <hub.Icon size={22} color={C.white} />
              <Text style={hero.miniLabel}>{hub.title.split(' ')[0]}</Text>
            </View>
            <View style={hero.miniPurple}>
              <Percent size={18} color={C.white} />
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
              <View style={[sec.iconBox, { backgroundColor: s.bg }]}>
                <s.Icon size={24} color={s.color} />
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
              <ChevronRight size={18} color={C.gray} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={ofr.container}>
          <View style={ofr.iconBox}>
            <Tag size={22} color="#FCD34D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ofr.headline}>Flat ₹75 cashback</Text>
            <Text style={ofr.sub}>on your first payment in this category</Text>
            <View style={ofr.code}>
              <Text style={ofr.codeText}>Use Code: WISH75</Text>
            </View>
          </View>
          <TouchableOpacity style={ofr.btn} onPress={() => onOpenBill(hub.ctaKind)}>
            <Text style={ofr.btnText}>Claim</Text>
          </TouchableOpacity>
        </View>

        <View style={ts.container}>
          {(
            [
              { Icon: ShieldCheck, color: C.green, title: 'Secure', sub: 'Safe payments' },
              { Icon: Zap, color: '#FBBF24', title: 'Instant', sub: 'Quick confirm' },
              { Icon: Headphones, color: '#60A5FA', title: '24x7', sub: 'Always help' },
              { Icon: Percent, color: C.orange, title: 'Offers', sub: 'Cashback deals' },
            ] as { Icon: LucideIcon; color: string; title: string; sub: string }[]
          ).map((b, i, arr) => (
            <View key={b.title} style={[ts.item, i < arr.length - 1 && ts.border]}>
              <b.Icon size={18} color={b.color} />
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

const hero = StyleSheet.create({
  wrap: {
    backgroundColor: '#0D0C35',
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
  },
  left: { flex: 1 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.white, lineHeight: 28 },
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
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  right: { gap: 8, width: 72 },
  mini: { borderRadius: 12, padding: 10, alignItems: 'flex-start', gap: 6 },
  miniPurple: {
    backgroundColor: C.purple,
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
    gap: 6,
  },
  miniLabel: { color: C.white, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});

const sec = StyleSheet.create({
  section: { marginTop: 20, paddingHorizontal: 14 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  sub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 2,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  badge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: C.green },
  cardDesc: {
    fontSize: 11,
    color: C.textLight,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
});

const ofr = StyleSheet.create({
  container: {
    backgroundColor: C.purple,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
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
  codeText: { color: C.white, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

const ts = StyleSheet.create({
  container: {
    backgroundColor: C.darkBg,
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  border: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: { color: C.white, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
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
