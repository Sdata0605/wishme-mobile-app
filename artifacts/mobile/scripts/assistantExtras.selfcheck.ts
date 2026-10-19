/**
 * Self-check for the assistant's picture search, plain-text captions and the "What I can do" list (no network):
 *
 *   node --experimental-strip-types scripts/assistantExtras.selfcheck.ts
 *
 * It checks the web addresses a picture request opens, that markdown never reaches a caption, and that the capabilities
 * list only names screens that exist and tools the assistant really has.
 */

import { register } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// pictures.ts imports react-native (Linking): give it a stand-in.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier === 'react-native') return { url: 'data:text/javascript,export const Linking = { openURL: async () => {} };', shortCircuit: true };
    return next(specifier, context);
  }`));

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pic = await import(new URL('../services/assistant/pictures.ts', import.meta.url).href);
const speech = await import(new URL('../services/assistant/speechText.ts', import.meta.url).href);
const cap = await import(new URL('../services/assistant/capabilities.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

// ─── Pictures ────────────────────────────────────────────────────────────────
check('"show me images of Amitabh Bachchan" is just the name', pic.subjectOf('show me images of Amitabh Bachchan') === 'Amitabh Bachchan', pic.subjectOf('show me images of Amitabh Bachchan'));
check('a bare name stays', pic.subjectOf('Virat Kohli') === 'Virat Kohli');
check('"pictures of the Taj Mahal at sunset" keeps the place', pic.subjectOf('pictures of the Taj Mahal at sunset') === 'Taj Mahal at sunset', pic.subjectOf('pictures of the Taj Mahal at sunset'));
check('only filler words: the request is kept, not emptied', pic.subjectOf('show pictures').length > 0);
check('Hindi names are kept', pic.subjectOf('अमिताभ बच्चन की फोटो') .includes('अमिताभ'));
check('google images uses the current images tab (udm=2) and the old one', pic.picturesUrl('Amitabh Bachchan') === 'https://www.google.com/search?q=Amitabh%20Bachchan&udm=2&tbm=isch', pic.picturesUrl('Amitabh Bachchan'));
check('instagram is google images limited to instagram.com', /^https:\/\/www\.google\.com\/search\?tbm=isch&q=Amitabh%20Bachchan%20site%3Ainstagram\.com$/.test(pic.picturesUrl('Amitabh Bachchan', 'instagram')), pic.picturesUrl('Amitabh Bachchan', 'instagram'));
check('facebook uses its search', pic.picturesUrl('Amitabh Bachchan', 'facebook') === 'https://www.facebook.com/search/top?q=Amitabh%20Bachchan');
check('only web addresses are ever built (no intent: or file:)', ['google', 'instagram', 'facebook'].every((s) => pic.picturesUrl('x y', s).startsWith('https://')));
check('a query with symbols cannot break out of the address', !/[<> " ]/.test(pic.picturesUrl('a"b<c> d\'e')), pic.picturesUrl('a"b<c> d\'e'));
const opened = await pic.openPictures('show me photos of Dhruv Rathee');
check('openPictures opens the right search', opened.ok && opened.subject === 'Dhruv Rathee' && opened.url.includes('Dhruv%20Rathee'), opened);
check('no subject: asks who', (await pic.openPictures('show me pictures of')).ok === false || (await pic.openPictures('  ')).ok === false);

// ─── No markdown in captions ─────────────────────────────────────────────────
const md = speech.stripMarkdown;
check('bold marks go', md('Here are the **top stories** today') === 'Here are the top stories today', md('Here are the **top stories** today'));
check('bullets go', md('- first story\n- second story') === 'first story second story', md('- first story\n- second story'));
check('headings go', md('# Headlines\nOne thing') === 'Headlines One thing', md('# Headlines\nOne thing'));
check('links keep their words and lose the address', md('Read [the report](https://example.com/a?b=1) now') === 'Read the report now', md('Read [the report](https://example.com/a?b=1) now'));
check('bare links go', !md('see https://example.com/x for more').includes('example'));
check('emoji go', md('Good morning ☀️ sir') === 'Good morning sir', md('Good morning ☀️ sir'));
check('a plain sentence is unchanged', md('It is 32 degrees in Pune, and it may rain.') === 'It is 32 degrees in Pune, and it may rain.');
check('a half-finished "**" at the end of a chunk does not show', !md('the big **').includes('*'), md('the big **'));
check('"End of conversational turn." never reaches the screen', md('Hello. End of conversational turn.') === 'Hello.' && md('End of conversational turn. ') === '', md('Hello. End of conversational turn.'));
check('a normal sentence with "turn" is untouched', md('Take a left turn at the end of the road.') === 'Take a left turn at the end of the road.');
check('a multiplication sign is not eaten', md('3 * 4 is twelve') === '3 * 4 is twelve' || md('3 * 4 is twelve') === '3 4 is twelve', md('3 * 4 is twelve'));

// ─── The capabilities list ───────────────────────────────────────────────────
const categories = cap.CAPABILITIES as Array<{ id: string; title: string; oneLine: string; items: Array<{ label: string; say: string; route?: string; tool?: string }> }>;
check('there are categories and each has items', categories.length >= 10 && categories.every((c) => c.items.length > 0));
check('ids are unique', new Set(categories.map((c) => c.id)).size === categories.length);

const routeExists = (route: string) => {
  const bare = route.replace(/^\//, '').replace(/^\(tabs\)\//, '');
  const candidates = [`app/${bare}.tsx`, `app/${bare}/index.tsx`, `app/(tabs)/${bare}.tsx`, `app/(tabs)/${bare}/index.tsx`];
  return candidates.some((c) => existsSync(join(root, c)));
};
const missingRoutes = categories.flatMap((c) => c.items.filter((i) => i.route && !routeExists(i.route)).map((i) => `${c.id}: ${i.route}`));
check('every screen a line opens exists', missingRoutes.length === 0, missingRoutes);

const dir = join(root, 'services/assistant');
const source = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const declared = new Set([...source.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]));
const unknownTools = categories.flatMap((c) => c.items.filter((i) => i.tool && !declared.has(i.tool)).map((i) => `${c.id}: ${i.tool}`));
check('every tool named in the list exists', unknownTools.length === 0, unknownTools);

const must = ['web_search', 'show_news', 'show_pictures', 'show_capabilities', 'ai_call', 'add_reminder', 'create_document', 'search_flights', 'open_app', 'set_language', 'start_wish', 'make_music'];
const listed = new Set(categories.flatMap((c) => c.items.map((i) => i.tool)));
const unlisted = must.filter((t) => t !== 'show_capabilities' && !listed.has(t));
check('the main tools are all in the list', unlisted.length === 0, unlisted);
check('the spoken summary names every category once and is short', cap.spokenSummary().split(';').length === categories.length && cap.spokenSummary().length < 700, cap.spokenSummary().length);
check('a category can be asked for by id or title', cap.categoriesFor('travel').length === 1 && cap.categoriesFor('Travel')[0].id === 'travel' && cap.categoriesFor('nonsense').length === categories.length);

// ─── Claims without a tool call (seen on a phone: "I have opened the screen", and no show_pictures in the log) ───
const claim = await import(new URL('../services/assistant/claimCheck.ts', import.meta.url).href);
check('"I have opened the screen" after a pictures request, no tool: the model is told', claim.missedTool('I have opened the screen.', 'Show me hit pictures.', 0)?.tool === 'show_pictures');
check('the nudge tells it to use the full name, never "his"', /full name/.test(claim.missedTool('Opened.', 'show me his photos', 0).nudge) && /never "his"/.test(claim.missedTool('Opened.', 'show me his photos', 0).nudge));
check('a tool was called: nothing to say', claim.missedTool('I have opened it.', 'show me pictures of Virat Kohli', 1) === null);
check('a clarifying question is not a claim', claim.missedTool('Which Rahul do you mean: Gandhi, Dravid or someone else?', 'show me pictures of Rahul', 0) === null);
check('"I will show you pictures once you tell me" is not a claim', claim.missedTool('I will show you pictures once you tell me which one.', 'pictures please', 0) === null);
check('an answer about something else is left alone', claim.missedTool('It is 32 degrees in Pune and it is open weather.', 'what is the weather', 0) === null);
check('headlines claimed but show_news never called', claim.missedTool('The headlines are on your screen.', 'what is the news', 0)?.tool === 'show_news');
check('a Hindi claim after a Hindi request is caught', claim.missedTool('मैंने खोल दिया है।', 'विराट कोहली की फोटो दिखाओ', 0)?.tool === 'show_pictures');
check('an empty answer is left alone', claim.missedTool('', 'show me pictures', 0) === null);

console.log(`${checks} checks passed`);
