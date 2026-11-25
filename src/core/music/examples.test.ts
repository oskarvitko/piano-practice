import { expect, it } from 'vitest';
import { EXAMPLE_LIBRARY } from '../../programs/scales-and-runs/examples';
import { examplePlaybackPlan, transposeExample } from './examples';
import { pitchClass, resolveDegree, spellDegree } from './index';

it('transposes both hands, chord names, targets and spelling into all twelve keys without mutating definitions', () => {
  const original = EXAMPLE_LIBRARY.find((example) => example.id === 'chromatic-i-v')!;
  const before = structuredClone(original);
  for (let root = 60; root < 72; root++) {
    const shifted = transposeExample(original, root);
    expect(shifted.events.map((event) => event.startBeat)).toEqual(
      original.events.map((event) => event.startBeat),
    );
    expect(shifted.events.map((event) => event.durationBeats)).toEqual(
      original.events.map((event) => event.durationBeats),
    );
    shifted.events.forEach((event, index) => {
      expect(event.notes).toEqual(original.events[index].notes.map((note) => note + root - 60));
      event.degrees?.forEach((degree, noteIndex) =>
        expect(resolveDegree(root, degree)).toBe(event.notes[noteIndex]),
      );
    });
    shifted.targetNotes.forEach((target, index) => {
      expect(target.note).toBe(original.targetNotes[index].note + root - 60);
      expect(
        shifted.progression.find((chord) => chord.name === target.chord)?.notes.map(pitchClass),
      ).toContain(pitchClass(target.note));
    });
    expect(transposeExample(shifted, 60)).toEqual(original);
  }
  expect(original).toEqual(before);
  const inF = transposeExample(EXAMPLE_LIBRARY[0], 65);
  expect(inF.progression.map((chord) => chord.name)).toEqual(['F', 'Bb']);
  expect(inF.targetNotes[0]).toMatchObject({ note: 74, chord: 'Bb', function: 'терция' });
  expect(
    spellDegree(60, original.events.find((event) => event.notes.includes(70))!.degrees![0]),
  ).toBe('Bb4');
});

it('creates an overlapping timeline with separate hands and expression, independent of BPM', () => {
  const example = EXAMPLE_LIBRARY[0];
  const plan = examplePlaybackPlan(example, 90);
  expect(plan.bpm).toBe(90);
  expect(plan.legato).toBe(true);
  expect(plan.events[0]).toMatchObject({ beat: 0, durationBeats: 4, hand: 'left', velocity: 0.48 });
  expect(
    plan.events.some((event) => event.hand === 'right' && event.beat > 0 && event.beat < 4),
  ).toBe(true);
  expect(plan.events.filter((event) => event.beat === 4).map((event) => event.hand)).toEqual([
    'left',
    'right',
  ]);
});
