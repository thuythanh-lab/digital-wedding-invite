// Dev tool: re-encode a 16-bit PCM WAV to a smaller MP3 for the web build.
// Usage: bun scripts/encode-mp3.mjs <in.wav> <out.mp3> [kbps]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// lamejs's module build is broken under ESM; evaluate its self-contained bundle instead.
const lameSrc = readFileSync(fileURLToPath(new URL('../node_modules/lamejs/lame.all.js', import.meta.url)), 'utf8');
const lamejs = new Function(lameSrc + ';\nreturn lamejs;')();

const [inPath, outPath, kbpsArg] = process.argv.slice(2);
const kbps = Number(kbpsArg || 96);
const buf = readFileSync(inPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

let off = 12, fmt = null, data = null;
while (off < buf.length - 8) {
  const id = buf.toString('ascii', off, off + 4);
  const size = dv.getUint32(off + 4, true);
  if (id === 'fmt ') fmt = { channels: dv.getUint16(off + 10, true), rate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
  if (id === 'data') data = { start: off + 8, size };
  off += 8 + size + (size & 1);
}
if (!fmt || !data || fmt.bits !== 16) throw new Error('Expected 16-bit PCM WAV, got ' + JSON.stringify(fmt));
console.log('WAV', fmt, 'seconds', (data.size / 2 / fmt.channels / fmt.rate).toFixed(2));

const samples = new Int16Array(buf.buffer.slice(buf.byteOffset + data.start, buf.byteOffset + data.start + data.size));
const n = samples.length / fmt.channels;
const L = new Int16Array(n), R = new Int16Array(n);
for (let i = 0; i < n; i++) { L[i] = samples[i * fmt.channels]; R[i] = samples[i * fmt.channels + (fmt.channels > 1 ? 1 : 0)]; }

const enc = new lamejs.Mp3Encoder(2, fmt.rate, kbps);
const chunks = []; const block = 1152;
for (let i = 0; i < n; i += block) {
  const out = enc.encodeBuffer(L.subarray(i, i + block), R.subarray(i, i + block));
  if (out.length) chunks.push(Buffer.from(out));
}
const end = enc.flush(); if (end.length) chunks.push(Buffer.from(end));
const mp3 = Buffer.concat(chunks);
writeFileSync(outPath, mp3);
console.log('Wrote', outPath, (mp3.length / 1024).toFixed(0) + ' KB');
