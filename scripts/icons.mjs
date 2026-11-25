import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="#101827"/><circle cx="256" cy="250" r="186" fill="#1d2b40"/><g fill="#a4cbff"><rect x="126" y="146" width="60" height="226" rx="12"/><rect x="194" y="146" width="60" height="226" rx="12"/><rect x="262" y="146" width="60" height="226" rx="12"/><rect x="330" y="146" width="60" height="226" rx="12"/></g><g fill="#101827"><rect x="168" y="144" width="42" height="137" rx="8"/><rect x="236" y="144" width="42" height="137" rx="8"/><rect x="372" y="144" width="22" height="137" rx="8"/></g></svg>`,
);
await mkdir('public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
])
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
