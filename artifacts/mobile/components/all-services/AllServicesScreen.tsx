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



// ─── Search Bar ─────────────────────────────────────────────────────────────
function SearchBar() {
  return (
    <View style={srch.container}>
      <Search size={16} color={C.gray} />
      <Text style={srch.placeholder}>
        Search services, bills, offers, celebrities...
      </Text>
      <TouchableOpacity>
        <Scan size={20} color={C.textLight} />
      </TouchableOpacity>
    </View>
  );
}

const srch = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  placeholder: {
    flex: 1,
    fontSize: 13,
    color: C.gray,
    fontFamily: 'Inter_400Regular',
  },
});

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
            <f.Icon size={14} color={isActive ? C.orange : C.textLight} />
            <Text style={[filt.chipText, isActive && filt.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const filt = StyleSheet.create({
  row: { paddingHorizontal: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: C.orange,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
  },
  chipTextActive: { color: C.orange, fontFamily: 'Inter_600SemiBold' },
});

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
    color: C.purple,
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
    color: C.orange,
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
    color: C.orange,
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
    color: C.purple,
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
    color: C.purple,
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
    color: C.navy,
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
    color: C.purpleLight,
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
    color: C.orange,
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
  return (
    <TouchableOpacity
      style={cat.card}
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={cat.cardTop}>
        <Text style={[cat.cardTitle, { color: item.color }]}>{item.title}</Text>
        {item.badge && (
          <View style={cat.newBadge}>
            <Text style={cat.newBadgeText}>{item.badge}</Text>
          </View>
        )}
      </View>

      <View style={[cat.iconBox, { backgroundColor: item.color + '15' }]}>
        <item.Icon size={26} color={item.color} />
      </View>

      <Text style={cat.cardDesc} numberOfLines={2}>
        {item.desc}
      </Text>

      <View style={cat.subRow}>
        {item.subs.map((s) => (
          <View key={s.label} style={cat.subItem}>
            <View style={cat.subIconBg}>
              <s.Icon size={14} color={C.textLight} />
            </View>
            <Text style={cat.subLabel} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={cat.moreBtn}>
        <MoreHorizontal size={16} color={C.gray} />
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
          <ChevronRight size={14} color={C.orange} />
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

const cat = StyleSheet.create({
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
    color: C.text,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.orange,
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
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  newBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: C.white,
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
    color: C.textLight,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 10,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.lightGray,
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
    backgroundColor: C.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 8,
    color: C.textLight,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 10,
  },
  moreBtn: {
    alignItems: 'center',
    marginTop: 6,
  },
});

// ─── Saved Shortcuts ──────────────────────────────────────────────────────────
interface Shortcut {
  brand: string;
  sub: string;
  color: string;
  bg: string;
}

const SHORTCUTS: Shortcut[] = [
  { brand: 'BESCOM', sub: 'Electricity', color: '#FF8C42', bg: '#FFF7ED' },
  { brand: 'airtel', sub: 'Mobile', color: '#E4002B', bg: '#FEE2E2' },
  { brand: 'IndiGo', sub: 'Flights', color: '#0B1F6B', bg: '#E0E7FF' },
  { brand: 'HDFC', sub: 'Credit Card', color: '#004B8D', bg: '#DBEAFE' },
  { brand: 'amazon', sub: 'Add Money', color: '#232F3E', bg: '#EDEEF1' },
];

function SavedShortcuts() {
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
            <View style={[sc.badge, { backgroundColor: s.bg }]}>
              <Text style={[sc.badgeText, { color: s.color }]} numberOfLines={1}>
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
            <Plus size={22} color={C.orange} />
          </View>
          <Text style={sc.itemSub}>Add New</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  section: {
    backgroundColor: C.white,
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  manage: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.purpleLight },
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
    color: C.textLight,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  addBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: C.orange,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Cashback Banner ──────────────────────────────────────────────────────────
function CashbackBanner() {
  return (
    <View style={cb.container}>
      <View style={cb.giftBox}>
        <Gift size={30} color="#FCD34D" />
      </View>
      <View style={cb.text}>
        <Text style={cb.headline}>Flat ₹100 Cashback</Text>
        <Text style={cb.sub}>on Your First Bill Payment!</Text>
        <View style={cb.codePill}>
          <Text style={cb.codeText}>Use Code: WISH100</Text>
        </View>
      </View>
      <View style={cb.ctaBlock}>
        <TouchableOpacity style={cb.btn}>
          <Text style={cb.btnText}>Pay Bills Now</Text>
        </TouchableOpacity>
        <Text style={cb.validity}>Valid till{'\n'}31 May 2025</Text>
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  container: {
    backgroundColor: C.purple,
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  giftBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  headline: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
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
  codeText: { color: C.white, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  ctaBlock: { alignItems: 'center', gap: 6 },
  btn: {
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  validity: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 13,
  },
});

// ─── Explore More ─────────────────────────────────────────────────────────────
interface ExploreItem {
  label: string;
  Icon: LucideIcon;
  color: string;
}

const EXPLORE: ExploreItem[] = [
  { label: 'Insurance', Icon: ShieldCheck, color: C.green },
  { label: 'Credit Score', Icon: Gauge, color: C.purpleLight },
  { label: 'Gift Cards', Icon: Gift, color: C.orange },
  { label: 'Subscriptions', Icon: RefreshCw, color: '#EF4444' },
  { label: 'More Services', Icon: MoreHorizontal, color: C.textLight },
];

function ExploreMore() {
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
              <e.Icon size={20} color={e.color} />
            </View>
            <Text style={ex.label} numberOfLines={1}>
              {e.label}
            </Text>
            <ChevronRight size={14} color={C.gray} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const ex = StyleSheet.create({
  section: { marginTop: 18 },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  row: { paddingHorizontal: 14, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
});

// ─── Trust Badges ─────────────────────────────────────────────────────────────
interface TrustBadge {
  Icon: LucideIcon;
  color: string;
  title: string;
  sub: string;
}

const TRUST: TrustBadge[] = [
  { Icon: ShieldCheck, color: C.green, title: 'Safe & Secure', sub: 'Bank-grade security for your safety' },
  { Icon: Zap, color: '#FBBF24', title: 'Instant Payments', sub: 'Lightning fast payments in just a few taps' },
  { Icon: Headphones, color: '#60A5FA', title: '24x7 Support', sub: "We're here for you anytime, anywhere" },
  { Icon: Users, color: C.green, title: 'Trusted by Millions', sub: '10Cr+ happy users across India' },
];

function TrustBadges() {
  return (
    <View style={tb.container}>
      {TRUST.map((b, i) => (
        <View
          key={b.title}
          style={[tb.item, i < TRUST.length - 1 && tb.itemBorder]}
        >
          <b.Icon size={22} color={b.color} />
          <Text style={tb.title}>{b.title}</Text>
          <Text style={tb.sub}>{b.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  container: {
    backgroundColor: C.darkBg,
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
    color: C.white,
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

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 110 },
});
