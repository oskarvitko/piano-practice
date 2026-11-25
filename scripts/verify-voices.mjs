import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../public/audio/voice/', import.meta.url));
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const tokens = ['1', '2', '3', '4', '5', '6', '7', 'flat', 'sharp'];
assert.equal(manifest.clips.length, 18);
assert.deepEqual(
  manifest.clips.map((clip) => clip.path).sort(),
  ['en', 'pl'].flatMap((language) => tokens.map((token) => `${language}/${token}.wav`)).sort(),
);
let bytes = 0;
for (const clip of manifest.clips) {
  const buffer = readFileSync(join(directory, clip.path));
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', clip.path);
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE', clip.path);
  assert.equal(buffer.readUInt32LE(4) + 8, buffer.length, clip.path);
  let format;
  let pcm;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const name = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const content = buffer.subarray(offset + 8, offset + 8 + length);
    assert.equal(content.length, length, clip.path);
    if (name === 'fmt ') format = content;
    if (name === 'data') pcm = content;
    offset += 8 + length + (length % 2);
  }
  assert.ok(format && pcm, clip.path);
  assert.equal(format.readUInt16LE(0), 1, 'Uncompressed PCM');
  assert.equal(format.readUInt16LE(2), 1, 'Mono');
  assert.equal(format.readUInt32LE(4), 22050);
  assert.equal(format.readUInt16LE(14), 16);
  const duration = pcm.length / 2 / 22050;
  assert.ok(duration >= 0.15 && duration < 0.8, `${clip.path}: duration ${duration}`);
  assert.ok(Math.abs(duration - clip.durationSeconds) < 0.000001, clip.path);
  let peak = 0;
  let sumSquares = 0;
  for (let offset = 0; offset < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset) / 32767;
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample ** 2;
  }
  assert.ok(peak > 0.7 && peak < 0.85, `${clip.path}: peak/clipping`);
  assert.ok(Math.sqrt(sumSquares / (pcm.length / 2)) > 0.03, `${clip.path}: silent audio`);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), clip.sha256, clip.path);
  bytes += buffer.length;
}
console.log(
  `Validated 18 voice clips: mono PCM16 / 22050 Hz, no clipping, <0.8s each, ${bytes} bytes.`,
);
