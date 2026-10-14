/**
 * Self-check for turning dictated phone numbers into digits:
 *
 *   node --experimental-strip-types scripts/spokenNumber.selfcheck.ts
 */

await import('./register-ts.mjs');
const m = await import(new URL('../services/assistant/spokenNumber.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}
const num = (s: string) => m.extractSpokenNumber(s);

check('plain digits', num('9876543210') === '9876543210');
check('digits in groups', num('98765 43210') === '9876543210');
check('with country code', num('+91 98765 43210') === '919876543210');
check('English words', num('nine eight seven six five four three two one zero') === '9876543210');
check('English words inside a sentence', num('my number is nine eight seven six five four three two one zero please') === '9876543210');
check('Hindi words', num('नौ आठ सात छह पाँच चार तीन दो एक शून्य') === '9876543210');
check('Hindi digits', num('९८७६५४३२१०') === '9876543210');
check('Kannada words', num('ಒಂಬತ್ತು ಎಂಟು ಏಳು ಆರು ಐದು ನಾಲ್ಕು ಮೂರು ಎರಡು ಒಂದು ಸೊನ್ನೆ') === '9876543210');
check('Kannada digits', num('೯೮೭೬೫೪೩೨೧೦') === '9876543210');
check('Tamil words', num('ஒன்பது எட்டு ஏழு ஆறு ஐந்து நான்கு மூன்று இரண்டு ஒன்று பூஜ்யம்') === '9876543210');
check('Telugu words', num('తొమ్మిది ఎనిమిది ఏడు ఆరు ఐదు నాలుగు మూడు రెండు ఒకటి సున్నా') === '9876543210');
check('Malayalam words', num('ഒമ്പത് എട്ട് ഏഴ് ആറ് അഞ്ച് നാല് മൂന്ന് രണ്ട് ഒന്ന് പൂജ്യം') === '9876543210');
check('Bengali words', num('নয় আট সাত ছয় পাঁচ চার তিন দুই এক শূন্য') === '9876543210');
check('Hinglish words', num('nau aath saat chhe paanch char teen do ek shunya') === '9876543210');
check('double and triple', num('nine eight double seven six five four three two one') === '9877654321');
check('triple', num('nine triple eight seven six five four three') === '988876543');
check('double in Hindi', num('९८ डबल सात छह पाँच चार तीन दो एक') === '9877654321');
check('mixed digits and words', num('98765 four three two one zero') === '9876543210');
check('too short is not a phone number', num('call me in two minutes') === null);
check('ordinary speech is left alone', num('book two tickets for tomorrow') === null);
check('a name is not a number', num('Rahul Sharma') === null);
check('longest run wins', num('flat 12 and my number is 9876543210') === '9876543210');

console.log(`spokenNumber: all ${checks} checks passed`);
