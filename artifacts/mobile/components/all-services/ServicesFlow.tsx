import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TravelScreen } from './TravelScreen';
import { FlightsScreen, type FlightSearchParams } from './FlightsScreen';
import { FlightResultsScreen, type FlightResult } from './FlightResultsScreen';
import { FareOptionsScreen } from './FareOptionsScreen';
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
import type { Hotel, HotelRoom, HotelSearchParams } from './hotelData';
import { ServiceCategoryScreen } from './BillsScreen';
import { BillPayScreen } from './BillPayScreen';
import type { BillKind } from './billData';
import { serviceColors } from './serviceColors';

export type ServiceView =
  | 'travel'
  | 'flights'
  | 'flightResults'
  | 'flightFares'
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
  | 'bills'
  | 'recharge'
  | 'finance'
  | 'billPay';

const DEFAULT_BACK: Partial<Record<ServiceView, ServiceView | 'hub'>> = {
  travel: 'hub',
  flights: 'travel',
  flightResults: 'flights',
  flightFares: 'flightResults',
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
  bills: 'hub',
  recharge: 'hub',
  finance: 'hub',
  billPay: 'bills',
};

export function ServicesFlow({
  initialView,
  initialBillKind,
}: {
  initialView: ServiceView;
  initialBillKind?: BillKind;
}) {
  const router = useRouter();
  const [view, setView] = useState<ServiceView>(initialView);
  const [hubReturn, setHubReturn] = useState<Partial<Record<ServiceView, ServiceView | 'hub'>>>({});
  const [billKind, setBillKind] = useState<BillKind>(initialBillKind ?? 'electricity');
  const [flightSearch, setFlightSearch] = useState<FlightSearchParams>({
    from: 'New Delhi (DEL)',
    to: 'Mumbai (BOM)',
    dateLabel: '',
    travellers: '1 Adult',
    cabin: 'Economy / Premium Economy',
  });
  const [selectedFlight, setSelectedFlight] = useState<FlightResult | null>(null);
  const [busSearch, setBusSearch] = useState({ from: 'Delhi', to: 'Jaipur', dateLabel: 'Today' });
  const [selectedBus, setSelectedBus] = useState<BusTicket | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [busPoints, setBusPoints] = useState<{ boarding: StopPoint; dropping: StopPoint } | null>(
    null,
  );
  const [hotelSearch, setHotelSearch] = useState<HotelSearchParams>({
    city: 'Goa',
    checkIn: 'Tonight',
    checkOut: 'Tomorrow',
    nights: 1,
    rooms: 1,
    adults: 2,
    children: 0,
  });
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedHotelRoom, setSelectedHotelRoom] = useState<HotelRoom | null>(null);

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

  const rootStyle = styles.root;

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
          <View style={StyleSheet.absoluteFill}>
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
          </View>
        )}
        {view === 'busPassenger' && busPoints && (
          <View style={StyleSheet.absoluteFill}>
            <PassengerDetailsScreen
              bus={selectedBus}
              seats={selectedSeats}
              boarding={busPoints.boarding}
              dropping={busPoints.dropping}
              onBack={() => setView('busPoints')}
            />
          </View>
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

  if (view === 'flightFares' && selectedFlight) {
    return (
      <View style={rootStyle}>
        <FareOptionsScreen
          flight={selectedFlight}
          fromCode={flightSearch.from}
          toCode={flightSearch.to}
          dateLabel={flightSearch.dateLabel}
          onBack={() => setView('flightResults')}
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
          onBack={() => backFrom('flights')}
          onSearch={(params) => {
            setFlightSearch(params);
            setView('flightResults');
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

  if (view === 'hotelGuest' && selectedHotel && selectedHotelRoom) {
    return (
      <View style={rootStyle}>
        <HotelGuestScreen
          hotel={selectedHotel}
          room={selectedHotelRoom}
          search={hotelSearch}
          onBack={() => setView('hotelDetail')}
          onDone={() => setView('hotels')}
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
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: serviceColors.pageBg },
});
