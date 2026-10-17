/**
 * Demo flight data, used when the live TBO flights service cannot be reached.
 *
 * Nothing here talks to an airline: searches return made-up fares, a "booking" returns a made-up PNR and no ticket is
 * issued. Every demo fare carries a trace id starting with `DEMO-`, so the screens can say plainly that it is a demo
 * and the booking step knows never to call the real service for it.
 */

import { resolveAirport } from '@/services/assistant/cities';
import type {
  TBOBookingConfirmation,
  TBOFareQuote,
  TBOFlight,
  TBOMealltem,
  TBOSearchResult,
  TBOSeatItem,
} from '@/services/tboService';

export const DEMO_PREFIX = 'DEMO-';

export const isDemoTrace = (traceId?: string | null) => !!traceId && traceId.startsWith(DEMO_PREFIX);

/** Small, stable number from a string, so the same search always shows the same flights. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded random in [0, 1), advancing with every call. */
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (mins: number) => `${pad(Math.floor((mins % 1440) / 60))}:${pad(mins % 60)}`;
const lengthOf = (mins: number) => `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;

const AIRLINES = [
  { name: 'IndiGo', code: '6E', logo: '🟦', lcc: true, craft: 'Airbus A320neo', bag: '15 kg', cabin: '7 kg' },
  { name: 'Air India', code: 'AI', logo: '🟥', lcc: false, craft: 'Airbus A321', bag: '25 kg', cabin: '8 kg' },
  { name: 'Akasa Air', code: 'QP', logo: '🟧', lcc: true, craft: 'Boeing 737 MAX 8', bag: '15 kg', cabin: '7 kg' },
  { name: 'SpiceJet', code: 'SG', logo: '🟨', lcc: true, craft: 'Boeing 737-800', bag: '15 kg', cabin: '7 kg' },
  { name: 'Air India Express', code: 'IX', logo: '🟪', lcc: true, craft: 'Boeing 737-800', bag: '20 kg', cabin: '7 kg' },
];

const HUBS = ['BOM', 'DEL', 'HYD', 'BLR'];

export function demoSearch(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
}): TBOSearchResult {
  const traceId = `${DEMO_PREFIX}${hash(`${params.origin}${params.destination}${params.departDate}`).toString(16)}`;

  const build = (from: string, to: string, date: string): TBOFlight[] => {
    const rand = rng(hash(`${from}-${to}-${date}`));
    const fromCity = resolveAirport(from)?.city ?? from;
    const toCity = resolveAirport(to)?.city ?? to;
    // A stable "distance" for the route, so a route is always about as long and as dear.
    const routeSeed = rng(hash([from, to].sort().join('')));
    const baseMins = 70 + Math.floor(routeSeed() * 110);
    const baseFare = 2800 + Math.floor(routeSeed() * 3600);
    const hubs = HUBS.filter((h) => h !== from && h !== to);

    const flights: TBOFlight[] = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = AIRLINES[Math.floor(rand() * AIRLINES.length)];
      const stops = rand() < 0.22 ? 1 : 0;
      const layover = stops ? 55 + Math.floor(rand() * 90) : 0;
      const mins = baseMins + (stops ? 70 + layover : Math.floor(rand() * 15));
      // Spread departures across the day, roughly one every hour from 05:30.
      const dep = 330 + Math.floor((i * 1000) / count) + Math.floor(rand() * 25);
      const arr = dep + mins;
      const hour = Math.floor((dep % 1440) / 60);
      const peak = hour >= 6 && hour <= 9 ? 1.18 : hour >= 17 && hour <= 21 ? 1.12 : hour < 6 ? 0.9 : 1;
      const price = Math.round((baseFare * peak * (stops ? 0.86 : 1) * (0.9 + rand() * 0.3)) / 10) * 10;
      const tax = Math.round(price * 0.12);
      const flightNumber = String(100 + Math.floor(rand() * 8800));
      const refundable = !a.lcc || rand() < 0.3;

      flights.push({
        id: i + 1,
        resultIndex: `${DEMO_PREFIX}${i + 1}`,
        traceId,
        isLCC: a.lcc,
        source: 6,
        airline: a.name,
        airlineName: a.name,
        airlineCode: a.code,
        flightNumber,
        logo: a.logo,
        depart: clock(dep),
        arrive: clock(arr),
        departTime: clock(dep),
        arriveTime: clock(arr),
        fromCode: from,
        toCode: to,
        depAirport: from,
        arrAirport: to,
        depTerminal: String(1 + Math.floor(rand() * 3)),
        arrTerminal: String(1 + Math.floor(rand() * 3)),
        depCity: fromCity,
        arrCity: toCity,
        duration: lengthOf(mins),
        durationMins: mins,
        stops: stops as 0 | 1,
        layoverAirport: stops && hubs.length ? hubs[Math.floor(rand() * hubs.length)] : undefined,
        layoverMins: stops ? layover : undefined,
        price,
        originalPrice: Math.round((price * 1.08) / 10) * 10,
        baseFare: price - tax,
        tax,
        currency: 'INR',
        refundable,
        fareType: refundable ? 'Refundable' : 'Non-refundable',
        fareClass: 'Economy',
        baggage: a.bag,
        cabinBaggage: a.cabin,
        seatsAvailable: 2 + Math.floor(rand() * 8),
        craft: a.craft,
        isPanRequired: false,
        isPassportRequired: false,
        isHoldAllowed: false,
      });
    }
    return flights.sort((x, y) => x.price - y.price);
  };

  const outbound = build(params.origin, params.destination, params.departDate);
  const inbound = params.returnDate ? build(params.destination, params.origin, params.returnDate) : [];
  return {
    traceId,
    isReturn: !!params.returnDate,
    outbound,
    inbound,
    totalResults: outbound.length + inbound.length,
  };
}

/** Re-pricing a demo fare: the price never moves. */
export function demoFareQuote(flight: Partial<TBOFlight> & { traceId: string; resultIndex: string }): TBOFareQuote {
  return {
    isPriceChanged: false,
    flight: flight as TBOFlight,
    fare: {},
    fareBreakdown: [],
    isPanRequiredAtBook: false,
    isPassportRequiredAtBook: false,
    isGSTMandatory: false,
    isLCC: true,
  };
}

/** A 30-row, 3 + 3 seat map for the demo fare, with some seats taken and window/aisle/middle prices. */
export function demoSeatMap(resultIndex: string): { seats: TBOSeatItem[]; meals: TBOMealltem[] } {
  const rand = rng(hash(resultIndex));
  const seats: TBOSeatItem[] = [];
  for (let row = 1; row <= 30; row++) {
    for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const kind = col === 'A' || col === 'F' ? 'window' : col === 'C' || col === 'D' ? 'aisle' : 'middle';
      const exitRow = row === 12 || row === 14;
      const front = row <= 5;
      const price = (kind === 'middle' ? 0 : kind === 'aisle' ? 250 : 350) + (exitRow ? 400 : 0) + (front ? 300 : 0);
      seats.push({
        SeatId: `${row}${col}`,
        SeatNo: `${row}${col}`,
        RowNo: String(row),
        SeatType: kind,
        Price: row > 20 && kind === 'middle' ? 0 : price,
        IsAvailable: rand() > 0.35,
      });
    }
  }
  const meals: TBOMealltem[] = [
    { Code: 'VGML', Description: 'Veg Sandwich with Juice', Price: 249, AirlineCode: '' },
    { Code: 'NVML', Description: 'Chicken Wrap with Coffee', Price: 299, AirlineCode: '' },
    { Code: 'JNML', Description: 'Jain Meal', Price: 279, AirlineCode: '' },
    { Code: 'SNCK', Description: 'Snack Box with Water', Price: 199, AirlineCode: '' },
    { Code: 'HTML', Description: 'Hot Meal (Poha / Upma)', Price: 329, AirlineCode: '' },
  ];
  return { seats, meals };
}

const PNR_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A confirmed-looking booking. No ticket exists anywhere: the PNR is made up and is marked as a demo. */
export function demoBooking(totalAmount: number): TBOBookingConfirmation {
  let pnr = '';
  for (let i = 0; i < 6; i++) pnr += PNR_LETTERS[Math.floor(Math.random() * PNR_LETTERS.length)];
  const stamp = Date.now().toString().slice(-8);
  return {
    BookingId: Number(stamp),
    PNR: pnr,
    Status: 'Confirmed',
    TicketNo: `DEMO-${stamp}`,
    InvoiceNo: `INV-${stamp}`,
    TotalAmount: totalAmount,
    Currency: 'INR',
    BookingDate: new Date().toISOString(),
  };
}
