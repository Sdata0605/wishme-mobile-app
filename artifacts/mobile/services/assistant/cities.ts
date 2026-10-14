/** Spoken city / airport name → IATA code, for voice flight searches. */

interface Airport {
  code: string;
  city: string;
  aliases?: string[];
}

const AIRPORTS: Airport[] = [
  { code: 'DEL', city: 'New Delhi', aliases: ['delhi', 'new delhi', 'dilli'] },
  { code: 'BOM', city: 'Mumbai', aliases: ['mumbai', 'bombay'] },
  { code: 'BLR', city: 'Bengaluru', aliases: ['bengaluru', 'bangalore'] },
  { code: 'HYD', city: 'Hyderabad', aliases: ['hyderabad'] },
  { code: 'MAA', city: 'Chennai', aliases: ['chennai', 'madras'] },
  { code: 'CCU', city: 'Kolkata', aliases: ['kolkata', 'calcutta'] },
  { code: 'GOI', city: 'Goa', aliases: ['goa', 'dabolim'] },
  { code: 'GOX', city: 'Goa (Mopa)', aliases: ['mopa'] },
  { code: 'PNQ', city: 'Pune', aliases: ['pune', 'poona'] },
  { code: 'AMD', city: 'Ahmedabad', aliases: ['ahmedabad'] },
  { code: 'JAI', city: 'Jaipur', aliases: ['jaipur'] },
  { code: 'LKO', city: 'Lucknow', aliases: ['lucknow'] },
  { code: 'COK', city: 'Kochi', aliases: ['kochi', 'cochin'] },
  { code: 'TRV', city: 'Thiruvananthapuram', aliases: ['trivandrum', 'thiruvananthapuram'] },
  { code: 'IXC', city: 'Chandigarh', aliases: ['chandigarh'] },
  { code: 'PAT', city: 'Patna', aliases: ['patna'] },
  { code: 'BBI', city: 'Bhubaneswar', aliases: ['bhubaneswar'] },
  { code: 'GAU', city: 'Guwahati', aliases: ['guwahati'] },
  { code: 'IDR', city: 'Indore', aliases: ['indore'] },
  { code: 'NAG', city: 'Nagpur', aliases: ['nagpur'] },
  { code: 'VNS', city: 'Varanasi', aliases: ['varanasi', 'banaras', 'benares'] },
  { code: 'SXR', city: 'Srinagar', aliases: ['srinagar'] },
  { code: 'IXL', city: 'Leh', aliases: ['leh', 'ladakh'] },
  { code: 'ATQ', city: 'Amritsar', aliases: ['amritsar'] },
  { code: 'UDR', city: 'Udaipur', aliases: ['udaipur'] },
  { code: 'IXZ', city: 'Port Blair', aliases: ['port blair', 'andaman'] },
  { code: 'RPR', city: 'Raipur', aliases: ['raipur'] },
  { code: 'BHO', city: 'Bhopal', aliases: ['bhopal'] },
  { code: 'IXR', city: 'Ranchi', aliases: ['ranchi'] },
  { code: 'CJB', city: 'Coimbatore', aliases: ['coimbatore'] },
  { code: 'IXM', city: 'Madurai', aliases: ['madurai'] },
  { code: 'VTZ', city: 'Visakhapatnam', aliases: ['visakhapatnam', 'vizag'] },
  { code: 'DED', city: 'Dehradun', aliases: ['dehradun'] },
  { code: 'DXB', city: 'Dubai', aliases: ['dubai'] },
  { code: 'SIN', city: 'Singapore', aliases: ['singapore'] },
  { code: 'BKK', city: 'Bangkok', aliases: ['bangkok'] },
  { code: 'LHR', city: 'London', aliases: ['london'] },
  { code: 'JFK', city: 'New York', aliases: ['new york'] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

export function resolveAirport(spoken: string): { code: string; city: string } | null {
  const raw = spoken.trim();
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const hit = AIRPORTS.find((a) => a.code === raw.toUpperCase());
    return hit ? { code: hit.code, city: hit.city } : { code: raw.toUpperCase(), city: raw.toUpperCase() };
  }
  const q = norm(raw);
  if (!q) return null;
  const hit =
    AIRPORTS.find((a) => a.aliases?.some((al) => al === q)) ??
    AIRPORTS.find((a) => a.aliases?.some((al) => q.includes(al) || al.includes(q)));
  return hit ? { code: hit.code, city: hit.city } : null;
}

/** Cities the hotel search screen knows about, matched loosely. */
export function resolveHotelCity(spoken: string, known: string[]): string {
  const q = norm(spoken);
  return (
    known.find((c) => norm(c) === q) ??
    known.find((c) => q.includes(norm(c)) || norm(c).includes(q)) ??
    spoken.trim()
  );
}
