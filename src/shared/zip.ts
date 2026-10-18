export interface ZipEntry {
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

const encoder = new TextEncoder();

let crcTable: Int32Array | undefined;

function crc32(data: Uint8Array<ArrayBuffer>): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

interface DosDateTime {
  time: number;
  date: number;
}

function dosDateTime(now: Date): DosDateTime {
  const time =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    (Math.floor(now.getSeconds() / 2) & 0x1f);
  const date =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);
  return { time, date };
}

/**
 * Build a ZIP archive (STORE method — PNG payloads are already compressed).
 * File names are written as UTF-8 (general-purpose bit 11) so Chinese names
 * extract correctly across Windows/macOS/Linux tools.
 */
export function createZip(entries: ZipEntry[]): Blob {
  const now = dosDateTime(new Date());
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const centralParts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = buildLocalHeader(nameBytes, crc, entry.data.length, now);
    parts.push(local, entry.data);
    centralParts.push(buildCentralHeader(nameBytes, crc, entry.data.length, offset, now));
    offset += local.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = buildEndOfCentralDirectory(entries.length, centralSize, offset);

  return new Blob([...parts, ...centralParts, end], { type: 'application/zip' });
}

function buildLocalHeader(
  nameBytes: Uint8Array<ArrayBuffer>,
  crc: number,
  size: number,
  now: DosDateTime,
): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0x0800, true); // UTF-8 flag
  view.setUint16(8, 0, true); // method: store
  view.setUint16(10, now.time, true);
  view.setUint16(12, now.date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true); // compressed size
  view.setUint32(22, size, true); // uncompressed size
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true); // extra field length
  buf.set(nameBytes, 30);
  return buf;
}

function buildCentralHeader(
  nameBytes: Uint8Array<ArrayBuffer>,
  crc: number,
  size: number,
  offset: number,
  now: DosDateTime,
): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0x0800, true); // UTF-8 flag
  view.setUint16(10, 0, true); // method: store
  view.setUint16(12, now.time, true);
  view.setUint16(14, now.date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true); // compressed size
  view.setUint32(24, size, true); // uncompressed size
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true); // extra field length
  view.setUint16(32, 0, true); // comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal attributes
  view.setUint32(38, 0, true); // external attributes
  view.setUint32(42, offset, true); // relative offset of local header
  buf.set(nameBytes, 46);
  return buf;
}

function buildEndOfCentralDirectory(
  count: number,
  centralSize: number,
  offset: number,
): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true); // comment length
  return buf;
}
