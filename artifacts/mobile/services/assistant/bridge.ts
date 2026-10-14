/**
 * Assistant bridge — lets voice tools drive screens that own their own state.
 *
 * Screens register what the assistant can do on them:
 *  - ServicesFlow registers a controller (search flights / hotels / buses, open a bill, pick a fare)
 *  - Results screens register the list of options currently on screen so the assistant can
 *    read them out and choose one on the user's behalf.
 *
 * Money never moves through here: payment buttons always stay manual taps.
 */

export interface AssistantOption {
  title: string;
  detail: string;
}

export interface OptionSet {
  kind: 'flights' | 'hotels' | 'buses';
  loading: boolean;
  error?: string;
  items: AssistantOption[];
  select: (index: number) => void;
}

export interface FlightSearchRequest {
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  /** YYYY-MM-DD */
  date: string;
  adults: number;
  children: number;
  infants: number;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface HotelSearchRequest {
  city: string;
  /** YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
}

export interface BusSearchRequest {
  from: string;
  to: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface ServicesController {
  searchFlights: (req: FlightSearchRequest) => void;
  searchHotels: (req: HotelSearchRequest) => void;
  searchBuses: (req: BusSearchRequest) => void;
  openBill: (kind: string) => void;
  /** Picks a fare on the fare-options screen. Returns false if that screen isn't open. */
  selectFare: (fareKey?: string) => boolean;
}

let controller: ServicesController | null = null;
let options: OptionSet | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function setServicesController(next: ServicesController | null) {
  controller = next;
  notify();
}

export function getServicesController() {
  return controller;
}

export function setOptionSet(next: OptionSet | null) {
  options = next;
  notify();
}

/** Only clears the set if it still belongs to the screen that is unmounting. */
export function clearOptionSet(kind: OptionSet['kind']) {
  if (options?.kind === kind) setOptionSet(null);
}

export function getOptionSet() {
  return options;
}

function waitFor<T>(read: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const now = read();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = (value: T | null) => {
      listeners.delete(check);
      clearTimeout(timer);
      resolve(value);
    };
    const check = () => {
      const v = read();
      if (v) done(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    listeners.add(check);
  });
}

export function waitForController(timeoutMs = 4000) {
  return waitFor(() => controller, timeoutMs);
}

/** Resolves once options of this kind have finished loading (or the wait times out). */
export function waitForOptions(kind: OptionSet['kind'], timeoutMs = 20000) {
  return waitFor(() => (options?.kind === kind && !options.loading ? options : null), timeoutMs);
}
