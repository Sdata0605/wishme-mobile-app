/**
 * Autonomous Gemini Voice Booking Agent (Multi-Directional & Hands-Free Conversational Flow)
 *
 * Full Flight Booking Flow:
 * 1. idle -> User: "Book a flight for me" -> Navigates to Flights screen -> Asks: "Where would you like to travel from, and what is your destination?"
 * 2. flight_route -> User: "Pune to Mumbai" -> Fills from & to -> Asks: "What date and time would you like to travel?"
 * 3. flight_datetime -> User: "Tomorrow morning" -> Fills date -> Searches & Navigates to Flight Results -> Asks: "I found IndiGo at 7:00 AM for ₹3,800 and Air India at 9:30 AM for ₹4,400. Which flight would you like?"
 * 4. flight_select -> User: "IndiGo" -> Selects flight -> Navigates to Passenger Details -> Asks: "Please tell me the passenger's full name, age, and phone number."
 * 5. flight_passenger -> User: "Rahul Sharma, 28, 9876543210" -> Fills passenger details -> Navigates to Seats & Addons -> Asks: "Would you prefer a Window seat or an Aisle seat?"
 * 6. flight_addons -> User: "Window seat" -> Selects seat 12A -> Navigates to Review & Pay -> Asks: "Summary: IndiGo Pune to Mumbai tomorrow 7:00 AM, Passenger Rahul Sharma, Window Seat 12A. Total is ₹4,150. Shall I proceed and complete payment from your WishMe Wallet?"
 * 7. flight_payment -> User: "Yes, pay" -> Completes payment -> Generates PNR -> Navigates to Confirmed E-ticket.
 */

export interface VoiceAgentSessionState {
  service: 'flights' | 'hotels' | 'bus' | 'bills' | 'general';
  step:
    | 'idle'
    | 'flight_route'
    | 'flight_datetime'
    | 'flight_select'
    | 'flight_passenger'
    | 'flight_addons'
    | 'flight_payment'
    | 'flight_confirmed';
  data: {
    fromCity?: string;
    toCity?: string;
    travelDate?: string;
    travelTime?: string;
    travellers?: string;
    airline?: string;
    flightNumber?: string;
    departureTime?: string;
    flightPrice?: number;
    passengerName?: string;
    passengerAge?: number;
    passengerGender?: 'Male' | 'Female';
    passengerPhone?: string;
    passengerEmail?: string;
    seatNo?: string;
    totalAmount?: number;
    pnr?: string;
  };
}

export interface VoiceAgentTurnResponse {
  message: string;
  nextStep: VoiceAgentSessionState['step'];
  action?: {
    type: 'navigate_service' | 'fill_route' | 'fill_date' | 'select_flight' | 'fill_passenger' | 'select_seat' | 'process_payment';
    targetView: 'flights' | 'flightResults' | 'flightFares' | 'flightPassenger' | 'flightAddons' | 'flightReviewPay' | 'flightSuccess';
    payload?: Record<string, unknown>;
  };
  sessionUpdate?: Partial<VoiceAgentSessionState['data']>;
  suggestions?: string[];
}

const CITY_AIRPORT_MAP: Record<string, { name: string; code: string; airport: string }> = {
  pune: { name: 'Pune', code: 'PNQ', airport: 'Pune International Airport' },
  mumbai: { name: 'Mumbai', code: 'BOM', airport: 'Chhatrapati Shivaji Maharaj International Airport' },
  bombay: { name: 'Mumbai', code: 'BOM', airport: 'Chhatrapati Shivaji Maharaj International Airport' },
  delhi: { name: 'New Delhi', code: 'DEL', airport: 'Indira Gandhi International Airport' },
  newdelhi: { name: 'New Delhi', code: 'DEL', airport: 'Indira Gandhi International Airport' },
  bengaluru: { name: 'Bengaluru', code: 'BLR', airport: 'Kempegowda International Airport' },
  bangalore: { name: 'Bengaluru', code: 'BLR', airport: 'Kempegowda International Airport' },
  goa: { name: 'Goa', code: 'GOI', airport: 'Dabolim / Mopa Airport' },
  hyderabad: { name: 'Hyderabad', code: 'HYD', airport: 'Rajiv Gandhi International Airport' },
  chennai: { name: 'Chennai', code: 'MAA', airport: 'Chennai International Airport' },
  kolkata: { name: 'Kolkata', code: 'CCU', airport: 'Netaji Subhash Chandra Bose Airport' },
  jaipur: { name: 'Jaipur', code: 'JAI', airport: 'Jaipur International Airport' },
  ahmedabad: { name: 'Ahmedabad', code: 'AMD', airport: 'Sardar Vallabhbhai Patel Airport' },
  chandigarh: { name: 'Chandigarh', code: 'IXC', airport: 'Shaheed Bhagat Singh Airport' },
  lucknow: { name: 'Lucknow', code: 'LKO', airport: 'Chaudhary Charan Singh Airport' },
  kochi: { name: 'Kochi', code: 'COK', airport: 'Cochin International Airport' },
  dubai: { name: 'Dubai', code: 'DXB', airport: 'Dubai International Airport' },
  singapore: { name: 'Singapore', code: 'SIN', airport: 'Singapore Changi Airport' },
  london: { name: 'London', code: 'LHR', airport: 'London Heathrow Airport' },
};

export function parseCity(text: string): { name: string; code: string; airport: string } | null {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, val] of Object.entries(CITY_AIRPORT_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return val;
    }
  }
  if (text.trim().length >= 3) {
    const formatted = capitalize(text.trim());
    return { name: formatted, code: formatted.slice(0, 3).toUpperCase(), airport: `${formatted} Airport` };
  }
  return null;
}

export function processVoiceBookingTurn(
  spokenText: string,
  session: VoiceAgentSessionState
): VoiceAgentTurnResponse {
  const lower = spokenText.toLowerCase().trim();

  // ─── 0. Universal Back / Previous Navigation ────────────────────────────────
  if (
    lower.includes('go back') ||
    lower.includes('previous screen') ||
    lower.includes('back screen') ||
    lower.includes('return back') ||
    lower === 'back'
  ) {
    if (session.step === 'flight_confirmed' || session.step === 'flight_payment') {
      return {
        message: 'Returning to Seat & Add-ons. Would you like a Window seat or an Aisle seat?',
        nextStep: 'flight_addons',
        action: { type: 'navigate_service', targetView: 'flightAddons' },
      };
    }
    if (session.step === 'flight_addons') {
      return {
        message: "Returning to Passenger details. Please tell me the passenger's full name, age, and phone number.",
        nextStep: 'flight_passenger',
        action: { type: 'navigate_service', targetView: 'flightPassenger' },
      };
    }
    if (session.step === 'flight_passenger') {
      return {
        message: 'Returning to Flight options. Which flight would you like: IndiGo at 7:00 AM or Air India at 9:30 AM?',
        nextStep: 'flight_select',
        action: { type: 'navigate_service', targetView: 'flightResults' },
      };
    }
    if (session.step === 'flight_select' || session.step === 'flight_datetime') {
      return {
        message: 'Returning to route selection. Where would you like to travel from, and what is your destination?',
        nextStep: 'flight_route',
        action: { type: 'navigate_service', targetView: 'flights' },
      };
    }
    return {
      message: 'Returning to Flight search. Where would you like to travel from, and what is your destination?',
      nextStep: 'flight_route',
      action: { type: 'navigate_service', targetView: 'flights' },
    };
  }

  // ─── 1. Route Change / Correction at Any Point ──────────────────────────────
  const isExplicitRouteChange =
    lower.includes('change to') ||
    lower.includes('change from') ||
    lower.includes('change flight to') ||
    lower.includes('actually') ||
    lower.includes('instead') ||
    lower.includes('pune to') ||
    lower.includes('mumbai to') ||
    lower.includes('delhi to') ||
    lower.includes('bangalore to') ||
    lower.includes('bengaluru to') ||
    lower.includes('goa to');

  // Check if speech contains cities (e.g. "Pune to Mumbai" or "from Pune to Mumbai")
  const fromToMatch = lower.match(/(?:from\s+)?([a-zA-Z]+)\s+to\s+([a-zA-Z]+)/);
  let detectedFrom: { name: string; code: string } | null = null;
  let detectedTo: { name: string; code: string } | null = null;

  if (fromToMatch) {
    detectedFrom = parseCity(fromToMatch[1]);
    detectedTo = parseCity(fromToMatch[2]);
  } else {
    // Check two city words
    const words = lower.split(/[\s,]+/);
    for (const w of words) {
      const parsed = parseCity(w);
      if (parsed) {
        if (!detectedFrom) detectedFrom = parsed;
        else if (!detectedTo && parsed.name !== detectedFrom.name) detectedTo = parsed;
      }
    }
  }

  // If user provided both cities at any step, or in 'flight_route'
  if (detectedFrom && detectedTo) {
    const fromLabel = `${detectedFrom.name} (${detectedFrom.code})`;
    const toLabel = `${detectedTo.name} (${detectedTo.code})`;

    // Check if user also gave date right away (e.g. "Pune to Mumbai tomorrow morning")
    const hasDate = lower.includes('tomorrow') || lower.includes('today') || lower.includes('friday') || lower.includes('september') || lower.includes('morning') || lower.includes('evening');

    if (hasDate) {
      const dateLabel = lower.includes('today') ? 'Today' : lower.includes('friday') ? 'Next Friday' : 'Tomorrow';
      const timeLabel = lower.includes('morning') ? 'Morning (7:00 AM)' : lower.includes('evening') ? 'Evening (6:30 PM)' : 'Morning';

      return {
        message: `Got it! Searching flights from ${detectedFrom.name} to ${detectedTo.name} for ${dateLabel} ${timeLabel}. I found an IndiGo flight at 7:00 AM for 3,800 rupees and an Air India flight at 9:30 AM for 4,400 rupees. Which flight would you like me to select?`,
        nextStep: 'flight_select',
        action: {
          type: 'navigate_service',
          targetView: 'flights',
          payload: { from: fromLabel, to: toLabel, dateLabel, travellers: '1 Adult', timeLabel },
        },
        sessionUpdate: {
          fromCity: fromLabel,
          toCity: toLabel,
          travelDate: dateLabel,
          travelTime: timeLabel,
        },
      };
    }

    // Cities given without date -> ask for date & time
    return {
      message: `Got it, flying from ${detectedFrom.name} to ${detectedTo.name}. What date and time would you like to travel?`,
      nextStep: 'flight_datetime',
      action: {
        type: 'fill_route',
        targetView: 'flights',
        payload: { from: fromLabel, to: toLabel },
      },
      sessionUpdate: {
        fromCity: fromLabel,
        toCity: toLabel,
      },
    };
  }

  // ─── 2. Initial Booking Request (Without Cities) ────────────────────────────
  if (
    session.step === 'idle' ||
    lower.includes('book a flight') ||
    lower.includes('book flight') ||
    lower.includes('book flight for me') ||
    lower.includes('flight ticket') ||
    lower.includes('plane ticket') ||
    lower.includes('flight section')
  ) {
    return {
      message: 'I am ready to book your flight. Where would you like to travel from, and what is your destination?',
      nextStep: 'flight_route',
      action: {
        type: 'navigate_service',
        targetView: 'flights',
      },
    };
  }

  // ─── 3. Route Step: Waiting for Destination ─────────────────────────────────
  if (session.step === 'flight_route') {
    if (detectedFrom && !detectedTo) {
      return {
        message: `Departure set to ${detectedFrom.name}. Which city is your destination?`,
        nextStep: 'flight_route',
        action: {
          type: 'fill_route',
          targetView: 'flights',
          payload: { from: `${detectedFrom.name} (${detectedFrom.code})` },
        },
        sessionUpdate: { fromCity: `${detectedFrom.name} (${detectedFrom.code})` },
      };
    }
    if (!detectedFrom && detectedTo) {
      return {
        message: `Destination set to ${detectedTo.name}. Which city are you flying from?`,
        nextStep: 'flight_route',
        action: {
          type: 'fill_route',
          targetView: 'flights',
          payload: { to: `${detectedTo.name} (${detectedTo.code})` },
        },
        sessionUpdate: { toCity: `${detectedTo.name} (${detectedTo.code})` },
      };
    }
    return {
      message: 'Please tell me the cities you are traveling from and to, for example Pune to Mumbai.',
      nextStep: 'flight_route',
    };
  }

  // ─── 4. Date & Time Step ────────────────────────────────────────────────────
  if (session.step === 'flight_datetime') {
    const isTomorrow = lower.includes('tomorrow');
    const isToday = lower.includes('today');
    const isMorning = lower.includes('morning') || lower.includes('7') || lower.includes('8') || lower.includes('am');
    const isEvening = lower.includes('evening') || lower.includes('night') || lower.includes('pm');

    let dateLabel = 'Tomorrow';
    if (isToday) dateLabel = 'Today';
    else if (lower.includes('friday')) dateLabel = 'Next Friday';
    else if (lower.includes('monday')) dateLabel = 'Next Monday';
    else {
      const match = spokenText.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|\d{1,2}[\/-]\d{1,2})/);
      if (match) dateLabel = match[1];
    }

    const timeLabel = isMorning ? '7:00 AM' : isEvening ? '6:30 PM' : 'morning';
    const fromCity = session.data.fromCity || 'Pune (PNQ)';
    const toCity = session.data.toCity || 'Mumbai (BOM)';

    return {
      message: `Searching flights from ${fromCity} to ${toCity} for ${dateLabel} ${timeLabel}. I found an IndiGo flight at 7:00 AM for 3,800 rupees, and an Air India flight at 9:30 AM for 4,400 rupees. Which flight would you like me to select?`,
      nextStep: 'flight_select',
      action: {
        type: 'navigate_service',
        targetView: 'flightResults',
        payload: {
          from: fromCity,
          to: toCity,
          dateLabel,
          timeLabel,
          travellers: '1 Adult',
        },
      },
      sessionUpdate: {
        travelDate: dateLabel,
        travelTime: timeLabel,
      },
    };
  }

  // ─── 5. Flight Selection Step ───────────────────────────────────────────────
  if (session.step === 'flight_select') {
    const isAirIndia = lower.includes('air india') || lower.includes('airindia') || lower.includes('9:30') || lower.includes('second');
    const isSpiceJet = lower.includes('spicejet') || lower.includes('spice');
    const isVistara = lower.includes('vistara');

    const airline = isAirIndia ? 'Air India' : isSpiceJet ? 'SpiceJet' : isVistara ? 'Vistara' : 'IndiGo';
    const flightNumber = isAirIndia ? 'AI-804' : isSpiceJet ? 'SG-234' : isVistara ? 'UK-955' : '6E-452';
    const depTime = isAirIndia ? '09:30 AM' : '07:00 AM';
    const price = isAirIndia ? 4400 : isSpiceJet ? 3400 : isVistara ? 4900 : 3800;

    return {
      message: `Selected ${airline} ${flightNumber} departing at ${depTime}. Please tell me the passenger's full name, age, and mobile number.`,
      nextStep: 'flight_passenger',
      action: {
        type: 'select_flight',
        targetView: 'flightPassenger',
        payload: {
          airline,
          flightNumber,
          departureTime: depTime,
          price,
          fareKey: 'wishspecial',
        },
      },
      sessionUpdate: {
        airline,
        flightNumber,
        departureTime: depTime,
        flightPrice: price,
      },
    };
  }

  // ─── 6. Passenger Details Step ──────────────────────────────────────────────
  if (session.step === 'flight_passenger') {
    // Extract phone
    const phoneMatch = spokenText.match(/(\d{10})/);
    const phone = phoneMatch ? phoneMatch[1] : '9876543210';

    // Extract age
    const ageMatch = spokenText.match(/(?:age|years old|is)\s*(\d{1,2})/i) || spokenText.match(/(\d{2})/);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : 28;

    // Extract name
    let name = 'Rahul Sharma';
    const nameMatch = spokenText.match(/(?:name is|passenger|for|i am)\s+([a-zA-Z]+\s+[a-zA-Z]+)/i);
    if (nameMatch) {
      name = nameMatch[1];
    } else {
      const words = spokenText
        .replace(/\d+/g, '')
        .replace(/phone|mobile|number|is|my|name|passenger|age|years|old|gender|male|female/gi, '')
        .trim()
        .split(/\s+/);
      if (words.length >= 2 && words[0].length > 1) {
        name = `${capitalize(words[0])} ${capitalize(words[1])}`;
      }
    }

    const gender = lower.includes('female') || lower.includes('woman') || lower.includes('mrs') || lower.includes('ms') ? 'Female' : 'Male';

    return {
      message: `Added passenger ${name}, age ${age}. Would you prefer a Window seat or an Aisle seat?`,
      nextStep: 'flight_addons',
      action: {
        type: 'fill_passenger',
        targetView: 'flightAddons',
        payload: {
          name,
          age,
          gender,
          phone,
          email: `${name.toLowerCase().replace(/\s+/g, '.') || 'traveler'}@wishme.in`,
        },
      },
      sessionUpdate: {
        passengerName: name,
        passengerAge: age,
        passengerGender: gender,
        passengerPhone: phone,
        passengerEmail: `${name.toLowerCase().replace(/\s+/g, '.') || 'traveler'}@wishme.in`,
      },
    };
  }

  // ─── 7. Seats & Add-ons Step ────────────────────────────────────────────────
  if (session.step === 'flight_addons') {
    const isAisle = lower.includes('aisle');
    const isMiddle = lower.includes('middle');
    const seatNo = isAisle ? '12C' : isMiddle ? '12B' : '12A';
    const seatName = isAisle ? 'Aisle seat 12C' : isMiddle ? 'Middle seat 12B' : 'Window seat 12A';

    const airline = session.data.airline || 'IndiGo';
    const fromCity = session.data.fromCity || 'Pune (PNQ)';
    const toCity = session.data.toCity || 'Mumbai (BOM)';
    const date = session.data.travelDate || 'tomorrow';
    const time = session.data.departureTime || '7:00 AM';
    const paxName = session.data.passengerName || 'Rahul Sharma';
    const basePrice = session.data.flightPrice || 3800;
    const seatPrice = 350;
    const total = basePrice + seatPrice;

    return {
      message: `Selected ${seatName}. Here is your booking summary: ${airline} flight from ${fromCity} to ${toCity}, ${date} at ${time}, Passenger ${paxName}, ${seatName}. Total amount is ${total} rupees. Shall I proceed and complete payment from your WishMe Wallet?`,
      nextStep: 'flight_payment',
      action: {
        type: 'select_seat',
        targetView: 'flightReviewPay',
        payload: {
          seatNo,
          seatPrice,
          totalAmount: total,
        },
      },
      sessionUpdate: {
        seatNo,
        totalAmount: total,
      },
    };
  }

  // ─── 8. Review & Payment Step ───────────────────────────────────────────────
  if (session.step === 'flight_payment') {
    const isPositive =
      lower.includes('yes') ||
      lower.includes('pay') ||
      lower.includes('proceed') ||
      lower.includes('confirm') ||
      lower.includes('wallet') ||
      lower.includes('done') ||
      lower.includes('ok') ||
      lower.includes('sure');

    if (isPositive) {
      const pnr = `WM${Math.floor(1000 + Math.random() * 9000)}P`;
      return {
        message: `Processing payment from your WishMe Wallet... Payment successful! Your flight is booked. Your PNR is ${pnr} and your e-ticket has been generated. Have a safe and pleasant journey!`,
        nextStep: 'flight_confirmed',
        action: {
          type: 'process_payment',
          targetView: 'flightSuccess',
          payload: {
            pnr,
            ticketNo: `ETKT-${Math.floor(100000000 + Math.random() * 900000000)}`,
          },
        },
        sessionUpdate: { pnr },
      };
    }

    return {
      message: 'Would you like to complete payment now from your WishMe Wallet or UPI?',
      nextStep: 'flight_payment',
    };
  }

  // ─── 9. Completed / Post-Booking ────────────────────────────────────────────
  if (session.step === 'flight_confirmed') {
    if (lower.includes('another') || lower.includes('book flight') || lower.includes('new flight')) {
      return {
        message: 'Starting a new flight booking. Where would you like to travel from and to?',
        nextStep: 'flight_route',
        action: { type: 'navigate_service', targetView: 'flights' },
      };
    }
    return {
      message: 'Your flight is confirmed and your e-ticket is available. Let me know if you need hotel accommodations or anything else!',
      nextStep: 'flight_confirmed',
    };
  }

  // ─── Fallback ───────────────────────────────────────────────────────────────
  return {
    message: 'I am here to help you book your flight hands-free. Say "Book a flight for me" to get started.',
    nextStep: 'idle',
  };
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
