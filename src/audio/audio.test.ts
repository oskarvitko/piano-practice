import { expect, it } from 'vitest';
import {
  CancellationToken,
  frameAtBeat,
  heldNotesAtBeat,
  playbackFrames,
  scheduleNotes,
} from './scheduler';
import { EXAMPLE_LIBRARY } from '../programs/scales-and-runs/examples';
import { examplePlaybackPlan } from '../core/music/examples';
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
it('keeps held left-hand notes lit while right-hand notes change, and resolves both hands together', () => {
  const plan = examplePlaybackPlan(EXAMPLE_LIBRARY[0]);
  expect(frameAtBeat(plan, 2).leftNotes).toEqual([48, 52, 55]);
  expect(frameAtBeat(plan, 2).rightNotes).toEqual([67]);
  expect(frameAtBeat(plan, 2.5).leftNotes).toEqual([48, 52, 55]);
  expect(frameAtBeat(plan, 2.5).rightNotes).toEqual([69]);
  expect(frameAtBeat(plan, 4).leftNotes).toEqual([53, 57, 60]);
  expect(frameAtBeat(plan, 4).rightNotes).toEqual([69]);
  expect(frameAtBeat(plan, 6).notes).toEqual([53, 57, 60]);
  expect(frameAtBeat(plan, 8).notes).toEqual([]);
  expect(playbackFrames(plan).map((frame) => frame.beat)).toEqual([0, 2, 2.5, 3, 3.5, 4, 6, 8]);
});
it('restores held chord and melody tails on resume without replaying expired notes', () => {
  const plan = examplePlaybackPlan(EXAMPLE_LIBRARY[0]);
  expect(heldNotesAtBeat(plan, 3.25)).toEqual([
    { time: 0, notes: [48, 52, 55], duration: 0.75, index: 0, hand: 'left', velocity: 0.48 },
    { time: 0, notes: [72], duration: 0.25, index: 3, hand: 'right', velocity: 0.75 },
  ]);
  expect(heldNotesAtBeat(plan, 4)).toEqual([]);
  expect(
    scheduleNotes({ ...plan, bpm: 120 }).events.find((event) => event.hand === 'left')?.duration,
  ).toBe(2);
});
