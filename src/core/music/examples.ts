import type { MusicalChord, MusicalExample, PlaybackPlan } from '../types';
import { spellDegree } from './index';

export function chordName(root: number, chord: Pick<MusicalChord, 'degree' | 'quality'>) {
  return (
    spellDegree(root, chord.degree, false) +
    (chord.quality === 'minor' ? 'm' : chord.quality === 'dominant7' ? '7' : '')
  );
}

/** A fresh value: bundled definitions and frozen review snapshots remain immutable. */
export function transposeExample(example: MusicalExample, root: number): MusicalExample {
  const shift = root - example.root;
  const names = new Map(example.progression.map((chord) => [chord.name, chordName(root, chord)]));
  return {
    ...example,
    root,
    progression: example.progression.map((chord) => ({
      ...chord,
      degree: { ...chord.degree },
      name: chordName(root, chord),
      notes: chord.notes.map((n) => n + shift),
    })),
    events: example.events.map((event) => ({
      ...event,
      notes: event.notes.map((n) => n + shift),
      degrees: event.degrees?.map((degree) => ({ ...degree })),
    })),
    targetNotes: example.targetNotes.map((target) => ({
      ...target,
      note: target.note + shift,
      chord: names.get(target.chord) ?? target.chord,
    })),
  };
}

export function examplePlaybackPlan(example: MusicalExample, bpm = example.bpm): PlaybackPlan {
  return {
    id: `${example.id}@${example.root}`,
    bpm,
    lengthBeats: example.lengthBeats,
    legato: true,
    events: example.events.map((event) => ({
      notes: event.notes,
      beat: event.startBeat,
      durationBeats: event.durationBeats,
      hand: event.hand,
      velocity: event.velocity,
    })),
  };
}

export function rhythmLabel(beats: number) {
  return (
    (
      {
        0.25: '1/16',
        0.5: '1/8',
        0.75: '1/8 с точкой',
        1: '1/4',
        1.5: '1/4 с точкой',
        2: '1/2',
        3: '1/2 с точкой',
        4: 'целая',
      } as Record<number, string>
    )[beats] ?? `${beats} доли`
  );
}
