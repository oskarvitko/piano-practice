import type { Degree, Exercise, PlaybackPlan, ScaleType, Visualization } from '../types';

export const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
export const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  major: MAJOR,
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'major-blues': [0, 2, 3, 4, 7, 9],
  'minor-blues': [0, 3, 5, 6, 7, 10],
};
export const SCALE_FORMULAS: Record<ScaleType, string> = {
  major: '1 2 3 4 5 6 7',
  'major-pentatonic': '1 2 3 5 6',
  'minor-pentatonic': '1 b3 4 5 b7',
  'major-blues': '1 2 b3 3 5 6',
  'minor-blues': '1 b3 4 b5 5 b7',
};
export const pitchClass = (note: number) => ((note % 12) + 12) % 12;
export const isBlackKey = (note: number) => [1, 3, 6, 8, 10].includes(pitchClass(note));
export function getNoteName(note: number, root = 60, octave = false): string {
  const names = [1, 3, 5, 8, 10].includes(pitchClass(root))
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[pitchClass(note)] + (octave ? String(Math.floor(note / 12) - 1) : '');
}
export function parseDegrees(formula: string): Degree[] {
  return formula
    .split(/[\s|]+/)
    .filter(Boolean)
    .map((token) => {
      const match = /^(bb|##|b|#)?([1-9]|1[0-4])$/.exec(token);
      if (!match) throw new Error(`Неверная ступень: ${token}`);
      const n = Number(match[2]) - 1;
      return {
        degree: ((n % 7) + 1) as Degree['degree'],
        accidental: ({ bb: -2, b: -1, '#': 1, '##': 2 }[match[1] ?? ''] ??
          0) as Degree['accidental'],
        octave: Math.floor(n / 7),
      };
    });
}
export const resolveDegree = (root: number, d: Degree) =>
  root + MAJOR[d.degree - 1] + (d.accidental ?? 0) + (d.octave ?? 0) * 12;
export const resolvePattern = (root: number, pattern: Degree[]) =>
  pattern.map((d) => resolveDegree(root, d));
export const degreeLabel = (d: Degree) =>
  `${d.accidental === -2 ? 'bb' : d.accidental === -1 ? 'b' : d.accidental === 1 ? '#' : d.accidental === 2 ? '##' : ''}${d.degree + (d.octave ?? 0) * 7}`;
export function spellDegree(root: number, d: Degree, octave = true): string {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const rootName = getNoteName(root, root);
  const letter = letters[(letters.indexOf(rootName[0]) + d.degree - 1) % 7];
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]!;
  const midi = resolveDegree(root, d);
  const diff = ((pitchClass(midi) - natural + 18) % 12) - 6;
  const accidental = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  const writtenOctave = Math.floor((midi - diff) / 12) - 1;
  return `${letter}${accidental}${octave ? writtenOctave : ''}`;
}
export function getScaleNotes(root: number, scale: ScaleType, octaves = 1): number[] {
  return [
    ...Array.from({ length: octaves }, (_, i) =>
      SCALE_INTERVALS[scale].map((n) => root + n + i * 12),
    ).flat(),
    root + octaves * 12,
  ];
}
export function getChordNotes(
  root: number,
  quality: 'major' | 'minor' | 'diminished' | 'dominant7' = 'major',
  inversion = 0,
): number[] {
  const notes = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    dominant7: [0, 4, 7, 10],
  }[quality].map((n) => n + root);
  for (let i = 0; i < inversion; i++) notes.push(notes.shift()! + 12);
  return notes;
}
export const transposeNotes = (notes: number[], semitones: number) =>
  notes.map((n) => n + semitones);
export function getKeyboardRange(notes: number[]): { start: number; end: number } {
  const low = Math.min(...(notes.length ? notes : [60]));
  const high = Math.max(...(notes.length ? notes : [72]));
  let start = Math.floor(low / 12) * 12;
  let end = Math.max(start + 12, high);
  if (isBlackKey(end)) end++;
  if (end - start > 36) start = isBlackKey(low) ? low - 1 : low;
  return { start, end };
}
export function visualizationNotes(v: Visualization): number[] {
  if (v.type === 'scale') return getScaleNotes(v.root, v.scale, v.octaves);
  if (v.type === 'chord') return v.notes;
  if (v.type === 'sequence') return resolvePattern(v.root, v.pattern);
  return v.chords.flatMap((c) => c.notes);
}
export function createPlaybackPlan(exercise: Exercise, bpm?: number): PlaybackPlan {
  const v = exercise.visualization;
  const meta = exercise.playback ?? {};
  let groups: number[][];
  if (v.type === 'chord') groups = [v.notes];
  else if (v.type === 'progression') groups = v.chords.map((c) => c.notes);
  else {
    let notes = visualizationNotes(v);
    if (meta.direction === 'down') notes = [...notes].reverse();
    else if (meta.direction === 'both') notes = [...notes, ...notes.slice(0, -1).reverse()];
    groups = notes.map((n) => [n]);
  }
  let beat = 0;
  const events = groups.map((notes, i) => {
    const durationBeats =
      meta.durations?.[i] ??
      (v.type === 'chord' || v.type === 'progression'
        ? (meta.holdBeats ?? 4)
        : 1 / (meta.subdivision ?? 2));
    const event = { notes, beat, durationBeats };
    beat += durationBeats;
    return event;
  });
  return { bpm: bpm ?? meta.bpm ?? 80, events, lengthBeats: beat };
}
