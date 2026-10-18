/**
 * Self-check for how the assistant addresses the user (sir / ma'am / decide by voice): greetings, titles and the prompt
 * line for each mode and each engine. No network.
 *
 *   node --experimental-strip-types scripts/addressAs.selfcheck.ts
 */
(globalThis as any).require = () => 0;
const p: any = await import(new URL('../services/assistant/persona.ts', import.meta.url).href);
let n = 0; const ok = (name: string, c: boolean, d?: unknown) => { n++; if (!c) throw new Error('FAILED ' + name + (d ? ' ' + JSON.stringify(d) : '')); };
const A = (mode: any, title: any = null) => ({ mode, title });
// greetings
ok('sir greets Hello sir.', p.buildGreetingLine(undefined, A('sir')) === 'Hello sir.');
ok("madam greets Hello ma'am.", p.buildGreetingLine(undefined, A('madam')) === "Hello ma'am.");
ok('voice greets plain Hello.', p.buildGreetingLine(undefined, A('voice')) === 'Hello.');
ok('unset greets plain Hello.', p.buildGreetingLine(undefined, A(undefined)) === 'Hello.');
ok('voice greeting ignores the earlier pick (new conversation)', p.buildGreetingLine(undefined, A('voice', 'madam')) === 'Hello.');
// titles
ok('fixed sir wins over a stray title', p.titleFor(A('sir', 'madam')) === 'sir');
ok('voice uses the decided title', p.titleFor(A('voice', 'madam')) === 'madam');
ok('voice with nothing decided has no title', p.titleFor(A('voice')) === null);
// system lines
const g = (a: any, e: any = 'gemini') => p.addressLine(a, e);
ok('sir line says sir and allows Hindi', /Address the user as "sir"/.test(g(A('sir'))) && g(A('sir')).includes('सर'));
ok('madam line says ma\'am and Hindi मैम', /Address the user as "ma'am"/.test(g(A('madam'))) && g(A('madam')).includes('मैम'));
ok('gemini voice, undecided: no title yet, asks to decide with the tool', /not yet decided/.test(g(A('voice'))) && /set_user_title/.test(g(A('voice'))) && !/Address the user as/.test(g(A('voice'))));
ok('unset mode behaves like voice on gemini', /not yet decided/.test(g(A(undefined))));
ok('gemini voice, decided: uses it and allows correction', /Address the user as "ma'am"/.test(g(A('voice', 'madam'))) && /set_user_title/.test(g(A('voice', 'madam'))));
ok('sarvam voice: no title, no tool', /Do not call the user "sir"/.test(g(A('voice'), 'sarvam')) && !/set_user_title/.test(g(A('voice'), 'sarvam')));
ok('sarvam fixed sir still says sir', /Address the user as "sir"/.test(g(A('sir'), 'sarvam')));
// greeting prompt
const gp = (a: any) => p.buildGreetingPrompt({}, a);
ok('voice greeting prompt marks a new conversation and says exactly Hello.', /New conversation/.test(gp(A('voice'))) && /Say exactly "Hello\."/.test(gp(A('voice'))), gp(A('voice')));
ok('fixed greeting prompt says exactly Hello sir.', /Say exactly "Hello sir\."/.test(gp(A('sir'))) && !/New conversation/.test(gp(A('sir'))));
console.log(n + ' checks passed');
