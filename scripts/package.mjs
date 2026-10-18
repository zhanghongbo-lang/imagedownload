import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const outDir = resolve(root, 'docs', 'download');
const zipName = '电商图片提取下载-v1.0.0.zip';

if (!existsSync(distDir)) {
  console.error('dist/ 不存在，请先运行 pnpm build');
  process.exit(1);
}

// ---------- crc32 / dos datetime ----------

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

function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const d =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: d };
}

// ---------- zip building (deflate) ----------

function buildLocalHeader(nameBytes, crc, compSize, uncompSize, now) {
  const buf = Buffer.alloc(30 + nameBytes.length);
  buf.writeUInt32LE(0x04034b50, 0);
  buf.writeUInt16LE(20, 4); // version needed
  buf.writeUInt16LE(0x0800, 6); // UTF-8 flag
  buf.writeUInt16LE(8, 8); // method: deflate
  buf.writeUInt16LE(now.time, 10);
  buf.writeUInt16LE(now.date, 12);
  buf.writeUInt32LE(crc >>> 0, 14);
  buf.writeUInt32LE(compSize, 18);
  buf.writeUInt32LE(uncompSize, 22);
  buf.writeUInt16LE(nameBytes.length, 26);
  buf.writeUInt16LE(0, 28); // extra length
  nameBytes.copy(buf, 30);
  return buf;
}

function buildCentralHeader(nameBytes, crc, compSize, uncompSize, offset, now) {
  const buf = Buffer.alloc(46 + nameBytes.length);
  buf.writeUInt32LE(0x02014b50, 0);
  buf.writeUInt16LE(20, 4); // version made by
  buf.writeUInt16LE(20, 6); // version needed
  buf.writeUInt16LE(0x0800, 8); // UTF-8 flag
  buf.writeUInt16LE(8, 10); // method: deflate
  buf.writeUInt16LE(now.time, 12);
  buf.writeUInt16LE(now.date, 14);
  buf.writeUInt32LE(crc >>> 0, 16);
  buf.writeUInt32LE(compSize, 20);
  buf.writeUInt32LE(uncompSize, 24);
  buf.writeUInt16LE(nameBytes.length, 28);
  buf.writeUInt16LE(0, 30); // extra length
  buf.writeUInt16LE(0, 32); // comment length
  buf.writeUInt16LE(0, 34); // disk number start
  buf.writeUInt16LE(0, 36); // internal attributes
  buf.writeUInt32LE(0, 38); // external attributes
  buf.writeUInt32LE(offset, 42); // local header offset
  nameBytes.copy(buf, 46);
  return buf;
}

function buildEndOfCentralDirectory(count, centralSize, offset) {
  const buf = Buffer.alloc(22);
  buf.writeUInt32LE(0x06054b50, 0);
  buf.writeUInt16LE(0, 4);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(count, 8);
  buf.writeUInt16LE(count, 10);
  buf.writeUInt32LE(centralSize, 12);
  buf.writeUInt32LE(offset, 16);
  buf.writeUInt16LE(0, 20); // comment length
  return buf;
}

function collectFiles(dir, base, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectFiles(full, base, out);
    else out.push({ name: relative(base, full).split(sep).join('/'), full });
  }
  return out;
}

function buildZip(entries) {
  const now = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data = readFileSync(entry.full);
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = buildLocalHeader(nameBytes, crc, compressed.length, data.length, now);
    parts.push(local, compressed);
    central.push(buildCentralHeader(nameBytes, crc, compressed.length, data.length, offset, now));
    offset += local.length + compressed.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = buildEndOfCentralDirectory(entries.length, centralSize, offset);
  return Buffer.concat([...parts, ...central, end]);
}

const files = collectFiles(distDir, distDir);
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, zipName);
writeFileSync(outPath, buildZip(files));
console.log(`wrote ${zipName} (${files.length} files) -> docs/download/`);
