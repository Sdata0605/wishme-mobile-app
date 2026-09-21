/**
 * WishMe Agent Knowledge Base
 * Complete map of every intent, screen, route, and required slots.
 * Used by the ai-assistant edge function to power agentic mode.
 */

export interface SlotDefinition {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'date' | 'boolean';
  required: boolean;
  options?: string[];
  example?: string;
  question: string;
}

export interface ScreenDefinition {
  route: string;
  name: string;
  description: string;
  prefillKeys?: string[];
}

export interface IntentDefinition {
  intent: string;
  displayName: string;
  category: string;
  description: string;
  slots: SlotDefinition[];
  screens: ScreenDefinition[];
  confirmBeforePayment: boolean;
  examplePhrases: string[];
}

// ─── CELEBRITY SERVICES ──────────────────────────────────────────────────────

const CELEBRITY_WISH_INTENT: IntentDefinition = {
  intent: 'celebrity_wish',
  displayName: 'Celebrity Video Wish',
  category: 'Celebrity',
  description: 'Book a personalised video wish from a celebrity',
  confirmBeforePayment: true,
  examplePhrases: [
    'book a celebrity wish', 'get a birthday video from a celebrity',
    'celebrity video for my mom', 'book Amitabh for birthday',
    'personalised video wish', 'celebrity shoutout',
  ],
  slots: [
    { key: 'celebrity', label: 'Celebrity Name', type: 'text', required: true, question: 'Which celebrity would you like the wish from? (e.g. Amitabh Bachchan, Ayushmann Khurrana)', example: 'Amitabh Bachchan' },
    { key: 'occasion', label: 'Occasion', type: 'select', required: true, options: ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Baby Shower', 'Farewell', 'Get Well Soon', 'Congratulations', 'New Year', 'Other'], question: 'What is the occasion?' },
    { key: 'recipientName', label: "Recipient's Name", type: 'text', required: true, question: "What is the recipient's name? (Who should the celebrity address?)", example: 'Sunita' },
    { key: 'message', label: 'Message / Instructions', type: 'text', required: true, question: 'What message or instructions should the celebrity follow? (What should they say?)', example: 'Wish her a happy birthday and mention she loves cricket' },
    { key: 'language', label: 'Language', type: 'select', required: false, options: ['Hindi', 'English', 'Tamil', 'Telugu', 'Punjabi', 'Bengali', 'Kannada', 'Malayalam'], question: 'What language should the video be in? (Default: Hindi/English)' },
  ],
  screens: [
    { route: '/wish-celebrity', name: 'Celebrity Search', description: 'Browse and search celebrities', prefillKeys: ['celebrity'] },
    { route: '/wish-booking/[id]', name: 'Booking Form', description: 'Fill occasion, recipient and message', prefillKeys: ['occasion', 'recipientName', 'message', 'language'] },
  ],
};

const VOICE_CALL_WISH_INTENT: IntentDefinition = {
  intent: 'voice_call_wish',
  displayName: 'Celebrity Voice Call Wish',
  category: 'Celebrity',
  description: 'Schedule a live or AI voice call wish from a celebrity',
  confirmBeforePayment: true,
  examplePhrases: [
    'voice call with celebrity', 'celebrity phone call', 'live call with star',
    'celebrity voice call wish', 'book voice call',
  ],
  slots: [
    { key: 'celebrity', label: 'Celebrity', type: 'text', required: true, question: 'Which celebrity would you like the voice call wish from?' },
    { key: 'occasion', label: 'Occasion', type: 'select', required: true, options: ['Birthday', 'Anniversary', 'Graduation', 'New Year', 'Diwali', 'Christmas', 'Eid', 'Promotion', 'Wedding', 'Other'], question: 'What is the occasion for the voice call?' },
    { key: 'recipientName', label: "Recipient's Name", type: 'text', required: true, question: "Who should the celebrity call? What's their name?" },
    { key: 'tone', label: 'Tone / Style', type: 'select', required: false, options: ['Warm & Loving', 'Funny & Playful', 'Inspirational', 'Formal', 'Casual & Friendly', 'Emotional & Heartfelt'], question: 'What tone should the call have?' },
    { key: 'language', label: 'Language', type: 'select', required: false, options: ['Hindi (Hinglish)', 'English', 'Tamil', 'Telugu', 'Punjabi'], question: 'In which language should the call be?' },
  ],
  screens: [
    { route: '/(tabs)/voice-call', name: 'Voice Call', description: 'Book a celebrity voice call wish', prefillKeys: ['celebrity', 'occasion', 'recipientName', 'tone', 'language'] },
  ],
};

const PHOTO_WISH_INTENT: IntentDefinition = {
  intent: 'photo_wish',
  displayName: 'AI Photo Wish',
  category: 'Celebrity',
  description: 'Create an AI-generated photo wish with a custom message overlay',
  confirmBeforePayment: false,
  examplePhrases: [
    'photo wish', 'create photo wish', 'birthday photo card', 'ai photo message',
    'personalized photo', 'make a photo wish',
  ],
  slots: [
    { key: 'occasion', label: 'Occasion', type: 'select', required: true, options: ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Baby Shower', 'Retirement', 'Diwali', 'Christmas', 'New Year'], question: 'What occasion is the photo wish for?' },
    { key: 'textStyle', label: 'Text Style', type: 'select', required: false, options: ['Elegant', 'Playful', 'Modern', 'Classic', 'Festive'], question: 'What text style do you prefer? (Elegant, Playful, Modern, Classic, or Festive)' },
    { key: 'message', label: 'Wish Message', type: 'text', required: false, question: 'What message should appear on the photo?', example: 'Happy Birthday! Wishing you joy and love.' },
  ],
  screens: [
    { route: '/photo-wish', name: 'Photo Wish', description: 'Create an AI photo wish', prefillKeys: ['occasion', 'textStyle', 'message'] },
  ],
};

const WISH_FRIEND_INTENT: IntentDefinition = {
  intent: 'wish_friend',
  displayName: 'Wish a Friend',
  category: 'Celebrity',
  description: 'Send a celebrity wish to a friend',
  confirmBeforePayment: false,
  examplePhrases: ['wish a friend', 'send wish to friend', 'gift a celebrity wish', 'send celebrity video to someone'],
  slots: [
    { key: 'friendName', label: "Friend's Name", type: 'text', required: true, question: "What's your friend's name?" },
  ],
  screens: [
    { route: '/wish-friend', name: 'Wish a Friend', description: 'Gift a celebrity wish to a friend', prefillKeys: ['friendName'] },
  ],
};

const IMAGE_PROMOTION_INTENT: IntentDefinition = {
  intent: 'image_promotion',
  displayName: 'Celebrity Image Promotion',
  category: 'Celebrity',
  description: 'Create an AI promotional image featuring a celebrity you follow',
  confirmBeforePayment: true,
  examplePhrases: [
    'image promotion', 'celebrity promo image', 'brand promotion with celebrity',
    'promotional image', 'celebrity ad image',
  ],
  slots: [
    { key: 'concept', label: 'Promotion Concept', type: 'text', required: true, question: 'Describe your promotion concept. What product or brand are you promoting?', example: 'Promote my bakery, feature the celebrity holding my birthday cake' },
    { key: 'brandingDetails', label: 'Branding Details', type: 'text', required: false, question: 'Any specific branding details? (Logo, colors, tagline, etc.)', example: 'Brand name: Sweet Bites, colors: pink and white' },
  ],
  screens: [
    { route: '/image-promotions', name: 'Image Promotions', description: 'Create celebrity promo images', prefillKeys: ['concept', 'brandingDetails'] },
  ],
};

const GREETING_CARD_INTENT: IntentDefinition = {
  intent: 'greeting_card',
  displayName: 'AI Greeting Card',
  category: 'Creative',
  description: 'Create an AI-generated personalised greeting card',
  confirmBeforePayment: false,
  examplePhrases: [
    'greeting card', 'create a card', 'birthday card', 'anniversary card',
    'make a greeting card', 'digital card', 'ai card',
  ],
  slots: [
    { key: 'occasion', label: 'Occasion', type: 'select', required: true, options: ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'New Year', 'Christmas', "Valentine's Day", "Mother's Day", "Father's Day", 'Thank You', 'Congratulations', 'Get Well Soon'], question: 'What occasion is the greeting card for?' },
    { key: 'recipientName', label: "Recipient's Name", type: 'text', required: true, question: "Who is the card for? What's their name?", example: 'Priya' },
    { key: 'message', label: 'Personal Message', type: 'text', required: false, question: "What message would you like on the card? (I'll suggest one if you leave this blank)", example: 'Happy birthday! You bring so much joy to everyone around you.' },
  ],
  screens: [
    { route: '/greeting-cards', name: 'Greeting Cards', description: 'Create AI greeting cards', prefillKeys: ['occasion', 'recipientName', 'message'] },
  ],
};

// ─── TRAVEL & TRANSPORT ──────────────────────────────────────────────────────

const FLIGHT_BOOKING_INTENT: IntentDefinition = {
  intent: 'flight_booking',
  displayName: 'Flight Booking',
  category: 'Travel',
  description: 'Search and book domestic flights',
  confirmBeforePayment: true,
  examplePhrases: [
    'book a flight', 'flight to Mumbai', 'fly to Delhi', 'search flights',
    'book airplane ticket', 'book plane ticket', 'flight booking',
    'book me a flight from Delhi to Goa', 'flight ticket',
  ],
  slots: [
    { key: 'fromCity', label: 'Departure City', type: 'text', required: true, question: 'Which city are you flying from?', example: 'New Delhi (DEL)' },
    { key: 'toCity', label: 'Destination City', type: 'text', required: true, question: 'Which city are you flying to?', example: 'Mumbai (BOM)' },
    { key: 'travelDate', label: 'Travel Date', type: 'date', required: true, question: 'What date do you want to fly? (e.g. 25 Sep, next Friday, tomorrow)', example: 'Sep 25' },
    { key: 'travellers', label: 'Number of Travellers', type: 'text', required: false, question: 'How many travellers? (e.g. 1 Adult, 2 Adults 1 Child)', example: '1 Adult' },
    { key: 'cabin', label: 'Cabin Class', type: 'select', required: false, options: ['Economy / Premium Economy', 'Business', 'First Class'], question: 'Which cabin class? (Economy, Business, or First Class)' },
  ],
  screens: [
    { route: '/services', name: 'Flights', description: 'Search flights', prefillKeys: ['fromCity', 'toCity', 'travelDate', 'travellers', 'cabin'] },
  ],
};

const HOTEL_BOOKING_INTENT: IntentDefinition = {
  intent: 'hotel_booking',
  displayName: 'Hotel Booking',
  category: 'Travel',
  description: 'Search and book hotels',
  confirmBeforePayment: true,
  examplePhrases: [
    'book a hotel', 'hotel in Mumbai', 'find hotel', 'hotel room booking',
    'stay in Goa', 'book hotel in Delhi', 'hotel search', 'hotel for tonight',
  ],
  slots: [
    { key: 'hotelCity', label: 'City', type: 'text', required: true, question: 'Which city do you need a hotel in?', example: 'Goa' },
    { key: 'checkIn', label: 'Check-in Date', type: 'date', required: true, question: 'When do you want to check in?', example: 'Tonight, Sep 25' },
    { key: 'checkOut', label: 'Check-out Date', type: 'date', required: true, question: 'When do you want to check out?', example: 'Tomorrow, Sep 27' },
    { key: 'rooms', label: 'Number of Rooms', type: 'number', required: false, question: 'How many rooms do you need?', example: '1' },
    { key: 'adults', label: 'Number of Adults', type: 'number', required: false, question: 'How many adults?', example: '2' },
  ],
  screens: [
    { route: '/services', name: 'Hotels', description: 'Search hotels', prefillKeys: ['hotelCity', 'checkIn', 'checkOut', 'rooms', 'adults'] },
  ],
};

const BUS_BOOKING_INTENT: IntentDefinition = {
  intent: 'bus_booking',
  displayName: 'Bus Ticket Booking',
  category: 'Travel',
  description: 'Search and book bus tickets',
  confirmBeforePayment: true,
  examplePhrases: [
    'book bus ticket', 'bus to Jaipur', 'bus from Delhi', 'bus booking',
    'bus ticket', 'book a bus', 'travel by bus',
  ],
  slots: [
    { key: 'busFrom', label: 'From City', type: 'text', required: true, question: 'Where are you travelling from?', example: 'Delhi' },
    { key: 'busTo', label: 'To City', type: 'text', required: true, question: 'Where are you travelling to?', example: 'Jaipur' },
    { key: 'busDate', label: 'Travel Date', type: 'date', required: true, question: 'What date do you want to travel?', example: 'Today, Tomorrow, Sep 25' },
  ],
  screens: [
    { route: '/services', name: 'Bus Tickets', description: 'Search and book bus tickets', prefillKeys: ['busFrom', 'busTo', 'busDate'] },
  ],
};

// ─── BILL PAYMENTS ────────────────────────────────────────────────────────────

function makeBillIntent(kind: string, displayName: string, consumerLabel: string, phrases: string[]): IntentDefinition {
  return {
    intent: `bill_${kind}`,
    displayName: `${displayName} Bill Payment`,
    category: 'Bills',
    description: `Pay ${displayName} bill`,
    confirmBeforePayment: true,
    examplePhrases: phrases,
    slots: [
      { key: 'billConsumerNumber', label: consumerLabel, type: 'text', required: true, question: `What is your ${consumerLabel.toLowerCase()}?`, example: '1234567890' },
      { key: 'billOperator', label: 'Provider / Operator', type: 'text', required: false, question: `Who is your ${displayName.toLowerCase()} provider?`, example: 'BSES, Airtel, Jio' },
    ],
    screens: [
      { route: '/services', name: `${displayName} Bill`, description: `Pay ${displayName} bill`, prefillKeys: ['billConsumerNumber', 'billOperator'] },
    ],
  };
}

const BILL_ELECTRICITY_INTENT = makeBillIntent('electricity', 'Electricity', 'Consumer Number', ['pay electricity bill', 'electricity bill payment', 'bijli bill', 'electricity bill']);
const BILL_WATER_INTENT = makeBillIntent('water', 'Water', 'Consumer Number', ['pay water bill', 'water bill payment', 'water bill']);
const BILL_GAS_INTENT = makeBillIntent('gas', 'Gas', 'Consumer Number', ['pay gas bill', 'piped gas', 'gas bill payment', 'gas bill']);
const BILL_MOBILE_INTENT = makeBillIntent('mobile', 'Mobile Recharge', 'Mobile Number', ['mobile recharge', 'recharge phone', 'prepaid recharge', 'mobile bill', 'phone recharge']);
const BILL_DTH_INTENT = makeBillIntent('dth', 'DTH', 'Customer ID', ['pay dth bill', 'tata sky', 'dish tv', 'dth recharge', 'set top box']);
const BILL_FASTAG_INTENT = makeBillIntent('fastag', 'FASTag', 'Vehicle Number', ['pay fastag', 'fastag recharge', 'toll tax', 'fastag top up']);
const BILL_BROADBAND_INTENT = makeBillIntent('broadband', 'Broadband', 'Account ID', ['pay broadband bill', 'internet bill', 'wifi bill', 'broadband payment']);
const BILL_CREDITCARD_INTENT = makeBillIntent('creditCard', 'Credit Card', 'Card Number', ['pay credit card bill', 'credit card payment', 'credit card due']);
const BILL_LOAN_INTENT = makeBillIntent('loanEmi', 'Loan EMI', 'Loan Account Number', ['pay loan emi', 'loan payment', 'emi payment', 'loan emi']);
const BILL_INSURANCE_INTENT = makeBillIntent('insurance', 'Insurance', 'Policy Number', ['pay insurance premium', 'insurance payment', 'policy premium']);

// ─── AI MUSIC STUDIO ─────────────────────────────────────────────────────────

const GENERATE_SONG_INTENT: IntentDefinition = {
  intent: 'generate_song',
  displayName: 'Generate AI Song',
  category: 'Music',
  description: 'Create a custom AI-generated song',
  confirmBeforePayment: false,
  examplePhrases: [
    'generate a song', 'create a song', 'make music', 'ai song', 'compose music',
    'create a birthday song', 'bollywood song', 'make a love song',
  ],
  slots: [
    { key: 'songTitle', label: 'Song Title', type: 'text', required: true, question: 'What should the song title be?', example: 'Maa Ki Lori' },
    { key: 'songDescription', label: 'Song Description', type: 'text', required: true, question: 'Describe what the song should be about', example: 'A happy birthday song for my mother who loves flowers' },
    { key: 'songGenre', label: 'Genre', type: 'select', required: false, options: ['bollywood', 'pop', 'romantic', 'happy', 'lofi', 'classical', 'hip-hop', 'r&b', 'edm', 'folk'], question: 'What genre? (Bollywood, Pop, Romantic, etc.)' },
    { key: 'songMood', label: 'Mood', type: 'select', required: false, options: ['happy', 'sad', 'energetic', 'calm', 'romantic', 'epic', 'uplifting'], question: 'What mood for the song?' },
    { key: 'songLanguage', label: 'Language', type: 'select', required: false, options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Bengali'], question: 'In what language?' },
  ],
  screens: [
    { route: '/(tabs)/music', name: 'AI Music Studio', description: 'Generate AI songs', prefillKeys: ['songTitle', 'songDescription', 'songGenre', 'songMood', 'songLanguage'] },
  ],
};

const TTS_INTENT: IntentDefinition = {
  intent: 'text_to_speech',
  displayName: 'Text to Speech',
  category: 'Music',
  description: 'Convert text to realistic speech audio',
  confirmBeforePayment: false,
  examplePhrases: ['text to speech', 'tts', 'convert text to audio', 'read out text', 'voice from text', 'ai voice'],
  slots: [
    { key: 'ttsText', label: 'Text to Convert', type: 'text', required: true, question: 'What text do you want to convert to speech?', example: 'Happy birthday dear friend!' },
    { key: 'ttsLanguage', label: 'Language', type: 'text', required: false, question: 'In which language?', example: 'Hindi, English, Tamil' },
  ],
  screens: [{ route: '/(tabs)/music', name: 'AI Music Studio - TTS', description: 'Text to speech', prefillKeys: ['ttsText', 'ttsLanguage'] }],
};

const SFX_INTENT: IntentDefinition = {
  intent: 'sound_effects',
  displayName: 'AI Sound Effects',
  category: 'Music',
  description: 'Generate custom sound effects with AI',
  confirmBeforePayment: false,
  examplePhrases: ['sound effect', 'sfx', 'create sound', 'generate sound effect', 'ai sound'],
  slots: [
    { key: 'sfxPrompt', label: 'Sound Effect Description', type: 'text', required: true, question: 'Describe the sound effect you want to create', example: 'Rain falling on leaves, gentle and calming' },
  ],
  screens: [{ route: '/(tabs)/music', name: 'AI Music Studio - SFX', description: 'Generate sound effects', prefillKeys: ['sfxPrompt'] }],
};

// ─── WALLET ───────────────────────────────────────────────────────────────────

const WALLET_CHECK_INTENT: IntentDefinition = {
  intent: 'wallet_check',
  displayName: 'Check Wallet Balance',
  category: 'Wallet',
  description: 'View wallet balance and transactions',
  confirmBeforePayment: false,
  examplePhrases: ['wallet balance', 'check balance', 'how much money', 'my balance', 'wallet', 'funds'],
  slots: [],
  screens: [{ route: '/wallet', name: 'Wallet', description: 'View balance and transactions' }],
};

const WALLET_ADD_INTENT: IntentDefinition = {
  intent: 'wallet_add',
  displayName: 'Add Money to Wallet',
  category: 'Wallet',
  description: 'Add funds to the WishMe wallet',
  confirmBeforePayment: true,
  examplePhrases: ['add money to wallet', 'recharge wallet', 'top up wallet', 'add funds', 'deposit money', 'add ₹500 to wallet'],
  slots: [
    { key: 'addAmount', label: 'Amount to Add', type: 'number', required: true, question: 'How much money do you want to add to your wallet? (Minimum ₹100)', example: '500' },
  ],
  screens: [{ route: '/wallet', name: 'Wallet', description: 'Add funds to wallet', prefillKeys: ['addAmount'] }],
};

// ─── OCCASIONS ────────────────────────────────────────────────────────────────

const OCCASION_ADD_INTENT: IntentDefinition = {
  intent: 'occasion_add',
  displayName: 'Add Occasion',
  category: 'Occasions',
  description: 'Add a birthday, anniversary or other special occasion for reminders',
  confirmBeforePayment: false,
  examplePhrases: ['add birthday', 'add occasion', 'add anniversary', 'save birthday', 'remember birthday', 'add reminder'],
  slots: [
    { key: 'occasionPersonName', label: "Person's Name", type: 'text', required: true, question: "Whose occasion do you want to add?", example: "Mom, Priya, Rahul" },
    { key: 'occasionType', label: 'Occasion Type', type: 'select', required: true, options: ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Other'], question: 'What type of occasion is it?' },
    { key: 'occasionDate', label: 'Date', type: 'date', required: true, question: 'What is the date of this occasion?', example: 'Sep 25, 25/09' },
  ],
  screens: [{ route: '/occasions', name: 'Occasions', description: 'Manage special occasions', prefillKeys: ['occasionPersonName', 'occasionType', 'occasionDate'] }],
};

// ─── REFERRALS ────────────────────────────────────────────────────────────────

const REFERRAL_INTENT: IntentDefinition = {
  intent: 'referral',
  displayName: 'Referral Program',
  category: 'Referrals',
  description: 'View referral code and earnings',
  confirmBeforePayment: false,
  examplePhrases: ['referral', 'refer a friend', 'my referral code', 'earn commission', 'referral earnings', 'invite friends', 'referral link'],
  slots: [],
  screens: [{ route: '/referrals', name: 'Referrals', description: 'View referral code and earnings' }],
};

// ─── ACCOUNT / PROFILE ───────────────────────────────────────────────────────

const VIEW_BOOKINGS_INTENT: IntentDefinition = {
  intent: 'view_bookings',
  displayName: 'View My Bookings',
  category: 'Account',
  description: 'See all past and current bookings',
  confirmBeforePayment: false,
  examplePhrases: ['my bookings', 'view bookings', 'booking history', 'past orders', 'order status', 'check booking'],
  slots: [],
  screens: [{ route: '/bookings', name: 'Bookings', description: 'View all bookings' }],
};

const EDIT_PROFILE_INTENT: IntentDefinition = {
  intent: 'edit_profile',
  displayName: 'Edit Profile',
  category: 'Account',
  description: 'Update profile information',
  confirmBeforePayment: false,
  examplePhrases: ['edit profile', 'update profile', 'change name', 'profile settings'],
  slots: [],
  screens: [{ route: '/edit-profile', name: 'Edit Profile', description: 'Update profile' }],
};

const MESSAGES_INTENT: IntentDefinition = {
  intent: 'messages',
  displayName: 'Messages',
  category: 'Account',
  description: 'View messages and chats',
  confirmBeforePayment: false,
  examplePhrases: ['messages', 'chats', 'inbox', 'my chats', 'celebrity messages'],
  slots: [],
  screens: [{ route: '/messages', name: 'Messages', description: 'View messages' }],
};

const FAVORITES_INTENT: IntentDefinition = {
  intent: 'favorites',
  displayName: 'Favorites / Following',
  category: 'Account',
  description: 'View followed celebrities',
  confirmBeforePayment: false,
  examplePhrases: ['favorites', 'following', 'liked celebrities', 'subscribed celebrities', 'my favorites'],
  slots: [],
  screens: [{ route: '/favorites', name: 'Favorites', description: 'View favorites' }],
};

const FOR_BUSINESS_INTENT: IntentDefinition = {
  intent: 'for_business',
  displayName: 'WishMe for Business',
  category: 'Business',
  description: 'Explore celebrity brand endorsements and campaigns for businesses',
  confirmBeforePayment: false,
  examplePhrases: ['business', 'brand endorsement', 'celebrity campaign', 'for business', 'brand promotion', 'corporate'],
  slots: [],
  screens: [{ route: '/for-business', name: 'For Business', description: 'Celebrity brand campaigns' }],
};

const BECOME_CELEBRITY_INTENT: IntentDefinition = {
  intent: 'become_celebrity',
  displayName: 'Become a Celebrity on WishMe',
  category: 'Celebrity',
  description: 'Register as a celebrity on WishMe',
  confirmBeforePayment: false,
  examplePhrases: ['become celebrity', 'register as celebrity', 'join as celebrity', 'celebrity signup', 'i am a celebrity'],
  slots: [],
  screens: [{ route: '/celebrity-signup', name: 'Celebrity Signup', description: 'Register as a celebrity' }],
};

// ─── MASTER INTENT REGISTRY ───────────────────────────────────────────────────

export const ALL_INTENTS: IntentDefinition[] = [
  // Celebrity
  CELEBRITY_WISH_INTENT,
  VOICE_CALL_WISH_INTENT,
  PHOTO_WISH_INTENT,
  WISH_FRIEND_INTENT,
  IMAGE_PROMOTION_INTENT,
  GREETING_CARD_INTENT,
  // Travel
  FLIGHT_BOOKING_INTENT,
  HOTEL_BOOKING_INTENT,
  BUS_BOOKING_INTENT,
  // Bills
  BILL_ELECTRICITY_INTENT,
  BILL_WATER_INTENT,
  BILL_GAS_INTENT,
  BILL_MOBILE_INTENT,
  BILL_DTH_INTENT,
  BILL_FASTAG_INTENT,
  BILL_BROADBAND_INTENT,
  BILL_CREDITCARD_INTENT,
  BILL_LOAN_INTENT,
  BILL_INSURANCE_INTENT,
  // Music
  GENERATE_SONG_INTENT,
  TTS_INTENT,
  SFX_INTENT,
  // Wallet
  WALLET_CHECK_INTENT,
  WALLET_ADD_INTENT,
  // Occasions
  OCCASION_ADD_INTENT,
  // Referrals
  REFERRAL_INTENT,
  // Account
  VIEW_BOOKINGS_INTENT,
  EDIT_PROFILE_INTENT,
  MESSAGES_INTENT,
  FAVORITES_INTENT,
  // Business
  FOR_BUSINESS_INTENT,
  BECOME_CELEBRITY_INTENT,
];

/** Look up intent definition by intent name */
export function getIntentDef(intent: string): IntentDefinition | undefined {
  return ALL_INTENTS.find((i) => i.intent === intent);
}

/** Find the best-matching intent from a user message */
export function matchIntent(text: string): IntentDefinition | undefined {
  const lower = text.toLowerCase();
  let best: IntentDefinition | undefined;
  let bestScore = 0;
  for (const def of ALL_INTENTS) {
    for (const phrase of def.examplePhrases) {
      const words = phrase.split(' ');
      const matches = words.filter((w) => lower.includes(w)).length;
      const score = matches / words.length;
      if (score > bestScore) {
        bestScore = score;
        best = def;
      }
    }
  }
  return bestScore > 0.4 ? best : undefined;
}

/**
 * Returns a compact JSON string describing all intents for the AI system prompt.
 * Keeps the prompt small — only intent name, display name, and example phrases.
 */
export function buildIntentSummaryForPrompt(): string {
  return ALL_INTENTS.map((i) => ({
    intent: i.intent,
    name: i.displayName,
    category: i.category,
    phrases: i.examplePhrases.slice(0, 3),
  }))
    .map((i) => `• ${i.intent} (${i.category}): "${i.phrases.join('", "')}"`)
    .join('\n');
}
