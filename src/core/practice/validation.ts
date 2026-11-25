import { z } from 'zod';
import { CHORDS } from './chords';
const chordIds = new Set(CHORDS.map((c) => c.id));
const number = z.number().finite();
const midi = number.int().min(0).max(127);
const time = number.nonnegative();
const key = z.object({ pc: number.int().min(0).max(11), mode: z.enum(['major', 'minor']) });
const voicing = z.enum([
  'root',
  'first',
  'second',
  'third',
  'slash',
  'no3',
  'no5',
  'open',
  'close',
  'shell',
  'drop2',
  'rootless',
  'top',
  'smooth',
]);
const trainer = z.enum(['degree', 'chord', 'style', 'fill', 'scale']);
const style = z.enum(['worship', 'gospel', 'jazz', 'pop', 'blues']);
const fill = z.enum([
  'free',
  'target',
  'pentatonic',
  'major',
  'major-blues',
  'minor-blues',
  'chromatic',
  'enclosure',
  'arpeggio',
  'mixed',
]);
const channel = z.object({ enabled: z.boolean(), volume: number.min(0).max(1) });
export const practiceConfigSchema = z.object({
  trainer,
  keys: z.array(key).min(1).max(24),
  keyOrder: z.enum(['selected', 'random', 'fifths']),
  style,
  bpm: number.int().min(30).max(200),
  meter: z.enum(['4/4', '3/4', '6/8', '2/4']),
  changeEvery: z.enum(['beat', 'two-beats', 'bar', 'two-bars', 'four-bars', 'manual']),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal('custom'),
  ]),
  generationMode: z.enum(['fixed', 'random', 'adaptive', 'free-random']),
  progressionId: z.string().max(150),
  durationMinutes: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
    z.literal(60),
    z.null(),
  ]),
  previewCount: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
  hintMode: z.enum(['hidden', 'chord-name', 'notes', 'keyboard', 'full']),
  degreeDisplay: z.enum(['arabic', 'roman', 'both', 'chord']),
  degreeTask: z.enum(['bass', 'triads', 'sevenths', 'extended', 'inversions', 'mixed']),
  chordMode: z.enum(['harmonic', 'isolated', 'voicing']),
  voiceLanguage: z.enum(['en', 'pl']),
  voiceTiming: z.enum(['on-change', 'one-beat-before', 'two-beats-before', 'off']),
  anticipatoryVoice: z.boolean(),
  enabledChordTypes: z.array(z.string().refine((id) => chordIds.has(id))).max(36),
  enabledDegrees: z.array(number.int().min(1).max(7)).min(1).max(7),
  voicings: z.array(voicing).min(1).max(14),
  channels: z.object({
    metronome: channel,
    bass: channel,
    harmony: channel,
    melody: channel,
    voice: channel,
  }),
  fillKind: fill,
  mix: z.enum([
    'major-pentatonic',
    'pentatonic-major-blues',
    'pentatonic-minor-blues',
    'major-chromatic',
    'arpeggio-pentatonic',
    'arpeggio-chromatic',
    'two-patterns',
  ]),
  scale: z.enum([
    'major',
    'major-pentatonic',
    'minor-pentatonic',
    'major-blues',
    'minor-blues',
    'natural-minor',
    'harmonic-minor',
  ]),
  pattern: z.enum(['scale', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']),
  direction: z.enum(['up', 'down', 'both', 'random', 'mixed']),
  octaves: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  subdivision: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  repetitions: number.int().min(1).max(16),
  hands: z.enum(['left', 'right', 'both']),
});
export const difficultSchema = z.object({
  id: z.string().min(1),
  key,
  degree: number.int().min(1).max(7),
  chordType: z.string(),
  chord: z.string(),
  voicing,
  previousChord: z.string().optional(),
  nextChord: z.string(),
  nextType: z.string(),
  fillKind: fill.optional(),
  bpm: number.min(30).max(200),
  style,
  phraseId: z.string(),
  count: number.int().positive(),
  lastAt: time,
});
const harmonic = z.object({
  degree: number.int().min(1).max(7),
  accidental: number.int().min(-2).max(2),
  type: z.string().refine((id) => chordIds.has(id)),
  bassDegree: number.int().min(1).max(7).optional(),
  bassAccidental: number.int().min(-2).max(2).optional(),
  root: midi,
  rootName: z.string(),
  symbol: z.string(),
  roman: z.string(),
  degreeLabel: z.string(),
  bass: midi,
  names: z.array(z.string()).max(12),
  formula: z.string(),
  function: z.string(),
});
const voices = z.object({
  leftHand: z.array(midi).min(1).max(12),
  rightHand: z.array(midi).min(1).max(12),
  kind: voicing,
  instruction: z.string(),
  names: z.record(z.string(), z.string()),
});
const plan = z.object({
  id: z.string().optional(),
  bpm: number.min(30).max(200),
  lengthBeats: number.positive().max(10000),
  legato: z.boolean().optional(),
  events: z
    .array(
      z.object({
        notes: z.array(midi).min(1).max(24),
        beat: time,
        durationBeats: number.positive(),
        hand: z.enum(['left', 'right']).optional(),
        velocity: number.min(0).max(1).optional(),
      }),
    )
    .max(20000),
});
const degree = z.object({
  degree: number.int().min(1).max(7),
  accidental: number.int().min(-2).max(2).optional(),
  octave: number.int().min(-5).max(5).optional(),
});
const example = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  root: midi,
  bpm: number.min(30).max(200),
  beatsPerBar: number.positive(),
  meter: z.enum(['4/4', '3/4', '6/8', '2/4']).optional(),
  lengthBeats: number.positive().max(10000),
  progression: z
    .array(
      z.object({
        name: z.string(),
        displaySuffix: z.string().optional(),
        bassDegree: degree.optional(),
        symbol: z.string(),
        degree,
        quality: z.enum(['major', 'minor', 'dominant7']),
        notes: z.array(midi),
        startBeat: time,
        durationBeats: number.positive(),
      }),
    )
    .max(64),
  events: z
    .array(
      z.object({
        startBeat: time,
        durationBeats: number.positive(),
        notes: z.array(midi),
        hand: z.enum(['left', 'right']),
        role: z.enum(['bass', 'chord', 'melody']),
        velocity: number.min(0).max(1).optional(),
        degrees: z.array(degree).optional(),
      }),
    )
    .max(20000),
  targetNotes: z
    .array(z.object({ beat: time, note: midi, chord: z.string(), function: z.string() }))
    .max(128),
});
const task = z.object({
  id: z.string(),
  trainer,
  key,
  chord: harmonic,
  voicing: voices,
  previousChord: harmonic.optional(),
  nextChord: harmonic,
  nextVoicing: voices,
  phraseId: z.string(),
  phraseName: z.string(),
  phraseIndex: time.int(),
  phraseLength: number.int().positive(),
  durationBeats: number.positive(),
  instruction: z.string(),
  fillKind: fill.optional(),
  targetNotes: z.array(midi),
  examples: z.array(example).max(8),
  plan: plan.optional(),
});
export const trainerSessionSchema = z
  .object({
    id: z.string().min(1),
    config: practiceConfigSchema,
    startedAt: time,
    updatedAt: time,
    completedAt: time.optional(),
    phase: z.enum([
      'configuration',
      'ready',
      'countdown',
      'playing',
      'paused',
      'hint',
      'completed',
    ]),
    statistics: z.object({
      activeSeconds: time,
      bpmSeconds: time,
      tasks: time.int(),
      chords: time.int(),
      transitions: time.int(),
      keys: z.array(z.string()).max(24),
      chordTypes: z.array(z.string()).max(36),
      hints: time.int(),
      hard: time.int(),
    }),
    difficult: z.array(difficultSchema).max(10000),
    queue: z.array(task).min(1).max(128),
    index: time.int(),
    generator: z.object({
      seed: time.int(),
      phrase: time.int(),
      keyIndex: time.int(),
      lastRoot: number.optional(),
      previousVoicing: z.array(midi).optional(),
    }),
    beat: time,
  })
  .refine((s) => s.index < s.queue.length, 'Позиция тренировки вне очереди');
