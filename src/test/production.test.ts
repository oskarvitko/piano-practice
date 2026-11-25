import { readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
const samples = ['C2', 'Fs2', 'C3', 'Fs3', 'C4', 'Fs4', 'C5', 'Fs5', 'C6'];
it('bundles all nine actual piano recordings and redistributable attribution', () => {
  samples.forEach((note) =>
    expect(statSync(`public/audio/piano/${note}.mp3`).size).toBeGreaterThan(20_000),
  );
  expect(readFileSync('public/audio/piano/LICENSE.txt', 'utf8')).toContain('Alexander Holm');
  expect(readFileSync('public/audio/piano/SOURCE-README.txt', 'utf8')).toContain(
    'creativecommons.org/licenses/by/3.0',
  );
});
it('provides correctly sized installation icons', () => {
  for (const [name, size] of [
    ['icon-192', 192],
    ['icon-512', 512],
    ['maskable-512', 512],
    ['apple-touch-icon', 180],
  ] as const) {
    const png = readFileSync(`public/icons/${name}.png`);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
});
