import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useAuth } from '@/context/AuthContext';
import { TravelScreen } from './TravelScreen';
import { FlightsScreen, type FlightSearchParams } from './FlightsScreen';
import { FlightResultsScreen, type FlightResult } from './FlightResultsScreen';
import { FareOptionsScreen } from './FareOptionsScreen';
import { FlightPassengerScreen, type FlightContactInfo, type FlightPassenger } from './FlightPassengerScreen';
import { FlightAddonsScreen, type SelectedFlightAddons } from './FlightAddonsScreen';
import { FlightReviewAndPayScreen } from './FlightReviewAndPayScreen';
import { FlightSuccessScreen } from './FlightSuccessScreen';
import { BusTicketsScreen } from './BusTicketsScreen';
import { BusResultsScreen, type BusTicket } from './BusResultsScreen';
import { SeatSelectionScreen, type Seat } from './SeatSelectionScreen';
import { BoardingPointsScreen, type StopPoint } from './BoardingPointsScreen';
import { PassengerDetailsScreen } from './PassengerDetailsScreen';
import { MyTicketsScreen } from './MyTicketsScreen';
import { HotelsScreen } from './HotelsScreen';
import { HotelResultsScreen } from './HotelResultsScreen';
import { HotelDetailScreen } from './HotelDetailScreen';
import { HotelGuestScreen } from './HotelGuestScreen';
import { HotelReviewAndPayScreen, type HotelGuestData, type HotelBookingConfirmation } from './HotelReviewAndPayScreen';
import { HotelSuccessScreen } from './HotelSuccessScreen';
import type { Hotel, HotelRoom, HotelSearchParams } from './hotelData';
import type { TBOBookingConfirmation } from '../../services/tboService';
import { ServiceCategoryScreen } from './BillsScreen';
import { BillPayScreen } from './BillPayScreen';
import type { BillKind } from './billData';
import { serviceColors } from './serviceColors';
import { voiceService } from '@/services/voiceService';
import { setServicesController } from '@/services/assistant/bridge';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { T, useThemedStyles } from './themed';

export type ServiceView =
  | 'travel'
  | 'flights'
  | 'flightResults'
  | 'flightFares'
  | 'flightPassenger'
  | 'flightAddons'
  | 'flightReviewPay'
  | 'flightSuccess'
  | 'busTickets'
  | 'myTickets'
  | 'busResults'
  | 'busSeats'
  | 'busPoints'
  | 'busPassenger'
  | 'hotels'
  | 'hotelResults'
  | 'hotelDetail'
  | 'hotelGuest'
  | 'hotelReviewPay'
  | 'hotelSuccess'
  | 'bills'
  | 'recharge'
  | 'finance'
  | 'billPay';

const DEFAULT_BACK: Partial<Record<ServiceView, ServiceView | 'hub'>> = {
  travel: 'hub',
  flights: 'travel',
  flightResults: 'flights',
  flightFares: 'flightResults',
  flightPassenger: 'flightFares',
  flightAddons: 'flightPassenger',
  flightReviewPay: 'flightAddons',
  flightSuccess: 'flights',
  busTickets: 'travel',
  myTickets: 'busTickets',
  busResults: 'busTickets',
  busSeats: 'busResults',
  busPoints: 'busSeats',
  busPassenger: 'busPoints',
  hotels: 'travel',
  hotelResults: 'hotels',
  hotelDetail: 'hotelResults',
  hotelGuest: 'hotelDetail',
  hotelReviewPay: 'hotelGuest',
  hotelSuccess: 'hotels',
  bills: 'hub',
  recharge: 'hub',
  finance: 'hub',
  billPay: 'bills',
};

const CABIN_CLASS = { economy: 2, premium_economy: 3, business: 4, first: 6 } as const;
const CABIN_LABEL = {
  economy: 'Economy / Premium Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
} as const;

/** "2026-10-05" → "5 Oct 2026" (the flight screens' label format). */
function isoToFlightLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })} ${d.getFullYear()}`;
}

/** "2026-10-05" → "Mon, 5 Oct" (the hotel and bus screens' label format). */
function isoToShortLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function ServicesFlow({
  initialView,
  initialBillKind,
}: {
  initialView: ServiceView;
  initialBillKind?: BillKind;
}) {
  const styles = use_styles();
  const router = useRouter();
  const agentPrefill = useAgentPrefill();
  const { session } = useAuth();
  const [view, setView] = useState<ServiceView>(initialView);
  const [hubReturn, setHubReturn] = useState<Partial<Record<ServiceView, ServiceView | 'hub'>>>({});
  const [billKind, setBillKind] = useState<BillKind>(initialBillKind ?? 'electricity');
  // Flight states
  const [flightSearch, setFlightSearch] = useState<FlightSearchParams>({
    from: '',
    to: '',
    dateLabel: '',
    travellers: '1 Adult',
    cabin: 'Economy / Premium Economy',
    fromCode: '',
    toCode: '',
    departDate: '',
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: 2,
  });

  // Only a completed search carries the codes/date the TBO API needs.
  const flightSearchQuery = useMemo(
    () =>
      flightSearch.fromCode && flightSearch.toCode && flightSearch.departDate
        ? {
            origin: flightSearch.fromCode,
            destination: flightSearch.toCode,
            departDate: flightSearch.departDate,
            returnDate: flightSearch.returnDate,
            adults: flightSearch.adults,
            children: flightSearch.children,
            infants: flightSearch.infants,
            cabinClass: flightSearch.cabinClass,
          }
        : undefined,
    [flightSearch],
  );
  const [selectedFlight, setSelectedFlight] = useState<FlightResult | null>(null);
  const [selectedFareKey, setSelectedFareKey] = useState<string>('wishspecial');
  const [flightPassengers, setFlightPassengers] = useState<FlightPassenger[]>([]);
  const [flightContact, setFlightContact] = useState<FlightContactInfo>({
    email: 'traveler@wishme.in',
    phone: '9876543210',
    gstEnabled: false,
  });
  const [flightAddons, setFlightAddons] = useState<SelectedFlightAddons>({
    seats: [],
    meals: [],
    extraBaggageKg: 0,
    insurance: true,
  });
  const [flightConfirmation, setFlightConfirmation] = useState<TBOBookingConfirmation | null>(null);

  // Bus states
  const [busSearch, setBusSearch] = useState({ from: '', to: '', dateLabel: 'Today' });
  const [selectedBus, setSelectedBus] = useState<BusTicket | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [busPoints, setBusPoints] = useState<{ boarding: StopPoint; dropping: StopPoint } | null>(null);

  // Hotel states
  const [hotelSearch, setHotelSearch] = useState<HotelSearchParams>({
    city: '',
    checkIn: 'Tonight',
    checkOut: 'Tomorrow',
    nights: 1,
    rooms: 1,
    adults: 2,
    children: 0,
  });
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedHotelRoom, setSelectedHotelRoom] = useState<HotelRoom | null>(null);
  const [hotelGuestData, setHotelGuestData] = useState<HotelGuestData | null>(null);
  const [hotelConfirmation, setHotelConfirmation] = useState<HotelBookingConfirmation | null>(null);

  // Auto-fill from agent prefill without jumping away from the section search screen
  useEffect(() => {
    if (agentPrefill.billKind) setBillKind(agentPrefill.billKind as BillKind);
    if (agentPrefill.fromCity || agentPrefill.toCity || agentPrefill.travelDate) {
      setFlightSearch((prev) => ({
        ...prev,
        from: agentPrefill.fromCity ? `${agentPrefill.fromCity}` : prev.from,
        to: agentPrefill.toCity ? `${agentPrefill.toCity}` : prev.to,
        dateLabel: agentPrefill.travelDate ?? prev.dateLabel,
        travellers: agentPrefill.travellers ?? prev.travellers,
        cabin: agentPrefill.cabin ?? prev.cabin,
      }));
    }
    if (agentPrefill.busFrom || agentPrefill.busTo || agentPrefill.busDate) {
      setBusSearch((prev) => ({
        ...prev,
        from: agentPrefill.busFrom ?? prev.from,
        to: agentPrefill.busTo ?? prev.to,
        dateLabel: agentPrefill.busDate ?? prev.dateLabel,
      }));
    }
    if (agentPrefill.hotelCity || agentPrefill.checkIn || agentPrefill.checkOut) {
      setHotelSearch((prev) => ({
        ...prev,
        city: agentPrefill.hotelCity ?? prev.city,
        checkIn: agentPrefill.checkIn ?? prev.checkIn,
        checkOut: agentPrefill.checkOut ?? prev.checkOut,
        rooms: agentPrefill.rooms ?? prev.rooms,
        adults: agentPrefill.adults ?? prev.adults,
      }));
    }
  }, [agentPrefill]);

  useEffect(() => {
    setView(initialView);
    if (initialBillKind) setBillKind(initialBillKind);
    if (initialView === 'billPay') {
      setHubReturn((prev) => ({ ...prev, billPay: 'hub' }));
    } else if (
      initialView === 'flights' ||
      initialView === 'hotels' ||
      initialView === 'busTickets'
    ) {
      setHubReturn((prev) => ({ ...prev, [initialView]: 'hub' }));
    }
  }, [initialView, initialBillKind]);

  const goHub = () => {
    voiceService.stop();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/all-services');
  };

  const rememberReturn = (screen: ServiceView, backTo: ServiceView | 'hub') => {
    setHubReturn((prev) => ({ ...prev, [screen]: backTo }));
  };

  const openScreen = (next: ServiceView, backTo: ServiceView | 'hub') => {
    rememberReturn(next, backTo);
    setView(next);
  };

  const backFrom = (screen: ServiceView) => {
    const target = hubReturn[screen] ?? DEFAULT_BACK[screen] ?? 'hub';
    if (target === 'hub') goHub();
    else setView(target);
  };

  const openBill = (kind: BillKind, backTo: ServiceView | 'hub') => {
    setBillKind(kind);
    rememberReturn('billPay', backTo);
    setView('billPay');
  };

  // Voice assistant control: search and pick fares without touching the screen.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    setServicesController({
      searchFlights: (r) => {
        const travellers = [
          `${r.adults} Adult${r.adults !== 1 ? 's' : ''}`,
          r.children > 0 ? `${r.children} Child${r.children !== 1 ? 'ren' : ''}` : '',
          r.infants > 0 ? `${r.infants} Infant${r.infants !== 1 ? 's' : ''}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        setFlightSearch({
          from: `${r.fromCity} (${r.fromCode})`,
          to: `${r.toCity} (${r.toCode})`,
          dateLabel: isoToFlightLabel(r.date),
          travellers,
          cabin: CABIN_LABEL[r.cabin],
          fromCode: r.fromCode,
          toCode: r.toCode,
          departDate: r.date,
          adults: r.adults,
          children: r.children,
          infants: r.infants,
          cabinClass: CABIN_CLASS[r.cabin],
        });
        setHubReturn((prev) => ({ ...prev, flights: prev.flights ?? 'hub' }));
        setView('flightResults');
      },
      searchHotels: (r) => {
        const nights = Math.max(
          1,
          Math.round(
            (new Date(`${r.checkOut}T00:00:00`).getTime() - new Date(`${r.checkIn}T00:00:00`).getTime()) /
              86_400_000,
          ),
        );
        setHotelSearch({
          city: r.city,
          checkIn: isoToShortLabel(r.checkIn),
          checkOut: isoToShortLabel(r.checkOut),
          nights,
          rooms: r.rooms,
          adults: r.adults,
          children: r.children,
        });
        setHubReturn((prev) => ({ ...prev, hotels: prev.hotels ?? 'hub' }));
        setView('hotelResults');
      },
      searchBuses: (r) => {
        setBusSearch({ from: r.from, to: r.to, dateLabel: isoToShortLabel(r.date) });
        setHubReturn((prev) => ({ ...prev, busTickets: prev.busTickets ?? 'hub' }));
        setView('busResults');
      },
      openBill: (kind) => {
        setBillKind(kind as BillKind);
        setHubReturn((prev) => ({ ...prev, billPay: prev.billPay ?? 'hub' }));
        setView('billPay');
      },
      selectFare: (fareKey) => {
        if (viewRef.current !== 'flightFares') return false;
        setSelectedFareKey(fareKey ?? 'wishspecial');
        setView('flightPassenger');
        return true;
      },
    });
    return () => setServicesController(null);
  }, []);

  const rootStyle = styles.root;

  const renderContent = () => {
    // ─── Bus Flow ─────────────────────────────────────────────────────────────
    if (
      (view === 'busSeats' || view === 'busPoints' || view === 'busPassenger') &&
      selectedBus
    ) {
      return (
        <View style={rootStyle}>
          <SeatSelectionScreen
            bus={selectedBus}
            onBack={() => setView('busResults')}
            onContinue={(seats) => {
              setSelectedSeats(seats);
              setView('busPoints');
            }}
          />
          {(view === 'busPoints' || view === 'busPassenger') && (
            <AmbientBackground>
              <BoardingPointsScreen
                bus={selectedBus}
                from={busSearch.from}
                to={busSearch.to}
                onBack={() => setView('busSeats')}
                onFillInfo={(boarding, dropping) => {
                  setBusPoints({ boarding, dropping });
                  setView('busPassenger');
                }}
              />
            </AmbientBackground>
          )}
          {view === 'busPassenger' && busPoints && (
            <AmbientBackground>
              <PassengerDetailsScreen
                bus={selectedBus}
                seats={selectedSeats}
                boarding={busPoints.boarding}
                dropping={busPoints.dropping}
                onBack={() => setView('busPoints')}
              />
            </AmbientBackground>
          )}
        </View>
      );
    }

    if (view === 'busResults') {
      return (
        <View style={rootStyle}>
          <BusResultsScreen
            from={busSearch.from}
            to={busSearch.to}
            dateLabel={busSearch.dateLabel}
            onBack={() => setView('busTickets')}
            onSelectBus={(bus) => {
              setSelectedBus(bus);
              setView('busSeats');
            }}
          />
        </View>
      );
    }

    if (view === 'myTickets') {
      return (
        <View style={rootStyle}>
          <MyTicketsScreen onBack={() => setView('busTickets')} />
        </View>
      );
    }

    if (view === 'busTickets') {
      return (
        <View style={rootStyle}>
          <BusTicketsScreen
            onBack={() => backFrom('busTickets')}
            onSearch={(from, to, dateLabel) => {
              setBusSearch({ from, to, dateLabel });
              setView('busResults');
            }}
            onOpenMyTickets={() => setView('myTickets')}
          />
        </View>
      );
    }

    // ─── Flight Flow ──────────────────────────────────────────────────────────
    if (view === 'flightSuccess' && selectedFlight && flightConfirmation) {
      return (
        <View style={rootStyle}>
          <FlightSuccessScreen
            flight={selectedFlight}
            fromCode={flightSearch.from}
            toCode={flightSearch.to}
            dateLabel={flightSearch.dateLabel}
            passengers={flightPassengers}
            contact={flightContact}
            addons={flightAddons}
            confirmation={flightConfirmation}
            onDone={() => setView('flights')}
          />
        </View>
      );
    }

    if (view === 'flightReviewPay' && selectedFlight) {
      return (
        <View style={rootStyle}>
          <FlightReviewAndPayScreen
            flight={selectedFlight}
            fareKey={selectedFareKey}
            passengers={flightPassengers}
            contact={flightContact}
            addons={flightAddons}
            onBack={() => setView('flightAddons')}
            onBookingSuccess={(confirmation: TBOBookingConfirmation) => {
              setFlightConfirmation(confirmation);
              setView('flightSuccess');
            }}
          />
        </View>
      );
    }

    if (view === 'flightAddons' && selectedFlight) {
      return (
        <View style={rootStyle}>
          <FlightAddonsScreen
            flight={selectedFlight}
            passengers={flightPassengers}
            onBack={() => setView('flightPassenger')}
            onContinue={(addons) => {
              setFlightAddons(addons);
              setView('flightReviewPay');
            }}
          />
        </View>
      );
    }

    if (view === 'flightPassenger' && selectedFlight) {
      return (
        <View style={rootStyle}>
          <FlightPassengerScreen
            flight={selectedFlight}
            fareKey={selectedFareKey}
            adultsCount={parseInt(flightSearch.travellers) || 1}
            onBack={() => setView('flightFares')}
            onContinue={(passengers, contact) => {
              setFlightPassengers(passengers);
              setFlightContact(contact);
              setView('flightAddons');
            }}
          />
        </View>
      );
    }

    if (view === 'flightFares' && selectedFlight) {
      return (
        <View style={rootStyle}>
          <FareOptionsScreen
            flight={selectedFlight}
            fromCode={flightSearch.from}
            toCode={flightSearch.to}
            dateLabel={flightSearch.dateLabel}
            onBack={() => setView('flightResults')}
            onSelectFare={(fareKey) => {
              setSelectedFareKey(fareKey);
              setView('flightPassenger');
            }}
          />
        </View>
      );
    }

    if (view === 'flightResults') {
      return (
        <View style={rootStyle}>
          <FlightResultsScreen
            from={flightSearch.from}
            to={flightSearch.to}
            dateLabel={flightSearch.dateLabel}
            travellers={flightSearch.travellers}
            cabin={flightSearch.cabin}
            search={flightSearchQuery}
            accessToken={session?.access_token}
            onBack={() => setView('flights')}
            onViewPrices={(flight) => {
              setSelectedFlight(flight);
              setView('flightFares');
            }}
          />
        </View>
      );
    }

    if (view === 'flights') {
      return (
        <View style={rootStyle}>
          <FlightsScreen
            initialSearch={flightSearch}
            onBack={() => backFrom('flights')}
            onSearch={(params) => {
              setFlightSearch(params);
              setView('flightResults');
            }}
          />
        </View>
      );
    }

    // ─── Hotel Flow ───────────────────────────────────────────────────────────
    if (view === 'hotelSuccess' && hotelConfirmation) {
      return (
        <View style={rootStyle}>
          <HotelSuccessScreen
            confirmation={hotelConfirmation}
            onDone={() => setView('hotels')}
          />
        </View>
      );
    }

    if (view === 'hotelReviewPay' && selectedHotel && selectedHotelRoom && hotelGuestData) {
      return (
        <View style={rootStyle}>
          <HotelReviewAndPayScreen
            hotel={selectedHotel}
            room={selectedHotelRoom}
            search={hotelSearch}
            guest={hotelGuestData}
            onBack={() => setView('hotelGuest')}
            onPaymentSuccess={(confirmation) => {
              setHotelConfirmation(confirmation);
              setView('hotelSuccess');
            }}
          />
        </View>
      );
    }

    if (view === 'hotelGuest' && selectedHotel && selectedHotelRoom) {
      return (
        <View style={rootStyle}>
          <HotelGuestScreen
            hotel={selectedHotel}
            room={selectedHotelRoom}
            search={hotelSearch}
            onBack={() => setView('hotelDetail')}
            onDone={() => setView('hotels')}
            onContinue={(guest) => {
              setHotelGuestData(guest);
              setView('hotelReviewPay');
            }}
          />
        </View>
      );
    }

    if (view === 'hotelDetail' && selectedHotel) {
      return (
        <View style={rootStyle}>
          <HotelDetailScreen
            hotel={selectedHotel}
            search={hotelSearch}
            onBack={() => setView('hotelResults')}
            onContinue={(room) => {
              setSelectedHotelRoom(room);
              setView('hotelGuest');
            }}
          />
        </View>
      );
    }

    if (view === 'hotelResults') {
      return (
        <View style={rootStyle}>
          <HotelResultsScreen
            search={hotelSearch}
            onBack={() => setView('hotels')}
            onSelectHotel={(hotel) => {
              setSelectedHotel(hotel);
              setView('hotelDetail');
            }}
          />
        </View>
      );
    }

    if (view === 'hotels') {
      return (
        <View style={rootStyle}>
          <HotelsScreen
            onBack={() => backFrom('hotels')}
            onSearch={(params) => {
              setHotelSearch(params);
              setView('hotelResults');
            }}
          />
        </View>
      );
    }

    // ─── Bills & Finance ──────────────────────────────────────────────────────
    if (view === 'billPay') {
      return (
        <View style={rootStyle}>
          <BillPayScreen kind={billKind} onBack={() => backFrom('billPay')} />
        </View>
      );
    }

    if (view === 'bills' || view === 'recharge' || view === 'finance') {
      return (
        <View style={rootStyle}>
          <ServiceCategoryScreen
            group={view}
            onBack={goHub}
            onOpenBill={(kind) => openBill(kind, view)}
          />
        </View>
      );
    }

    return (
      <View style={rootStyle}>
        <TravelScreen
          onBack={goHub}
          onOpenBus={() => openScreen('busTickets', 'travel')}
          onOpenFlights={() => openScreen('flights', 'travel')}
          onOpenHotels={() => openScreen('hotels', 'travel')}
        />
      </View>
    );
  };

  return (
    <AmbientBackground>
      <View style={rootStyle}>
        {renderContent()}
      </View>
    </AmbientBackground>
  );
}

const make_styles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(serviceColors.pageBg, 'page') },
});
const use_styles = () => useThemedStyles(make_styles);
