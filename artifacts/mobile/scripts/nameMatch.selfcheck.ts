/**
 * Self-check for how a spoken name is matched against written ones (contacts, app names). No React Native needed:
 *
 *   node --experimental-strip-types scripts/nameMatch.selfcheck.ts
 *
 * Exits with an error (non-zero) on the first failing check.
 */

const m = await import(new URL('../services/assistant/nameMatch.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}

const best = (spoken: string, names: string[]): string | undefined =>
  m.rankNames(spoken, names, (n: string) => [n])[0]?.item;
const all = (spoken: string, names: string[]): string[] => m.rankNames(spoken, names, (n: string) => [n]).map((r: { item: string }) => r.item);

// Transliteration
check('Devanagari Rahul', m.fineKey('राहुल') === 'rahul');
check('Kannada Rahul', m.coarseKey('ರಾಹುಲ್') === m.coarseKey('Rahul'));
check('Tamil spells Rahul as Ragul: still found', m.scoreName('ராகுல்', 'Rahul') >= 60);
check('Tamil Suresh (one letter for s and ch)', m.coarseKey('சுரேஷ்') === m.coarseKey('Suresh'));
check('Telugu Rahul', m.coarseKey('రాహుల్') === m.coarseKey('Rahul'));
check('Malayalam Rahul', m.coarseKey('രാഹുൽ') === m.coarseKey('Rahul'));
check('Bengali Rahul', m.coarseKey('রাহুল') === m.coarseKey('Rahul'));
check('Gujarati Rahul', m.coarseKey('રાહુલ') === m.coarseKey('Rahul'));
check('Gurmukhi Rahul', m.coarseKey('ਰਾਹੁਲ') === m.coarseKey('Rahul'));
check('Devanagari Suresh', m.coarseKey('सुरेश') === m.coarseKey('Suresh'));
check('Kannada Suresh (final a kept)', m.coarseKey('ಸುರೇಶ') === m.coarseKey('Suresh'));
check('Devanagari Priya', m.coarseKey('प्रिया') === m.coarseKey('Priya'));
check('anusvara before a labial is m', m.fineKey('अंबिका') === m.fineKey('Ambika'));
check('anusvara before d is n', m.fineKey('संदीप') === m.fineKey('Sandeep'));
check('Indic digits become digits', m.toLatin('९८७६') === '9876');
check('Latin accents are stripped', m.fineKey('Ré') === m.fineKey('Re'));

// Finding a contact written in Latin letters from a name said in another script
const contacts = ['Rahul Sharma', 'Rohit Verma', 'Priya', 'Suresh Kumar', 'Mummy', 'Papa', 'Dr Sharma Clinic', 'Anita'];
check('Devanagari finds Latin contact', best('राहुल', contacts) === 'Rahul Sharma');
check('Kannada finds Latin contact', best('ರಾಹುಲ್', contacts) === 'Rahul Sharma');
check('Tamil finds Latin contact', best('சுரேஷ்', contacts) === 'Suresh Kumar');
check('Hindi Priya', best('प्रिया', contacts) === 'Priya');
check('Latin still works', best('rahul', contacts) === 'Rahul Sharma');
check('Case does not matter', best('RAHUL SHARMA', contacts) === 'Rahul Sharma');
check('Spelling variant', best('Rahool', contacts) === 'Rahul Sharma');
check('Tamil Rahul finds the contact', best('ராகுல்', contacts) === 'Rahul Sharma');
check('Rahul does not pull in Rohit', !all('rahul', contacts).includes('Rohit Verma'));
check('Unknown name finds nothing', all('Zubin', contacts).length === 0);
check('Family word in another script', best('अम्मा', contacts) === 'Mummy');
check('Family word in Kannada', best('ಅಮ್ಮ', contacts) === 'Mummy');
check('Family word: papa', best('पापा', contacts) === 'Papa');
check('Title and filler are ignored', best('Dr Sharma clinic', contacts) === 'Dr Sharma Clinic');
check('Surname alone', best('शर्मा', contacts) !== undefined && all('शर्मा', contacts).includes('Rahul Sharma'));

// A contact saved in an Indic script, asked for in Latin
check('Contact saved in Devanagari', best('rahul', ['राहुल शर्मा', 'Anita']) === 'राहुल शर्मा');

// Names with extras
check('Emoji and brackets in contact names', best('anita', ['Anita 💕 (Home)', 'Anil']) === 'Anita 💕 (Home)');

// Words in Indic scripts stay whole (vowel signs are marks, not letters)
check('plain keeps a Hindi word whole', m.plain('राहुल शर्मा') === 'राहुल शर्मा');
check('whole-word match works in Hindi', m.scoreName('राहुल', 'राहुल शर्मा') === 90);

// Scores are ordered
check('exact beats partial', m.scoreName('Rahul', 'Rahul') > m.scoreName('Rahul', 'Rahul Sharma'));
check('partial beats phonetic', m.scoreName('Rahul', 'Rahul Sharma') > m.scoreName('राहुल', 'Rahul'));

// App names
const apps = ['WhatsApp', 'WhatsApp Business', 'YouTube', 'YouTube Music', 'PhonePe', 'Phone', 'Instagram', 'Flipkart'];
check('Hindi spelling of WhatsApp', best('व्हाट्सएप', apps) === 'WhatsApp');
check('Hindi spelling of YouTube', best('यूट्यूब', apps) === 'YouTube');
check('Kannada spelling of Instagram', best('ಇನ್ಸ್ಟಾಗ್ರಾಮ್', apps) === 'Instagram');
check('Tamil spelling of Flipkart', best('ஃபிளிப்கார்ட்', apps) === 'Flipkart');
check('Phone is not PhonePe', best('phone', apps) === 'Phone');

// Picking the contact to call
const book = [
  { name: 'Rahul Sharma', numbers: [{ number: '0802345678', mobile: false }, { number: '9876500002', mobile: true }] },
  { name: 'Rahul Verma', numbers: [{ number: '9876500003', mobile: true }] },
  { name: 'Rahul', numbers: [{ number: '9876500004', mobile: true }] },
  { name: 'Rohit Verma', numbers: [{ number: '9876500005', mobile: true }] },
  { name: 'Mummy', numbers: [{ number: '9876500006', mobile: true }] },
  { name: 'Suresh Kumar', nickname: 'Sunny', numbers: [{ number: '9876500007', mobile: true }] },
  { name: 'Suresh K (work)', numbers: [{ number: '9876500007', mobile: true }] },
  { name: 'Anita', numbers: [{ number: '9876500008', mobile: true }] },
];
const pick = (spoken: string, list = book) => m.pickContacts(spoken, list) as { name: string; number: string }[];

check('exact name wins over longer names', pick('Rahul').length === 1 && pick('Rahul')[0].number === '9876500004');
check('exact name in Kannada wins too', pick('ರಾಹುಲ್').length === 1 && pick('ರಾಹುಲ್')[0].name === 'Rahul');
const rahuls = book.filter((c) => c.name !== 'Rahul');
check('two different Rahuls are both offered', pick('ರಾಹುಲ್', rahuls).length === 2);
check('full name picks one', pick('Rahul Sharma').length === 1 && pick('Rahul Sharma')[0].name === 'Rahul Sharma');
check('the mobile number is preferred over a landline', pick('Rahul Sharma')[0].number === '9876500002');
check('Hindi family word', pick('अम्मा')[0]?.name === 'Mummy');
check('nickname', pick('Sunny')[0]?.name === 'Suresh Kumar');
check('the same person saved twice is listed once', pick('Suresh').length === 1);
check('no one by that name', pick('Zubin').length === 0);
check('empty book', pick('Rahul', []).length === 0);

console.log(`nameMatch: all ${checks} checks passed`);
