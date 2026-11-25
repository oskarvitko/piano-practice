import { describe, expect, it } from 'vitest';
import {
  createPlaybackPlan,
  getChordNotes,
  getKeyboardRange,
  getNoteName,
  getScaleNotes,
  isBlackKey,
  parseDegrees,
  resolvePattern,
  spellDegree,
  transposeNotes,
} from './index';
describe('music in every key', () => {
  for (let root = 60; root < 72; root++)
    it(`resolves scales and octaves from MIDI ${root}`, () => {
      expect(getScaleNotes(root, 'major', 1).map((n) => n - root)).toEqual([
        0, 2, 4, 5, 7, 9, 11, 12,
      ]);
      expect(getScaleNotes(root, 'major-pentatonic', 2).at(-1)).toBe(root + 24);
      expect(getScaleNotes(root, 'minor-blues', 1).map((n) => n - root)).toEqual([
        0, 3, 5, 6, 7, 10, 12,
      ]);
      expect(resolvePattern(root, parseDegrees('8 b7 5 b5 4 b3 1')).map((n) => n - root)).toEqual([
        12, 10, 7, 6, 5, 3, 0,
      ]);
      expect(resolvePattern(root, parseDegrees('1 5 2 6 3 7 4 8')).slice(-2)).toEqual([
        root + 5,
        root + 12,
      ]);
    });
  it('spells F major and chromatic enclosures correctly', () => {
    expect(getNoteName(70, 65)).toBe('Bb');
    expect(spellDegree(65, { degree: 4 })).toBe('Bb4');
    expect(spellDegree(60, { degree: 2, accidental: 1 })).toBe('D#4');
    expect(spellDegree(71, { degree: 7 })).toBe('A#5');
    expect(spellDegree(61, { degree: 3 })).toBe('F4');
  });
  it('handles chord inversions, transposition, and a black root', () => {
    expect(getChordNotes(60, 'major', 1)).toEqual([64, 67, 72]);
    expect(transposeNotes([60, 64, 67], 2)).toEqual([62, 66, 69]);
    expect(getKeyboardRange([61, 73])).toEqual({ start: 60, end: 74 });
    expect([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].filter(isBlackKey)).toHaveLength(5);
  });
  it('schedules a simultaneous chord and exact descending run', () => {
    const chord = createPlaybackPlan({
      id: 'c',
      title: 'c',
      instructions: [],
      visualization: { type: 'chord', name: 'C', root: 60, notes: [60, 64, 67] },
    });
    expect(chord.events).toEqual([{ notes: [60, 64, 67], beat: 0, durationBeats: 4 }]);
    const run = createPlaybackPlan({
      id: 'r',
      title: 'r',
      instructions: [],
      visualization: { type: 'sequence', root: 60, pattern: parseDegrees('8 b7 5 b5 4 b3 1') },
      playback: { subdivision: 2 },
    });
    expect(run.events.map((e) => e.notes[0])).toEqual([72, 70, 67, 66, 65, 63, 60]);
    expect(run.events.map((e) => e.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(run.lengthBeats).toBe(3.5);
  });
});
