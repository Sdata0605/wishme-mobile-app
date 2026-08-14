import React from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import {
  Banknote,
  Bus,
  Car,
  ChevronRight,
  CreditCard,
  Droplet,
  Flame,
  Hotel as HotelIcon,
  Plane,
  ShieldCheck,
  Smartphone,
  Tv,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import type { BillKind } from '@/components/all-services/billData';
import type { ServiceView } from '@/components/all-services/ServicesFlow';

import { serviceColors as C } from './serviceColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HomeAction =
  | { type: 'bill'; kind: BillKind }
  | { type: 'screen'; view: ServiceView };

interface ServiceItem {
  name: string;
  Icon: LucideIcon;
  color: string;
  bgColor: string;
  action: HomeAction;
}

const HOME_SERVICES: ServiceItem[] = [
  { name: 'Flights', Icon: Plane, color: C.purple, bgColor: '#F5F3FF', action: { type: 'screen', view: 'flights' } },
  { name: 'Hotels', Icon: HotelIcon, color: C.purple, bgColor: '#F5F3FF', action: { type: 'screen', view: 'hotels' } },
  { name: 'Bus', Icon: Bus, color: C.purple, bgColor: '#F5F3FF', action: { type: 'screen', view: 'busTickets' } },
  { name: 'Electricity', Icon: Zap, color: '#D97706', bgColor: '#FFFBEB', action: { type: 'bill', kind: 'electricity' } },
  { name: 'Water', Icon: Droplet, color: '#2563EB', bgColor: '#EFF6FF', action: { type: 'bill', kind: 'water' } },
  { name: 'Gas', Icon: Flame, color: C.orange, bgColor: '#FFF7ED', action: { type: 'bill', kind: 'gas' } },
  { name: 'Mobile', Icon: Smartphone, color: C.purple, bgColor: '#F5F3FF', action: { type: 'bill', kind: 'mobile' } },
  { name: 'DTH', Icon: Tv, color: '#374151', bgColor: '#F9FAFB', action: { type: 'bill', kind: 'dth' } },
  { name: 'FASTag', Icon: Car, color: C.orange, bgColor: '#FFF7ED', action: { type: 'bill', kind: 'fastag' } },
  { name: 'Broadband', Icon: Wifi, color: C.purple, bgColor: '#F5F3FF', action: { type: 'bill', kind: 'broadband' } },
  { name: 'Credit Card', Icon: CreditCard, color: C.orange, bgColor: '#FFF7ED', action: { type: 'bill', kind: 'creditCard' } },
  { name: 'Loan EMI', Icon: Banknote, color: C.green, bgColor: '#ECFDF5', action: { type: 'bill', kind: 'loanEmi' } },
  { name: 'Insurance', Icon: ShieldCheck, color: C.green, bgColor: '#ECFDF5', action: { type: 'bill', kind: 'insurance' } },
];

const COL_W = (SCREEN_WIDTH - 48) / 6;

function pushService(action: HomeAction) {
  if (action.type === 'bill') {
    router.push({
      pathname: '/services',
      params: { start: 'billPay', kind: action.kind },
    } as Href);
    return;
  }
  router.push({ pathname: '/services', params: { start: action.view } } as Href);
}

function ServiceCell({ item }: { item: ServiceItem }) {
  return (
    <TouchableOpacity
      style={[styles.cell, { width: COL_W }]}
      activeOpacity={0.75}
      onPress={() => pushService(item.action)}
    >
      <View style={[styles.iconBg, { backgroundColor: item.bgColor }]}>
        <item.Icon size={20} color={item.color} />
      </View>
      <Text style={styles.cellLabel}>{item.name}</Text>
    </TouchableOpacity>
  );
}

/** Wish-Me home All Services grid — replaces Quick Actions on WishMe-UI home. */
export function HomeAllServicesSection() {
  const rows: ServiceItem[][] = [];
  for (let i = 0; i < HOME_SERVICES.length; i += 6) {
    rows.push(HOME_SERVICES.slice(i, i + 6));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Services</Text>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => router.push('/(tabs)/all-services')}
        >
          <Text style={styles.exploreText}>Explore All</Text>
          <ChevronRight size={14} color={C.purple} />
        </TouchableOpacity>
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((item) => (
            <ServiceCell key={item.name} item={item} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  exploreText: { fontSize: 13, color: C.purple, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', marginBottom: 12 },
  cell: { alignItems: 'center' },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  cellLabel: {
    fontSize: 9.5,
    color: C.text,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 13,
  },
});
