/**
 * A minimal ZIP writer, so "Download your demo" needs no library. Files are stored, not compressed: the slides are PNGs (already
 * compressed) and the captions are tiny, so a zip is just a few headers around the bytes. No ZIP64, so it refuses what it can't hold.
 */

export type ZipFile = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** The date and time as zip stores them (MS-DOS format: local time, two-second steps, years from 1980). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8_NAMES = 0x0800;
const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;

export function makeZip(files: ZipFile[], now = new Date()): Uint8Array<ArrayBuffer> {
  if (files.length > 0xffff) throw new Error("Too many files for a zip");
  const enc = new TextEncoder();
  const entries = files.map((f) => ({ ...f, nameBytes: enc.encode(f.name), crc: crc32(f.data) }));
  const bodySize = entries.reduce((n, e) => n + LOCAL_HEADER + e.nameBytes.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + CENTRAL_HEADER + e.nameBytes.length, 0);
  const total = bodySize + centralSize + END_RECORD;
  if (total > 0xffffffff) throw new Error("Too big for a zip");

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const { time, date } = dosDateTime(now);
  let p = 0;
  const u16 = (v: number) => { view.setUint16(p, v, true); p += 2; };
  const u32 = (v: number) => { view.setUint32(p, v, true); p += 4; };
  const bytes = (b: Uint8Array) => { out.set(b, p); p += b.length; };

  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(p);
    u32(0x04034b50); u16(20); u16(UTF8_NAMES); u16(0); u16(time); u16(date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.nameBytes.length); u16(0);
    bytes(e.nameBytes);
    bytes(e.data);
  }
  const centralStart = p;
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(UTF8_NAMES); u16(0); u16(time); u16(date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.nameBytes.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(offsets[i]);
    bytes(e.nameBytes);
  });
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(centralSize); u32(centralStart); u16(0);
  return out;
}
