/**
 * In-App Agentic Engine
 *
 * Fast, robust, zero-latency agent engine running directly inside the app.
 * Handles intent classification, multi-turn slot filling, and sequential action planning
 * across all 40+ WishMe services.
 */

import {
  ALL_INTENTS,
  matchIntent,
  getIntentDef,
  type IntentDefinition,
  type SlotDefinition,
} from '@/constants/agentKnowledge';
import type { AgentStep } from '@/context/AgentStateContext';

export interface AgentEngineResult {
  mode: 'chat' | 'agent';
  message: string;
  intent: string | null;
  slots: Record<string, unknown>;
  missingSlots: string[];
  nextQuestion: string | null;
  actionPlan: AgentStep[] | null;
  suggestions?: string[];
  actions?: Array<{ type: 'navigate' | 'fillForm' | 'search' | 'showInfo'; route: string; label: string }>;
}

// ─── Slot Extraction Logic ───────────────────────────────────────────────────

export function extractSlots(
  text: string,
  intentDef: IntentDefinition,
  existingSlots: Record<string, unknown>,
): Record<string, unknown> {
  const lower = text.toLowerCase().trim();
  const slots: Record<string, unknown> = { ...existingSlots };

  for (const slot of intentDef.slots) {
    if (slots[slot.key] !== undefined && slots[slot.key] !== '') continue;

    // Check select options
    if (slot.type === 'select' && slot.options) {
      for (const opt of slot.options) {
        if (lower.includes(opt.toLowerCase())) {
          slots[slot.key] = opt;
          break;
        }
      }
    }

    // Number extraction
    if (slot.type === 'number' || slot.key === 'addAmount') {
      const numMatch = text.match(/₹?\s*(\d+)/);
      if (numMatch) {
        slots[slot.key] = parseInt(numMatch[1], 10);
      }
    }

    // Date extraction
    if (slot.type === 'date') {
      if (lower.includes('today') || lower.includes('tonight')) slots[slot.key] = 'Today';
      else if (lower.includes('tomorrow')) slots[slot.key] = 'Tomorrow';
      else {
        const dateMatch = text.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|[A-Za-z]+\s+\d{1,2})\b/);
        if (dateMatch) slots[slot.key] = dateMatch[1];
      }
    }
  }

  return slots;
}

// ─── Build Action Plan ───────────────────────────────────────────────────────

export function generateActionPlan(
  intentDef: IntentDefinition,
  slots: Record<string, unknown>,
): AgentStep[] {
  const steps: AgentStep[] = [];
  const primaryScreen = intentDef.screens[0];
  if (!primaryScreen) return [];

  // 1. Navigation step
  steps.push({
    type: 'navigate',
    route: primaryScreen.route,
    serviceView: intentDef.category === 'Travel'
      ? (intentDef.intent === 'flight_booking' ? 'flights' : intentDef.intent === 'hotel_booking' ? 'hotels' : 'busTickets')
      : undefined,
    billKind: intentDef.intent.startsWith('bill_') ? intentDef.intent.replace('bill_', '') : undefined,
    label: `Opening ${primaryScreen.name}...`,
  });

  // 2. Prefill step
  const prefillData: Record<string, unknown> = {};

  if (intentDef.intent === 'celebrity_wish') {
    if (slots.celebrity) prefillData.search = String(slots.celebrity);
    if (slots.occasion) prefillData.occasion = String(slots.occasion);
    if (slots.recipientName) prefillData.recipientName = String(slots.recipientName);
    if (slots.message) prefillData.message = String(slots.message);
    if (slots.language) prefillData.language = String(slots.language);
  } else if (intentDef.intent === 'voice_call_wish') {
    if (slots.celebrity) prefillData.search = String(slots.celebrity);
    if (slots.occasion) prefillData.occasion = String(slots.occasion);
    if (slots.recipientName) prefillData.recipientName = String(slots.recipientName);
    if (slots.tone) prefillData.tone = String(slots.tone);
    if (slots.language) prefillData.language = String(slots.language);
  } else if (intentDef.intent === 'flight_booking') {
    if (slots.fromCity) prefillData.fromCity = String(slots.fromCity);
    if (slots.toCity) prefillData.toCity = String(slots.toCity);
    if (slots.travelDate) prefillData.travelDate = String(slots.travelDate);
    if (slots.travellers) prefillData.travellers = String(slots.travellers);
    if (slots.cabin) prefillData.cabin = String(slots.cabin);
  } else if (intentDef.intent === 'hotel_booking') {
    if (slots.hotelCity) prefillData.hotelCity = String(slots.hotelCity);
    if (slots.checkIn) prefillData.checkIn = String(slots.checkIn);
    if (slots.checkOut) prefillData.checkOut = String(slots.checkOut);
    if (slots.rooms) prefillData.rooms = Number(slots.rooms);
    if (slots.adults) prefillData.adults = Number(slots.adults);
  } else if (intentDef.intent === 'bus_booking') {
    if (slots.busFrom) prefillData.busFrom = String(slots.busFrom);
    if (slots.busTo) prefillData.busTo = String(slots.busTo);
    if (slots.busDate) prefillData.busDate = String(slots.busDate);
  } else if (intentDef.intent.startsWith('bill_')) {
    if (slots.billConsumerNumber) prefillData.billConsumerNumber = String(slots.billConsumerNumber);
    if (slots.billOperator) prefillData.billOperator = String(slots.billOperator);
  } else if (intentDef.intent === 'generate_song') {
    if (slots.songTitle) prefillData.songTitle = String(slots.songTitle);
    if (slots.songDescription) prefillData.songDescription = String(slots.songDescription);
    if (slots.songGenre) prefillData.songGenre = String(slots.songGenre);
    if (slots.songMood) prefillData.songMood = String(slots.songMood);
    if (slots.songLanguage) prefillData.songLanguage = String(slots.language || slots.songLanguage);
    prefillData.musicTab = 0;
  } else if (intentDef.intent === 'text_to_speech') {
    if (slots.ttsText) prefillData.ttsText = String(slots.ttsText);
    prefillData.musicTab = 1;
  } else if (intentDef.intent === 'sound_effects') {
    if (slots.sfxPrompt) prefillData.sfxPrompt = String(slots.sfxPrompt);
    prefillData.musicTab = 3;
  } else if (intentDef.intent === 'greeting_card') {
    if (slots.occasion) prefillData.occasion = String(slots.occasion);
    if (slots.recipientName) prefillData.recipientName = String(slots.recipientName);
    if (slots.message) prefillData.message = String(slots.message);
  } else if (intentDef.intent === 'photo_wish') {
    if (slots.occasion) prefillData.occasion = String(slots.occasion);
    if (slots.textStyle) prefillData.textStyle = String(slots.textStyle);
    if (slots.message) prefillData.message = String(slots.message);
  } else if (intentDef.intent === 'wallet_add') {
    if (slots.addAmount) prefillData.addAmount = Number(slots.addAmount);
  }

  if (Object.keys(prefillData).length > 0) {
    steps.push({
      type: 'prefill',
      fields: prefillData,
      label: 'Filling in your details...',
    });
  }

  // 3. Confirm step if payment is involved
  if (intentDef.confirmBeforePayment) {
    steps.push({
      type: 'confirm',
      label: 'Waiting for your review...',
      message: `All details have been filled in for ${intentDef.displayName}! Please review and confirm to proceed.`,
    });
  }

  // 4. Complete step
  steps.push({
    type: 'complete',
    label: 'Done! ✅',
    message: `All set! I've opened ${primaryScreen.name} and pre-filled your details. Let me know if you need anything else!`,
  });

  return steps;
}

export interface DirectNavigationTarget {
  route: string;
  serviceView?: string;
  billKind?: string;
  sectionName: string;
  confirmMessage: string;
}

export function detectDirectSection(query: string): DirectNavigationTarget | null {
  const q = query.toLowerCase().trim();

  // 1. Flights
  if (
    q.includes('flight') ||
    q.includes('flights') ||
    q.includes('plane') ||
    q.includes('airplane') ||
    q.includes('fly to') ||
    q.includes('airline')
  ) {
    return {
      route: '/services',
      serviceView: 'flights',
      sectionName: 'Flights',
      confirmMessage: 'Taking you to Flights section right now! ✈️',
    };
  }

  // 2. Hotels
  if (
    q.includes('hotel') ||
    q.includes('hotels') ||
    q.includes('room booking') ||
    q.includes('stay') ||
    q.includes('resort')
  ) {
    return {
      route: '/services',
      serviceView: 'hotels',
      sectionName: 'Hotels',
      confirmMessage: 'Taking you to Hotels section right now! 🏨',
    };
  }

  // 3. Bus Tickets
  if (
    q.includes('bus') ||
    q.includes('bus ticket') ||
    q.includes('bus booking')
  ) {
    return {
      route: '/services',
      serviceView: 'busTickets',
      sectionName: 'Bus Booking',
      confirmMessage: 'Taking you to Bus booking section right now! 🚌',
    };
  }

  // 4. Specific Bills & Utilities
  if (q.includes('electricity') || q.includes('bijli') || q.includes('light bill')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'electricity',
      sectionName: 'Electricity Bill',
      confirmMessage: 'Taking you to Electricity Bill payment now! ⚡',
    };
  }

  if (q.includes('water bill') || q.includes('water payment') || q.includes('pani bill')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'water',
      sectionName: 'Water Bill',
      confirmMessage: 'Taking you to Water Bill payment now! 💧',
    };
  }

  if (q.includes('gas') || q.includes('lpg') || q.includes('cylinder') || q.includes('piped gas')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'gas',
      sectionName: 'Gas Bill',
      confirmMessage: 'Taking you to Gas Bill payment now! 🔥',
    };
  }

  if (q.includes('recharge') || q.includes('mobile bill') || q.includes('phone bill') || q.includes('prepaid')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'mobile',
      sectionName: 'Mobile Recharge',
      confirmMessage: 'Taking you to Mobile Recharge now! 📱',
    };
  }

  if (q.includes('dth') || q.includes('tata sky') || q.includes('dish tv') || q.includes('set top box')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'dth',
      sectionName: 'DTH Recharge',
      confirmMessage: 'Taking you to DTH Recharge now! 📺',
    };
  }

  if (q.includes('fastag') || q.includes('toll')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'fastag',
      sectionName: 'FASTag Recharge',
      confirmMessage: 'Taking you to FASTag Recharge now! 🚗',
    };
  }

  if (q.includes('broadband') || q.includes('wifi') || q.includes('internet bill')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'broadband',
      sectionName: 'Broadband Bill',
      confirmMessage: 'Taking you to Broadband Bill payment now! 🌐',
    };
  }

  if (q.includes('credit card')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'creditCard',
      sectionName: 'Credit Card Bill',
      confirmMessage: 'Taking you to Credit Card payment now! 💳',
    };
  }

  if (q.includes('loan') || q.includes('emi')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'loanEmi',
      sectionName: 'Loan EMI Payment',
      confirmMessage: 'Taking you to Loan EMI payment now! 🏦',
    };
  }

  if (q.includes('insurance') || q.includes('policy premium')) {
    return {
      route: '/services',
      serviceView: 'billPay',
      billKind: 'insurance',
      sectionName: 'Insurance Payment',
      confirmMessage: 'Taking you to Insurance payment now! 🛡️',
    };
  }

  if (q.includes('bill') || q.includes('billing') || q.includes('utilities')) {
    return {
      route: '/services',
      serviceView: 'bills',
      sectionName: 'Bills & Utilities',
      confirmMessage: 'Taking you to Bills & Utilities section now! 💡',
    };
  }

  // 5. Celebrity Services
  if (q.includes('celebrity') || q.includes('star') || q.includes('actor') || q.includes('video wish')) {
    return {
      route: '/wish-celebrity',
      sectionName: 'Celebrity Wishes',
      confirmMessage: 'Taking you to Celebrity Video Wishes now! 🎬',
    };
  }

  if (q.includes('voice call') || q.includes('phone wish')) {
    return {
      route: '/voice-call-wish',
      sectionName: 'Voice Call Wish',
      confirmMessage: 'Taking you to Celebrity Voice Calls now! 📞',
    };
  }

  // 6. Music Studio
  if (q.includes('song') || q.includes('music') || q.includes('sing') || q.includes('audio track')) {
    return {
      route: '/(tabs)/music',
      sectionName: 'AI Music Studio',
      confirmMessage: 'Taking you to AI Music Studio now! 🎵',
    };
  }

  // 7. Wallet & Balance
  if (q.includes('wallet') || q.includes('balance') || q.includes('funds') || q.includes('add money')) {
    return {
      route: '/wallet',
      sectionName: 'WishMe Wallet',
      confirmMessage: 'Opening your WishMe Wallet now! 💳',
    };
  }

  // 8. Occasions & Reminders
  if (q.includes('occasion') || q.includes('birthday') || q.includes('anniversary') || q.includes('reminder')) {
    return {
      route: '/occasions',
      sectionName: 'Occasion Reminders',
      confirmMessage: 'Opening Occasions & Reminders now! 🎂',
    };
  }

  // 9. Greeting Cards
  if (q.includes('greeting card') || q.includes('card') || q.includes('ecard')) {
    return {
      route: '/greeting-cards',
      sectionName: 'AI Greeting Cards',
      confirmMessage: 'Opening AI Greeting Cards now! 💌',
    };
  }

  return null;
}

// ─── Main Process Message Function ───────────────────────────────────────────

export function processAgentMessage(
  query: string,
  currentIntentName: string | null,
  collectedSlots: Record<string, unknown>,
): AgentEngineResult {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct Ultra-Specific Section Navigation (Immediate Routing)
  const directTarget = detectDirectSection(trimmed);
  if (directTarget) {
    const matchedDef = matchIntent(trimmed);
    const initialSlots = matchedDef ? extractSlots(trimmed, matchedDef, {}) : {};

    const plan: AgentStep[] = [
      {
        type: 'navigate',
        route: directTarget.route,
        serviceView: directTarget.serviceView,
        billKind: directTarget.billKind,
        label: `Opening ${directTarget.sectionName}...`,
      },
    ];

    if (Object.keys(initialSlots).length > 0) {
      plan.push({
        type: 'prefill',
        fields: initialSlots,
        label: `Setting details...`,
      });
    }

    return {
      mode: 'agent',
      message: directTarget.confirmMessage,
      intent: matchedDef?.intent ?? null,
      slots: initialSlots,
      missingSlots: [],
      nextQuestion: null,
      actionPlan: plan,
      actions: [
        {
          type: 'navigate',
          route: directTarget.route,
          label: `Go to ${directTarget.sectionName}`,
        },
      ],
    };
  }

  // Determine intent (either continued from state or newly matched)
  let intentDef: IntentDefinition | undefined = currentIntentName
    ? getIntentDef(currentIntentName)
    : matchIntent(trimmed);

  // ── IN-PROGRESS AGENT FLOW ────────────────────────────────────────────────
  if (intentDef && currentIntentName) {
    const isSkip = lower.includes('skip') || lower === 'no' || lower === 'default' || lower === 'none';

    // Find the current pending slot we were asking for
    const missingBefore = intentDef.slots.filter(
      (s) => s.required && (collectedSlots[s.key] === undefined || collectedSlots[s.key] === ''),
    );
    const optionalBefore = intentDef.slots.filter(
      (s) => !s.required && (collectedSlots[s.key] === undefined || collectedSlots[s.key] === ''),
    );

    const pendingSlot = missingBefore[0] ?? (isSkip ? null : optionalBefore[0]);

    let updatedSlots = extractSlots(trimmed, intentDef, collectedSlots);

    // If the slot couldn't be auto-extracted by regex/options, assign the free text to the pending slot
    if (pendingSlot && (updatedSlots[pendingSlot.key] === undefined || updatedSlots[pendingSlot.key] === '')) {
      if (!isSkip) {
        updatedSlots[pendingSlot.key] = trimmed;
      }
    }

    const remainingRequired = intentDef.slots.filter(
      (s) => s.required && (updatedSlots[s.key] === undefined || updatedSlots[s.key] === ''),
    );
    const remainingOptional = intentDef.slots.filter(
      (s) => !s.required && (updatedSlots[s.key] === undefined || updatedSlots[s.key] === ''),
    );

    // If all required slots are collected (and user answered or skipped optional)
    if (remainingRequired.length === 0 && (remainingOptional.length === 0 || isSkip)) {
      const plan = generateActionPlan(intentDef, updatedSlots);
      return {
        mode: 'agent',
        message: `Great! I've got everything I need for your ${intentDef.displayName}. Doing this for you now! 🚀`,
        intent: intentDef.intent,
        slots: updatedSlots,
        missingSlots: [],
        nextQuestion: null,
        actionPlan: plan,
      };
    }

    // Ask next question
    const nextSlot = remainingRequired[0] ?? remainingOptional[0];
    return {
      mode: 'agent',
      message: nextSlot.question,
      intent: intentDef.intent,
      slots: updatedSlots,
      missingSlots: [...remainingRequired, ...remainingOptional].map((s) => s.key),
      nextQuestion: nextSlot.question,
      suggestions: nextSlot.options?.slice(0, 5) ?? (nextSlot.example ? [nextSlot.example] : []),
      actionPlan: null,
    };
  }

  // ── NEW INTENT MATCHED ────────────────────────────────────────────────────
  if (intentDef) {
    const initialSlots = extractSlots(trimmed, intentDef, {});
    const plan = generateActionPlan(intentDef, initialSlots);
    return {
      mode: 'agent',
      message: `Opening ${intentDef.displayName} for you now! 🚀`,
      intent: intentDef.intent,
      slots: initialSlots,
      missingSlots: [],
      nextQuestion: null,
      actionPlan: plan,
    };
  }

  // ── GENERAL CHAT / FALLBACK ───────────────────────────────────────────────
  const navMatches = ALL_INTENTS.slice(0, 4).map((i) => ({
    type: 'navigate' as const,
    route: i.screens[0].route,
    label: i.displayName,
  }));

  return {
    mode: 'chat',
    message: "I'm your WishMe AI Assistant! I can help you book celebrity video wishes, search flights & hotels, pay utility bills, generate songs & voiceovers, top up your wallet, and more.\n\nWhat would you like to do today?",
    intent: null,
    slots: {},
    missingSlots: [],
    nextQuestion: null,
    actionPlan: null,
    suggestions: [
      '🎬 Celebrity Wish',
      '✈️ Book Flight',
      '🎵 Make a Song',
      '💡 Pay Bill',
      '💳 Check Wallet',
    ],
    actions: navMatches,
  };
}
