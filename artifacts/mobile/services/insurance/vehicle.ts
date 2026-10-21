/**
 * Vehicle lookup and premium maths for the car / bike insurance quote.
 *
 * There is no free source of Indian registration data: the government Vahan records are only sold through paid,
 * licensed providers (Surepass, Signzy, IDfy...). Until one is connected server-side, `lookupVehicle` returns
 * clearly-labelled demo details (source: 'demo') so the screen can be built and tried. The provider key must never
 * ship in the app; the real call belongs on our API server.
 */

export type VehicleKind = 'car' | 'bike';

export interface Vehicle {
  plate: string;
  kind: VehicleKind;
  make: string;
  model: string;
  variant: string;
  fuel: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
  usage: 'Private Use' | 'Commercial Use';
  regYear: number;
  cc: number;
  /** Ex-showroom price, the base of the IDV. */
  exShowroom: number;
  /** ISO date the current policy ends, if known. */
  policyExpiry: string | null;
  /** State from the plate's first two letters (this part is real, it is how plates work). */
  state: string;
}

export interface LookupResult {
  source: 'live' | 'demo';
  vehicle: Vehicle;
}

const STATES: Record<string, string> = {
  AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CG: 'Chhattisgarh', CH: 'Chandigarh',
  DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu & Kashmir',
  KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur', MP: 'Madhya Pradesh',
  MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', OR: 'Odisha', PB: 'Punjab', PY: 'Puducherry', RJ: 'Rajasthan',
  SK: 'Sikkim', TN: 'Tamil Nadu', TR: 'Tripura', TS: 'Telangana', UK: 'Uttarakhand', UP: 'Uttar Pradesh',
  WB: 'West Bengal', BH: 'Bharat series',
};

type Model = Omit<Vehicle, 'plate' | 'usage' | 'regYear' | 'policyExpiry' | 'state'>;

// Demo catalogue: common Indian models with approximate ex-showroom prices.
const DEMO: Model[] = [
  { kind: 'bike', make: 'Honda', model: 'Dio', variant: 'Deluxe BS VI', fuel: 'Petrol', cc: 110, exShowroom: 74000 },
  { kind: 'bike', make: 'Honda', model: 'Activa 6G', variant: 'Standard', fuel: 'Petrol', cc: 110, exShowroom: 78000 },
  { kind: 'bike', make: 'TVS', model: 'Jupiter', variant: 'ZX', fuel: 'Petrol', cc: 110, exShowroom: 80000 },
  { kind: 'bike', make: 'Bajaj', model: 'Pulsar 150', variant: 'Twin Disc', fuel: 'Petrol', cc: 149, exShowroom: 115000 },
  { kind: 'bike', make: 'Royal Enfield', model: 'Classic 350', variant: 'Signals', fuel: 'Petrol', cc: 349, exShowroom: 200000 },
  { kind: 'car', make: 'Maruti Suzuki', model: 'Swift', variant: 'VXi', fuel: 'Petrol', cc: 1197, exShowroom: 720000 },
  { kind: 'car', make: 'Hyundai', model: 'i20', variant: 'Asta', fuel: 'Petrol', cc: 1197, exShowroom: 900000 },
  { kind: 'car', make: 'Tata', model: 'Nexon', variant: 'XZ+', fuel: 'Diesel', cc: 1497, exShowroom: 1250000 },
  { kind: 'car', make: 'Mahindra', model: 'XUV700', variant: 'AX5', fuel: 'Diesel', cc: 2184, exShowroom: 1900000 },
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Fetches the vehicle behind a registration number. `kind` is set for a brand-new, unregistered vehicle. */
export async function lookupVehicle(plate: string, kind?: VehicleKind): Promise<LookupResult> {
  // A live provider call (through our API server) goes here and returns { source: 'live', ... }.
  await new Promise((r) => setTimeout(r, 900));
  const h = hash(plate || kind || 'new');
  const pool = kind ? DEMO.filter((m) => m.kind === kind) : DEMO;
  const m = pool[h % pool.length];
  const year = new Date().getFullYear();
  const regYear = plate ? year - 1 - (h % 7) : year;
  let policyExpiry: string | null = null;
  if (plate) {
    const d = new Date();
    d.setDate(d.getDate() + ((h >> 3) % 120) - 60); // somewhere in the last or next two months
    policyExpiry = d.toISOString().slice(0, 10);
  }
  return {
    source: 'demo',
    vehicle: { ...m, plate, usage: 'Private Use', regYear, policyExpiry, state: STATES[plate.slice(0, 2)] ?? '' },
  };
}

/**
 * Third-party premium for one year. These are the statutory rates (same for every insurer), by engine size, as
 * notified by MoRTH in 2022. Check them against the current notification before going live.
 */
export function thirdPartyPremium(kind: VehicleKind, cc: number) {
  if (kind === 'bike') return cc <= 75 ? 538 : cc <= 150 ? 714 : cc <= 350 ? 1366 : 2804;
  return cc <= 1000 ? 2094 : cc <= 1500 ? 3416 : 7897;
}

/** IDV depreciation by age, per the standard India Motor Tariff schedule. */
export function idvFor(v: Vehicle) {
  const age = new Date().getFullYear() - v.regYear;
  const dep = age < 1 ? 0.05 : age < 2 ? 0.2 : age < 3 ? 0.3 : age < 4 ? 0.4 : age < 5 ? 0.5 : 0.55;
  return Math.round((v.exShowroom * (1 - dep)) / 100) * 100;
}

/** Estimated own-damage premium for a year at a given IDV (insurers price this themselves; it is only an estimate). */
export function ownDamageEstimate(kind: VehicleKind, idv: number) {
  return Math.round(idv * (kind === 'bike' ? 0.0115 : 0.022));
}
