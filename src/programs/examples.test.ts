import { expect, it } from 'vitest';
import { allLessons } from '../core/lesson-engine';
import { pitchClass } from '../core/music';
import { programs } from './registry';
import { EXAMPLE_LIBRARY } from './scales-and-runs/examples';

it('covers every run, improvisation, assessment, chromatic, enclosure and blues pattern in all 48 lessons', () => {
  const lessons = allLessons(programs[0]);
  expect(lessons).toHaveLength(48);
  let covered = 0;
  for (const lesson of lessons)
    for (const step of lesson.steps)
      for (const exercise of step.exercises) {
        if (
          exercise.id.includes('-run-') ||
          exercise.visualization.type === 'progression' ||
          /-p(7|8|9|10)$/.test(exercise.id)
        ) {
          expect(exercise.examples?.length, exercise.id).toBeGreaterThanOrEqual(2);
          const examples = exercise.examples!;
          expect(new Set(examples.map((example) => example.id)).size).toBe(examples.length);
          expect(
            new Set(
              examples.map((example) => example.progression.map((chord) => chord.symbol).join('-')),
            ).size,
            exercise.id,
          ).toBeGreaterThanOrEqual(2);
          expect(
            new Set(
              examples.map((example) =>
                example.events
                  .filter((event) => event.hand === 'right')
                  .map((event) => event.notes.join(','))
                  .join('|'),
              ),
            ).size,
            exercise.id,
          ).toBeGreaterThanOrEqual(2);
          expect(examples.every((example) => example.root === exercise.visualization.root)).toBe(
            true,
          );
          covered++;
        }
      }
  expect(covered).toBeGreaterThan(200);
});

it('authors complete phrases with held chords, valid rhythms and chord-tone resolutions at every change', () => {
  expect(EXAMPLE_LIBRARY).toHaveLength(25);
  for (const example of EXAMPLE_LIBRARY) {
    const melody = example.events.filter((event) => event.hand === 'right');
    expect(example.events[0].startBeat).toBe(0);
    expect(example.events[0].hand).toBe('left');
    expect(melody[0].startBeat).toBeGreaterThan(0);
    expect(example.targetNotes.length).toBe(example.progression.length - 1);
    for (const [index, event] of example.events.entries()) {
      expect(event.startBeat).toBeGreaterThanOrEqual(0);
      expect(event.durationBeats).toBeGreaterThan(0);
      expect(event.startBeat + event.durationBeats).toBeLessThanOrEqual(example.lengthBeats);
      if (index)
        expect(event.startBeat).toBeGreaterThanOrEqual(example.events[index - 1].startBeat);
      expect(event.notes.every((note) => Number.isInteger(note) && note >= 21 && note <= 108)).toBe(
        true,
      );
    }
    for (const [index, event] of melody.entries())
      if (index) {
        const previous = melody[index - 1];
        expect(previous.startBeat + previous.durationBeats, example.id).toBeLessThanOrEqual(
          event.startBeat,
        );
      }
    for (const target of example.targetNotes) {
      const chord = example.progression.find((chord) => chord.startBeat === target.beat)!;
      expect(chord, example.id).toBeDefined();
      expect(chord.name).toBe(target.chord);
      expect(chord.notes.map(pitchClass)).toContain(pitchClass(target.note));
      expect(
        melody.some(
          (event) => event.startBeat === target.beat && event.notes.includes(target.note),
        ),
      ).toBe(true);
    }
  }
});

it('includes the five requested phrases and increases rhythmic complexity for later lessons', () => {
  const notes = (id: string) =>
    EXAMPLE_LIBRARY.find((example) => example.id === id)!
      .events.filter((event) => event.hand === 'right')
      .flatMap((event) => event.notes);
  expect(notes('target-i-iv')).toEqual([67, 69, 72, 67, 69]);
  expect(notes('target-vi-v')).toEqual([64, 67, 69, 72, 71]);
  expect(notes('chromatic-i-v')).toEqual([67, 69, 70, 71]);
  expect(notes('enclosure-v-i')).toEqual([67, 65, 63, 64]);
  expect(notes('blues-i-iv')).toEqual([72, 69, 67, 64, 63, 62, 60]);
  const lessons = allLessons(programs[0]);
  const early = lessons[0].steps[4].exercises[0].examples!;
  const late = lessons[47].steps[4].exercises[0].examples!;
  expect(Math.max(...early.map((example) => example.lengthBeats))).toBeLessThan(
    Math.max(...late.map((example) => example.lengthBeats)),
  );
  expect(late.some((example) => example.events.some((event) => event.durationBeats === 0.25))).toBe(
    true,
  );
});
