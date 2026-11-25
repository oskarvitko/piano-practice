import { expect, it } from 'vitest';
import { CancellationToken, scheduleNotes } from './scheduler';
it('uses the audio timeline for chords, subdivisions, resume, and exact loop boundaries', () => {
  const plan = {
    bpm: 60,
    events: [
      { notes: [60, 64, 67], beat: 0, durationBeats: 2 },
      { notes: [72], beat: 2, durationBeats: 0.5 },
    ],
    lengthBeats: 2.5,
  };
  expect(scheduleNotes(plan)).toEqual({
    events: [
      { time: 0, notes: [60, 64, 67], duration: 2, index: 0 },
      { time: 2, notes: [72], duration: 0.5, index: 1 },
    ],
    length: 2.5,
  });
  expect(scheduleNotes({ ...plan, bpm: 120 }).length).toBe(1.25);
  expect(scheduleNotes(plan, 1).events[0].time).toBe(0);
});
it('cancels already queued highlights on stop and permits only new callbacks', () => {
  const token = new CancellationToken();
  let highlighted = false;
  const old = token.guard(() => {
    highlighted = true;
  });
  token.cancel();
  old();
  expect(highlighted).toBe(false);
  token.guard(() => {
    highlighted = true;
  })();
  expect(highlighted).toBe(true);
});
