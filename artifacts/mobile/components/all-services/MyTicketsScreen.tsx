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
    color: C.green,
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  completed: {
    label: 'Completed',
    color: C.purple,
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  cancelled: {
    label: 'Cancelled',
    color: C.red,
    bg: '#FEF2F2',
    border: '#FECACA',
  },
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[badge.wrap, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <View style={[badge.dot, { backgroundColor: meta.color }]} />
      <Text style={[badge.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
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
  return (
    <TouchableOpacity style={[act.chip, { backgroundColor: bg }]} activeOpacity={0.75}>
      <Icon size={13} color={color} />
      <Text style={[act.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const act = StyleSheet.create({
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

function TicketCard({ ticket }: { ticket: BookedTicket }) {
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
            <Bus size={12} color={C.orange} />
            <View style={card.line} />
            <View style={[card.dot, { backgroundColor: C.orange }]} />
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
          <Ticket size={12} color={C.purpleLight} />
          <Text style={card.metaText}>PNR {ticket.pnr}</Text>
        </View>
        <View style={card.metaItem}>
          <Calendar size={12} color={C.orange} />
          <Text style={card.metaText}>{ticket.seats}</Text>
        </View>
        <View style={card.metaItem}>
          <Clock size={12} color={C.green} />
          <Text style={card.metaText}>
            {ticket.passengers} pax
          </Text>
        </View>
      </View>

      <View style={card.boardingRow}>
        <MapPin size={13} color={C.textLight} />
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
              <ActionChip Icon={Download} label="m-Ticket" color={C.purple} bg="#F5F3FF" />
              <ActionChip Icon={Navigation} label="Track" color={C.orange} bg="#FFF7ED" />
              <ActionChip Icon={XCircle} label="Cancel" color={C.red} bg="#FEF2F2" />
            </>
          )}
          {ticket.status === 'completed' && (
            <>
              <ActionChip Icon={Download} label="Invoice" color={C.purple} bg="#F5F3FF" />
              <ActionChip Icon={RefreshCw} label="Book again" color={C.orange} bg="#FFF7ED" />
              <ActionChip Icon={Headphones} label="Help" color={C.green} bg="#ECFDF5" />
            </>
          )}
          {ticket.status === 'cancelled' && (
            <>
              <ActionChip Icon={RefreshCw} label="Book again" color={C.orange} bg="#FFF7ED" />
              <ActionChip Icon={Headphones} label="Help" color={C.green} bg="#ECFDF5" />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  operator: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  busType: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 2,
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.pageBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  timeCol: { width: 72 },
  time: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  city: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    marginTop: 2,
  },
  midCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  duration: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: C.textLight,
    marginBottom: 4,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 3,
  },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  dateInline: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: C.orange,
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
    backgroundColor: C.lightGray,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: C.text },
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
    color: C.textLight,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    gap: 8,
  },
  paidLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
  },
  amount: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.green, marginTop: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justify: 1, justifyContent: 'flex-end' },
});

function EmptyState({ tab }: { tab: TabKey }) {
  const copy =
    tab === 'upcoming'
      ? 'No upcoming trips. Book a bus and your tickets will show up here.'
      : tab === 'completed'
        ? 'No completed journeys yet. Past trips appear here after travel.'
        : 'No cancelled bookings. Cancelled tickets will be listed here.';

  return (
    <View style={empty.wrap}>
      <View style={empty.icon}>
        <Ticket size={28} color={C.orange} />
      </View>
      <Text style={empty.title}>No tickets found</Text>
      <Text style={empty.sub}>{copy}</Text>
      <TouchableOpacity style={empty.btn} activeOpacity={0.85}>
        <Text style={empty.btnText}>Search Buses</Text>
        <ArrowRight size={14} color={C.white} />
      </TouchableOpacity>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  sub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { color: C.white, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

export function MyTicketsScreen({ onBack }: { onBack: () => void }) {
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
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>My Tickets</Text>
          <Text style={st.headerSub}>Your bus booking history</Text>
        </View>
        <View style={st.headerIcon}>
          <Ticket size={18} color={C.orange} />
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
          <Bus size={16} color={C.purple} />
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
          <Headphones size={18} color={C.white} />
          <View style={{ flex: 1 }}>
            <Text style={st.helpTitle}>Need help with a booking?</Text>
            <Text style={st.helpSub}>24x7 trip support for cancellations & boarding</Text>
          </View>
          <TouchableOpacity style={st.helpBtn} activeOpacity={0.85}>
            <Text style={st.helpBtnText}>Contact</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

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
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
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
    backgroundColor: C.lightGray,
  },
  tabActive: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: C.orange },
  tabText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textLight },
  tabTextActive: { color: C.orange },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DCDFE5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countPillActive: { backgroundColor: C.orange },
  countText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.textLight },
  countTextActive: { color: C.white },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: C.purple,
    lineHeight: 15,
  },
  helpStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.darkBg,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  helpTitle: { color: C.white, fontSize: 13, fontFamily: 'Inter_700Bold' },
  helpSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  helpBtn: {
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  helpBtnText: { color: C.white, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
