import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
  Check,
  CheckCircle2,
  ChevronRight,
  Luggage,
  Plus,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react-native';
import { serviceColors as C } from './serviceColors';
import { tboGetSSR, type TBOSeatItem, type TBOMealltem } from '@/services/tboService';
import type { FlightResult } from './FlightResultsScreen';
import type { FlightPassenger } from './FlightPassengerScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SelectedFlightAddons {
  seats: Array<{ paxIndex: number; seatNo: string; price: number }>;
  meals: Array<{ paxIndex: number; code: string; label: string; price: number }>;
  extraBaggageKg: number;
  insurance: boolean;
}

export function FlightAddonsScreen({
  flight,
  passengers,
  onBack,
  onContinue,
}: {
  flight: FlightResult;
  passengers: FlightPassenger[];
  onBack: () => void;
  onContinue: (addons: SelectedFlightAddons) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [activeTab, setActiveTab] = useState<'seats' | 'meals' | 'baggage' | 'insurance'>('seats');
  const [selectedPaxIdx, setSelectedPaxIdx] = useState(0);

  const [seats, setSeats] = useState<TBOSeatItem[]>([]);
  const [meals, setMeals] = useState<TBOMealltem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSeats, setSelectedSeats] = useState<Record<number, { seatNo: string; price: number }>>({});
  const [selectedMeals, setSelectedMeals] = useState<Record<number, { code: string; label: string; price: number }>>({});
  const [extraBaggageKg, setExtraBaggageKg] = useState(0);
  const [insurance, setInsurance] = useState(true);

  useEffect(() => {
    tboGetSSR(String(flight.id)).then((res) => {
      setSeats(res.seats);
      setMeals(res.meals);
      setLoading(false);
    });
  }, [flight.id]);

  const handleSeatClick = (seat: TBOSeatItem) => {
    if (!seat.IsAvailable) return;
    setSelectedSeats((prev) => {
      const next = { ...prev };
      if (next[selectedPaxIdx]?.seatNo === seat.SeatNo) {
        delete next[selectedPaxIdx];
      } else {
        next[selectedPaxIdx] = { seatNo: seat.SeatNo, price: seat.Price };
      }
      return next;
    });
  };

  const handleMealClick = (meal: TBOMealltem) => {
    setSelectedMeals((prev) => {
      const next = { ...prev };
      if (next[selectedPaxIdx]?.code === meal.Code) {
        delete next[selectedPaxIdx];
      } else {
        next[selectedPaxIdx] = { code: meal.Code, label: meal.Description, price: meal.Price };
      }
      return next;
    });
  };

  // Calculate total add-on cost
  const seatTotal = Object.values(selectedSeats).reduce((s, x) => s + x.price, 0);
  const mealTotal = Object.values(selectedMeals).reduce((s, x) => s + x.price, 0);
  const baggageTotal = extraBaggageKg === 5 ? 1499 : extraBaggageKg === 10 ? 2799 : extraBaggageKg === 15 ? 3999 : 0;
  const insuranceTotal = insurance ? 249 * passengers.length : 0;
  const grandAddonsTotal = seatTotal + mealTotal + baggageTotal + insuranceTotal;

  const handleProceed = () => {
    const formattedSeats = Object.entries(selectedSeats).map(([paxIdx, s]) => ({
      paxIndex: Number(paxIdx),
      seatNo: s.seatNo,
      price: s.price,
    }));

    const formattedMeals = Object.entries(selectedMeals).map(([paxIdx, m]) => ({
      paxIndex: Number(paxIdx),
      code: m.code,
      label: m.label,
      price: m.price,
    }));

    onContinue({
      seats: formattedSeats,
      meals: formattedMeals,
      extraBaggageKg,
      insurance,
    });
  };

  // Group seats by row
  const rowNumbers = Array.from(new Set(seats.map((s) => s.RowNo)));

  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Add-ons & Seats</Text>
          <Text style={st.headerSub}>Customize your journey with IndiGo</Text>
        </View>
        <View style={st.stepBadge}>
          <Text style={st.stepText}>Step 2 of 3</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabBar}>
        {[
          { key: 'seats', label: '💺 Seats', count: Object.keys(selectedSeats).length },
          { key: 'meals', label: '🍱 Meals', count: Object.keys(selectedMeals).length },
          { key: 'baggage', label: '🧳 Baggage', count: extraBaggageKg ? 1 : 0 },
          { key: 'insurance', label: '🛡️ Insurance', count: insurance ? 1 : 0 },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[st.tabBtn, activeTab === t.key && st.tabBtnActive]}
            onPress={() => setActiveTab(t.key as any)}
          >
            <Text style={[st.tabBtnText, activeTab === t.key && st.tabBtnTextActive]}>
              {t.label} {t.count > 0 ? `(${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Passenger Selector Bar (for seats and meals) */}
      {(activeTab === 'seats' || activeTab === 'meals') && passengers.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.paxBar}
        >
          {passengers.map((p, idx) => {
            const isSelected = selectedPaxIdx === idx;
            const hasSeat = selectedSeats[idx];
            const hasMeal = selectedMeals[idx];
            return (
              <TouchableOpacity
                key={p.id}
                style={[st.paxPill, isSelected && st.paxPillActive]}
                onPress={() => setSelectedPaxIdx(idx)}
              >
                <Text style={[st.paxPillText, isSelected && st.paxPillTextActive]}>
                  {p.firstName || `Pax ${idx + 1}`}
                </Text>
                {activeTab === 'seats' && hasSeat && (
                  <View style={st.miniTag}><Text style={st.miniTagText}>{hasSeat.seatNo}</Text></View>
                )}
                {activeTab === 'meals' && hasMeal && (
                  <View style={st.miniTag}><Text style={st.miniTagText}>✓</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={{ marginTop: 12, fontSize: 13, color: C.textLight }}>Loading seat map...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── SEATS TAB ────────────────────────────────────────────────────────── */}
          {activeTab === 'seats' && (
            <View>
              {/* Legend */}
              <View style={st.legendCard}>
                <View style={st.legendItem}><View style={[st.legendBox, { backgroundColor: '#F3F4F6' }]} /><Text style={st.legendText}>Occupied</Text></View>
                <View style={st.legendItem}><View style={[st.legendBox, { backgroundColor: '#E0E7FF', borderColor: '#6366F1', borderWidth: 1 }]} /><Text style={st.legendText}>Free / ₹150</Text></View>
                <View style={st.legendItem}><View style={[st.legendBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]} /><Text style={st.legendText}>₹350</Text></View>
                <View style={st.legendItem}><View style={[st.legendBox, { backgroundColor: '#FCE7F3', borderColor: '#EC4899', borderWidth: 1 }]} /><Text style={st.legendText}>₹600+</Text></View>
              </View>

              {/* Airplane Cabin */}
              <View style={st.fuselage}>
                <View style={st.cockpit}>
                  <Text style={st.cockpitText}>FRONT OF AIRCRAFT ✈️</Text>
                </View>

                {/* Column Headers */}
                <View style={st.seatColHead}>
                  <Text style={st.colLetter}>A</Text>
                  <Text style={st.colLetter}>B</Text>
                  <Text style={st.colLetter}>C</Text>
                  <View style={{ width: 28 }} />
                  <Text style={st.colLetter}>D</Text>
                  <Text style={st.colLetter}>E</Text>
                  <Text style={st.colLetter}>F</Text>
                </View>

                {/* Rows */}
                {rowNumbers.map((rowNo) => {
                  const rowSeats = seats.filter((s) => s.RowNo === rowNo);
                  const isExit = rowNo === '12' || rowNo === '14';

                  return (
                    <View key={rowNo}>
                      {isExit && (
                        <View style={st.exitRowIndicator}>
                          <Text style={st.exitText}>🚨 EMERGENCY EXIT ROW (+ Legroom)</Text>
                        </View>
                      )}
                      <View style={st.seatRow}>
                        {['A', 'B', 'C'].map((col) => {
                          const seat = rowSeats.find((s) => s.SeatNo === `${rowNo}${col}`);
                          const isAssignedToCurrent = selectedSeats[selectedPaxIdx]?.seatNo === seat?.SeatNo;
                          const isAssignedToOther = Object.entries(selectedSeats).some(
                            ([paxI, s]) => Number(paxI) !== selectedPaxIdx && s.seatNo === seat?.SeatNo,
                          );

                          return (
                            <TouchableOpacity
                              key={col}
                              disabled={!seat?.IsAvailable || isAssignedToOther}
                              onPress={() => seat && handleSeatClick(seat)}
                              style={[
                                st.seatBox,
                                !seat?.IsAvailable && st.seatOccupied,
                                (seat?.Price ?? 0) >= 600 ? st.seatPremium : (seat?.Price ?? 0) >= 350 ? st.seatStandard : st.seatFree,
                                isAssignedToCurrent && st.seatSelectedCurrent,
                                isAssignedToOther && st.seatSelectedOther,
                              ]}
                            >
                              <Text
                                style={[
                                  st.seatBoxText,
                                  isAssignedToCurrent && st.seatBoxTextSelected,
                                  !seat?.IsAvailable && { color: '#9CA3AF' },
                                ]}
                              >
                                {isAssignedToCurrent ? '✓' : seat?.SeatNo}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Aisle */}
                        <View style={st.aisle}>
                          <Text style={st.aisleText}>{rowNo}</Text>
                        </View>

                        {['D', 'E', 'F'].map((col) => {
                          const seat = rowSeats.find((s) => s.SeatNo === `${rowNo}${col}`);
                          const isAssignedToCurrent = selectedSeats[selectedPaxIdx]?.seatNo === seat?.SeatNo;
                          const isAssignedToOther = Object.entries(selectedSeats).some(
                            ([paxI, s]) => Number(paxI) !== selectedPaxIdx && s.seatNo === seat?.SeatNo,
                          );

                          return (
                            <TouchableOpacity
                              key={col}
                              disabled={!seat?.IsAvailable || isAssignedToOther}
                              onPress={() => seat && handleSeatClick(seat)}
                              style={[
                                st.seatBox,
                                !seat?.IsAvailable && st.seatOccupied,
                                (seat?.Price ?? 0) >= 600 ? st.seatPremium : (seat?.Price ?? 0) >= 350 ? st.seatStandard : st.seatFree,
                                isAssignedToCurrent && st.seatSelectedCurrent,
                                isAssignedToOther && st.seatSelectedOther,
                              ]}
                            >
                              <Text
                                style={[
                                  st.seatBoxText,
                                  isAssignedToCurrent && st.seatBoxTextSelected,
                                  !seat?.IsAvailable && { color: '#9CA3AF' },
                                ]}
                              >
                                {isAssignedToCurrent ? '✓' : seat?.SeatNo}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── MEALS TAB ────────────────────────────────────────────────────────── */}
          {activeTab === 'meals' && (
            <View style={{ gap: 10 }}>
              <Text style={st.sectionTitle}>Select In-flight Meal for Passenger {selectedPaxIdx + 1}</Text>
              {meals.map((m) => {
                const isSelected = selectedMeals[selectedPaxIdx]?.code === m.Code;
                return (
                  <TouchableOpacity
                    key={m.Code}
                    style={[st.mealCard, isSelected && st.mealCardActive]}
                    onPress={() => handleMealClick(m)}
                  >
                    <View style={st.mealIconBox}>
                      <Utensils size={20} color={isSelected ? C.white : C.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.mealTitle}>{m.Description}</Text>
                      <Text style={st.mealPrice}>₹{m.Price}</Text>
                    </View>
                    <View style={[st.checkCircle, isSelected && st.checkCircleActive]}>
                      {isSelected && <Check size={14} color={C.white} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── BAGGAGE TAB ──────────────────────────────────────────────────────── */}
          {activeTab === 'baggage' && (
            <View style={{ gap: 12 }}>
              <Text style={st.sectionTitle}>Add Extra Check-in Baggage</Text>
              <Text style={st.sectionSub}>Standard allowance is 15 kg per passenger. Save up to 40% pre-booking extra baggage.</Text>

              {[
                { kg: 0, price: 0, label: 'Standard Baggage (15 kg Included)' },
                { kg: 5, price: 1499, label: '+5 kg Extra Check-in Baggage' },
                { kg: 10, price: 2799, label: '+10 kg Extra Check-in Baggage' },
                { kg: 15, price: 3999, label: '+15 kg Extra Check-in Baggage' },
              ].map((b) => (
                <TouchableOpacity
                  key={b.kg}
                  style={[st.bagCard, extraBaggageKg === b.kg && st.bagCardActive]}
                  onPress={() => setExtraBaggageKg(b.kg)}
                >
                  <Luggage size={22} color={extraBaggageKg === b.kg ? C.purple : C.textLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.bagTitle}>{b.label}</Text>
                    <Text style={st.bagPrice}>{b.price === 0 ? 'Free' : `₹${b.price}`}</Text>
                  </View>
                  <View style={[st.checkCircle, extraBaggageKg === b.kg && st.checkCircleActive]}>
                    {extraBaggageKg === b.kg && <Check size={14} color={C.white} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── INSURANCE TAB ────────────────────────────────────────────────────── */}
          {activeTab === 'insurance' && (
            <View style={st.insurCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={28} color={C.green} />
                <View style={{ flex: 1 }}>
                  <Text style={st.insurHead}>Comprehensive Travel Cover</Text>
                  <Text style={st.insurSub}>₹249 per traveller</Text>
                </View>
              </View>

              <View style={st.insurPerks}>
                <View style={st.perkRow}><CheckCircle2 size={15} color={C.green} /><Text style={st.perkText}>Medical Emergency cover up to ₹5,00,000</Text></View>
                <View style={st.perkRow}><CheckCircle2 size={15} color={C.green} /><Text style={st.perkText}>Flight Delay & Cancellation compensation</Text></View>
                <View style={st.perkRow}><CheckCircle2 size={15} color={C.green} /><Text style={st.perkText}>Baggage Loss & Theft protection up to ₹25,000</Text></View>
                <View style={st.perkRow}><CheckCircle2 size={15} color={C.green} /><Text style={st.perkText}>24x7 Global Emergency Assistance</Text></View>
              </View>

              <TouchableOpacity
                style={[st.insurToggle, insurance && st.insurToggleActive]}
                onPress={() => setInsurance(!insurance)}
              >
                <Text style={[st.insurToggleText, insurance && { color: C.white }]}>
                  {insurance ? '✓ Insurance Added' : '+ Add Travel Insurance (₹249)'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={st.footerLabel}>Add-ons total</Text>
          <Text style={st.footerPrice}>
            {grandAddonsTotal > 0 ? `+₹${grandAddonsTotal.toLocaleString('en-IN')}` : 'Included'}
          </Text>
        </View>
        <TouchableOpacity style={st.continueBtn} activeOpacity={0.85} onPress={handleProceed}>
          <Text style={st.continueBtnText}>Review & Pay</Text>
          <ChevronRight size={18} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 1 },
  stepBadge: { backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  stepText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.purple },
  tabBar: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.purple },
  tabBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textLight },
  tabBtnTextActive: { color: C.purple, fontFamily: 'Inter_700Bold' },
  paxBar: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, backgroundColor: '#FAF5FF' },
  paxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  paxPillActive: { backgroundColor: C.purple, borderColor: C.purple },
  paxPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  paxPillTextActive: { color: C.white },
  miniTag: { backgroundColor: '#FCD34D', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  miniTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#78350F' },
  legendCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 14, height: 14, borderRadius: 4 },
  legendText: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: C.textLight },
  fuselage: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  cockpit: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 16,
  },
  cockpitText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.textLight },
  seatColHead: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 8 },
  colLetter: { width: 34, textAlign: 'center', fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textLight },
  seatRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  aisle: { width: 28, alignItems: 'center' },
  aisleText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  seatBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  seatFree: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  seatStandard: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  seatPremium: { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' },
  seatOccupied: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  seatSelectedCurrent: { backgroundColor: C.purple, borderColor: C.purple },
  seatSelectedOther: { backgroundColor: '#9333EA', borderColor: '#9333EA' },
  seatBoxText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.text },
  seatBoxTextSelected: { color: C.white },
  exitRowIndicator: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 4,
    borderRadius: 6,
    marginVertical: 6,
    alignItems: 'center',
  },
  exitText: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: C.red },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
  sectionSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight, marginTop: 2, marginBottom: 8 },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  mealCardActive: { borderColor: C.purple, backgroundColor: '#FAF5FF' },
  mealIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  mealTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  mealPrice: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.green, marginTop: 2 },
  bagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  bagCardActive: { borderColor: C.purple, backgroundColor: '#FAF5FF' },
  bagTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  bagPrice: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.green, marginTop: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { backgroundColor: C.purple, borderColor: C.purple },
  insurCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  insurHead: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  insurSub: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.green, marginTop: 2 },
  insurPerks: { marginTop: 14, gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.text },
  insurToggle: {
    marginTop: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: C.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  insurToggleActive: { backgroundColor: C.green },
  insurToggleText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.green },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textLight },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
  continueBtn: {
    backgroundColor: C.orange,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  continueBtnText: { color: C.white, fontSize: 14, fontFamily: 'Inter_700Bold' },
});
