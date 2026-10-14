import React, { useState } from 'react';
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
  CheckCircle2,
  Circle,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import type { BusTicket } from './BusResultsScreen';

import { serviceColors as C } from './serviceColors';
import { withAlpha } from '@/constants/neon';
import { T, useThemedStyles, glass, dockBar, dk, N } from './themed';
import { BrandFill } from './BrandFill';

export interface StopPoint {
  id: string;
  name: string;
  landmark: string;
  time: string;
}

const BOARDING_POINTS: StopPoint[] = [
  { id: 'b1', name: 'Borivali East', landmark: 'Near National Park Gate, Western Express Hwy', time: '21:00' },
  { id: 'b2', name: 'Andheri East', landmark: 'Opp. Metro Station Gate 2, WEH', time: '21:25' },
  { id: 'b3', name: 'Bandra Kurla Complex', landmark: 'MTNL Building, BKC Road', time: '21:45' },
  { id: 'b4', name: 'Sion Circle', landmark: 'Near Sion Hospital bus stop', time: '22:05' },
  { id: 'b5', name: 'Chembur', landmark: 'Diamond Garden, Eastern Express Hwy', time: '22:20' },
  { id: 'b6', name: 'Vashi Plaza', landmark: 'Sector 17, opp. Vashi Bus Depot', time: '22:40' },
];

const DROPPING_POINTS: StopPoint[] = [
  { id: 'd1', name: 'Wakad Bridge', landmark: 'Below flyover, near Datta Mandir', time: '05:05' },
  { id: 'd2', name: 'Hinjewadi Phase 1', landmark: 'Infosys Circle, Rajiv Gandhi Infotech Park', time: '05:15' },
  { id: 'd3', name: 'Baner', landmark: 'Baner Road, near Sadanand Hotel', time: '05:30' },
  { id: 'd4', name: 'Shivajinagar', landmark: 'Opp. Shivajinagar ST Bus Stand', time: '05:50' },
  { id: 'd5', name: 'Swargate', landmark: 'Swargate Bus Depot main gate', time: '06:10' },
  { id: 'd6', name: 'Hadapsar', landmark: 'Gadital bus stop, Pune-Solapur Rd', time: '06:30' },
];

function StopRow({
  stop,
  selected,
  onPress,
  accent,
}: {
  stop: StopPoint;
  selected: boolean;
  onPress: () => void;
  accent: string;
}) {
  const st = use_st();
  return (
    <TouchableOpacity
      style={[st.stopRow, selected && { borderColor: accent, backgroundColor: dk(withAlpha(accent, 0.1), '#FFFDF9') }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {selected ? (
        <CheckCircle2 size={20} color={accent} />
      ) : (
        <Circle size={20} color={T(C.gray, 'fg')} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={st.stopName}>{stop.name}</Text>
        <Text style={st.stopLandmark}>{stop.landmark}</Text>
      </View>
      <Text style={[st.stopTime, selected && { color: accent }]}>{stop.time}</Text>
    </TouchableOpacity>
  );
}

export function BoardingPointsScreen({
  bus,
  from,
  to,
  onBack,
  onFillInfo,
}: {
  bus: BusTicket;
  from: string;
  to: string;
  onBack: () => void;
  onFillInfo: (boarding: StopPoint, dropping: StopPoint) => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [boarding, setBoarding] = useState<StopPoint | null>(null);
  const [dropping, setDropping] = useState<StopPoint | null>(null);

  const ready = boarding !== null && dropping !== null;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={[st.headerBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View>
          <Text style={st.headerTitle}>Boarding & dropping points</Text>
          <Text style={st.headerSub}>
            {bus.company} · {from} → {to}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* Boarding points */}
        <View style={st.sectionHead}>
          <View style={[st.sectionIcon, { backgroundColor: T('#F5F0FF', 'bg') }]}>
            <Navigation size={15} color={T(C.orange, 'fg')} />
          </View>
          <View>
            <Text style={st.sectionTitle}>Boarding points</Text>
            <Text style={st.sectionSub}>Where you get on in {from}</Text>
          </View>
        </View>
        <View style={st.listWrap}>
          {BOARDING_POINTS.map((s) => (
            <StopRow
              key={s.id}
              stop={s}
              selected={boarding?.id === s.id}
              onPress={() => setBoarding(boarding?.id === s.id ? null : s)}
              accent={dk(N().cyan, C.orange)}
            />
          ))}
        </View>

        {/* Dropping points */}
        <View style={[st.sectionHead, { marginTop: 20 }]}>
          <View style={[st.sectionIcon, { backgroundColor: T('#ECFDF5', 'bg') }]}>
            <MapPin size={15} color={T(C.green, 'fg')} />
          </View>
          <View>
            <Text style={st.sectionTitle}>Dropping points</Text>
            <Text style={st.sectionSub}>Where you get off in {to}</Text>
          </View>
        </View>
        <View style={st.listWrap}>
          {DROPPING_POINTS.map((s) => (
            <StopRow
              key={s.id}
              stop={s}
              selected={dropping?.id === s.id}
              onPress={() => setDropping(dropping?.id === s.id ? null : s)}
              accent={dk(N().success, C.green)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.footerLine} numberOfLines={1}>
            <Text style={{ color: T(C.orange, 'fg') }}>{boarding ? boarding.name : 'Pick boarding'}</Text>
            {'  →  '}
            <Text style={{ color: T(C.green, 'fg') }}>{dropping ? dropping.name : 'Pick dropping'}</Text>
          </Text>
          <Text style={st.footerSub}>
            {ready ? `${boarding!.time} board · ${dropping!.time} drop` : 'Select one of each to continue'}
          </Text>
        </View>
        <TouchableOpacity
          style={[st.confirmBtn, !ready && st.confirmDisabled]}
          activeOpacity={0.85}
          disabled={!ready}
          onPress={() => ready && onFillInfo(boarding!, dropping!)}
        ><BrandFill />
          <Text style={st.confirmText}>Fill passenger information</Text>
          <ArrowRight size={15} color={T(C.white, 'fg')} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: T(C.white, 'page'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'page'),
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  sectionSub: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  listWrap: { paddingHorizontal: 14, gap: 8 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1.5,
    borderColor: T(C.border, 'border'),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
   ...glass(18), },
  stopName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  stopLandmark: {
    fontSize: 10.5,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    marginTop: 2,
  },
  stopTime: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: T(C.textLight, 'fg') },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 16,
    paddingTop: 12,
   ...dockBar(), },
  footerLine: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  footerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
   overflow: 'hidden', },
  confirmDisabled: { backgroundColor: T('#E9D5FF', 'bg') },
  confirmText: { color: T(C.white, 'fg'), fontSize: 13.5, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
