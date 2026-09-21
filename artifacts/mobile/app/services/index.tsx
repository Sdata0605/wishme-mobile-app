import React, { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ServicesFlow,
  type ServiceView,
} from '@/components/all-services/ServicesFlow';
import type { BillKind } from '@/components/all-services/billData';

const VALID_VIEWS = new Set<ServiceView>([
  'travel',
  'flights',
  'flightResults',
  'flightFares',
  'flightPassenger',
  'flightAddons',
  'flightReviewPay',
  'flightSuccess',
  'busTickets',
  'myTickets',
  'busResults',
  'busSeats',
  'busPoints',
  'busPassenger',
  'hotels',
  'hotelResults',
  'hotelDetail',
  'hotelGuest',
  'hotelReviewPay',
  'hotelSuccess',
  'bills',
  'recharge',
  'finance',
  'billPay',
]);

export default function ServicesRoute() {
  const params = useLocalSearchParams<{ start?: string; kind?: string }>();

  const initialView = useMemo<ServiceView>(() => {
    const start = params.start;
    if (start && VALID_VIEWS.has(start as ServiceView)) return start as ServiceView;
    return 'travel';
  }, [params.start]);

  const initialBillKind = useMemo<BillKind | undefined>(() => {
    return params.kind as BillKind | undefined;
  }, [params.kind]);

  return <ServicesFlow initialView={initialView} initialBillKind={initialBillKind} />;
}
