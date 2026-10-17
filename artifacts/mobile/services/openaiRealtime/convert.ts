/**
 * Pure helpers for the OpenAI Realtime client (no React Native): tool declarations in OpenAI's shape, and the
 * microphone's 16 kHz audio raised to the 24 kHz OpenAI expects. See scripts/openaiRealtime.selfcheck.ts.
 */

/** Gemini declarations use upper-case types (STRING, OBJECT); OpenAI wants JSON Schema (string, object). */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v);
  }
  return out;
}

export function toRealtimeTools(declarations: unknown[] = []) {
  return declarations.map((d) => {
    const decl = d as { name: string; description?: string; parameters?: unknown };
    return {
      type: 'function' as const,
      name: decl.name,
      description: decl.description ?? '',
      parameters: decl.parameters ? toJsonSchema(decl.parameters) : { type: 'object', properties: {} },
    };
  });
}

/** 16 kHz -> 24 kHz, 16-bit little-endian mono, by linear interpolation. */
export function upsample16kTo24k(pcm: Uint8Array): Uint8Array {
  const n = Math.floor(pcm.length / 2);
  if (n === 0) return new Uint8Array(0);
  const src = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const outLen = Math.floor((n * 3) / 2);
  const out = new Uint8Array(outLen * 2);
  const dst = new DataView(out.buffer);
  for (let i = 0; i < outLen; i++) {
    const pos = (i * 2) / 3;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, n - 1);
    const t = pos - i0;
    const v = src.getInt16(i0 * 2, true) * (1 - t) + src.getInt16(i1 * 2, true) * t;
    dst.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(v))), true);
  }
  return out;
}
