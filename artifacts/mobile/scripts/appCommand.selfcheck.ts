/**
 * Self-check for recognising "open <app>" commands and resolving app names:
 *
 *   node --experimental-strip-types scripts/appCommand.selfcheck.ts
 */

await import('./register-ts.mjs');
const cmd = await import(new URL('../services/assistant/appCommand.ts', import.meta.url).href);
const cat = await import(new URL('../services/assistant/appCatalog.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}
const opens = (text: string): string | null => cmd.parseOpenAppCommand(text)?.app.label ?? null;

// Plain commands in several languages
check('open WhatsApp', opens('Open WhatsApp') === 'WhatsApp');
check('with a full stop', opens('Open WhatsApp.') === 'WhatsApp');
check('lower case, no punctuation', opens('open whatsapp') === 'WhatsApp');
check('polite sentence', opens('Can you please open the WhatsApp app for me') === 'WhatsApp');
check('launch', opens('launch Instagram') === 'Instagram');
check('Hinglish', opens('WhatsApp kholo') === 'WhatsApp');
check('Hindi script', opens('व्हाट्सएप खोलो') === 'WhatsApp');
check('Hindi, verb first', opens('खोलो यूट्यूब') === 'YouTube');
check('Hindi with the English word open', opens('यूट्यूब ओपन करो') === 'YouTube');
check('Kannada', opens('ಇನ್ಸ್ಟಾಗ್ರಾಮ್ ತೆರೆಯಿರಿ') === 'Instagram');
check('Kannada with open', opens('ಇನ್ಸ್ಟಾಗ್ರಾಮ್ ಓಪನ್ ಮಾಡಿ') === 'Instagram');
check('Tamil', opens('பிளிப்கார்ட் திற') === 'Flipkart');
check('Telugu', opens('వాట్సాప్ ఓపెన్ చేయి') === 'WhatsApp');
check('Malayalam', opens('വാട്സ്ആപ്പ് തുറക്കൂ') === 'WhatsApp');
check('two-word app', opens('open YouTube Music') === 'YouTube Music');
check('YouTube is not YouTube Music', opens('open YouTube') === 'YouTube');
check('Play Store', opens('open the play store') === 'Play Store');
check('system app: camera', opens('open camera') === 'Camera');
check('system app: calculator', opens('open calculator') === 'Calculator');
check('system app: phone', opens('open phone') === 'Phone');
check('Google Pay', opens('open Google Pay') === 'Google Pay');
check('misspelt open', opens('opan WhatsApp') === 'WhatsApp');

// Things that must NOT be handled by the shortcut
check('no verb', opens('WhatsApp') === null);
check('tap is not open', opens('tap Fetch Bill') === null);
check('negative', opens("don't open WhatsApp") === null);
check('second request', opens('open YouTube and play Arijit songs') === null);
check('second request in Hinglish', opens('YouTube kholo aur gaana chalao') === null);
check('WishMe screen, not an app', opens('open the bill payment screen') === null);
check('WishMe wallet', opens('open wallet') === null);
check('WishMe photo wish is not Google Photos', opens('open photo wish') === null);
check('WishMe my bookings is not Booking.com', opens('open my bookings') === null);
check('settings is ambiguous', opens('open settings') === null);
check('messages is ambiguous', opens('open messages') === null);
check('calendar is ambiguous', opens('open calendar') === null);
check('music is ambiguous', opens('open music') === null);
check('unknown app', opens('open Zorblax') === null);
check('long sentence', opens('I was thinking that maybe later today we could open WhatsApp and see') === null);
check('empty', opens('') === null);

// Resolving a name the model passes in
const r = (s: string) => cat.resolveApp(s, 55)?.label ?? null;
check('resolve: app suffix', r('WhatsApp app') === 'WhatsApp');
check('resolve: Hindi script', r('वाट्सऐप') === 'WhatsApp');
check('resolve: Kannada script', r('ಯೂಟ್ಯೂಬ್') === 'YouTube');
check('resolve: settings', r('settings') === 'Settings');
check('resolve: x', r('x') === 'X');
check('resolve: twitter', r('twitter') === 'X');
check('resolve: gibberish', r('qwertyuiop') === null);
check('resolve: Phone is not PhonePe', r('phone') === 'Phone');
check('system apps use intents, not packages', cat.APPS.filter((a: { intent?: unknown; pkg?: string }) => a.intent).every((a: { pkg?: string }) => !a.pkg));
check('every app can be launched', cat.APPS.every((a: { intent?: unknown; pkg?: string }) => a.intent || a.pkg));

// Regressions from 2026-10-14: 'open expo app' opened YouTube / MX Player, and WhatsApp opened its Play Store page
check('expo is Expo Go, not MX Player', r('expo') === 'Expo Go');
check('open expo app', opens('open expo app') === 'Expo Go');
check('Hindi Expo', r('एक्सपो') === 'Expo Go');
check('Paytm in Hindi', r('पेटीएम') === 'Paytm');
check('every launch hint points at a known package', Object.keys(cat.LAUNCH_HINTS).every((p) => cat.APPS.some((a: { pkg?: string }) => a.pkg === p)));
check('WhatsApp has a launcher activity', !!cat.LAUNCH_HINTS['com.whatsapp']?.activity);

console.log(`appCommand: all ${checks} checks passed`);
