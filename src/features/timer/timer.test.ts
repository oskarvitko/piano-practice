import { expect, it } from 'vitest';
import { PracticeTimer } from './PracticeTimer';
it('uses timestamps despite missed ticks, pauses, and restores in pause', () => {
  let now = 0;
  const timer = new PracticeTimer(undefined, () => now);
  timer.start();
  now = 15345;
  expect(timer.value().elapsedSeconds).toBe(15.345);
  timer.pause();
  now = 90_000;
  expect(timer.value().elapsedSeconds).toBe(15.345);
  timer.start();
  now += 1000;
  const saved = timer.pause();
  const resumed = new PracticeTimer(saved, () => now);
  expect(resumed.running).toBe(false);
  expect(resumed.value().timerSeconds).toBe(16.345);
});
it('resets the countdown without deleting actual practice time', () => {
  let now = 0;
  const timer = new PracticeTimer(undefined, () => now);
  timer.start();
  now = 5000;
  timer.reset();
  expect(timer.value()).toEqual({ elapsedSeconds: 5, timerSeconds: 0 });
});
