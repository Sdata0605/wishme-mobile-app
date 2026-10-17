/**
 * Self-check for the OpenAI Realtime helpers:
 *
 *   node --experimental-strip-types scripts/openaiRealtime.selfcheck.ts
 */

await import('./register-ts.mjs');
const m = await import(new URL('../services/openaiRealtime/convert.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}

const tools = m.toRealtimeTools([
  { name: 'open_screen', description: 'Open a screen', parameters: { type: 'OBJECT', properties: { screen: { type: 'STRING', description: 'which' }, n: { type: 'NUMBER' }, tags: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['screen'] } },
  { name: 'no_args' },
]);
check('function tool shape', tools[0].type === 'function' && tools[0].name === 'open_screen' && tools[0].description === 'Open a screen');
check('types lower-cased', tools[0].parameters.type === 'object' && tools[0].parameters.properties.screen.type === 'string' && tools[0].parameters.properties.n.type === 'number');
check('nested types lower-cased', tools[0].parameters.properties.tags.items.type === 'string');
check('descriptions and required kept', tools[0].parameters.properties.screen.description === 'which' && tools[0].parameters.required[0] === 'screen');
check('tool without parameters gets an empty object schema', tools[1].parameters.type === 'object' && Object.keys(tools[1].parameters.properties).length === 0);

const pcm = (vals: number[]) => {
  const b = new Uint8Array(vals.length * 2);
  const v = new DataView(b.buffer);
  vals.forEach((x, i) => v.setInt16(i * 2, x, true));
  return b;
};
const samples = (b: Uint8Array) => Array.from({ length: b.length / 2 }, (_, i) => new DataView(b.buffer).getInt16(i * 2, true));
const up = m.upsample16kTo24k(pcm([0, 300, 600, 900]));
check('3 samples out for every 2 in', up.length / 2 === 6);
check('linear interpolation', JSON.stringify(samples(up)) === JSON.stringify([0, 200, 400, 600, 800, 900]));
check('empty input', m.upsample16kTo24k(new Uint8Array(0)).length === 0);
check('stays in range', samples(m.upsample16kTo24k(pcm([32767, -32768, 32767]))).every((x: number) => x <= 32767 && x >= -32768));

console.log(`openaiRealtime: all ${checks} checks passed`);
