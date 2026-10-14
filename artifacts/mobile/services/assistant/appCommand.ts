/**
 * Spotting a plain "open <app>" command in what the user just said, so the app can be launched at once
 * instead of waiting for the language model to think about it (that round trip is what made opening an app slow).
 *
 * It is deliberately strict: an open verb AND a known app AND nothing else of substance in the sentence. Anything
 * longer ("open YouTube and play Arijit songs"), negative ("don't open"), or unclear returns null and goes to the
 * model as before. A false negative costs a second; a false positive would open the wrong thing.
 * Pure code (no React Native): see scripts/appCommand.selfcheck.ts.
 */

import { coarseKey, plain } from './nameMatch';
import { cleanAppPhrase } from './appCatalog';
import { buildAppIndex, matchApp, squash, type AppIndex, type AppTarget } from './installedAppMatch';

/** Open verbs written in Latin letters. ("open" itself is matched by sound below, which also catches "opan".) */
const LATIN_VERBS = new Set([
  'open', 'opens', 'opening', 'launch', 'start', 'run',
  'kholo', 'kholiye', 'kholiyen', 'kholein', 'kholen', 'khol', 'kholna', 'kholdo', 'chalu', 'shuru', 'chalao', 'chalaiye',
  'tere', 'tereyiri',
]);

/** Open verbs in other scripts, compared by sound so every spelling of them counts. */
const NATIVE_VERBS = [
  'खोलो', 'खोलिए', 'खोलिये', 'खोलें', 'खोलना', 'खोल', 'चालू', 'शुरू', 'चलाओ', 'चलाइए', 'ओपन', 'लॉन्च',
  'ತೆರೆ', 'ತೆರೆಯಿರಿ', 'ತೆರೆಯಿ', 'ಓಪನ್', 'ಲಾಂಚ್',
  'திற', 'திறக்கவும்', 'திறங்க', 'திறந்து', 'ஓபன்',
  'తెరవండి', 'తెరువు', 'తెరవ', 'ఓపెన్',
  'തുറക്കുക', 'തുറക്കൂ', 'തുറക്ക്', 'ഓപ്പൺ', 'ഓപ്പണ്',
  'उघडा', 'उघड',
  'খোলো', 'খুলুন', 'খুল', 'ওপেন',
  'ખોલો', 'ખોલ', 'ઓપન',
  'ਖੋਲ੍ਹੋ', 'ਖੋਲ੍ਹ', 'ਓਪਨ',
  'ଖୋଲ', 'ଖୋଲନ୍ତୁ', 'ଓପନ୍',
];
const VERB_SOUNDS = new Set([...NATIVE_VERBS.map((v) => coarseKey(v)), coarseKey('open'), coarseKey('launch')]);

/** "Not", "don't", "stop"...: a sentence with one of these is never a command to do the thing. */
const NEGATIONS = new Set(
  ['not', 'dont', 'don', 'never', 'stop', 'cancel', 'mat', 'nahi', 'nahin', 'नहीं', 'नही', 'मत', 'ಬೇಡ', 'ಬೇಡಿ', 'வேண்டாம்', 'వద్దు', 'വേണ്ട', 'नको', 'না', 'નહીં', 'ਨਹੀਂ', 'ନାହିଁ'].map(plain),
);

/** Words that start a second request ("...and play songs"): the model has to handle those. */
const CONTINUATIONS = new Set(
  [
    'and', 'then', 'also', 'after', 'aur', 'phir', 'fir', 'play', 'search', 'send', 'call', 'message', 'msg', 'video', 'song', 'songs',
    'find', 'book', 'order', 'pay', 'text', 'share', 'post', 'watch', 'read', 'check', 'type', 'write', 'tell', 'ask', 'baad',
    'और', 'फिर', 'ಮತ್ತು', 'ಆಮೇಲೆ', 'ಹಾಗೂ', 'மற்றும்', 'பிறகு', 'మరియు', 'తర్వాత', 'ഒപ്പം', 'ശേഷം', 'आणि', 'এবং', 'અને', 'ਅਤੇ', 'ଏବଂ',
  ].map(plain),
);

/** A sentence longer than this is a conversation, not a command. */
const MAX_WORDS = 9;
/** Words besides the verb and the app name that still leave it a plain command ("can you please open ... for me"). */
const MAX_EXTRA_WORDS = 6;

const isVerb = (w: string) => LATIN_VERBS.has(w) || (VERB_SOUNDS.has(coarseKey(w)) && (/[^a-z0-9]/.test(w) || w === 'opan' || w === 'oppen'));

/** Words that are also a WishMe screen: "open wallet" means the WishMe wallet, even if the phone has an app called Wallet. */
const WISHME_WORDS = new Set(
  [
    'home', 'profile', 'wallet', 'messages', 'message', 'settings', 'music', 'support', 'favorites', 'favourites', 'following', 'referrals',
    'occasions', 'finance', 'bills', 'recharge', 'travel', 'flights', 'hotels', 'calendar', 'reminders', 'documents', 'news', 'library', 'hub',
    'bookings', 'my bookings', 'photo wish', 'celebrities', 'services', 'all services', 'chat', 'chats', 'help', 'assistant', 'camera roll',
  ].map((w) => squash(w)),
);

export interface OpenAppCommand {
  app: AppTarget;
  /** The words the app was recognised from, as the user said them. */
  heard: string;
}

/** The app to open if `text` is a plain "open <app>" command, otherwise null. */
export function parseOpenAppCommand(text: string, index: AppIndex = buildAppIndex(null)): OpenAppCommand | null {
  const words = plain(text).split(' ').filter(Boolean);
  if (words.length === 0 || words.length > MAX_WORDS) return null;
  if (!words.some(isVerb)) return null;
  if (words.some((w) => NEGATIONS.has(w))) return null;

  // Longest name first, so "youtube music" is not mistaken for "youtube".
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const window = words.slice(start, start + size);
      if (window.some(isVerb)) continue;
      const heard = window.join(' ');
      if (heard.length < 3) continue; // a single letter is far more likely noise than "X"
      if (WISHME_WORDS.has(squash(heard))) continue;
      // A name in Latin letters must be exactly a name (spaces aside: "chat gpt" is "ChatGPT"): a part of one is not enough
      // ("photo wish" is a WishMe screen, not the Photo gallery). A name in another script can only ever match by sound.
      const app = /[^a-z0-9 ]/.test(heard) ? matchApp(heard, index, 70)[0]?.target : index.bySquash.get(squash(cleanAppPhrase(heard)));
      if (!app || !app.quick) continue;
      // Whatever is left over must not be a second request ("...and play songs"); "play" inside "play store" is fine.
      const rest = [...words.slice(0, start), ...words.slice(start + size)];
      if (rest.some((w) => CONTINUATIONS.has(w))) continue;
      const extra = rest.length - rest.filter(isVerb).length;
      if (extra <= MAX_EXTRA_WORDS) return { app, heard };
    }
  }
  return null;
}
