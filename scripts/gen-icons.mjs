// Generates the extension icons (16/48/128 PNG) using only Node built-ins.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');

// ---------- PNG encoding ----------

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- rasterizer ----------

function inRoundedRect(x, y, size, radius) {
  if (x < 0 || x > size || y < 0 || y > size) return false;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function sign(px, py, a, b) {
  return (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
}

function inTriangle(px, py, a, b, c) {
  const d1 = sign(px, py, a, b);
  const d2 = sign(px, py, b, c);
  const d3 = sign(px, py, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// download glyph: shaft + downward arrowhead + tray
function inGlyph(x, y, size) {
  const u = x / size;
  const v = y / size;
  if (u >= 0.44 && u <= 0.56 && v >= 0.26 && v <= 0.54) return true;
  if (v >= 0.50 && v <= 0.68 && inTriangle(u, v, [0.5, 0.68], [0.3, 0.5], [0.7, 0.5])) return true;
  if (u >= 0.28 && u <= 0.72 && v >= 0.72 && v <= 0.8) return true;
  return false;
}

function drawIcon(size) {
  const bg = [5, 150, 105]; // #059669
  const fg = [255, 255, 255];
  const radius = size * 0.22;
  const ss = 3; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCov = 0;
      let fgCov = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          if (inRoundedRect(px, py, size, radius)) {
            bgCov++;
            if (inGlyph(px, py, size)) fgCov++;
          }
        }
      }
      const total = ss * ss;
      const bgA = bgCov / total;
      const fgA = fgCov / total;
      let r = bg[0];
      let g = bg[1];
      let b = bg[2];
      if (fgA > 0) {
        r = r * (1 - fgA) + fg[0] * fgA;
        g = g * (1 - fgA) + fg[1] * fgA;
        b = b * (1 - fgA) + fg[2] * fgA;
      }
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(g);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = Math.round(bgA * 255);
    }
  }
  return rgba;
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), encodePng(size, size, drawIcon(size)));
  console.log(`wrote icon-${size}.png`);
}
