import React, { useMemo, useState } from 'react';
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
  ArrowRight,
  Bus,
  Calendar,
  Clock,
  Download,
  Headphones,
  MapPin,
  Navigation,
  RefreshCw,
  Ticket,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass } from './themed';
import { BrandFill } from './BrandFill';

type TicketStatus = 'upcoming' | 'completed' | 'cancelled';

interface BookedTicket {
  id: string;
  pnr: string;
  status: TicketStatus;
  operator: string;
  busType: string;
  from: string;
  to: string;
  dateLabel: string;
  depTime: string;
  arrTime: string;
  duration: string;
  seats: string;
  boarding: string;
  dropping: string;
  passengers: number;
  amount: string;
}

const TICKETS: BookedTicket[] = [
  {
    id: '1',
    pnr: 'WM8B2K19',
    status: 'upcoming',
    operator: 'VRL Travels',
    busType: 'Volvo AC Sleeper',
    from: 'Mumbai',
    to: 'Pune',
    dateLabel: 'Sat, 8 Aug',
    depTime: '22:30',
    arrTime: '02:15',
    duration: '3h 45m',
    seats: 'L12, L13',
    boarding: 'Dadar East — Opp. Plaza Cinema',
    dropping: 'Swargate Bus Stand',
    passengers: 2,
    amount: '₹1,298',
  },
  {
    id: '2',
    pnr: 'WM4F9Q72',
    status: 'upcoming',
    operator: 'Orange Tours',
    busType: 'AC Seater',
    from: 'Delhi',
    to: 'Jaipur',
    dateLabel: 'Mon, 11 Aug',
    depTime: '07:00',
    arrTime: '12:20',
    duration: '5h 20m',
    seats: 'A4',
    boarding: 'Kashmere Gate ISBT',
    dropping: 'Sindhi Camp Bus Stand',
    passengers: 1,
    amount: '₹649',
  },
  {
    id: '3',
    pnr: 'WM1C6H54',
    status: 'completed',
    operator: 'SRS Travels',
    busType: 'Non-AC Sleeper',
    from: 'Bengaluru',
    to: 'Chennai',
    dateLabel: 'Fri, 18 Jul',
    depTime: '21:45',
    arrTime: '04:30',
    duration: '6h 45m',
    seats: 'U7',
    boarding: 'Madiwala Bus Stop',
    dropping: 'Koyambedu CMBT',
    passengers: 1,
    amount: '₹799',
  },
  {
    id: '4',
    pnr: 'WM9P3D28',
    status: 'completed',
    operator: 'IntrCity SmartBus',
    busType: 'Electric AC Seater',
    from: 'Hyderabad',
    to: 'Bengaluru',
    dateLabel: 'Sun, 6 Jul',
    depTime: '23:00',
    arrTime: '07:10',
    duration: '8h 10m',
    seats: 'B2, B3',
    boarding: 'Lakdikapul',
    dropping: 'Electronic City',
    passengers: 2,
    amount: '₹1,598',
  },
  {
    id: '5',
    pnr: 'WM7R5M01',
    status: 'cancelled',
    operator: 'Neeta Tours',
    busType: 'Luxury Volvo',
    from: 'Mumbai',
    to: 'Goa',
    dateLabel: 'Wed, 25 Jun',
    depTime: '20:00',
    arrTime: '08:30',
    duration: '12h 30m',
    seats: 'L4',
    boarding: 'Borivali National Park',
    dropping: 'Mapusa Bus Stand',
    passengers: 1,
    amount: '₹1,199',
  },
];

type TabKey = 'upcoming' | 'completed' | 'cancelled';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_META: Record<
  TicketStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  upcoming: {
    label: 'Confirmed',
    color: T(C.green, 'fg'),
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  completed: {
    label: 'Completed',
    color: T(C.purple, 'fg'),
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  cancelled: {
    label: 'Cancelled',
    color: T(C.red, 'fg'),
    bg: '#FEF2F2',
    border: '#FECACA',
  },
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const badge = use_badge();
  const meta = STATUS_META[status];
  return (
    <View style={[badge.wrap, { backgroundColor: T(meta.bg, 'bg'), borderColor: T(meta.border, 'border') }]}>
      <View style={[badge.dot, { backgroundColor: T(meta.color, 'bg') }]} />
      <Text style={[badge.text, { color: T(meta.color, 'fg') }]}>{meta.label}</Text>
    </View>
  );
}

const make_badge = () => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
const use_badge = () => useThemedStyles(make_badge);

function ActionChip({
  Icon,
  label,
  color,
  bg,
}: {
  Icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
}) {
  const act = use_act();
  return (
    <TouchableOpacity style={[act.chip, { backgroundColor: bg }]} activeOpacity={0.75}>
      <Icon size={13} color={color} />
      <Text style={[act.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const make_act = () => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
const use_act = () => useThemedStyles(make_act);

function TicketCard({ ticket }: { ticket: BookedTicket }) {
  const card = use_card();
  return (
    <View style={card.wrap}>
      <View style={card.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={card.operator}>{ticket.operator}</Text>
          <Text style={card.busType}>{ticket.busType}</Text>
        </View>
        <StatusBadge status={ticket.status} />
      </View>

      <View style={card.routeBox}>
        <View style={card.timeCol}>
          <Text style={card.time}>{ticket.depTime}</Text>
          <Text style={card.city}>{ticket.from}</Text>
        </View>
        <View style={card.midCol}>
          <Text style={card.duration}>{ticket.duration}</Text>
          <View style={card.lineRow}>
            <View style={card.dot} />
            <View style={card.line} />
            <Bus size={12} color={T(C.orange, 'fg')} />
            <View style={card.line} />
            <View style={[card.dot, { backgroundColor: T(C.orange, 'bg') }]} />
          </View>
          <Text style={card.dateInline}>{ticket.dateLabel}</Text>
        </View>
        <View style={[card.timeCol, { alignItems: 'flex-end' }]}>
          <Text style={card.time}>{ticket.arrTime}</Text>
          <Text style={card.city}>{ticket.to}</Text>
        </View>
      </View>

      <View style={card.metaRow}>
        <View style={card.metaItem}>
          <Ticket size={12} color={T(C.purpleLight, 'fg')} />
          <Text style={card.metaText}>PNR {ticket.pnr}</Text>
        </View>
        <View style={card.metaItem}>
          <Calendar size={12} color={T(C.orange, 'fg')} />
          <Text style={card.metaText}>{ticket.seats}</Text>
        </View>
        <View style={card.metaItem}>
          <Clock size={12} color={T(C.green, 'fg')} />
          <Text style={card.metaText}>
            {ticket.passengers} pax
          </Text>
        </View>
      </View>

      <View style={card.boardingRow}>
        <MapPin size={13} color={T(C.textLight, 'fg')} />
        <Text style={card.boardingText} numberOfLines={1}>
          Board: {ticket.boarding}
        </Text>
      </View>

      <View style={card.footer}>
        <View>
          <Text style={card.paidLabel}>Amount paid</Text>
          <Text style={card.amount}>{ticket.amount}</Text>
        </View>
        <View style={card.actions}>
          {ticket.status === 'upcoming' && (
            <>
              <ActionChip Icon={Download} label="m-Ticket" color={T(C.purple, 'fg')} bg={T('#F5F3FF', 'bg')} />
              <ActionChip Icon={Navigation} label="Track" color={T(C.orange, 'fg')} bg={T('#F5F0FF', 'bg')} />
              <ActionChip Icon={XCircle} label="Cancel" color={T(C.red, 'fg')} bg={T('#FEF2F2', 'bg')} />
            </>
          )}
          {ticket.status === 'completed' && (
            <>
              <ActionChip Icon={Download} label="Invoice" color={T(C.purple, 'fg')} bg={T('#F5F3FF', 'bg')} />
              <ActionChip Icon={RefreshCw} label="Book again" color={T(C.orange, 'fg')} bg={T('#F5F0FF', 'bg')} />
              <ActionChip Icon={Headphones} label="Help" color={T(C.green, 'fg')} bg={T('#ECFDF5', 'bg')} />
            </>
          )}
          {ticket.status === 'cancelled' && (
            <>
              <ActionChip Icon={RefreshCw} label="Book again" color={T(C.orange, 'fg')} bg={T('#F5F0FF', 'bg')} />
              <ActionChip Icon={Headphones} label="Help" color={T(C.green, 'fg')} bg={T('#ECFDF5', 'bg')} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const make_card = () => StyleSheet.create({
  wrap: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
   ...glass(22), },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  operator: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  busType: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T(C.pageBg, 'bg'),
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  timeCol: { width: 72 },
  time: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  city: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
  },
  midCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  duration: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    marginBottom: 4,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 3,
  },
  line: { flex: 1, height: 1, backgroundColor: T(C.border, 'bg') },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T(C.green, 'bg'),
  },
  dateInline: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: T(C.orange, 'fg'),
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T(C.lightGray, 'bg'),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  boardingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  boardingText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingTop: 12,
    gap: 8,
  },
  paidLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
  },
  amount: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg'), marginTop: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
});
const use_card = () => useThemedStyles(make_card);

function EmptyState({ tab }: { tab: TabKey }) {
  const empty = use_empty();
  const copy =
    tab === 'upcoming'
      ? 'No upcoming trips. Book a bus and your tickets will show up here.'
      : tab === 'completed'
        ? 'No completed journeys yet. Past trips appear here after travel.'
        : 'No cancelled bookings. Cancelled tickets will be listed here.';

  return (
    <View style={empty.wrap}>
      <View style={empty.icon}>
        <Ticket size={28} color={T(C.orange, 'fg')} />
      </View>
      <Text style={empty.title}>No tickets found</Text>
      <Text style={empty.sub}>{copy}</Text>
      <TouchableOpacity style={empty.btn} activeOpacity={0.85}><BrandFill />
        <Text style={empty.btnText}>Search Buses</Text>
        <ArrowRight size={14} color={T(C.white, 'fg')} />
      </TouchableOpacity>
    </View>
  );
}

const make_empty = () => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    marginTop: 8,
   ...glass(22), },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: T('#F5F0FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
   overflow: 'hidden', },
  btnText: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
const use_empty = () => useThemedStyles(make_empty);

export function MyTicketsScreen({ onBack }: { onBack: () => void }) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [tab, setTab] = useState<TabKey>('upcoming');

  const filtered = useMemo(() => TICKETS.filter((t) => t.status === tab), [tab]);
  const counts = useMemo(
    () => ({
      upcoming: TICKETS.filter((t) => t.status === 'upcoming').length,
      completed: TICKETS.filter((t) => t.status === 'completed').length,
      cancelled: TICKETS.filter((t) => t.status === 'cancelled').length,
    }),
    [],
  );

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>My Tickets</Text>
          <Text style={st.headerSub}>Your bus booking history</Text>
        </View>
        <View style={st.headerIcon}>
          <Ticket size={18} color={T(C.orange, 'fg')} />
        </View>
      </View>

      <View style={st.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[st.tab, active && st.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[st.tabText, active && st.tabTextActive]}>{t.label}</Text>
              <View style={[st.countPill, active && st.countPillActive]}>
                <Text style={[st.countText, active && st.countTextActive]}>{counts[t.key]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.content}
        bounces
      >
        <View style={st.hintCard}>
          <Bus size={16} color={T(C.purple, 'fg')} />
          <Text style={st.hintText}>
            Show m-ticket at boarding · Track live bus · Cancel or rebook anytime
          </Text>
        </View>

        {filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          filtered.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
        )}

        <View style={st.helpStrip}>
          <Headphones size={18} color={T(C.white, 'fg')} />
          <View style={{ flex: 1 }}>
            <Text style={st.helpTitle}>Need help with a booking?</Text>
            <Text style={st.helpSub}>24x7 trip support for cancellations & boarding</Text>
          </View>
          <TouchableOpacity style={st.helpBtn} activeOpacity={0.85}><BrandFill />
            <Text style={st.helpBtnText}>Contact</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

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
    backgroundColor: T('#F5F0FF', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T(C.white, 'bg'),
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 9,
    backgroundColor: T(C.lightGray, 'bg'),
  },
  tabActive: { backgroundColor: T('#F5F0FF', 'bg'), borderWidth: 1, borderColor: T(C.orange, 'border') },
  tabText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  tabTextActive: { color: T(C.orange, 'fg') },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T('#DCDFE5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countPillActive: { backgroundColor: T(C.orange, 'bg') },
  countText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: T(C.textLight, 'fg') },
  countTextActive: { color: T(C.white, 'fg') },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T('#F5F3FF', 'bg'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T('#DDD6FE', 'border'),
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.purple, 'fg'),
    lineHeight: 15,
  },
  helpStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T(C.darkBg, 'bg'),
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  helpTitle: { color: T(C.white, 'fg'), fontSize: 13, fontFamily: 'Inter_700Bold' },
  helpSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  helpBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
   overflow: 'hidden', },
  helpBtnText: { color: T(C.white, 'fg'), fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
const use_st = () => useThemedStyles(make_st);
