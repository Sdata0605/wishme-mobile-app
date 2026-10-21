import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { serviceColors as C } from './serviceColors';
import {
  Banknote,
  Bus,
  CalendarCheck,
  Car,
  ChevronRight,
  CreditCard,
  Droplet,
  FileText,
  Flame,
  Gift,
  Headphones,
  Hotel,
  Landmark,
  MoreHorizontal,
  Plane,
  Scan,
  Search,
  ShieldCheck,
  Smartphone,
  Tv,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';
import { SavedShortcuts } from './SavedShortcuts';
import type { ShortcutCategory } from './shortcuts';

/** The filter chips under the search bar. 'all' shows everything. */
type ServiceFilter = 'all' | ShortcutCategory;



// ─── Search Bar ─────────────────────────────────────────────────────────────
function SearchBar() {
  const srch = use_srch();
  return (
    <View style={srch.container}>
      <Search size={16} color={T(C.gray, 'fg')} />
      <Text style={srch.placeholder}>
        Search services, bills, offers, celebrities...
      </Text>
      <TouchableOpacity>
        <Scan size={20} color={T(C.textLight, 'fg')} />
      </TouchableOpacity>
    </View>
  );
}

const make_srch = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T(C.white, 'bg'),
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  placeholder: {
    flex: 1,
    fontSize: 13,
    color: T(C.gray, 'fg'),
    fontFamily: 'Inter_400Regular',
  },
});
const use_srch = () => useThemedStyles(make_srch);

// ─── Category Filter Row ──────────────────────────────────────────────────────
interface Filter {
  key: ServiceFilter;
  label: string;
  Icon: LucideIcon;
}

const FILTERS: Filter[] = [
  { key: 'all', label: 'All', Icon: MoreHorizontal },
  { key: 'bills', label: 'Bills', Icon: FileText },
  { key: 'recharge', label: 'Recharge', Icon: Zap },
  { key: 'travel', label: 'Travel', Icon: Plane },
  { key: 'finance', label: 'Finance', Icon: Landmark },
];

function CategoryFilter({
  active,
  onChange,
}: {
  active: ServiceFilter;
  onChange: (next: ServiceFilter) => void;
}) {
  const filt = use_filt();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filt.row}
      style={{ marginTop: 12 }}
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[filt.chip, isActive && filt.chipActive]}
            activeOpacity={0.8}
          >
            <f.Icon size={14} color={isActive ? T(C.orange, 'fg') : T(C.textLight, 'fg')} />
            <Text style={[filt.chipText, isActive && filt.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const make_filt = () => StyleSheet.create({
  row: { paddingHorizontal: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  chipActive: {
    backgroundColor: T('#F5F0FF', 'bg'),
    borderColor: T(C.orange, 'border'),
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
  },
  chipTextActive: { color: T(C.orange, 'fg'), fontFamily: 'Inter_600SemiBold' },
});
const use_filt = () => useThemedStyles(make_filt);

// ─── Service Category Cards ───────────────────────────────────────────────────
interface SubItem {
  label: string;
  Icon: LucideIcon;
}

interface Category {
  title: string;
  filter: ShortcutCategory;
  color: string;
  Icon: LucideIcon;
  desc: string;
  subs: SubItem[];
}

const CATEGORIES: Category[] = [
  {
    title: 'Bills',
    filter: 'bills',
    color: T(C.orange, 'fg'),
    Icon: FileText,
    desc: 'Electricity, water & gas only',
    subs: [
      { label: 'Electricity', Icon: Zap },
      { label: 'Water', Icon: Droplet },
      { label: 'Gas', Icon: Flame },
    ],
  },
  {
    title: 'Recharge',
    filter: 'recharge',
    color: T(C.orange, 'fg'),
    Icon: Smartphone,
    desc: 'Instant recharges in a few clicks',
    subs: [
      { label: 'Mobile\nRecharge', Icon: Smartphone },
      { label: 'DTH\nRecharge', Icon: Tv },
      { label: 'FASTag\nRecharge', Icon: Car },
    ],
  },
  {
    title: 'Travel',
    filter: 'travel',
    color: T(C.purple, 'fg'),
    Icon: Plane,
    desc: 'Book travel at best prices',
    subs: [
      { label: 'Flights', Icon: Plane },
      { label: 'Bus\nTickets', Icon: Bus },
      { label: 'Hotels', Icon: Hotel },
    ],
  },
  {
    title: 'Financial\nServices',
    filter: 'finance',
    color: T(C.navy, 'fg'),
    Icon: Landmark,
    desc: 'Loans, cards & more services',
    subs: [
      { label: 'Loan\nEMI', Icon: Banknote },
      { label: 'Credit\nCard Bill', Icon: CreditCard },
      { label: 'Insurance', Icon: ShieldCheck },
    ],
  },
];

function CategoryCard({ item, onPress }: { item: Category; onPress?: () => void }) {
  const cat = use_cat();
  return (
    <TouchableOpacity
      style={cat.card}
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={cat.cardTop}>
        <Text style={[cat.cardTitle, { color: T(item.color, 'fg') }]}>{item.title}</Text>
      </View>

      <View style={[cat.iconBox, { backgroundColor: item.color + '15' }]}>
        <item.Icon size={26} color={T(item.color, 'fg')} />
      </View>

      <Text style={cat.cardDesc} numberOfLines={2}>
        {item.desc}
      </Text>

      <View style={cat.subRow}>
        {item.subs.map((s) => (
          <View key={s.label} style={cat.subItem}>
            <View style={cat.subIconBg}>
              <s.Icon size={14} color={T(C.textLight, 'fg')} />
            </View>
            <Text style={cat.subLabel} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={cat.moreBtn}>
        <MoreHorizontal size={16} color={T(C.gray, 'fg')} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ServiceGrid({
  filter,
  onOpenTravel,
  onOpenBills,
  onOpenRecharge,
  onOpenFinance,
}: {
  filter: ServiceFilter;
  onOpenTravel?: () => void;
  onOpenBills?: () => void;
  onOpenRecharge?: () => void;
  onOpenFinance?: () => void;
}) {
  const cat = use_cat();
  const openFor = (c: Category) => {
    if (c.filter === 'travel') return onOpenTravel;
    if (c.filter === 'bills') return onOpenBills;
    if (c.filter === 'recharge') return onOpenRecharge;
    return onOpenFinance;
  };
  const shown = CATEGORIES.filter((c) => filter === 'all' || c.filter === filter);

  return (
    <View style={cat.section}>
      <View style={cat.sectionHead}>
        <Text style={cat.sectionTitle}>All Services</Text>
        <TouchableOpacity style={cat.viewAll}>
          <Text style={cat.viewAllText}>View All</Text>
          <ChevronRight size={14} color={T(C.orange, 'fg')} />
        </TouchableOpacity>
      </View>
      <View style={cat.grid}>
        {shown.map((c) => (
          <CategoryCard key={c.title} item={c} onPress={openFor(c)} />
        ))}
      </View>
    </View>
  );
}

const make_cat = () => StyleSheet.create({
  section: { marginTop: 16 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.orange, 'fg'),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 8,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 11,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 10,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: T(C.lightGray, 'border'),
    paddingTop: 10,
  },
  subItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  subIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: T(C.lightGray, 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 8,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 10,
  },
  moreBtn: {
    alignItems: 'center',
    marginTop: 6,
  },
});
const use_cat = () => useThemedStyles(make_cat);

// ─── Cashback Banner ──────────────────────────────────────────────────────────

/**
 * The offer this banner advertises, with the date it stops being true. The banner hides itself once
 * that date passes, so an expired promotion is never shown again (QA audit M-02: it was still
 * offering "Valid till 31 May 2025" in October 2026).
 */
const CASHBACK_OFFER = {
  headline: 'Flat ₹100 Cashback',
  sub: 'on Your First Bill Payment!',
  code: 'WISH100',
  /** Last day the offer is valid, inclusive. */
  validTill: new Date('2026-12-31T23:59:59+05:30'),
};

function CashbackBanner() {
  const cb = use_cb();
  if (Date.now() > CASHBACK_OFFER.validTill.getTime()) return null;
  const validLabel = CASHBACK_OFFER.validTill.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={cb.container}><BrandFill />
      <View style={cb.giftBox}>
        <Gift size={30} color={T('#FCD34D', 'fg')} />
      </View>
      <View style={cb.text}>
        <Text style={cb.headline}>{CASHBACK_OFFER.headline}</Text>
        <Text style={cb.sub}>{CASHBACK_OFFER.sub}</Text>
        <View style={cb.codePill}>
          <Text style={cb.codeText}>Use Code: {CASHBACK_OFFER.code}</Text>
        </View>
      </View>
      <View style={cb.ctaBlock}>
        <TouchableOpacity style={cb.btn}><BrandFill />
          <Text style={cb.btnText}>Pay Bills Now</Text>
        </TouchableOpacity>
        <Text style={cb.validity}>Valid till{'\n'}{validLabel}</Text>
      </View>
    </View>
  );
}

const make_cb = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.purple, 'bg'),
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
   overflow: 'hidden', },
  giftBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  headline: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
  sub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
    marginBottom: 6,
  },
  codePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  codeText: { color: T(C.white, 'fg'), fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  ctaBlock: { alignItems: 'center', gap: 6 },
  btn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  validity: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 13,
  },
});
const use_cb = () => useThemedStyles(make_cb);

// ─── Explore More ─────────────────────────────────────────────────────────────
interface ExploreItem {
  label: string;
  Icon: LucideIcon;
  color: string;
  open: () => void;
}

const openService = (params: Record<string, string>) =>
  router.push({ pathname: '/services', params } as Href);

const EXPLORE: ExploreItem[] = [
  { label: 'Scan & Pay', Icon: Scan, color: T(C.purpleLight, 'fg'), open: () => router.push('/(tabs)/scan-pay') },
  { label: 'Pay to Number', Icon: Smartphone, color: T(C.purpleLight, 'fg'), open: () => router.push('/pay-mobile' as Href) },
  { label: 'Pay to UPI / Bank', Icon: Landmark, color: T(C.purpleLight, 'fg'), open: () => router.push('/pay-upi' as Href) },
  {
    label: 'Insurance',
    Icon: ShieldCheck,
    color: T(C.green, 'fg'),
    open: () => router.push('/insurance' as Href),
  },
  { label: 'My Bookings', Icon: CalendarCheck, color: T(C.orange, 'fg'), open: () => router.push('/bookings') },
  { label: 'Wish a Friend', Icon: Gift, color: '#EF4444', open: () => router.push('/wish-friend' as Href) },
  { label: 'More Services', Icon: MoreHorizontal, color: T(C.textLight, 'fg'), open: () => router.navigate('/hub') },
];

function ExploreMore() {
  const ex = use_ex();
  return (
    <View style={ex.section}>
      <Text style={ex.title}>Explore More</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ex.row}
      >
        {EXPLORE.map((e) => (
          <TouchableOpacity key={e.label} style={ex.card} activeOpacity={0.85} onPress={e.open}>
            <View style={[ex.iconBg, { backgroundColor: e.color + '15' }]}>
              <e.Icon size={20} color={T(e.color, 'fg')} />
            </View>
            <Text style={ex.label} numberOfLines={1}>
              {e.label}
            </Text>
            <ChevronRight size={14} color={T(C.gray, 'fg')} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const make_ex = () => StyleSheet.create({
  section: { marginTop: 18 },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(18), },
  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
});
const use_ex = () => useThemedStyles(make_ex);

// ─── Trust Badges ─────────────────────────────────────────────────────────────
interface TrustBadge {
  Icon: LucideIcon;
  color: string;
  title: string;
  sub: string;
}

const TRUST: TrustBadge[] = [
  { Icon: ShieldCheck, color: T(C.green, 'fg'), title: 'Safe & Secure', sub: 'Bank-grade security for your safety' },
  { Icon: Zap, color: '#FBBF24', title: 'Instant Payments', sub: 'Lightning fast payments in just a few taps' },
  { Icon: Headphones, color: '#25DFFF', title: '24x7 Support', sub: "We're here for you anytime, anywhere" },
  { Icon: Users, color: T(C.green, 'fg'), title: 'Trusted by Millions', sub: '10Cr+ happy users across India' },
];

function TrustBadges() {
  const tb = use_tb();
  return (
    <View style={tb.container}>
      {TRUST.map((b, i) => (
        <View
          key={b.title}
          style={[tb.item, i < TRUST.length - 1 && tb.itemBorder]}
        >
          <b.Icon size={22} color={T(b.color, 'fg')} />
          <Text style={tb.title}>{b.title}</Text>
          <Text style={tb.sub}>{b.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const make_tb = () => StyleSheet.create({
  container: {
    backgroundColor: T(C.darkBg, 'bg'),
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  itemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  title: {
    color: T(C.white, 'fg'),
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 11,
  },
});
const use_tb = () => useThemedStyles(make_tb);

// ─── All Services Screen Content ──────────────────────────────────────────────
export function AllServicesScreen({
  onOpenTravel,
  onOpenBills,
  onOpenRecharge,
  onOpenFinance,
}: {
  onOpenTravel?: () => void;
  onOpenBills?: () => void;
  onOpenRecharge?: () => void;
  onOpenFinance?: () => void;
}) {
  const styles = useScreenStyles();
  const [filter, setFilter] = useState<ServiceFilter>('all');
  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      bounces
    >
      <SearchBar />
      <CategoryFilter active={filter} onChange={setFilter} />
      <ServiceGrid
        filter={filter}
        onOpenTravel={onOpenTravel}
        onOpenBills={onOpenBills}
        onOpenRecharge={onOpenRecharge}
        onOpenFinance={onOpenFinance}
      />
      <SavedShortcuts filter={filter} />
      <CashbackBanner />
      {filter === 'all' && <ExploreMore />}
      <TrustBadges />
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const make_styles = () => StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 110 },
});
const useScreenStyles = () => useThemedStyles(make_styles);
