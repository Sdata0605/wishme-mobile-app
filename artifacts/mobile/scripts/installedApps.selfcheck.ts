/**
 * Self-check for matching a spoken app name against the apps really installed on the phone:
 *
 *   node --experimental-strip-types scripts/installedApps.selfcheck.ts
 */

await import('./register-ts.mjs');
const m = await import(new URL('../services/assistant/installedAppMatch.ts', import.meta.url).href);
const cmd = await import(new URL('../services/assistant/appCommand.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks += 1;
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exit(1);
  }
}

const app = (label: string, packageName: string) => ({ label, packageName, activityName: `${packageName}.Main` });
// A made-up phone. ChatGPT, Claude, Perplexity and Zepto are not special-cased anywhere: they come from the phone's list.
const phone = [
  app('ChatGPT', 'com.openai.chatgpt'),
  app('Claude', 'com.anthropic.claude'),
  app('WhatsApp', 'com.whatsapp'),
  app('WA Business', 'com.whatsapp.w4b'),
  app('Google Chrome', 'com.android.chrome'),
  app('Phone', 'com.google.android.dialer'),
  app('PhonePe', 'com.phonepe.app'),
  app('Files', 'com.google.android.apps.nbu.files'),
  app('Contacts', 'com.google.android.contacts'),
  app('Perplexity', 'ai.perplexity.app.android'),
  app('Zepto', 'com.zeptoconsumerapp'),
  app('Wallet', 'com.google.android.apps.walletnfcrel'),
  app('Obscure Tracker', 'org.example.obscuretracker'),
];
const idx = m.buildAppIndex(phone);
const pkg = (s: string) => m.matchApp(s, idx)[0]?.target.pkg ?? null;

for (const say of ['ChatGPT', 'chatgpt', 'chat gpt', 'Chat GPT app', 'चैट जीपीटी', 'ChatGPT in my mobile', 'open ai']) {
  check(`ChatGPT <- ${say}`, pkg(say) === 'com.openai.chatgpt');
}
check('claude', pkg('claude') === 'com.anthropic.claude');
check('claude in Hindi', pkg('क्लॉड') === 'com.anthropic.claude');
check('whatsapp is not WA Business', pkg('whatsapp') === 'com.whatsapp');
check('whatsapp business', pkg('whatsapp business') === 'com.whatsapp.w4b');
check('whatsapp in Hindi', pkg('व्हाट्सएप') === 'com.whatsapp');
check('chrome', pkg('chrome') === 'com.android.chrome');
check('google chrome', pkg('google chrome') === 'com.android.chrome');
check('phone is the dialer, not PhonePe', pkg('phone') === 'com.google.android.dialer');
check('phone pe', pkg('phone pe') === 'com.phonepe.app');
check('perplexity ai', pkg('perplexity ai') === 'ai.perplexity.app.android');
check('an app nobody wrote down', pkg('obscure tracker') === 'org.example.obscuretracker');
check('contacts: the installed app ranks first', pkg('contacts') === 'com.google.android.contacts');
check('truecaller is not installed here', m.matchApp('truecaller', idx)[0]?.target.installed === false);
check('gibberish matches nothing', m.matchApp('zorblax', idx).length === 0);
check('a near miss is offered back', m.closestInstalled('chat g p', idx).some((c: { target: { label: string } }) => c.target.label === 'ChatGPT'));

// Without the phone's list (builds from before the native module), the catalogue still knows ChatGPT
const bare = m.buildAppIndex(null);
check('catalogue only: chatgpt', m.matchApp('chatgpt', bare)[0]?.target.pkg === 'com.openai.chatgpt');
check('catalogue only: expo', m.matchApp('expo', bare)[0]?.target.pkg === 'host.exp.exponent');
check('catalogue only: nothing installed is claimed', !bare.hasInstalled);

// The quick "open <app>" path
const quick = (s: string) => cmd.parseOpenAppCommand(s, idx)?.app.label ?? null;
check('quick: open chat gpt', quick('open chat gpt') === 'ChatGPT');
check('quick: Hindi ChatGPT', quick('चैट जीपीटी खोलो') === 'ChatGPT');
check('quick: open ChatGPT in my mobile', quick('open ChatGPT in my mobile') === 'ChatGPT');
check('quick: wallet is the WishMe wallet', quick('open wallet') === null);
check('quick: settings is ambiguous', quick('open settings') === null);
check('quick: messages is ambiguous', quick('open messages') === null);
check('quick: a second request goes to the model', quick('open whatsapp and send hi') === null);

console.log(`installedApps: all ${checks} checks passed`);
