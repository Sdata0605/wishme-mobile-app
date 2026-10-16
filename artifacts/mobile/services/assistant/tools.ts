/**
 * Tools the voice assistant may call. Each one maps to something the app already does:
 * navigation, prefilled forms, searches, and phone actions.
 *
 * Safety rules enforced here (not left to the model):
 *  - Payments are never made by the assistant; it only gets the user to the pay screen.
 *  - Calls only go out after the model passes user_confirmed=true.
 *  - Only http/https links are ever opened.
 */

import type { Router } from 'expo-router';
import type { AgentPrefill } from '@/context/AgentStateContext';
import type { LiveToolCall } from '@/services/geminiLive/client';
import { HOTEL_CITIES } from '@/components/all-services/hotelData';
import {
  getOptionSet,
  getServicesController,
  waitForController,
  waitForOptions,
  type OptionSet,
} from './bridge';
import { resolveAirport, resolveHotelCity } from './cities';
import { findContacts, openApp, openAppSettings, openWebsite, placeCall } from './phone';
import { extractSpokenNumber } from './spokenNumber';
import { checkPhoneNumber, describeCall, fetchAiCall, fetchLatestAiCall, isActive, startAiCall, whoLabel } from './aiCalls';
import { UI_FUNCTION_DECLARATIONS, runUiTool } from './uiTools';
import { HUB_FUNCTION_DECLARATIONS, runHubTool, type HubToolContext } from './hubTools';
import { resolveLanguage, SARVAM_LANGUAGE_NAMES, type LanguageRequest } from './languages';
import { DOC_FUNCTION_DECLARATIONS, runDocTool, type DocToolContext } from './docTools';
import { WEB_FUNCTION_DECLARATIONS, runWebTool } from './webSearch';

export interface ToolContext extends HubToolContext, DocToolContext {
  router: Router;
  setPrefill: (data: Partial<AgentPrefill>) => void;
  /** Called when a tool changes what is on screen, so the UI can react. */
  onAction?: (label: string) => void;
  /** Called right before handing over to the phone dialer / a browser / another app. */
  onLeaveApp?: () => void;
  /** The logged-in user's access token (refreshed if stale). */
  getAccessToken?: () => Promise<string | null | undefined>;
  /** The server refused the login (401): the app checks it and signs the user out if it has really ended. */
  onAuthRejected?: () => void;
  /** Follow an AI call until it ends, then report the result to the user. */
  watchAiCall?: (id: string, scheduled?: boolean) => void;
  /** Switch the spoken language. Returns ok:false when the current voice cannot speak it. */
  setLanguage?: (language: LanguageRequest) => Promise<{ ok: boolean; error?: string }>;
}

// ─── Screens the assistant can open ──────────────────────────────────────────

type ScreenTarget = { route: string; params?: Record<string, string>; label: string };

const SCREENS: Record<string, ScreenTarget> = {
  home: { route: '/(tabs)', label: 'Home' },
  all_services: { route: '/(tabs)/all-services', label: 'All services' },
  celebrities: { route: '/(tabs)/celebrities', label: 'Celebrities' },
  music: { route: '/(tabs)/music', label: 'Music studio' },
  voice_call: { route: '/(tabs)/voice-call', label: 'Celebrity voice call' },
  profile: { route: '/(tabs)/profile', label: 'Profile' },
  scan_and_pay: { route: '/(tabs)/scan-pay', label: 'Scan & pay' },
  wallet: { route: '/wallet', label: 'Wallet' },
  my_bookings: { route: '/bookings', label: 'My bookings' },
  wish_orders: { route: '/wish-orders', label: 'Wish orders' },
  favorites: { route: '/favorites', label: 'Favorites' },
  following: { route: '/following', label: 'Following' },
  messages: { route: '/messages', label: 'Messages' },
  loved_ones: { route: '/loved-ones', label: 'Loved ones' },
  occasions: { route: '/occasions', label: 'Occasions' },
  occasion_alerts: { route: '/occasion-alerts', label: 'Occasion alerts' },
  referrals: { route: '/referrals', label: 'Referrals' },
  settings: { route: '/settings', label: 'Settings' },
  support: { route: '/support', label: 'Support' },
  edit_profile: { route: '/edit-profile', label: 'Edit profile' },
  greeting_cards: { route: '/greeting-cards', label: 'Greeting cards' },
  photo_wish: { route: '/photo-wish', label: 'Photo wish' },
  image_promotions: { route: '/image-promotions', label: 'Image promotions' },
  ugc_videos: { route: '/ugc-videos', label: 'UGC videos' },
  ugc_ads: { route: '/ugc-ads', label: 'UGC ads' },
  for_business: { route: '/for-business', label: 'WishMe for business' },
  wish_celebrity: { route: '/wish-celebrity', label: 'Celebrity wish' },
  wish_friend: { route: '/wish-friend', label: 'Wish a friend' },
  select_plan: { route: '/select-plan', label: 'Plans' },
  travel: { route: '/services', params: { start: 'travel' }, label: 'Travel' },
  bills: { route: '/services', params: { start: 'bills' }, label: 'Bills' },
  recharge: { route: '/services', params: { start: 'recharge' }, label: 'Recharge' },
  finance: { route: '/services', params: { start: 'finance' }, label: 'Finance' },
  flights: { route: '/services', params: { start: 'flights' }, label: 'Flights' },
  hotels: { route: '/services', params: { start: 'hotels' }, label: 'Hotels' },
  bus_tickets: { route: '/services', params: { start: 'busTickets' }, label: 'Bus tickets' },
  my_tickets: { route: '/services', params: { start: 'myTickets' }, label: 'My tickets' },
  ai_calls: { route: '/ai-calls', label: 'AI calls' },
  hub: { route: '/hub', label: 'Hub' },
  calendar: { route: '/calendar', label: 'Calendar' },
  reminders: { route: '/reminders', label: 'Reminders' },
  call_logs: { route: '/call-logs', label: 'Call logs' },
  documents: { route: '/documents', label: 'Documents' },
  my_finance: { route: '/finance', label: 'Finance' },
  features: { route: '/features', label: 'Features' },
  ai_home: { route: '/(tabs)/assistant', label: 'AI home' },
};

const BILL_KINDS = [
  'electricity',
  'water',
  'gas',
  'broadband',
  'dth',
  'landline',
  'mobile',
  'creditCard',
  'loanEmi',
  'fastag',
  'insurance',
] as const;

/** One-line hint per screen, so similar names (bookings / orders / tickets) aren't confused. */
const SCREEN_HELP: Record<string, string> = {
  home: 'home dashboard (bottom tab Home)',
  all_services: 'Services tab: grid of all services',
  celebrities: 'browse and search celebrities',
  music: 'AI music studio (songs, text to speech, sound effects)',
  voice_call: 'book a live voice call with a celebrity',
  profile: 'Profile tab',
  scan_and_pay: 'Scan tab: scan a QR code to pay',
  wallet: 'Wallet tab: balance and add money',
  my_bookings: "Bookings: the user's celebrity bookings",
  wish_orders: 'Wish orders: wishes the user has ordered',
  favorites: 'favourite celebrities',
  following: 'celebrities the user follows',
  messages: 'chats and messages with celebrities',
  loved_ones: 'saved loved ones',
  occasions: 'occasions: book a celebrity for an occasion',
  occasion_alerts: 'occasion alerts and reminders',
  referrals: 'refer a friend and earnings',
  settings: 'app settings',
  support: 'help and support',
  edit_profile: 'edit name, email and profile',
  greeting_cards: 'create AI greeting cards',
  photo_wish: 'create an AI photo wish',
  image_promotions: 'celebrity image promotions for brands',
  ugc_videos: 'UGC videos',
  ugc_ads: 'UGC ads',
  for_business: 'WishMe for business',
  wish_celebrity: 'Wish a Celebrity: order a celebrity video wish',
  wish_friend: 'Wish a Friend: send a wish to a friend',
  select_plan: 'My Plan: membership plans',
  travel: 'Travel hub (flights, hotels, buses)',
  bills: 'Bills hub (electricity, water, gas and more)',
  recharge: 'Recharge hub (mobile, DTH, FASTag)',
  finance: 'Finance hub (credit card, loan EMI, insurance)',
  flights: 'flight search form',
  hotels: 'hotel search form',
  bus_tickets: 'bus ticket search form',
  my_tickets: 'bus tickets the user has already booked',
  ai_calls: 'calls the assistant made for the user, with what was said',
  hub: 'Hub: calendar, reminders and call logs in one place',
  calendar: 'month calendar of the user’s events',
  reminders: 'the user’s reminders, including undated ones',
  call_logs: 'past AI calls with transcripts and recordings to play',
  my_finance: 'the user’s EMIs, incomes and recurring expenses, with totals',
  features: 'what the app can do: live, in progress and coming soon',
  ai_home: 'the AI home: the day at a glance, agenda and month heat-map',
  documents: 'documents the assistant has written: reports, letters, notes, plans and spreadsheets, as files to share or save',
};

// ─── Declarations sent to Gemini ─────────────────────────────────────────────

const str = (description: string) => ({ type: 'STRING', description });
const num = (description: string) => ({ type: 'NUMBER', description });

const APP_FUNCTION_DECLARATIONS = [
  {
    name: 'open_screen',
    description:
      'Open a screen or section of the WishMe app. Screens: ' +
      Object.keys(SCREENS)
        .map((k) => `${k} = ${SCREEN_HELP[k] ?? SCREENS[k].label}`)
        .join('; ') +
      '.',
    parameters: {
      type: 'OBJECT',
      properties: { screen: { type: 'STRING', enum: Object.keys(SCREENS) } },
      required: ['screen'],
    },
  },
  {
    name: 'go_back',
    description: 'Go back to the previous screen.',
  },
  {
    name: 'search_flights',
    description:
      'Search flights and show the results on screen. Always ask the user for origin, destination and date first if any is missing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        origin: str('Departure city, e.g. Mumbai'),
        destination: str('Arrival city, e.g. Goa'),
        date: str('Travel date as YYYY-MM-DD'),
        adults: num('Number of adults, default 1'),
        children: num('Number of children, default 0'),
        infants: num('Number of infants, default 0'),
        cabin: { type: 'STRING', enum: ['economy', 'premium_economy', 'business', 'first'] },
      },
      required: ['origin', 'destination', 'date'],
    },
  },
  {
    name: 'search_hotels',
    description: 'Search hotels in a city and show the results on screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        city: str('City, e.g. Goa'),
        check_in: str('Check-in date as YYYY-MM-DD'),
        check_out: str('Check-out date as YYYY-MM-DD'),
        rooms: num('Rooms, default 1'),
        adults: num('Adults, default 2'),
        children: num('Children, default 0'),
      },
      required: ['city', 'check_in', 'check_out'],
    },
  },
  {
    name: 'search_buses',
    description: 'Search bus tickets between two cities and show the results on screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from: str('Departure city'),
        to: str('Arrival city'),
        date: str('Travel date as YYYY-MM-DD'),
      },
      required: ['from', 'to', 'date'],
    },
  },
  {
    name: 'list_options',
    description:
      'Read the flights, hotels or buses currently shown on screen (numbered from 1). Use this before the user chooses one.',
  },
  {
    name: 'choose_option',
    description:
      'Select one of the numbered options currently on screen (flight, hotel or bus) as if the user tapped it.',
    parameters: {
      type: 'OBJECT',
      properties: { number: num('Option number from list_options, starting at 1') },
      required: ['number'],
    },
  },
  {
    name: 'choose_fare',
    description:
      'On the flight fare screen, pick the standard fare and continue to passenger details.',
  },
  {
    name: 'open_bill',
    description:
      'Open the bill payment or recharge screen for a utility. Never pays; the user taps to pay.',
    parameters: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', enum: [...BILL_KINDS] },
        consumer_number: str('Consumer / account / mobile number if the user said it'),
      },
      required: ['kind'],
    },
  },
  {
    name: 'start_wish',
    description:
      'Start creating a wish: a celebrity video wish (Wish a Celebrity), a celebrity voice call, an AI photo wish, a wish for a friend, or a greeting card. Opens the right screen. Tell the user which details were filled in and what they still need to choose.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['celebrity_video', 'celebrity_call', 'photo', 'friend', 'greeting_card'],
        },
        celebrity: str('Celebrity name to search for'),
        occasion: str('e.g. Birthday, Anniversary'),
        recipient_name: str('Who the wish is for'),
        message: str('What the wish should say'),
        language: str('Language for the wish'),
      },
      required: ['type'],
    },
  },
  {
    name: 'make_music',
    description: 'Open the music studio to create a song, text-to-speech audio, or a sound effect.',
    parameters: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', enum: ['song', 'text_to_speech', 'sound_effect'] },
        title: str('Song title'),
        description: str('What the song or sound should be about'),
        genre: str('Music genre'),
        mood: str('Mood'),
        language: str('Language'),
        text: str('Text to speak, for text_to_speech'),
      },
      required: ['kind'],
    },
  },
  {
    name: 'add_wallet_money',
    description: 'Open the wallet with an amount filled in. The user taps to pay.',
    parameters: {
      type: 'OBJECT',
      properties: { amount: num('Amount in rupees') },
      required: ['amount'],
    },
  },
  {
    name: 'add_occasion',
    description: "Open the occasions screen to save someone's birthday or anniversary.",
    parameters: {
      type: 'OBJECT',
      properties: {
        person_name: str('Person name'),
        type: str('Birthday or Anniversary'),
        date: str('Date as YYYY-MM-DD'),
      },
      required: ['person_name'],
    },
  },
  {
    name: 'open_website',
    description:
      'Open a website in the phone browser, only when the user asks to open a site or to search in the browser. NEVER use it to answer a question: use web_search for that. Give url for a specific site, or search_query for a search. This leaves the WishMe app: right after using the screen it asks for a spoken confirmation first.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: str('Website address, e.g. flipkart.com'),
        search_query: str('Text to search on Google'),
        user_confirmed: { type: 'BOOLEAN', description: 'True only after the user said yes to leaving the app.' },
      },
    },
  },
  {
    name: 'open_app',
    description:
      'Open ANY app installed on the phone (it checks the phone\'s own list of apps: ChatGPT, Claude, a bank, a game, anything). Call it for every "open <app>" in any language ("WhatsApp kholo", "ಯೂಟ್ಯೂಬ್ ತೆರೆಯಿರಿ", "open ChatGPT in my mobile"). Pass app_name exactly as heard, in the script it was heard, never translated or corrected. It opens straight away, so NEVER ask the user for permission or confirmation first, do not announce it before doing it, and NEVER say an app is missing unless this tool returned not_found or not_installed. If it returns not_found with closest_installed and one of them is plainly the app meant, call open_app again at once with that exact name, without asking. After ok:true the app is already open: do not call open_app again. Never use this for "tap/press/click X": that is a button on the current WishMe screen, so use tap. Never use it for a screen of WishMe itself: use open_screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        app_name: str('App name exactly as the user said it'),
        play_store: { type: 'BOOLEAN', description: 'True only after the user agreed to search the Play Store for an app that was not found.' },
      },
      required: ['app_name'],
    },
  },
  {
    name: 'call_contact',
    description:
      "ONLY when the user clearly says they want to TALK THEMSELVES (\"connect me to mummy\", \"let me talk to him\", \"just dial\", \"I will speak\"): it opens the user's own phone call, and the assistant plays no part in it. It is NOT the default. When the user just says \"call X\" (with or without a message), you make the call and speak with the person yourself: use ai_call. You must pass user_will_talk=true, which is only allowed if the user explicitly said they will talk themselves. First call it without user_confirmed to look the person up, then ask \"shall I connect your call?\", and only call again with user_confirmed=true after they say yes.",
    parameters: {
      type: 'OBJECT',
      properties: {
        name: str('Contact name'),
        number: str('Exact phone number to call (from a previous lookup, or one the user said)'),
        user_will_talk: { type: 'BOOLEAN', description: 'True only if the user explicitly said they want to talk to the person themselves.' },
        user_confirmed: { type: 'BOOLEAN', description: 'True only after the user said yes to connecting the call.' },
      },
      required: ['user_will_talk'],
    },
  },
  {
    name: 'ai_call',
    description:
      'The DEFAULT way to call anyone. The assistant phones the person, SPEAKS WITH THEM for the user (it says it is an AI and that the call is recorded), and then reports back what they said. Use it whenever the user asks you to call someone: family, friends, clinics, shops, banks, anyone. "Call Rahul and tell him I will be late", "call the clinic and book an appointment", "call mummy and ask if she has eaten" are all ai_call. THE MOMENT the user names a person, call this tool with `name`, even if you do not yet know what to say: the app searches the user\'s contacts by itself, in any language or script, and finds the number. NEVER ask the user for a phone number before you have tried this. Only when the tool answers that no contact was found, or that contacts are unavailable, ask the user to say the number. If the tool answers that the purpose is missing, ask "What should I tell <name>?" and never invent a purpose. NEVER for emergencies. When the tool returns needs_confirmation, read back who, the number and what you will say, and only call again with user_confirmed=true after a clear yes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: str('Who to call, exactly as the user said it, e.g. "Rahul" or "Dr Sharma clinic" (looked up in the contacts)'),
        number: str('Exact phone number, only if the user said one out loud or a lookup already found one. Never ask the user for it just to place a call to a saved contact.'),
        purpose: str('What the user ACTUALLY asked the call to achieve, in a sentence, including dates and times. Never invent or assume a purpose: if the user has not said what the call is for, leave this out and the tool will tell you to ask. e.g. "Book an appointment with Dr Sharma for tomorrow at 5 pm"'),
        details: str('Useful facts to share: patient name, preferred alternative times, the reason for the visit'),
        language: { type: 'STRING', enum: ['english', 'hindi', 'hinglish'], description: 'Language to speak on the call' },
        user_confirmed: { type: 'BOOLEAN', description: 'True only after the user said yes to this exact call.' },
      },
    },
  },
  {
    name: 'open_app_settings',
    description:
      "Open WishMe's page in the phone settings so the user can switch a permission (such as Contacts) back on. Only use it after they agree, and only when a permission was refused. It leaves the app.",
  },
  {
    name: 'set_language',
    description:
      'Switch the language you speak in. Use it the moment the user asks: "talk in Tamil", "baat Hindi mein karo", "speak English", "can you speak French". Pass the language exactly as they said it. After switching, carry on in that language for the rest of the conversation.',
    parameters: {
      type: 'OBJECT',
      properties: { language: str('The language the user asked for, e.g. "Tamil", "French", "Hindi"') },
      required: ['language'],
    },
  },
  {
    name: 'get_call_result',
    description:
      'Get the status and result of a call the assistant made for the user: what the other person said, the outcome, and what the user should do next. Without call_id it uses the most recent call. Use it when the user asks "what did they say?".',
    parameters: {
      type: 'OBJECT',
      properties: { call_id: str('Id returned by ai_call (optional)') },
    },
  }
];

/** App-specific tools plus the generic hands-free screen tools (read, tap, fill, scroll). */
export const FUNCTION_DECLARATIONS = [
  ...APP_FUNCTION_DECLARATIONS,
  ...HUB_FUNCTION_DECLARATIONS,
  ...DOC_FUNCTION_DECLARATIONS,
  ...WEB_FUNCTION_DECLARATIONS,
  ...UI_FUNCTION_DECLARATIONS,
];

// ─── Execution ───────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function checkDate(value: unknown, label: string): string | { error: string } {
  const v = String(value ?? '');
  if (!ISO_DATE.test(v) || Number.isNaN(new Date(`${v}T00:00:00`).getTime())) {
    return { error: `${label} must be a real date in YYYY-MM-DD format.` };
  }
  if (v < todayIso()) return { error: `${label} is in the past. Today is ${todayIso()}.` };
  return v;
}

const asInt = (v: unknown, fallback: number, min = 0, max = 9) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function summarize(set: OptionSet | null, max = 6) {
  if (!set) return { options: [], note: 'Nothing to choose from on screen right now.' };
  if (set.error && !set.items.length) {
    return {
      ok: false,
      options: [],
      error: set.error,
      instruction:
        'The search failed. Tell the user briefly that this search is not available right now and do NOT retry the same search.',
    };
  }
  return {
    total: set.items.length,
    options: set.items.slice(0, max).map((o, i) => ({ number: i + 1, title: o.title, details: o.detail })),
  };
}

/** Opens /services (if not already there) and waits until its controller is ready. */
async function ensureServices(ctx: ToolContext, start: string) {
  let c = getServicesController();
  if (!c) {
    ctx.router.navigate({ pathname: '/services', params: { start } } as never);
    c = await waitForController();
  }
  return c;
}

/**
 * Contacts are switched off, so no name can be looked up. The call itself still works, so ask for
 * the number rather than giving up.
 */
function contactsBlocked(error: string | undefined, canAskAgain: boolean | undefined) {
  return {
    ok: false,
    permission_needed: 'contacts',
    error: error ?? 'Contacts are not available.',
    instruction: canAskAgain
      ? 'Say that you could not look up the contact because WishMe has no access to the contacts, and ask the user to say the phone number instead. You can still make the call with a number.'
      : 'Say that WishMe is blocked from reading the contacts in the phone settings. Ask the user to either say the phone number out loud, or let you open the settings so they can allow Contacts. Use open_app_settings only if they agree.',
  };
}

/** The AI call the user is being asked to confirm. A call only goes out if it matches this exactly. */
let pendingAiCall: { e164: string; purpose: string; at: number } | null = null;

/** When a screen tool last ran: leaving the app right after is probably a misheard "tap". */
let lastUiToolAt = 0;
const RECENT_UI_MS = 30_000;

/** Asks for a spoken yes before leaving WishMe if the user was just working on a screen. */
function confirmLeaving(a: Record<string, unknown>, what: string): Record<string, unknown> | null {
  if (a.user_confirmed === true || Date.now() - lastUiToolAt > RECENT_UI_MS) return null;
  return {
    ok: false,
    needs_confirmation: true,
    instruction: `The user was just using a screen in WishMe, and speech recognition can mishear a button name (for example "Fetch Bill" as "Facebook"). Ask: "Do you want me to leave WishMe and open ${what}?" If they actually meant a button on the screen, use read_screen and tap it instead. Only call again with user_confirmed=true after they say yes.`,
  };
}

export async function runAssistantTool(
  call: LiveToolCall,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  // Looking something up on the internet.
  const webResult = await runWebTool(call.name, call.args ?? {}, ctx);
  if (webResult) return webResult;

  // Generic screen control (read_screen / tap / fill_field / scroll_screen) is handled first.
  const uiResult = await runUiTool({ name: call.name, args: call.args ?? {} });
  if (uiResult) {
    lastUiToolAt = Date.now();
    if (uiResult.ok !== false) ctx.onAction?.(call.name === 'read_screen' ? 'Reading the screen' : `Using the screen: ${call.name.replace('_', ' ')}`);
    return uiResult;
  }

  const a = call.args ?? {};

  // Reminders and calendar entries created by voice.
  const hubResult = await runHubTool(call.name, a, ctx);
  if (hubResult) return hubResult;

  // Documents: written by the server, rendered and kept on the phone.
  const docResult = await runDocTool(call.name, a, {
    ...ctx,
    openDocument: (id) => ctx.router.push(`/document/${id}` as never),
  });
  if (docResult) return docResult;

  switch (call.name) {
    case 'open_screen': {
      const target = SCREENS[String(a.screen)];
      if (!target) return { ok: false, error: 'Unknown screen.' };
      ctx.router.navigate(
        (target.params ? { pathname: target.route, params: target.params } : target.route) as never,
      );
      ctx.onAction?.(`Opening ${target.label}`);
      return { ok: true, opened: target.label };
    }

    case 'go_back': {
      if (ctx.router.canGoBack()) ctx.router.back();
      return { ok: true };
    }

    case 'search_flights': {
      const from = resolveAirport(String(a.origin ?? ''));
      const to = resolveAirport(String(a.destination ?? ''));
      if (!from) return { ok: false, error: `I couldn't find an airport for "${a.origin}". Ask the user for a nearby major city.` };
      if (!to) return { ok: false, error: `I couldn't find an airport for "${a.destination}". Ask the user for a nearby major city.` };
      if (from.code === to.code) return { ok: false, error: 'Origin and destination are the same.' };
      const date = checkDate(a.date, 'The travel date');
      if (typeof date !== 'string') return { ok: false, ...date };

      const controller = await ensureServices(ctx, 'flights');
      if (!controller) return { ok: false, error: 'Could not open the flights screen.' };
      controller.searchFlights({
        fromCode: from.code,
        fromCity: from.city,
        toCode: to.code,
        toCity: to.city,
        date,
        adults: asInt(a.adults, 1, 1),
        children: asInt(a.children, 0),
        infants: asInt(a.infants, 0),
        cabin: (['economy', 'premium_economy', 'business', 'first'] as const).includes(a.cabin as never)
          ? (a.cabin as 'economy')
          : 'economy',
      });
      ctx.onAction?.(`Searching flights ${from.city} → ${to.city}`);
      const set = await waitForOptions('flights');
      return { ok: true, route: `${from.city} to ${to.city}`, date, ...summarize(set) };
    }

    case 'search_hotels': {
      const checkIn = checkDate(a.check_in, 'Check-in');
      if (typeof checkIn !== 'string') return { ok: false, ...checkIn };
      const checkOut = checkDate(a.check_out, 'Check-out');
      if (typeof checkOut !== 'string') return { ok: false, ...checkOut };
      if (checkOut <= checkIn) return { ok: false, error: 'Check-out must be after check-in.' };

      const city = resolveHotelCity(String(a.city ?? ''), HOTEL_CITIES);
      const controller = await ensureServices(ctx, 'hotels');
      if (!controller) return { ok: false, error: 'Could not open the hotels screen.' };
      controller.searchHotels({
        city,
        checkIn,
        checkOut,
        rooms: asInt(a.rooms, 1, 1),
        adults: asInt(a.adults, 2, 1),
        children: asInt(a.children, 0),
      });
      ctx.onAction?.(`Searching hotels in ${city}`);
      const set = await waitForOptions('hotels', 5000);
      return { ok: true, city, ...summarize(set) };
    }

    case 'search_buses': {
      const date = checkDate(a.date, 'The travel date');
      if (typeof date !== 'string') return { ok: false, ...date };
      const controller = await ensureServices(ctx, 'busTickets');
      if (!controller) return { ok: false, error: 'Could not open the bus screen.' };
      controller.searchBuses({ from: String(a.from ?? ''), to: String(a.to ?? ''), date });
      ctx.onAction?.(`Searching buses ${a.from} → ${a.to}`);
      const set = await waitForOptions('buses', 5000);
      return { ok: true, ...summarize(set) };
    }

    case 'list_options':
      return { ok: true, ...summarize(getOptionSet()) };

    case 'choose_option': {
      const set = getOptionSet();
      const index = asInt(a.number, 0, 0, 999) - 1;
      if (!set || index < 0 || index >= set.items.length) {
        return { ok: false, error: 'That option is not on screen.' };
      }
      set.select(index);
      ctx.onAction?.(`Selected ${set.items[index].title}`);
      return {
        ok: true,
        selected: set.items[index].title,
        next:
          set.kind === 'flights'
            ? 'The fare options are showing. Offer to pick the standard fare.'
            : 'The details screen is showing. The user finishes and pays by tapping.',
      };
    }

    case 'choose_fare': {
      const ok = getServicesController()?.selectFare() ?? false;
      if (!ok) return { ok: false, error: 'The fare screen is not open.' };
      ctx.onAction?.('Picked the standard fare');
      return {
        ok: true,
        next: 'Passenger details are showing. Ask the user to fill in passenger names and then tap to continue and pay.',
      };
    }

    case 'open_bill': {
      const kind = String(a.kind);
      if (!(BILL_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Unknown bill type.' };
      if (a.consumer_number) ctx.setPrefill({ billConsumerNumber: String(a.consumer_number) });
      const controller = getServicesController();
      if (controller) controller.openBill(kind);
      else ctx.router.navigate({ pathname: '/services', params: { start: 'billPay', kind } } as never);
      ctx.onAction?.(`Opening ${kind} bill`);
      return { ok: true, note: 'The user must tap to confirm and pay.' };
    }

    case 'start_wish': {
      const type = String(a.type);
      const fields: Partial<AgentPrefill> = {};
      if (a.occasion) fields.occasion = String(a.occasion);
      if (a.recipient_name) fields.recipientName = String(a.recipient_name);
      if (a.message) fields.message = String(a.message);
      if (a.language) fields.language = String(a.language);
      if (a.celebrity) fields.search = String(a.celebrity);

      const route =
        type === 'celebrity_call'
          ? '/(tabs)/voice-call'
          : type === 'photo'
            ? '/photo-wish'
            : type === 'friend'
              ? '/wish-friend'
              : type === 'greeting_card'
                ? '/greeting-cards'
                : '/wish-celebrity';

      // Only what each screen actually reads gets filled in; say so, so the model doesn't over-claim.
      const reads: Record<string, (keyof AgentPrefill)[]> = {
        '/wish-celebrity': ['search'],
        '/(tabs)/voice-call': ['recipientName', 'occasion', 'tone', 'language', 'message'],
        '/photo-wish': ['occasion', 'message'],
        '/greeting-cards': ['occasion', 'recipientName', 'message'],
        '/wish-friend': [],
      };
      const filled = (reads[route] ?? []).filter((k) => fields[k] !== undefined);
      ctx.setPrefill(fields);
      ctx.router.navigate(route as never);
      ctx.onAction?.('Starting your wish');
      const needs =
        type === 'celebrity_video'
          ? 'The user picks the celebrity, then occasion and message are prefilled on the next screen.'
          : type === 'celebrity_call'
            ? 'The user picks the celebrity to call.'
            : type === 'friend'
              ? 'Nothing is prefilled; the user fills the form.'
              : 'The user reviews and confirms on screen.';
      return { ok: true, screen_opened: route, details_filled: filled, note: needs };
    }

    case 'make_music': {
      const kind = String(a.kind);
      const fields: Partial<AgentPrefill> = {
        musicTab: kind === 'text_to_speech' ? 1 : kind === 'sound_effect' ? 3 : 0,
      };
      if (kind === 'song') {
        if (a.title) fields.songTitle = String(a.title);
        if (a.description) fields.songDescription = String(a.description);
        if (a.genre) fields.songGenre = String(a.genre);
        if (a.mood) fields.songMood = String(a.mood);
        if (a.language) fields.songLanguage = String(a.language);
      } else if (kind === 'text_to_speech') {
        if (a.text) fields.ttsText = String(a.text);
      } else if (a.description) {
        fields.sfxPrompt = String(a.description);
      }
      ctx.setPrefill(fields);
      ctx.router.navigate('/(tabs)/music' as never);
      ctx.onAction?.('Opening the music studio');
      return { ok: true };
    }

    case 'add_wallet_money': {
      const amount = Math.round(Number(a.amount));
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'That amount is not valid.' };
      ctx.setPrefill({ addAmount: amount });
      ctx.router.navigate('/wallet' as never);
      ctx.onAction?.(`Wallet top-up ₹${amount}`);
      return { ok: true, note: 'The user taps to complete the payment.' };
    }

    case 'add_occasion': {
      // The occasions screen doesn't read prefilled details yet, so just open it.
      ctx.router.navigate('/occasions' as never);
      ctx.onAction?.('Opening occasions');
      return {
        ok: true,
        details_filled: [],
        note: 'The occasions screen is open. Details are not prefilled, so ask the user to enter the name and date themselves.',
      };
    }

    case 'open_website': {
      const hold = confirmLeaving(a, String(a.url ?? `a Google search for ${a.search_query ?? 'that'}`));
      if (hold) return hold;
      ctx.onLeaveApp?.();
      const result = await openWebsite({
        url: a.url ? String(a.url) : undefined,
        searchQuery: a.search_query ? String(a.search_query) : undefined,
      });
      ctx.onAction?.(a.search_query ? `Searching Google` : `Opening ${a.url}`);
      return result;
    }

    case 'open_app': {
      // Opens at once, with no question asked: the user already said "open <app>". (The spoken "do you want
      // to leave WishMe?" check that used to sit here made every launch slower and was the "asking" users heard.)
      ctx.onAction?.(`Opening ${a.app_name}`);
      // The assistant only lets go of the mic once the app is known, so it can still explain when one is not found.
      return openApp(String(a.app_name ?? ''), { onLeave: ctx.onLeaveApp, playStore: a.play_store === true });
    }

    case 'call_contact': {
      const number = a.number ? String(a.number) : '';
      const name = a.name ? String(a.name) : '';

      // The assistant makes calls itself unless the user explicitly asks to talk on their own phone.
      if (a.user_will_talk !== true) {
        return {
          ok: false,
          redirect: 'ai_call',
          instruction:
            'Nothing was dialled. The user did not say they want to talk themselves, so YOU make the call and speak to the person: use ai_call. If you do not yet know what to say, ask "What should I tell them?". Only use call_contact if the user says they want to talk themselves.',
        };
      }

      if (!a.user_confirmed) {
        // Lookup only: tell the model who we found so it can ask the user to confirm.
        if (number && !name) {
          return { ok: true, needs_confirmation: true, number, instruction: 'Ask the user to confirm calling this number.' };
        }
        const { matches, error, permissionDenied, canAskAgain } = await findContacts(name);
        if (permissionDenied) return contactsBlocked(error, canAskAgain);
        if (error) return { ok: false, error };
        if (!matches.length) return { ok: false, error: `No contact named "${name}" was found.` };
        return {
          ok: true,
          needs_confirmation: true,
          matches: matches.slice(0, 3),
          instruction:
            matches.length === 1
              ? 'Ask the user "Shall I call <name>?" then call again with that number and user_confirmed=true.'
              : 'Ask which contact they mean, then confirm before calling.',
        };
      }

      if (!number) return { ok: false, error: 'Give the exact number from the lookup.' };
      ctx.onAction?.(`Calling ${name || number}`);
      ctx.onLeaveApp?.();
      return placeCall(number);
    }

    case 'ai_call': {
      const purpose = String(a.purpose ?? '').trim();
      let name = a.name ? String(a.name) : '';
      let rawNumber = a.number ? String(a.number) : '';
      // A number said out loud can arrive as words or in another script ("ಒಂಬತ್ತು ಎಂಟು ..."): make it digits.
      if (rawNumber) rawNumber = extractSpokenNumber(rawNumber) ?? rawNumber;
      // A number dictated as the "name" is still a number.
      if (!rawNumber && name) {
        const dictated = extractSpokenNumber(name);
        if (dictated && dictated.length >= 8) {
          rawNumber = dictated;
          name = '';
        }
      }

      if (!rawNumber && !name) {
        return { ok: false, needs_info: 'who', instruction: 'Ask the user who to call (a name from their contacts, or a phone number). Do not guess.' };
      }

      // Find the number FIRST, before asking anything else. The user named a person, so look that person up in
      // the contacts: asking "what is the number?" is only right when this lookup comes back empty.
      if (!rawNumber) {
        const { matches, error, permissionDenied, canAskAgain } = await findContacts(name);
        if (permissionDenied) return contactsBlocked(error, canAskAgain);
        if (error) return { ok: false, error, instruction: 'Say you could not read the contacts, and ask the user to say the phone number instead.' };
        if (!matches.length) {
          return {
            ok: false,
            not_found: true,
            error: `No contact named "${name}" was found.`,
            instruction: `Say in one short sentence that you could not find ${name} in the contacts, and ask the user to say the phone number. Then carry on with that number.`,
          };
        }
        if (matches.length > 1) {
          return { ok: true, needs_confirmation: true, matches: matches.slice(0, 3), instruction: 'Several contacts match. Say their names and ask which one they mean.' };
        }
        name = matches[0].name;
        rawNumber = matches[0].number;
      }
      const number = checkPhoneNumber(rawNumber);
      if (!number.ok) {
        return {
          ok: false,
          error: number.reason,
          instruction: name ? `The number saved for ${name} cannot be used. Tell the user, and ask if they have another number for ${name}.` : undefined,
        };
      }

      // Now the number is known, ask what to say. Never ask for the number again: it is already found.
      if (purpose.length < 5) {
        return {
          ok: false,
          needs_info: 'purpose',
          found: name || number.spoken,
          instruction: `${name ? `You found ${name} in the contacts and have the number. ` : ''}Ask the user what you should say or ask ${name || 'the person'} on the call, for example "What should I tell ${name || 'them'}?". Do not guess or make up a purpose, and do not ask for the phone number.`,
        };
      }

      // Nothing is dialled until the user has said yes to exactly this call.
      const same =
        pendingAiCall &&
        pendingAiCall.e164 === number.e164 &&
        pendingAiCall.purpose === purpose &&
        Date.now() - pendingAiCall.at < 3 * 60_000;
      if (a.user_confirmed !== true || !same) {
        pendingAiCall = { e164: number.e164, purpose, at: Date.now() };
        return {
          ok: true,
          needs_confirmation: true,
          who: name || number.spoken,
          number: number.spoken,
          purpose,
          instruction:
            'Read this back and ask for a clear yes: "I will call <who> on <number> as an AI assistant and <purpose>. I will tell them I am an AI and that the call is written down, and then tell you what they say. Shall I go ahead?" Only call ai_call again with user_confirmed=true and exactly the same number and purpose after they say yes.',
        };
      }

      const token = await ctx.getAccessToken?.();
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const started = await startAiCall(token, {
        name: name || undefined,
        phone: number.e164,
        purpose,
        details: a.details ? String(a.details) : undefined,
        language: a.language ? String(a.language) : undefined,
      });
      if (!started.ok) return { ok: false, error: started.error };

      pendingAiCall = null;
      const scheduled = started.status === 'scheduled';
      ctx.watchAiCall?.(started.callId, scheduled);
      ctx.onAction?.(scheduled ? `Call booked: ${name || number.spoken}` : `Calling ${name || number.spoken}…`);
      return {
        ok: true,
        call_id: started.callId,
        status: started.status,
        scheduled_for: started.scheduledFor,
        note: scheduled
          ? 'The call is booked for later. Tell the user the time, and that you will report what they say once it is done.'
          : 'The call is being placed now. Tell the user in one short sentence that you are calling and will speak with them, and that you will tell them what was said as soon as the call ends (usually 1 to 3 minutes). Then stay quiet and keep the conversation open: do not close, do not start other tasks, and do not ask the user to hold. If they ask, say the call is still going.',
      };
    }

    case 'open_app_settings': {
      ctx.onAction?.('Opening WishMe settings');
      ctx.onLeaveApp?.();
      const result = await openAppSettings();
      return result.ok
        ? { ok: true, note: 'The WishMe settings page is open. Tell the user to turn on Contacts, then come back and ask again.' }
        : result;
    }

    case 'set_language': {
      const wanted = resolveLanguage(String(a.language ?? ''));
      if (!wanted) return { ok: false, error: 'Ask the user which language they would like.' };

      const result = await ctx.setLanguage?.(wanted);
      // The voice in use may simply not be able to say it. Better to admit that than to answer in
      // the wrong language and leave the user wondering why.
      if (result?.ok === false) {
        return {
          ok: false,
          error: result.error,
          instruction: `Tell the user plainly, in the language you are speaking now, that this voice cannot speak ${wanted.label}, and that it can speak ${SARVAM_LANGUAGE_NAMES}. Ask which they would like instead. Do NOT pretend to have switched.`,
        };
      }
      ctx.onAction?.(`Speaking ${wanted.label}`);
      return {
        ok: true,
        language: wanted.label,
        instruction: `From now on speak only in ${wanted.label}, starting with your very next sentence. Confirm the switch in ${wanted.label}, in one short sentence.`,
      };
    }

    case 'get_call_result': {
      const token = await ctx.getAccessToken?.();
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const row = a.call_id ? await fetchAiCall(token, String(a.call_id)) : await fetchLatestAiCall(token);
      if (!row) return { ok: false, error: 'There is no AI call to report on yet.' };
      if (isActive(row.status)) {
        return { ok: true, in_progress: true, status: row.status, who: whoLabel(row), note: 'The call has not finished yet. Tell the user you will report as soon as it ends.' };
      }
      return { ok: true, ...describeCall(row) };
    }

    default:
      return { ok: false, error: `Unknown tool ${call.name}.` };
  }
}
