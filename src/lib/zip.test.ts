import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32, makeZip } from "./zip";

/** Reads a zip back the way an unzipper would: from the end record to the central directory to each file's bytes. */
function readZip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50, "ends with the end-of-directory record");
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const files: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    assert.equal(v.getUint32(local, true), 0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = zip.slice(start, start + size);
    assert.equal(crc32(data), crc, `${name}: crc matches its bytes`);
    files.push({ name, data });
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return files;
}

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test("a zip reads back with every name and byte intact", () => {
  const png = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) % 256);
  const files = [
    { name: "slide-1.png", data: png },
    { name: "caption-instagram.txt", data: new TextEncoder().encode("Café — ¡hola! 🌼\n") },
    { name: "empty.txt", data: new Uint8Array() },
  ];
  const back = readZip(makeZip(files));
  assert.deepEqual(back.map((f) => f.name), files.map((f) => f.name));
  back.forEach((f, i) => assert.deepEqual(f.data, files[i].data));
});

test("an empty zip is still a valid zip", () => {
  assert.deepEqual(readZip(makeZip([])), []);
});
