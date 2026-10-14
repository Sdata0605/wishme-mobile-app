/**
 * Phone numbers the way people dictate them.
 *
 * Someone who says their number in Kannada gets back ಒಂಬತ್ತು ಎಂಟು ಏಳು ... (or ೯೮೭೬...), in Hindi नौ आठ सात ... and in
 * English "nine eight seven ...". The calling code needs plain digits, so all of those are turned into 9876... here.
 * Pure code (no React Native): see scripts/spokenNumber.selfcheck.ts.
 */

import { indicDigitValue, plain } from './nameMatch';

/** Digit words, 0..9, per language. Romanised spellings are included because speech engines produce them too. */
const DIGIT_WORDS: string[][] = [
  // English
  ['zero oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  // Hindi / Hinglish
  ['shunya sifar jeero', 'ek', 'do', 'teen', 'char chaar', 'paanch panch pach', 'chhe chhah chah chheh', 'saat sat', 'aath aat', 'nau nao'],
  ['शून्य ज़ीरो जीरो', 'एक वन', 'दो टू', 'तीन थ्री', 'चार फोर', 'पाँच पांच पाच फाइव', 'छह छः छे छ सिक्स', 'सात सेवन', 'आठ एट', 'नौ नाइन'],
  // Marathi
  ['', '', 'दोन', '', '', '', 'सहा', '', '', 'नऊ'],
  // Kannada
  ['ಸೊನ್ನೆ ಶೂನ್ಯ ಜೀರೋ', 'ಒಂದು ಒಂದ', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು ಒಂಭತ್ತು'],
  ['sonne', 'ondu', 'eradu', 'mooru', 'naalku', 'aidu', 'aaru', 'elu', 'entu', 'ombattu'],
  // Tamil
  ['பூஜ்யம் சுழியம் ஜீரோ', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது'],
  ['poojyam', 'onru', 'irandu', 'moondru', 'naangu', 'ainthu', 'aaru', 'ezhu', 'ettu', 'onbathu'],
  // Telugu
  ['సున్నా జీరో', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'],
  ['sunna', 'okati', 'rendu', 'moodu', 'nalugu', 'aidu', 'aaru', 'edu', 'enimidi', 'tommidi'],
  // Malayalam
  ['പൂജ്യം', 'ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്', 'ഏഴ്', 'എട്ട്', 'ഒമ്പത് ഒൻപത്'],
  // Bengali
  ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'],
  // Gujarati
  ['શૂન્ય', 'એક', 'બે', 'ત્રણ', 'ચાર', 'પાંચ', 'છ', 'સાત', 'આઠ', 'નવ'],
  // Punjabi
  ['ਸਿਫ਼ਰ', 'ਇੱਕ', 'ਦੋ', 'ਤਿੰਨ', 'ਚਾਰ', 'ਪੰਜ', 'ਛੇ', 'ਸੱਤ', 'ਅੱਠ', 'ਨੌਂ'],
  // Odia
  ['ଶୂନ୍ୟ', 'ଏକ', 'ଦୁଇ', 'ତିନି', 'ଚାରି', 'ପାଞ୍ଚ', 'ଛଅ', 'ସାତ', 'ଆଠ', 'ନଅ'],
];

/** "double nine" / "triple five": the next digit counts twice / three times. */
const REPEATERS = new Map<string, number>(
  Object.entries({
    double: 2, triple: 3, 'डबल': 2, 'ट्रिपल': 3, 'ಡಬಲ್': 2, 'ಟ್ರಿಪಲ್': 3, 'டபுள்': 2, 'ట్రిపుల్': 3, 'ഡബിൾ': 2,
  }).map(([word, times]) => [plain(word), times]),
);

const WORD_TO_DIGIT = new Map<string, number>();
DIGIT_WORDS.forEach((row) =>
  row.forEach((cell, digit) => {
    for (const w of cell.split(' ')) if (w) WORD_TO_DIGIT.set(plain(w), digit);
  }),
);

/** Digits (any script) → 0-9 inside a string. */
function asciiDigits(text: string): string {
  let out = '';
  for (const ch of text) {
    const v = indicDigitValue(ch.codePointAt(0)!);
    out += v >= 0 ? String(v) : ch;
  }
  return out;
}

/**
 * The phone number found in what the user said, as plain digits, or null if there is none. It takes the longest
 * stretch made only of digits and digit words, so "my number is nine eight seven six five four three two one zero"
 * still works. At least 6 digits are needed so ordinary speech ("one moment", "two tickets") is never taken for one.
 */
export function extractSpokenNumber(text: string): string | null {
  const words = plain(asciiDigits(text)).split(' ').filter(Boolean);
  let best = '';
  let run = '';
  let repeat = 1;
  const flush = () => {
    if (run.length > best.length) best = run;
    run = '';
    repeat = 1;
  };
  for (const w of words) {
    if (/^\d+$/.test(w)) {
      run += w.repeat(repeat);
      repeat = 1;
    } else if (WORD_TO_DIGIT.has(w)) {
      run += String(WORD_TO_DIGIT.get(w)).repeat(repeat);
      repeat = 1;
    } else if (REPEATERS.has(w) && run) {
      repeat = REPEATERS.get(w)!;
    } else if (w === 'plus' || w === 'प्लस') {
      // "plus nine one": the sign itself carries nothing we need
    } else {
      flush();
    }
  }
  flush();
  return best.length >= 6 ? best : null;
}
