/**
 * Builds the Android notification icon from the app's adaptive icon.
 *
 * Android does not show a notification's small icon in colour: it keeps only the shape, painting
 * every opaque pixel white. Hand it the ordinary app icon and you get a white blob, so the glyph
 * has to be cut out of the adaptive foreground, trimmed to its bounding box and redrawn as a white
 * silhouette at the size Android actually asks for.
 *
 *   node scripts/make-notification-icon.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SOURCE = path.join(__dirname, '..', 'assets', 'images', 'adaptive-icon.png');
const TARGET = path.join(__dirname, '..', 'assets', 'images', 'notification-icon.png');
/** What Android expects for the small icon. */
const SIZE = 96;
/** Breathing room, so the glyph is not pressed against the status-bar edge. */
const MARGIN = 5;
/** Below this the pixel is treated as background rather than part of the glyph. */
const ALPHA_FLOOR = 40;

// ─── Reading ────────────────────────────────────────────────────────────────

function decode(file) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const depth = b[24];
  const type = b[25];
  if (type !== 6) throw new Error(`${path.basename(file)} has no alpha channel, so no shape can be cut from it.`);

  const parts = [];
  let off = 8;
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const tag = b.toString('ascii', off + 4, off + 8);
    if (tag === 'IDAT') parts.push(b.subarray(off + 8, off + 8 + len));
    if (tag === 'IEND') break;
    off += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(parts));
  const bpp = 4 * (depth / 8);
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  const paeth = (a, bb, c) => {
    const q = a + bb - c;
    const pa = Math.abs(q - a);
    const pb = Math.abs(q - bb);
    const pc = Math.abs(q - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
  };

  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const bAbove = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      const v = row[x];
      cur[x] =
        filter === 0 ? v
        : filter === 1 ? (v + a) & 255
        : filter === 2 ? (v + bAbove) & 255
        : filter === 3 ? (v + ((a + bAbove) >> 1)) & 255
        : (v + paeth(a, bAbove, c)) & 255;
    }
  }
  // 16-bit samples are stored high byte first, so the top byte alone is the value we need.
  const alpha = (x, y) => out[y * stride + x * bpp + (depth === 16 ? 6 : 3)];
  return { w, h, alpha };
}

// ─── Writing ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `pixels` is RGBA, 8 bits per sample. */
function encode(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const rows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (stride + 1)] = 0; // no row filter: the image is tiny and this keeps it simple
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Building the icon ──────────────────────────────────────────────────────

const src = decode(SOURCE);

// The adaptive foreground keeps the glyph inside a safe zone with a lot of empty space around it.
// Trimming to what is actually drawn means the notification shows the logo, not the padding.
let x0 = src.w;
let y0 = src.h;
let x1 = -1;
let y1 = -1;
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    if (src.alpha(x, y) > ALPHA_FLOOR) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
}
if (x1 < 0) throw new Error('The source icon is fully transparent.');

// The logo is a symbol with the word "WishMe" beneath it. At the size Android draws this, that text
// is an illegible smudge, so only the symbol is kept: the drawing is split on the blank rows
// between the two and the heavier block wins.
const rowInk = [];
for (let y = y0; y <= y1; y++) {
  let n = 0;
  for (let x = x0; x <= x1; x++) if (src.alpha(x, y) > ALPHA_FLOOR) n++;
  rowInk.push(n);
}
const blocks = [];
let start = -1;
for (let i = 0; i <= rowInk.length; i++) {
  const inked = i < rowInk.length && rowInk[i] > 0;
  if (inked && start < 0) start = i;
  if (!inked && start >= 0) {
    blocks.push({ top: y0 + start, bottom: y0 + i - 1, ink: rowInk.slice(start, i).reduce((a, b) => a + b, 0) });
    start = -1;
  }
}
const main = blocks.sort((a, b) => b.ink - a.ink)[0] ?? { top: y0, bottom: y1 };
y0 = main.top;
y1 = main.bottom;

// Re-trim the sides: without the wordmark the symbol is usually narrower than the whole drawing.
let nx0 = x1;
let nx1 = x0;
for (let y = y0; y <= y1; y++) {
  for (let x = x0; x <= x1; x++) {
    if (src.alpha(x, y) > ALPHA_FLOOR) {
      if (x < nx0) nx0 = x;
      if (x > nx1) nx1 = x;
    }
  }
}
x0 = nx0;
x1 = nx1;

// Keep the glyph square so it is not stretched.
const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
const cx = (x0 + x1) / 2;
const cy = (y0 + y1) / 2;
const left = cx - side / 2;
const top = cy - side / 2;

const inner = SIZE - MARGIN * 2;
const pixels = Buffer.alloc(SIZE * SIZE * 4);
const scale = side / inner;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    // White everywhere; only the alpha carries the shape, which is all Android keeps.
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;

    const ix = x - MARGIN;
    const iy = y - MARGIN;
    if (ix < 0 || iy < 0 || ix >= inner || iy >= inner) continue;

    // Average the source over the whole area each target pixel covers, so the edges stay smooth
    // instead of breaking up at this size.
    const sx0 = Math.floor(left + ix * scale);
    const sy0 = Math.floor(top + iy * scale);
    const sx1 = Math.max(sx0 + 1, Math.floor(left + (ix + 1) * scale));
    const sy1 = Math.max(sy0 + 1, Math.floor(top + (iy + 1) * scale));

    let sum = 0;
    let n = 0;
    for (let sy = sy0; sy < sy1; sy++) {
      for (let sx = sx0; sx < sx1; sx++) {
        n++;
        if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
        sum += src.alpha(sx, sy);
      }
    }
    pixels[i + 3] = n ? Math.round(sum / n) : 0;
  }
}

fs.writeFileSync(TARGET, encode(SIZE, SIZE, pixels));

let covered = 0;
for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) covered++;
console.log(`Wrote ${path.relative(process.cwd(), TARGET)} — ${SIZE}x${SIZE}, glyph covers ${Math.round((100 * covered) / (SIZE * SIZE))}% of the square.`);
