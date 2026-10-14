import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { serviceColors as C } from './serviceColors';
import {
  Award,
  Banknote,
  Bus,
  Car,
  ChevronRight,
  CreditCard,
  Droplet,
  FileText,
  Flame,
  Gauge,
  Gift,
  Headphones,
  Hotel,
  Image as ImageIcon,
  Landmark,
  MoreHorizontal,
  Music,
  Plane,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Scan,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Tv,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';



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
  label: string;
  Icon: LucideIcon;
}

const FILTERS: Filter[] = [
  { label: 'All', Icon: MoreHorizontal },
  { label: 'Wishes', Icon: ShieldCheck },
  { label: 'Bills', Icon: FileText },
  { label: 'Recharge', Icon: Zap },
  { label: 'Travel', Icon: Plane },
  { label: 'Wallet', Icon: Wallet },
];

function CategoryFilter() {
  const filt = use_filt();
  const [active, setActive] = useState(0);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filt.row}
      style={{ marginTop: 12 }}
    >
      {FILTERS.map((f, i) => {
        const isActive = i === active;
        return (
          <TouchableOpacity
            key={f.label}
            onPress={() => setActive(i)}
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
  color: string;
  Icon: LucideIcon;
  desc: string;
  subs: SubItem[];
  badge?: string;
}

const CATEGORIES: Category[] = [
  {
    title: 'Wishes',
    color: T(C.purple, 'fg'),
    Icon: Gift,
    desc: 'Celebrate every special moment',
    subs: [
      { label: 'Celebrity\nWishes', Icon: Star },
      { label: 'AI\nGreetings', Icon: Sparkles },
      { label: 'Video\nWishes', Icon: Play },
    ],
  },
  {
    title: 'Bills',
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
    title: 'Wallet',
    color: T(C.purple, 'fg'),
    Icon: Wallet,
    desc: 'Manage money & make payments',
    subs: [
      { label: 'Add\nMoney', Icon: Plus },
      { label: 'Transactions', Icon: Receipt },
      { label: 'Referrals', Icon: Gift },
    ],
  },
  {
    title: 'Financial\nServices',
    color: T(C.navy, 'fg'),
    Icon: Landmark,
    desc: 'Loans, cards & more services',
    subs: [
      { label: 'Loan\nEMI', Icon: Banknote },
      { label: 'Credit\nCard Bill', Icon: CreditCard },
      { label: 'Insurance', Icon: ShieldCheck },
    ],
  },
  {
    title: 'AI Studio',
    color: T(C.purpleLight, 'fg'),
    Icon: Sparkles,
    desc: 'Create unique content with AI',
    badge: 'New',
    subs: [
      { label: 'AI\nGreetings', Icon: Sparkles },
      { label: 'AI\nImages', Icon: ImageIcon },
      { label: 'AI\nMusic', Icon: Music },
    ],
  },
  {
    title: 'Rewards',
    color: T(C.orange, 'fg'),
    Icon: Gift,
    desc: 'Earn points & exciting rewards',
    subs: [
      { label: 'My\nPoints', Icon: Award },
      { label: 'Redeem\nNow', Icon: Gift },
      { label: 'Offers', Icon: Tag },
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
        {item.badge && (
          <View style={cat.newBadge}>
            <Text style={cat.newBadgeText}>{item.badge}</Text>
          </View>
        )}
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
  onOpenTravel,
  onOpenBills,
  onOpenRecharge,
  onOpenFinance,
  onOpenWallet,
}: {
  onOpenTravel?: () => void;
  onOpenBills?: () => void;
  onOpenRecharge?: () => void;
  onOpenFinance?: () => void;
  onOpenWallet?: () => void;
}) {
  const cat = use_cat();
  const openFor = (title: string) => {
    if (title === 'Travel') return onOpenTravel;
    if (title === 'Bills') return onOpenBills;
    if (title === 'Recharge') return onOpenRecharge;
    if (title === 'Financial\nServices') return onOpenFinance;
    if (title === 'Wallet') return onOpenWallet;
    return undefined;
  };

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
        {CATEGORIES.map((c) => (
          <CategoryCard key={c.title} item={c} onPress={openFor(c.title)} />
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
  newBadge: {
    backgroundColor: T('#EF4444', 'bg'),
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: T(C.white, 'fg'),
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
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

// ─── Saved Shortcuts ──────────────────────────────────────────────────────────
interface Shortcut {
  brand: string;
  sub: string;
  color: string;
  bg: string;
}

const SHORTCUTS: Shortcut[] = [
  { brand: 'BESCOM', sub: 'Electricity', color: '#F59E0B', bg: '#F5F0FF' },
  { brand: 'airtel', sub: 'Mobile', color: '#E4002B', bg: '#FEE2E2' },
  { brand: 'IndiGo', sub: 'Flights', color: '#0B1F6B', bg: '#E0E7FF' },
  { brand: 'HDFC', sub: 'Credit Card', color: '#004B8D', bg: '#DBEAFE' },
  { brand: 'amazon', sub: 'Add Money', color: '#232F3E', bg: '#EDEEF1' },
];

function SavedShortcuts() {
  const sc = use_sc();
  return (
    <View style={sc.section}>
      <View style={sc.head}>
        <Text style={sc.title}>Saved Shortcuts</Text>
        <TouchableOpacity>
          <Text style={sc.manage}>Manage</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sc.row}
      >
        {SHORTCUTS.map((s) => (
          <TouchableOpacity key={s.brand} style={sc.item} activeOpacity={0.8}>
            <View style={[sc.badge, { backgroundColor: T(s.bg, 'bg') }]}>
              <Text style={[sc.badgeText, { color: T(s.color, 'fg') }]} numberOfLines={1}>
                {s.brand}
              </Text>
            </View>
            <Text style={sc.itemSub} numberOfLines={1}>
              {s.sub}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={sc.item} activeOpacity={0.8}>
          <View style={sc.addBadge}>
            <Plus size={22} color={T(C.orange, 'fg')} />
          </View>
          <Text style={sc.itemSub}>Add New</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const make_sc = () => StyleSheet.create({
  section: {
    backgroundColor: T(C.white, 'bg'),
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
   ...glass(22), },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  manage: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.purpleLight, 'fg') },
  row: { paddingHorizontal: 14, gap: 16 },
  item: { alignItems: 'center', width: 60, gap: 6 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  itemSub: {
    fontSize: 10,
    color: T(C.textLight, 'fg'),
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  addBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: T(C.orange, 'border'),
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
const use_sc = () => useThemedStyles(make_sc);

// ─── Cashback Banner ──────────────────────────────────────────────────────────
function CashbackBanner() {
  const cb = use_cb();
  return (
    <View style={cb.container}><BrandFill />
      <View style={cb.giftBox}>
        <Gift size={30} color={T('#FCD34D', 'fg')} />
      </View>
      <View style={cb.text}>
        <Text style={cb.headline}>Flat ₹100 Cashback</Text>
        <Text style={cb.sub}>on Your First Bill Payment!</Text>
        <View style={cb.codePill}>
          <Text style={cb.codeText}>Use Code: WISH100</Text>
        </View>
      </View>
      <View style={cb.ctaBlock}>
        <TouchableOpacity style={cb.btn}><BrandFill />
          <Text style={cb.btnText}>Pay Bills Now</Text>
        </TouchableOpacity>
        <Text style={cb.validity}>Valid till{'\n'}31 May 2025</Text>
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
}

const EXPLORE: ExploreItem[] = [
  { label: 'Insurance', Icon: ShieldCheck, color: T(C.green, 'fg') },
  { label: 'Credit Score', Icon: Gauge, color: T(C.purpleLight, 'fg') },
  { label: 'Gift Cards', Icon: Gift, color: T(C.orange, 'fg') },
  { label: 'Subscriptions', Icon: RefreshCw, color: '#EF4444' },
  { label: 'More Services', Icon: MoreHorizontal, color: T(C.textLight, 'fg') },
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
          <TouchableOpacity key={e.label} style={ex.card} activeOpacity={0.85}>
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
  { Icon: Headphones, color: '#60A5FA', title: '24x7 Support', sub: "We're here for you anytime, anywhere" },
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
  onOpenWallet,
}: {
  onOpenTravel?: () => void;
  onOpenBills?: () => void;
  onOpenRecharge?: () => void;
  onOpenFinance?: () => void;
  onOpenWallet?: () => void;
}) {
  const styles = use_styles();
  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      bounces
    >
      <SearchBar />
      <CategoryFilter />
      <ServiceGrid
        onOpenTravel={onOpenTravel}
        onOpenBills={onOpenBills}
        onOpenRecharge={onOpenRecharge}
        onOpenFinance={onOpenFinance}
        onOpenWallet={onOpenWallet}
      />
      <SavedShortcuts />
      <CashbackBanner />
      <ExploreMore />
      <TrustBadges />
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const make_styles = () => StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 110 },
});
const use_styles = () => useThemedStyles(make_styles);
