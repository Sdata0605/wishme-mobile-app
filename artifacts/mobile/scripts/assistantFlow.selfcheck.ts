/**
 * Runs the assistant's real tool code (tools.ts, phone.ts, name matching, number checks) against a pretend address
 * book and a pretend Android, to prove the flows the user complained about:
 *   - "call <name>" finds the number in the contacts by itself, in any language, and only asks when it cannot
 *   - "open <app>" launches at once, with no question, even right after the user was working on a screen
 *
 *   node --experimental-strip-types scripts/assistantFlow.selfcheck.ts
 */

import { register } from 'node:module';

register('./assistant-hooks.mjs', import.meta.url);
const g = globalThis as Record<string, any>;
g.__DEV__ = false; // a React Native global the app code reads
const tools = await import(new URL('../services/assistant/tools.ts', import.meta.url).href);
const phone = await import(new URL('../services/assistant/phone.ts', import.meta.url).href);

type Result = Record<string, any>;

let checks = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (ok) return;
  const message = `FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`;
  // CHECK_ALL=1 lists every failure instead of stopping at the first (used to compare against the old code).
  if (process.env.CHECK_ALL) failures.push(message);
  else throw new Error(message);
}

let left = 0;
const ctx = {
  router: { navigate() {}, back() {}, canGoBack: () => false, push() {} },
  setPrefill() {},
  onAction() {},
  onLeaveApp: () => void left++,
  getAccessToken: async () => 'token',
  watchAiCall() {},
  getUserId: () => 'user-1',
};
const run = (name: string, args: Record<string, unknown>): Promise<Result> =>
  tools.runAssistantTool({ id: 't', name, args }, ctx);

const reset = () => {
  phone.forgetLastOpenedApp();
  g.__sent = [];
  g.__intents = [];
  g.__opened = [];
  g.__requests = [];
  g.__asked = 0;
  g.__notInstalled = [];
  left = 0;
};
const mobile = (n: string) => ({ number: n, label: 'mobile' });
g.__perm = { granted: true, canAskAgain: true, status: 'granted' };
g.__contacts = [
  { name: 'Rahul Sharma', phoneNumbers: [{ number: '080 2345 6789', label: 'home' }, { number: '+91 98765 00002', label: 'mobile' }] },
  { name: 'Rohit Verma', phoneNumbers: [mobile('98765 00005')] },
  { name: 'Mummy', phoneNumbers: [mobile('98765 00006')] },
  { name: 'Priya', phoneNumbers: [mobile('98765 00007')] },
  { name: 'Dr Sharma Clinic', phoneNumbers: [mobile('98765 00009')] },
];

// ─── "Call <name>": the contact is found first, in any language ──────────────
reset();
let r = await run('ai_call', { name: 'Rahul' });
check('Latin name, no purpose yet: contact is found, purpose is asked', r.needs_info === 'purpose' && r.found === 'Rahul Sharma', r);
check('it tells the model not to ask for the number', /do not ask for the phone number/i.test(r.instruction), r);

r = await run('ai_call', { name: 'ರಾಹುಲ್' });
check('Kannada name finds the contact saved in English', r.needs_info === 'purpose' && r.found === 'Rahul Sharma', r);

r = await run('ai_call', { name: 'राहुल' });
check('Hindi name finds the contact saved in English', r.needs_info === 'purpose' && r.found === 'Rahul Sharma', r);

r = await run('ai_call', { name: 'அம்மா', purpose: 'Ask if she has eaten' });
check('"Amma" in Tamil finds Mummy and asks to confirm', r.needs_confirmation === true && r.who === 'Mummy', r);
check('the number is read without the country code', r.number === '98765 00006', r);

r = await run('ai_call', { name: 'Priya', purpose: 'Say I will be late' });
check('confirmation read-back', r.needs_confirmation === true && r.who === 'Priya' && r.number === '98765 00007', r);
check('nothing was dialled before the yes', g.__requests.length === 0);
r = await run('ai_call', { name: 'Priya', purpose: 'Say I will be late', user_confirmed: true });
check('after the yes the call is placed', r.ok === true && r.call_id === 'call-1', r);
check('the call went to the number found in the contacts', g.__requests[0]?.body?.phone === '+919876500007', g.__requests);

reset();
r = await run('ai_call', { name: 'Zubin' });
check('unknown name: only now is the number asked for', r.not_found === true && /ask the user to say the phone number/i.test(r.instruction), r);

reset();
g.__perm = { granted: false, canAskAgain: true, status: 'denied' };
g.__permAfterAsk = { granted: true, canAskAgain: true, status: 'granted' };
r = await run('ai_call', { name: 'Priya' });
check('contacts permission is asked for on the spot, then the lookup goes on', g.__asked === 1 && r.found === 'Priya', r);

reset();
g.__perm = { granted: false, canAskAgain: false, status: 'denied' };
g.__permAfterAsk = undefined;
r = await run('ai_call', { name: 'Priya', purpose: 'Say hi' });
check('contacts blocked: the model is told to ask for the number', r.permission_needed === 'contacts' && /number/i.test(r.instruction), r);
g.__perm = { granted: true, canAskAgain: true, status: 'granted' };

reset();
r = await run('ai_call', { name: 'Rahul', purpose: 'Say hi' });
check('"Rahul" alone matches Rahul Sharma but not Rohit', r.needs_confirmation === true && r.who === 'Rahul Sharma', r);

r = await run('ai_call', { name: 'Sharma', purpose: 'Say hi' });
check('two Sharmas: the user is asked which', r.needs_confirmation === true && Array.isArray(r.matches) && r.matches.length === 2, r);

r = await run('ai_call', { number: 'nine eight seven six five zero zero zero one four', purpose: 'Say hi' });
check('a number said in English words is understood', r.needs_confirmation === true && r.number === '98765 00014', r);
r = await run('ai_call', { number: 'ಒಂಬತ್ತು ಎಂಟು ಏಳು ಆರು ಐದು ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಒಂದು', purpose: 'Say hi' });
check('a number said in Kannada words is understood', r.needs_confirmation === true && r.number === '98765 00001', r);
r = await run('ai_call', { number: '९८७६५००००२', purpose: 'Say hi' });
check('a number in Hindi digits is understood', r.needs_confirmation === true && r.number === '98765 00002', r);
r = await run('ai_call', { name: '+91 98765 43210', purpose: 'Say hi' });
check('a number dictated as the name is still a number', r.needs_confirmation === true && r.number === '98765 43210', r);
r = await run('ai_call', { name: '112', purpose: 'Help' });
check('emergency numbers are still refused', r.ok === false, r);

// ─── "Open <app>": immediate, no question ────────────────────────────────────
reset();
await run('read_screen', {}); // the user was just working on a screen: this used to trigger a spoken "are you sure?"
r = await run('open_app', { app_name: 'WhatsApp' });
check('opens at once, right after a screen tool', r.ok === true && r.opened === 'WhatsApp' && !r.needs_confirmation, r);
check('the assistant stepped aside', left === 1);
check('launched by package', g.__intents[0]?.packageName === 'com.whatsapp' && g.__intents[0]?.category === 'android.intent.category.LAUNCHER', g.__intents);

reset();
r = await run('open_app', { app_name: 'व्हाट्सएप' });
check('app named in Hindi script', r.ok === true && r.opened === 'WhatsApp', r);
r = await run('open_app', { app_name: 'ಇನ್ಸ್ಟಾಗ್ರಾಮ್' });
check('app named in Kannada script', r.ok === true && r.opened === 'Instagram', r);
r = await run('open_app', { app_name: 'camera' });
check('camera opens by intent, not a Google-only package', r.ok === true && g.__sent?.at(-1) === 'android.media.action.STILL_IMAGE_CAMERA', { sent: g.__sent, intents: g.__intents });
r = await run('open_app', { app_name: 'settings' });
check('settings opens by intent', g.__sent?.at(-1) === 'android.settings.SETTINGS', { sent: g.__sent, intents: g.__intents });
r = await run('open_app', { app_name: 'Meesho' });
check('an app with no launcher hint and no package visibility ends honestly at its store page', r.ok === false && r.opened_store === true && /Play Store page/.test(r.error), r);
g.__visibleApps = ['com.meesho.supply']; // as after the rebuild that adds the <queries> permission
r = await run('open_app', { app_name: 'Meesho' });
check('once the app is visible, its own launcher starts it', r.ok === true && r.opened === 'Meesho' && g.__apps?.includes('com.meesho.supply'), { r, apps: g.__apps });
g.__visibleApps = [];
r = await run('open_app', { app_name: 'Truecaller' });
check('an app that was NOT in the old list now opens directly', r.ok === true && r.opened === 'Truecaller' && g.__intents.at(-1)?.packageName === 'com.truecaller', r);

reset();
g.__notInstalled = ['com.truecaller'];
r = await run('open_app', { app_name: 'Truecaller' });
check('cannot be started: its Play Store page is opened and the model is told honestly', r.ok === false && /Play Store page/.test(r.error) && g.__opened[0] === 'market://details?id=com.truecaller', { r, opened: g.__opened });

reset();
r = await run('open_app', { app_name: 'Zorblax' });
check('unknown app: nothing is opened, the model is told and may offer the Play Store', r.ok === false && r.not_found === true && /Zorblax/.test(r.error) && !g.__opened?.length && !!r.instruction, { r, opened: g.__opened });
r = await run('open_app', { app_name: 'Zorblax', play_store: true });
check('the user agreed: the Play Store search opens', r.ok === true && g.__opened[0].startsWith('market://search'), { r, opened: g.__opened });
r = await run('open_app', { app_name: 'ChatGPT' });
check('ChatGPT is known even without the phone\'s list', r.ok === true && r.opened === 'ChatGPT', r);

// Websites keep their spoken safety check (only apps were changed)
reset();
await run('read_screen', {});
r = await run('open_website', { url: 'flipkart.com' });
check('opening a website right after a screen tool still asks first', r.needs_confirmation === true, r);

if (failures.length) {
  console.log(failures.map((f) => f.split('\n')[0]).join('\n'));
  console.log(`assistantFlow: ${failures.length} of ${checks} checks failed`);
} else {
  console.log(`assistantFlow: all ${checks} checks passed`);
}
