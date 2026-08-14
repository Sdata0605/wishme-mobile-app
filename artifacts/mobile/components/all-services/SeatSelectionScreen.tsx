import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  ChevronLeft,
  CircleDot,
  PersonStanding,
  Star,
  Users,
} from 'lucide-react-native';
import type { BusTicket } from './BusResultsScreen';

import { serviceColors as C } from './serviceColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Seat model ──────────────────────────────────────────────────────────────
type SeatStatus = 'available' | 'sold' | 'women';

export interface Seat {
  id: string;
  status: SeatStatus;
  price: number;
  wide?: boolean; // wide bottom berth
}

// Deterministic sample layout: 6 rows, left single berth + right pair, plus a
// wide berth at the back — mirroring the reference screenshots.
function buildDeck(deck: 'L' | 'U', busId: number): Seat[][] {
  const rows: Seat[][] = [];
  const base = deck === 'L' ? 555 : 505;
  for (let r = 0; r < 6; r++) {
    const row: Seat[] = [];
    for (let col = 0; col < 3; col++) {
      const n = r * 3 + col;
      // Pseudo-random but stable pattern per bus
      const h = (busId * 7 + (deck === 'L' ? 0 : 3) + n * 5) % 11;
      let status: SeatStatus = 'available';
      if (h < 5) status = 'sold';
      else if (h === 5 || h === 6) status = 'women';
      row.push({ id: `${deck}${r + 1}${'ABC'[col]}`, status, price: base });
    }
    rows.push(row);
  }
  // Back wide berth
  const wideSold = (busId + (deck === 'L' ? 0 : 1)) % 3 === 0;
  rows.push([
    { id: `${deck}7W`, status: wideSold ? 'sold' : 'available', price: base + 93, wide: true },
  ]);
  return rows;
}

// ─── Seat cell ───────────────────────────────────────────────────────────────
const SEAT_W = 52;
const SEAT_H = 96;

function SeatCell({
  seat,
  selected,
  onPress,
}: {
  seat: Seat;
  selected: boolean;
  onPress: () => void;
}) {
  const isSold = seat.status === 'sold';
  const isWomen = seat.status === 'women';
  const selectable = seat.status === 'available';

  const box = [
    seat.wide ? sc.seatWide : sc.seat,
    isSold && sc.seatSold,
    isWomen && sc.seatWomen,
    selectable && sc.seatAvailable,
    selected && sc.seatSelected,
  ];

  return (
    <TouchableOpacity
      style={sc.cell}
      activeOpacity={selectable ? 0.7 : 1}
      onPress={selectable ? onPress : undefined}
      disabled={!selectable}
    >
      <View style={box}>
        {(isSold || isWomen) && (
          <PersonStanding
            size={16}
            color={isWomen ? C.pink : C.soldIcon}
            style={seat.wide ? { transform: [{ rotate: '90deg' }] } : undefined}
          />
        )}
        {selectable && (
          <View
            style={[
              seat.wide ? sc.pillowWide : sc.pillow,
              selected && { backgroundColor: C.white },
            ]}
          />
        )}
      </View>
      <Text style={[sc.label, selectable && sc.labelPrice, selected && sc.labelSelected]}>
        {isSold || isWomen ? 'Sold' : `₹${seat.price}`}
      </Text>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  cell: { alignItems: 'center' },
  seat: {
    width: SEAT_W,
    height: SEAT_H,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatWide: {
    width: SEAT_W * 2 + 14,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatSold: { backgroundColor: C.soldBg, borderColor: C.soldBorder },
  seatWomen: { backgroundColor: C.pinkBg, borderColor: C.pinkBorder },
  seatAvailable: { backgroundColor: C.white, borderColor: C.green },
  seatSelected: { backgroundColor: C.green, borderColor: C.greenDark },
  pillow: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#BBE7CF',
    marginTop: SEAT_H - 34,
  },
  pillowWide: {
    width: 7,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#BBE7CF',
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  label: {
    marginTop: 4,
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    color: C.gray,
  },
  labelPrice: { color: C.text, fontFamily: 'Inter_600SemiBold' },
  labelSelected: { color: C.greenDark },
});

// ─── Deck card ───────────────────────────────────────────────────────────────
function DeckCard({
  title,
  rows,
  selectedIds,
  onToggle,
}: {
  title: string;
  rows: Seat[][];
  selectedIds: Set<string>;
  onToggle: (seat: Seat) => void;
}) {
  return (
    <View style={dk.wrap}>
      <View style={dk.card}>
        <View style={dk.head}>
          <Text style={dk.title}>{title}</Text>
          {title === 'Lower deck' ? (
            <CircleDot size={26} color={C.textLight} />
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>
        {rows.map((row, i) =>
          row[0]?.wide ? (
            <View key={i} style={dk.wideRow}>
              <SeatCell
                seat={row[0]}
                selected={selectedIds.has(row[0].id)}
                onPress={() => onToggle(row[0])}
              />
            </View>
          ) : (
            <View key={i} style={dk.row}>
              <SeatCell
                seat={row[0]}
                selected={selectedIds.has(row[0].id)}
                onPress={() => onToggle(row[0])}
              />
              <View style={dk.aisle} />
              <View style={dk.pair}>
                <SeatCell
                  seat={row[1]}
                  selected={selectedIds.has(row[1].id)}
                  onPress={() => onToggle(row[1])}
                />
                <SeatCell
                  seat={row[2]}
                  selected={selectedIds.has(row[2].id)}
                  onPress={() => onToggle(row[2])}
                />
              </View>
            </View>
          ),
        )}
      </View>
    </View>
  );
}

const dk = StyleSheet.create({
  wrap: { width: SCREEN_WIDTH, paddingHorizontal: 14 },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  aisle: { flex: 1 },
  pair: { flexDirection: 'row', gap: 14 },
  wideRow: { alignItems: 'flex-start', marginTop: 2 },
});

// ─── Seat Selection Screen ───────────────────────────────────────────────────
export function SeatSelectionScreen({
  bus,
  onBack,
  onContinue,
}: {
  bus: BusTicket;
  onBack: () => void;
  onContinue: (seats: Seat[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const lower = useMemo(() => buildDeck('L', bus.id), [bus.id]);
  const upper = useMemo(() => buildDeck('U', bus.id), [bus.id]);
  const allSeats = useMemo(() => [...lower.flat(), ...upper.flat()], [lower, upper]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deckPage, setDeckPage] = useState(0);
  const deckScrollRef = useRef<ScrollView>(null);

  const toggle = (seat: Seat) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  };

  const selectedSeats = allSeats.filter((s) => selectedIds.has(s.id));
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const maker = bus.id % 2 === 0 ? 'Volvo' : 'Tata';
  const monthly = `${(20 + ((bus.id * 7) % 25)).toFixed(0)}K+`;

  const onDeckScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (p !== deckPage) setDeckPage(p);
  };

  return (
    <View style={st.root}>
      {/* Header bar */}
      <View style={[st.headerBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Select your seats</Text>
          <Text style={st.headerSub}>You selected this bus</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Bus info card */}
        <View style={st.busCard}>
          <Image
            source={require('../../assets/images/seat-bus-hero.jpg')}
            style={st.busImage}
            resizeMode="cover"
          />
          <View style={st.busInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={st.busName}>{bus.company}</Text>
              <View style={st.ratingPill}>
                <Star size={10} color={C.white} fill={C.white} />
                <Text style={st.ratingText}> {bus.rating.toFixed(1)}</Text>
              </View>
            </View>
            <View style={st.travellersRow}>
              <Users size={12} color={C.textLight} />
              <Text style={st.travellersText}>
                {' '}
                {monthly} people travel with this bus every month
              </Text>
            </View>
            <View style={st.chipRow}>
              <View style={st.chip}>
                <Text style={st.chipText}>{maker}</Text>
              </View>
              <View style={st.chip}>
                <Text style={st.chipText}>{bus.ac ? 'AC' : 'Non-AC'}</Text>
              </View>
              <View style={st.chip}>
                <Text style={st.chipText}>{bus.sleeper ? 'Sleeper' : 'Seater'}</Text>
              </View>
              <View style={st.chip}>
                <Text style={st.chipText}>{bus.layout}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Legend */}
        <View style={st.legendRow}>
          <View style={st.legendItem}>
            <View style={[st.legendBox, { borderColor: C.green, backgroundColor: C.white }]} />
            <Text style={st.legendText}>Available</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendBox, { borderColor: C.greenDark, backgroundColor: C.green }]} />
            <Text style={st.legendText}>Selected</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendBox, { borderColor: C.soldBorder, backgroundColor: C.soldBg }]} />
            <Text style={st.legendText}>Sold</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.legendBox, { borderColor: C.pinkBorder, backgroundColor: C.pinkBg }]} />
            <Text style={st.legendText}>Women</Text>
          </View>
        </View>

        {/* Swipe hint */}
        <View style={st.hintRow}>
          {deckPage === 0 ? (
            <>
              <Text style={st.hintText}>Swipe left to see Upper deck</Text>
              <ArrowRight size={13} color={C.orange} />
            </>
          ) : (
            <>
              <ChevronLeft size={13} color={C.orange} />
              <Text style={st.hintText}>Swipe right for Lower deck</Text>
            </>
          )}
        </View>

        {/* Decks — horizontal swipe */}
        <ScrollView
          ref={deckScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onDeckScroll}
          scrollEventThrottle={16}
        >
          <DeckCard title="Lower deck" rows={lower} selectedIds={selectedIds} onToggle={toggle} />
          <DeckCard title="Upper deck" rows={upper} selectedIds={selectedIds} onToggle={toggle} />
        </ScrollView>
        <View style={st.deckDots}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[st.deckDot, i === deckPage ? st.deckDotActive : st.deckDotInactive]}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom total bar */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.footerSeats}>
            {selectedSeats.length === 0
              ? 'No seats selected'
              : `${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''} · ${selectedSeats
                  .map((s) => s.id)
                  .join(', ')}`}
          </Text>
          <Text style={st.footerTotal}>₹{total}</Text>
        </View>
        <TouchableOpacity
          style={[st.continueBtn, selectedSeats.length === 0 && st.continueDisabled]}
          activeOpacity={0.85}
          disabled={selectedSeats.length === 0}
          onPress={() => onContinue(selectedSeats)}
        >
          <Text style={st.continueText}>Select boarding & dropping points</Text>
          <ArrowRight size={15} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: C.textLight,
    marginTop: 1,
  },
  busCard: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  busImage: { width: '100%', height: 130 },
  busInfo: { padding: 14 },
  busName: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.green,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: { color: C.white, fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  travellersRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  travellersText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textLight },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: C.purple },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendBox: { width: 13, height: 13, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: C.textLight },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  hintText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: C.orange },
  deckDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 10 },
  deckDot: { height: 5, borderRadius: 3 },
  deckDotActive: { width: 16, backgroundColor: C.orange },
  deckDotInactive: { width: 5, backgroundColor: '#D1D5DB' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerSeats: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: C.textLight },
  footerTotal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 1 },
  continueBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  continueDisabled: { backgroundColor: '#FDBA8C' },
  continueText: {
    color: C.white,
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    flexShrink: 1,
  },
});
