/**
 * TBO (Travel Boutique Online / Tek Travels) client.
 *
 * Every call goes through the `tbo-flights` / `tbo-hotels` Supabase edge functions.
 * TBO credentials are agency-level and can authorise real, paid bookings, so they
 * live as server-side secrets and must never be bundled into the app.
 *
 * Flight flow: Search -> FareRule -> FareQuote -> SSR -> Book -> Ticket -> GetBookingDetails
 * Hotel flow:  CityList -> HotelCodes -> Search -> PreBook -> Book -> BookingDetail
 */

import { parseApiError, supabaseFetch } from '@/constants/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TBOFlight {
  id: number;
  resultIndex: string;
  traceId: string;
  isLCC: boolean;
  source: number;

  airline: string;
  airlineName: string;
  airlineCode: string;
  flightNumber: string;
  logo: string;

  depart: string;
  arrive: string;
  departTime: string;
  arriveTime: string;

  fromCode: string;
  toCode: string;
  depAirport: string;
  arrAirport: string;
  depTerminal: string;
  arrTerminal: string;
  depCity: string;
  arrCity: string;

  duration: string;
  durationMins: number;
  stops: 0 | 1 | 2;
  layoverAirport?: string;
  layoverMins?: number;

  price: number;
  originalPrice: number;
  baseFare: number;
  tax: number;
  currency: string;

  refundable: boolean;
  fareType: string;
  fareClass: string;
  baggage: string;
  cabinBaggage: string;
  seatsAvailable: number;
  craft: string;

  isPanRequired: boolean;
  isPassportRequired: boolean;
  isHoldAllowed: boolean;
}

export interface TBOSearchResult {
  traceId: string;
  isReturn: boolean;
  outbound: TBOFlight[];
  inbound: TBOFlight[];
  totalResults: number;
}

export interface TBOFareQuote {
  isPriceChanged: boolean;
  flight: TBOFlight;
  fare: Record<string, unknown>;
  fareBreakdown: Array<Record<string, unknown>>;
  isPanRequiredAtBook: boolean;
  isPassportRequiredAtBook: boolean;
  isGSTMandatory: boolean;
  isLCC: boolean;
}

export interface TBOBookingPassenger {
  Title: string;
  FirstName: string;
  LastName: string;
  PaxType: 1 | 2 | 3;
  DateOfBirth: string;
  Gender: 1 | 2;
  PassportNo?: string;
  PassportExpiry?: string;
  AddressLine1?: string;
  City?: string;
  CountryCode?: string;
  CountryName?: string;
  ContactNo: string;
  Email: string;
  IsLeadPax: boolean;
  Fare?: Record<string, number>;
}

export interface TBOHotelRoom {
  id: string;
  bookingCode: string;
  name: string;
  bed: string;
  guests: number;
  amenities: string[];
  price: number;
  originalPrice: number;
  mealType: string;
  freeCancel: boolean;
  breakfast: boolean;
}

export interface TBOHotel {
  id: string;
  hotelCode: string;
  name: string;
  area: string;
  city: string;
  stars: 3 | 4 | 5;
  rating: number;
  reviews: string;
  price: number;
  originalPrice: number;
  currency: string;
  amenities: string[];
  freeCancel: boolean;
  breakfast: boolean;
  description: string;
  image: string;
  images: string[];
  rooms: TBOHotelRoom[];
}

// ─── Transport ────────────────────────────────────────────────────────────────

async function callTbo<T>(
  fn: 'tbo-flights' | 'tbo-hotels',
  action: string,
  payload: Record<string, unknown>,
  accessToken?: string | null,
): Promise<T> {
  const res = await supabaseFetch(
    `/functions/v1/${fn}`,
    { method: 'POST', body: JSON.stringify({ action, ...payload }) },
    accessToken,
  );

  if (!res.ok) throw new Error(await parseApiError(res));

  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'TBO request failed');
  return data as T;
}

// ─── Flights ──────────────────────────────────────────────────────────────────

export async function tboSearchFlights(
  params: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string;
    adults?: number;
    children?: number;
    infants?: number;
    cabinClass?: number;
    directOnly?: boolean;
  },
  accessToken?: string | null,
): Promise<TBOSearchResult> {
  return callTbo<TBOSearchResult>('tbo-flights', 'search', params, accessToken);
}

export async function tboFareRule(
  traceId: string,
  resultIndex: string,
  accessToken?: string | null,
): Promise<{ fareRules: Array<Record<string, unknown>> }> {
  return callTbo('tbo-flights', 'farerule', { traceId, resultIndex }, accessToken);
}

/** Re-prices a fare immediately before booking; TBO may return a changed price. */
export async function tboFareQuote(
  traceId: string,
  resultIndex: string,
  accessToken?: string | null,
): Promise<TBOFareQuote> {
  return callTbo<TBOFareQuote>('tbo-flights', 'farequote', { traceId, resultIndex }, accessToken);
}

export async function tboGetSSR(
  traceId: string,
  resultIndex: string,
  accessToken?: string | null,
): Promise<{ seats: unknown[]; meals: unknown[]; baggage: unknown[] }> {
  return callTbo('tbo-flights', 'ssr', { traceId, resultIndex }, accessToken);
}

export async function tboBook(
  params: { traceId: string; resultIndex: string; passengers: TBOBookingPassenger[] },
  accessToken?: string | null,
): Promise<{ booking: Record<string, unknown> }> {
  return callTbo('tbo-flights', 'book', params, accessToken);
}

export async function tboTicket(
  params: {
    traceId: string;
    resultIndex?: string;
    passengers?: TBOBookingPassenger[];
    pnr?: string;
    bookingId?: number;
  },
  accessToken?: string | null,
): Promise<{ ticket: Record<string, unknown> }> {
  return callTbo('tbo-flights', 'ticket', params, accessToken);
}

export async function tboGetBookingDetails(
  params: { bookingId: number; pnr?: string; traceId?: string },
  accessToken?: string | null,
): Promise<{ booking: Record<string, unknown> }> {
  return callTbo('tbo-flights', 'bookingdetails', params, accessToken);
}

// ─── Hotels ───────────────────────────────────────────────────────────────────

export async function tboHotelCities(
  countryCode = 'IN',
  accessToken?: string | null,
): Promise<{ cities: Array<{ Code: string; Name: string }> }> {
  return callTbo('tbo-hotels', 'citylist', { countryCode }, accessToken);
}

export async function tboHotelCodes(
  cityCode: string,
  accessToken?: string | null,
): Promise<{ hotels: Array<Record<string, unknown>> }> {
  return callTbo('tbo-hotels', 'hotelcodes', { cityCode }, accessToken);
}

export async function tboSearchHotels(
  params: {
    checkIn: string;
    checkOut: string;
    hotelCodes: string;
    adults?: number;
    children?: number;
    childrenAges?: number[];
    rooms?: number;
    guestNationality?: string;
    refundableOnly?: boolean;
  },
  accessToken?: string | null,
): Promise<{ hotels: TBOHotel[]; totalResults: number }> {
  return callTbo('tbo-hotels', 'search', params, accessToken);
}

export async function tboHotelPreBook(
  bookingCode: string,
  accessToken?: string | null,
): Promise<{ rooms: Array<Record<string, unknown>> }> {
  return callTbo('tbo-hotels', 'prebook', { bookingCode }, accessToken);
}

// ─── Seat / meal selection ────────────────────────────────────────────────────

export interface TBOSeatItem {
  SeatId: string;
  SeatNo: string;
  RowNo: string;
  SeatType: 'window' | 'aisle' | 'middle';
  Price: number;
  IsAvailable: boolean;
}

export interface TBOMealltem {
  Code: string;
  Description: string;
  Price: number;
  AirlineCode: string;
}

interface TboRawSeat {
  Code?: string; SeatNo?: string; RowNo?: string; SeatType?: number;
  Price?: number; AvailablityType?: number;
}

/**
 * Flattens TBO's nested SeatDynamic structure into a single seat list.
 * SSR is not enabled on every agency account — callers get an empty list rather
 * than an error so the add-ons step can simply skip seat selection.
 */
export async function tboSeatMap(
  traceId: string,
  resultIndex: string,
  accessToken?: string | null,
): Promise<{ seats: TBOSeatItem[]; meals: TBOMealltem[] }> {
  let raw: { seats: unknown[]; meals: unknown[] };
  try {
    raw = await tboGetSSR(traceId, resultIndex, accessToken);
  } catch {
    return { seats: [], meals: [] };
  }

  const seats: TBOSeatItem[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown> & TboRawSeat;
    if (obj.SeatNo) {
      // SeatType: 1 = window, 2 = aisle, anything else = middle.
      const kind = obj.SeatType === 1 ? 'window' : obj.SeatType === 2 ? 'aisle' : 'middle';
      seats.push({
        SeatId: String(obj.Code ?? obj.SeatNo),
        SeatNo: String(obj.SeatNo),
        RowNo: String(obj.RowNo ?? ''),
        SeatType: kind,
        Price: Number(obj.Price ?? 0),
        IsAvailable: obj.AvailablityType !== 2,
      });
      return;
    }
    Object.values(obj).forEach(walk);
  };
  walk(raw.seats);

  const meals: TBOMealltem[] = [];
  const walkMeal = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walkMeal); return; }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.Code && obj.Description) {
      meals.push({
        Code: String(obj.Code),
        Description: String(obj.Description),
        Price: Number(obj.Price ?? 0),
        AirlineCode: String(obj.AirlineCode ?? ''),
      });
    }
  };
  walkMeal(raw.meals);

  return { seats, meals };
}

// ─── Book + ticket ────────────────────────────────────────────────────────────

export interface TBOBookingConfirmation {
  BookingId: number;
  PNR: string;
  Status: 'Confirmed' | 'Vouchered' | 'Failed';
  TicketNo: string;
  InvoiceNo: string;
  TotalAmount: number;
  Currency: string;
  BookingDate: string;
}

/**
 * Issues a real ticket against the agency's TBO credit. LCC fares ticket in a
 * single call; non-LCC fares must be booked first and ticketed against the PNR.
 */
export async function tboBookAndTicket(
  params: {
    traceId: string;
    resultIndex: string;
    isLCC: boolean;
    passengers: TBOBookingPassenger[];
    totalAmount: number;
  },
  accessToken?: string | null,
): Promise<TBOBookingConfirmation> {
  const { traceId, resultIndex, isLCC, passengers, totalAmount } = params;

  let pnr = '';
  let bookingId = 0;

  if (!isLCC) {
    const { booking } = await tboBook({ traceId, resultIndex, passengers }, accessToken);
    const r = (booking ?? {}) as Record<string, any>;
    pnr = String(r.PNR ?? '');
    bookingId = Number(r.BookingId ?? 0);
  }

  const { ticket } = await tboTicket(
    isLCC ? { traceId, resultIndex, passengers } : { traceId, pnr, bookingId },
    accessToken,
  );

  const t = (ticket ?? {}) as Record<string, any>;
  const itinerary = t.FlightItinerary ?? {};
  const firstTicket = Array.isArray(itinerary.Passenger?.[0]?.Ticket)
    ? itinerary.Passenger[0].Ticket[0]
    : itinerary.Passenger?.[0]?.Ticket;

  return {
    BookingId: Number(t.BookingId ?? bookingId ?? 0),
    PNR: String(t.PNR ?? itinerary.PNR ?? pnr),
    Status: t.Error?.ErrorCode ? 'Failed' : 'Confirmed',
    TicketNo: String(firstTicket?.TicketNumber ?? ''),
    InvoiceNo: String(itinerary.InvoiceNo ?? t.InvoiceNo ?? ''),
    TotalAmount: Number(itinerary.Fare?.PublishedFare ?? totalAmount),
    Currency: String(itinerary.Fare?.Currency ?? 'INR'),
    BookingDate: String(itinerary.InvoiceCreatedOn ?? new Date().toISOString()),
  };
}

export async function tboHotelBook(
  params: {
    bookingCode: string;
    customerDetails: Array<Record<string, unknown>>;
    clientReferenceId?: string;
    totalFare?: number;
    emailId?: string;
    phoneNumber?: string;
  },
  accessToken?: string | null,
): Promise<{ booking: Record<string, unknown> }> {
  return callTbo('tbo-hotels', 'book', params, accessToken);
}
