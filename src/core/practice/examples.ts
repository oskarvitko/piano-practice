import {
  MAJOR,
  parseDegrees,
  pitchClass,
  resolvePattern,
  SCALE_INTERVALS,
  spellDegree,
} from '../music';
import type { Degree, MusicalExample, MusicalEvent, PlaybackPlan } from '../types';
import { CHORD_BY_ID, chordToneName } from './chords';
import { FILLS, meterInfo } from './config';
import type {
  ChordVoicing,
  FillKind,
  HarmonicChord,
  MusicalKey,
  PracticeConfig,
  PracticeTask,
} from './types';

export function noteDegree(root: number, note: number): Degree {
  const delta = note - root;
  const pc = pitchClass(delta);
  let index = MAJOR.findIndex((n) => n === pc);
  let accidental = 0;
  if (index < 0) {
    index = MAJOR.findIndex((n) => n === pc + 1);
    accidental = -1;
  }
  if (index < 0) {
    index = MAJOR.findIndex((n) => n === pc - 1);
    accidental = 1;
  }
  return {
    degree: (index + 1) as Degree['degree'],
    accidental: accidental as Degree['accidental'],
    octave: Math.floor(delta / 12),
  };
}
function chordEntry(
  chord: HarmonicChord,
  voicing: ChordVoicing,
  startBeat: number,
  durationBeats: number,
  root: number,
) {
  return {
    name: chord.symbol,
    symbol: chord.roman,
    degree: { ...noteDegree(root, chord.root), octave: 0 },
    quality: CHORD_BY_ID[chord.type].family === 'minor' ? ('minor' as const) : ('major' as const),
    displaySuffix: CHORD_BY_ID[chord.type].suffix,
    bassDegree: chord.bassDegree ? { ...noteDegree(root, chord.bass), octave: 0 } : undefined,
    notes: [...voicing.leftHand, ...voicing.rightHand],
    startBeat,
    durationBeats,
  };
}
export function transitionExample(
  key: MusicalKey,
  chord: HarmonicChord,
  next: HarmonicChord,
  voicing: ChordVoicing,
  nextVoicing: ChordVoicing,
  bpm: number,
  kind: FillKind = 'target',
  variant = 0,
  mix: PracticeConfig['mix'] = 'major-pentatonic',
): MusicalExample {
  const root = 60 + key.pc;
  const targetInterval = CHORD_BY_ID[next.type].intervals.find((n) => n === 3 || n === 4) ?? 0;
  let target = 60 + pitchClass(next.root) + targetInterval;
  while (target > 79) target -= 12;
  const keyScale = (key.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [...MAJOR]).flatMap((n) => [
    root - 12 + n,
    root + n,
    root + 12 + n,
  ]);
  const pent = (
    key.mode === 'minor' ? SCALE_INTERVALS['minor-pentatonic'] : SCALE_INTERVALS['major-pentatonic']
  ).flatMap((n) => [root - 12 + n, root + n, root + 12 + n]);
  const nearest = (pool: readonly number[], at: number) =>
    [...pool].sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0];
  const arp = CHORD_BY_ID[chord.type].intervals
    .map((n) => 60 + pitchClass(chord.root) + n)
    .flatMap((n) => [n - 12, n, n + 12]);
  const pool = kind === 'pentatonic' || kind === 'target' || kind === 'free' ? pent : keyScale;
  let melody = [
    nearest(pool, target - 5),
    nearest(pool, target - 3),
    nearest(pool, target + 2),
    target,
  ];
  if (kind === 'major')
    melody = [
      nearest(keyScale, target - 7),
      nearest(keyScale, target - 5),
      nearest(keyScale, target - 3),
      nearest(keyScale, target - 1),
      target,
    ];
  if (kind === 'arpeggio')
    melody = [nearest(arp, target - 8), nearest(arp, target - 4), nearest(arp, target + 3), target];
  if (kind === 'chromatic')
    melody = [
      nearest(keyScale, target - 5),
      nearest(keyScale, target - 3),
      target - 2,
      target - 1,
      target,
    ];
  if (kind === 'enclosure') melody = [nearest(arp, target + 3), target + 1, target - 1, target];
  if (kind === 'major-blues' || kind === 'minor-blues') {
    // Blues colour is local to the source chord and brief; the arrival is always a target-chord tone.
    const blues = SCALE_INTERVALS[kind];
    const base = 60 + pitchClass(chord.root);
    melody =
      kind === 'major-blues'
        ? [base + 7, base + 4, base + 3, base + 2, nearest(arp, target - 2), target]
        : [base + 12, base + 10, base + 7, base + 6, base + 5, nearest(arp, target - 2), target];
    if (CHORD_BY_ID[chord.type].family === 'minor' && kind === 'major-blues')
      melody = [base + 7, base + 2, base + 3, base + 5, target];
    if (!blues.length) throw new Error('Нет блюзовой формулы');
  }
  if (kind === 'mixed') {
    const starts = mix.startsWith('arpeggio')
      ? arp
      : mix.startsWith('pentatonic')
        ? pent
        : keyScale;
    melody = [nearest(starts, target - 7), nearest(starts, target - 3), nearest(pent, target + 2)];
    if (mix.includes('chromatic')) melody.push(target - 1);
    else if (mix.includes('blues'))
      melody.push(60 + pitchClass(chord.root) + (mix.includes('minor-blues') ? 6 : 3));
    else if (mix === 'two-patterns')
      melody.push(nearest(keyScale, target - 2), nearest(pent, target + 3));
    melody.push(target);
  }
  if (variant === 1) melody = [melody[1], melody[0], ...melody.slice(2)];
  const targetName = chordToneName(next, target, true);
  const shell = (c: HarmonicChord) => {
    const intervals = CHORD_BY_ID[c.type].intervals;
    const third = intervals.find((n) => n === 3 || n === 4) ?? intervals[1];
    const top = intervals.find((n) => n === 10 || n === 11) ?? intervals[2] ?? 7;
    const bass = 48 + pitchClass(c.bass);
    const upper = [0, third, top].map((n) => bass + pitchClass(c.root + n - bass));
    return [...new Set([bass, ...upper])].sort((a, b) => a - b);
  };
  const events: MusicalEvent[] = [
    {
      startBeat: 0,
      durationBeats: 4,
      notes: shell(chord),
      hand: 'left',
      role: 'chord',
      velocity: 0.45,
    },
    {
      startBeat: 4,
      durationBeats: 4,
      notes: shell(next),
      hand: 'left',
      role: 'chord',
      velocity: 0.45,
    },
  ];
  const gap = 0.5;
  const sourcePcs = CHORD_BY_ID[chord.type].intervals.map((n) => pitchClass(chord.root + n));
  const anchors = [
    ...new Set(melody.slice(0, -1).filter((n) => sourcePcs.includes(pitchClass(n)))),
  ].map((n) => chordToneName(chord, n));
  const passing = [
    ...new Set(melody.slice(0, -1).filter((n) => !sourcePcs.includes(pitchClass(n)))),
  ].map((n) => spellDegree(root, noteDegree(root, n), false));
  const first = 4 - (melody.length - 1) * gap;
  melody.forEach((note, i) =>
    events.push({
      startBeat: first + i * gap,
      durationBeats: i === melody.length - 1 ? 2 : gap,
      notes: [note],
      hand: 'right',
      role: 'melody',
      velocity: 0.78,
      degrees: [noteDegree(root, note)],
    }),
  );
  return {
    id: `${kind}-${chord.symbol}-${next.symbol}-${variant}`,
    title: `${FILLS[kind]} · ${chord.symbol} → ${next.symbol}`,
    description: `${chord.symbol} создаёт опору. Левая рука играет компактную основу с заданным басом; полный состав аккорда: ${chord.names.join(', ')}. Аккордовые опоры в мелодии: ${anchors.join(', ') || 'целевая нота следующего аккорда'}. Проходящие ноты и краски: ${passing.join(', ') || 'нет'} — не задерживай их над текущей гармонией. ${kind === 'chromatic' || kind === 'enclosure' ? 'Полутоны вокруг цели создают короткое напряжение.' : kind.includes('blues') ? 'Блюзовые ноты — краткая окраска исходного аккорда.' : 'Ноты гаммы соединяют устойчивые опоры.'} Разрешись в ${targetName} (${targetInterval === 0 ? 'основной тон' : 'терция'} ${next.symbol}) вместе со сменой аккорда. ${kind === 'mixed' ? `Комбинация: ${mix}.` : ''}`,
    root,
    bpm,
    beatsPerBar: 4,
    lengthBeats: 8,
    progression: [
      { ...chordEntry(chord, voicing, 0, 4, root), notes: shell(chord) },
      { ...chordEntry(next, nextVoicing, 4, 4, root), notes: shell(next) },
    ],
    events: events.sort((a, b) => a.startBeat - b.startBeat),
    targetNotes: [
      {
        beat: 4,
        note: target,
        chord: next.symbol,
        function: targetInterval === 0 ? 'основной тон' : 'терция',
      },
    ],
  };
}
export function harmonyExample(task: PracticeTask, bpm: number): MusicalExample {
  const chords = [task.chord, task.nextChord];
  const voices = [task.voicing, task.nextVoicing];
  return {
    id: `harmony-${task.id}`,
    title: `${chords.map((c) => c.symbol).join(' → ')}`,
    description:
      'Сравни общие ноты и движение голосов. Это один из возможных вариантов расположения; бас задаёт гармоническую опору.',
    root: 60 + task.key.pc,
    bpm,
    beatsPerBar: 4,
    lengthBeats: 8,
    progression: chords.map((c, i) => chordEntry(c, voices[i], i * 4, 4, 60 + task.key.pc)),
    events: chords.flatMap((_, i): MusicalEvent[] => [
      {
        startBeat: i * 4,
        durationBeats: 4,
        notes: voices[i].leftHand,
        hand: 'left',
        role: 'bass',
        velocity: 0.55,
      },
      {
        startBeat: i * 4,
        durationBeats: 4,
        notes: voices[i].rightHand,
        hand: 'right',
        role: 'chord',
        velocity: 0.65,
      },
    ]),
    targetNotes: [],
  };
}
export function scalePlan(
  key: MusicalKey,
  config: PracticeConfig,
  patterns: Record<string, string>,
  pattern = config.pattern,
): PlaybackPlan {
  const root = 60 + key.pc;
  const intervals =
    config.scale === 'natural-minor'
      ? [0, 2, 3, 5, 7, 8, 10]
      : config.scale === 'harmonic-minor'
        ? [0, 2, 3, 5, 7, 8, 11]
        : SCALE_INTERVALS[config.scale];
  let notes =
    pattern === 'scale'
      ? [
          ...Array.from({ length: config.octaves }, (_, oct) =>
            intervals.map((n) => root + n + oct * 12),
          ).flat(),
          root + 12 * config.octaves,
        ]
      : Array.from({ length: config.octaves }, (_, oct) =>
          resolvePattern(root + 12 * oct, parseDegrees(patterns[pattern] ?? patterns.P1)),
        ).flat();
  if (config.direction === 'down') notes.reverse();
  if (config.direction === 'both') notes = [...notes, ...notes.slice(0, -1).reverse()];
  notes = Array.from({ length: config.repetitions }, () => notes).flat();
  const duration = (config.meter === '6/8' ? 2 / 3 : 1) / config.subdivision;
  const events = notes.flatMap((note, i) => [
    ...(config.hands !== 'left'
      ? [
          {
            beat: i * duration,
            durationBeats: duration,
            notes: [note],
            hand: 'right' as const,
            velocity: 0.7,
          },
        ]
      : []),
    ...(config.hands !== 'right'
      ? [
          {
            beat: i * duration,
            durationBeats: duration,
            notes: [note - 24],
            hand: 'left' as const,
            velocity: 0.6,
          },
        ]
      : []),
  ]);
  return {
    id: `scale-${key.pc}-${pattern}-${config.direction}`,
    bpm: config.bpm,
    events,
    lengthBeats: notes.length * duration,
  };
}
export function scaleExample(task: PracticeTask, config: PracticeConfig): MusicalExample {
  const plan = task.plan!;
  const root = 60 + task.key.pc;
  return {
    id: plan.id!,
    title: task.instruction,
    description:
      'Сначала сыграй медленно и ровно. Затем повтори без подсказки; направления и октавы указаны в задании.',
    root,
    bpm: config.bpm,
    beatsPerBar: meterInfo(config.meter).beats,
    meter: config.meter,
    lengthBeats: plan.lengthBeats,
    progression: [chordEntry(task.chord, task.voicing, 0, plan.lengthBeats, root)],
    events: plan.events.map((e) => ({
      startBeat: e.beat,
      durationBeats: e.durationBeats,
      notes: e.notes,
      hand: e.hand ?? 'right',
      role: 'melody',
      velocity: e.velocity,
      degrees: e.notes.map((n) => noteDegree(root, n)),
    })),
    targetNotes: [],
  };
}
