/**
 * Everything the WishMe assistant can do and everything the WishMe app has, in one list.
 *
 * Three things read it, so they can never disagree:
 *  - the "What I can do" card on the assistant screen (every category and item, tap one to open its screen or to say it);
 *  - the show_capabilities tool, which hands the model the SHORT spoken summary (the category names), so it never starts a
 *    long list out loud and gets cut off in the middle;
 *  - scripts/capabilities.selfcheck.ts, which checks that every route exists and every assistant tool is covered.
 *
 * Add a feature to the app or a tool to the assistant, add a line here.
 */

import type { IconName } from '@/components/Icon';

export interface CapabilityItem {
  label: string;
  /** What the user can say to use it. */
  say: string;
  /** The screen it opens when tapped. Without one, tapping gives the assistant the phrase to act on. */
  route?: string;
  /** The assistant tool that does it, if it is one (checked against the real tool list in the self-check). */
  tool?: string;
}

export interface CapabilityCategory {
  id: string;
  title: string;
  icon: IconName;
  /** One short line: said aloud for this category. */
  oneLine: string;
  items: CapabilityItem[];
}

export const CAPABILITIES: CapabilityCategory[] = [
  {
    id: 'ask',
    title: 'Ask anything and search the internet',
    icon: 'globe',
    oneLine: 'answer any question and search the live internet',
    items: [
      { label: 'Any question', say: 'Explain how a loan EMI works', tool: 'web_search' },
      { label: 'Latest news as headline cards', say: 'Show me today’s news', tool: 'show_news' },
      { label: 'News about a person or topic', say: 'News about the Mumbai Indians', tool: 'show_news' },
      { label: 'People, prices, scores, rates', say: 'Who is the finance minister? What is the gold rate today?', tool: 'web_search' },
      { label: 'Weather', say: 'What is the weather in Pune?', tool: 'web_search' },
      { label: 'Pictures of anyone or anything', say: 'Show me pictures of Amitabh Bachchan', tool: 'show_pictures' },
      { label: 'Open a website or a Google search', say: 'Open flipkart.com', tool: 'open_website' },
    ],
  },
  {
    id: 'phone',
    title: 'Control your phone',
    icon: 'phone',
    oneLine: 'open any app, tap and type on screens, and read out numbers',
    items: [
      { label: 'Open any app', say: 'Open WhatsApp', tool: 'open_app' },
      { label: 'Tap, type and scroll any screen', say: 'Tap Continue', tool: 'tap' },
      { label: 'Go back', say: 'Go back', tool: 'go_back' },
      { label: 'Fix a permission', say: 'Turn on contacts for WishMe', tool: 'open_app_settings' },
      { label: 'Say phone numbers digit by digit', say: 'Read me Amma’s number' },
    ],
  },
  {
    id: 'calls',
    title: 'Phone calls for you',
    icon: 'phone-call',
    oneLine: 'phone people for you, talk to them and tell you what was said',
    items: [
      { label: 'Call someone on your behalf', say: 'Call Dr Sharma and move my appointment to Friday', tool: 'ai_call', route: '/ai-calls' },
      { label: 'What did they say?', say: 'What did Dr Sharma say?', tool: 'get_call_result', route: '/call-logs' },
      { label: 'Connect you to talk yourself', say: 'Just dial Amma, I will talk', tool: 'call_contact' },
    ],
  },
  {
    id: 'plan',
    title: 'Reminders, calendar and occasions',
    icon: 'calendar',
    oneLine: 'set reminders and calendar events, and save birthdays and anniversaries',
    items: [
      { label: 'Reminders (even a phone call to wake you)', say: 'Remind me to take medicine at 8 tonight', tool: 'add_reminder', route: '/reminders' },
      { label: 'Calendar events', say: 'Add a meeting with Raj on Monday at 4', tool: 'add_event', route: '/calendar' },
      { label: 'What is coming up', say: 'What is on my calendar this week?', tool: 'list_upcoming' },
      { label: 'Birthdays and anniversaries', say: 'Save Anita’s birthday, 12 March', tool: 'add_occasion', route: '/occasion-alerts' },
      { label: 'Play my day', say: 'Play my day' },
    ],
  },
  {
    id: 'docs',
    title: 'Documents',
    icon: 'copy',
    oneLine: 'write real PDF, Word and Excel files',
    items: [
      { label: 'Write a document', say: 'Make a rent agreement as a PDF', tool: 'create_document', route: '/documents' },
      { label: 'Check progress', say: 'Is my document ready?', tool: 'get_document_status' },
    ],
  },
  {
    id: 'celebrity',
    title: 'Celebrity wishes, calls and bookings',
    icon: 'star',
    oneLine: 'book celebrity video wishes, calls and bookings',
    items: [
      { label: 'Wish a celebrity', say: 'I want to wish Shah Rukh Khan', tool: 'start_wish', route: '/wish-celebrity' },
      { label: 'Celebrity video call or voice call', say: 'Book a celebrity call', tool: 'start_wish', route: '/(tabs)/voice-call' },
      { label: 'Browse and subscribe to celebrities', say: 'Show me celebrities', tool: 'open_screen', route: '/(tabs)/celebrities' },
      { label: 'Your bookings and orders', say: 'Open my bookings', tool: 'open_screen', route: '/bookings' },
      { label: 'Messages with celebrities', say: 'Open my messages', tool: 'open_screen', route: '/messages' },
      { label: 'Favourites', say: 'Open my favourites', tool: 'open_screen', route: '/favorites' },
    ],
  },
  {
    id: 'friend',
    title: 'Wish a friend, cards and AI media',
    icon: 'gift',
    oneLine: 'make greeting cards, AI photo wishes, videos and promotions',
    items: [
      { label: 'Wish a friend (video wish with a signed card)', say: 'Wish my friend happy birthday', tool: 'start_wish', route: '/wish-friend' },
      { label: 'Greeting cards', say: 'Make a birthday card for Meera', tool: 'start_wish', route: '/greeting-cards' },
      { label: 'AI photo wish', say: 'Make a photo wish', tool: 'start_wish', route: '/photo-wish' },
      { label: 'Image promotions', say: 'Make a promotion image with a celebrity', tool: 'open_screen', route: '/image-promotions' },
      { label: 'UGC videos and UGC ads', say: 'Order a UGC video', tool: 'open_screen', route: '/ugc-videos' },
    ],
  },
  {
    id: 'music',
    title: 'AI music and voice',
    icon: 'music',
    oneLine: 'create songs, text to speech and sound effects',
    items: [
      { label: 'Create a song', say: 'Make a song for my sister’s wedding', tool: 'make_music', route: '/(tabs)/music' },
      { label: 'Text to speech, sound effects, voice cloning', say: 'Turn this text into speech', tool: 'make_music', route: '/(tabs)/music' },
    ],
  },
  {
    id: 'travel',
    title: 'Travel',
    icon: 'globe',
    oneLine: 'search flights, hotels and buses',
    items: [
      { label: 'Flights', say: 'Flights from Delhi to Mumbai on Friday', tool: 'search_flights' },
      { label: 'Hotels', say: 'Hotels in Goa for two nights', tool: 'search_hotels' },
      { label: 'Buses', say: 'Buses from Pune to Hyderabad tomorrow', tool: 'search_buses' },
      { label: 'Pick an option and continue', say: 'Choose the second one', tool: 'choose_option' },
    ],
  },
  {
    id: 'money',
    title: 'Bills, wallet and plans',
    icon: 'wallet',
    oneLine: 'pay bills and recharges, add wallet money, and manage your plan and referrals',
    items: [
      { label: 'Pay bills and recharge', say: 'Open the electricity bill', tool: 'open_bill' },
      { label: 'Add money to the wallet', say: 'Add 500 rupees to my wallet', tool: 'add_wallet_money', route: '/wallet' },
      { label: 'Your plan and discounts', say: 'Open my plan', tool: 'open_screen', route: '/select-plan' },
      { label: 'Refer a friend and earn', say: 'Open referrals', tool: 'open_screen', route: '/referrals' },
      { label: 'Finance: EMIs, income and expenses', say: 'Open finance', tool: 'open_screen', route: '/finance' },
    ],
  },
  {
    id: 'you',
    title: 'Your language and how I talk to you',
    icon: 'smile',
    oneLine: 'speak your language and call you sir or ma’am the way you like',
    items: [
      { label: 'Speak any language', say: 'Talk in Tamil', tool: 'set_language' },
      { label: 'Sir, ma’am or decided by your voice', say: 'Open my assistant settings', route: '/settings/assistant' },
      { label: 'Change my name, voice and style', say: 'Open my assistant settings', route: '/settings/assistant' },
    ],
  },
];

/** The categories in the order they are spoken: "I can ... , ... and ...". */
export function spokenSummary(): string {
  const lines = CAPABILITIES.map((c) => c.oneLine);
  return `${lines.slice(0, -1).join('; ')}; and ${lines[lines.length - 1]}`;
}

/** One category by id, or all of them. */
export function categoriesFor(id?: string): CapabilityCategory[] {
  if (!id) return CAPABILITIES;
  const key = id.toLowerCase().trim();
  const hit = CAPABILITIES.filter((c) => c.id === key || c.title.toLowerCase().includes(key));
  return hit.length ? hit : CAPABILITIES;
}
