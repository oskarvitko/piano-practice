import { pitchClass } from '../music';
import { CHORDS, CHORD_BY_ID, MINOR_ALTERATIONS, parseChord, buildChord } from './chords';
import type {
  DifficultTask,
  GeneratorState,
  HarmonicChord,
  MusicStyle,
  MusicalKey,
  PracticeConfig,
  ProgressionTemplate,
  RelativeChord,
} from './types';

export class Random {
  constructor(public seed: number) {}
  next() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error('Пустой набор заданий');
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((s, x) => s + Math.max(0, weight(x)), 0);
    let n = this.next() * total;
    for (const item of items) {
      n -= Math.max(0, weight(item));
      if (n <= 0) return item;
    }
    return items.at(-1)!;
  }
}
const transitions: Record<MusicStyle, number[][]> = {
  worship: [[4, 5, 6, 2], [5, 4], [6, 4], [1, 5, 6, 2], [1, 6], [4, 2, 5, 1], [1]],
  gospel: [[6, 4, 3, 2], [5, 7], [6, 4], [1, 5, 2], [1, 6], [2, 4, 5], [1]],
  jazz: [
    [6, 4, 2],
    [5, 7],
    [6, 4],
    [3, 2, 5],
    [1, 6],
    [2, 4],
    [1, 3],
  ],
  pop: [[5, 6, 4], [5, 4], [6, 4], [1, 5, 6], [1, 6, 4], [4, 5, 2], [1]],
  blues: [[4, 1, 5], [5], [4, 6], [1, 5], [4, 1], [2, 5], [1]],
};
export function transitionWeight(style: MusicStyle, from: number, to: number) {
  const order = transitions[style][from - 1] ?? [1];
  const index = order.indexOf(to);
  return index < 0 ? 0.2 : 5 - index * 0.7;
}
export const levelOf = (config: PracticeConfig) =>
  config.difficulty === 'custom' ? 5 : config.difficulty;
function candidates(chord: RelativeChord, config: PracticeConfig) {
  const original = CHORD_BY_ID[chord.type];
  if (!config.enabledChordTypes.length)
    return original.level <= levelOf(config) ? [original.id] : [];
  return config.enabledChordTypes.filter((id) => {
    const d = CHORD_BY_ID[id];
    if (!d || d.level > levelOf(config)) return false;
    // Sus may replace a major triad, but never erase a required dominant resolution.
    return (
      d.family === original.family ||
      (original.family === 'major' && original.id === 'major' && d.family === 'suspended')
    );
  });
}
export function compatibleTemplates(
  config: PracticeConfig,
  templates: ProgressionTemplate[],
  mode: MusicalKey['mode'],
) {
  return templates.filter(
    (t) =>
      t.style === config.style &&
      t.mode === mode &&
      t.difficulty <= levelOf(config) &&
      t.chords.every((token) => {
        const c = parseChord(token);
        return config.enabledDegrees.includes(c.degree) && candidates(c, config).length > 0;
      }),
  );
}
export function configProblems(config: PracticeConfig, templates: ProgressionTemplate[]): string[] {
  const errors: string[] = [];
  if (!config.keys.length) errors.push('Выбери хотя бы одну тональность.');
  if (!config.enabledDegrees.length) errors.push('Выбери хотя бы одну ступень.');
  if (config.trainer === 'scale') return errors;
  if (
    config.trainer === 'degree' &&
    ['sevenths', 'extended', 'mixed'].includes(config.degreeTask) &&
    levelOf(config) < 3
  )
    errors.push('Для септаккордов и расширенной гармонии нужен уровень 3 или выше.');
  if (
    config.generationMode === 'free-random' ||
    (config.chordMode === 'isolated' && config.trainer === 'chord')
  ) {
    if (
      !CHORDS.some(
        (c) =>
          c.level <= levelOf(config) &&
          (!config.enabledChordTypes.length || config.enabledChordTypes.includes(c.id)),
      )
    )
      errors.push('Выбранные аккорды недоступны на этом уровне сложности.');
    return errors;
  }
  for (const mode of new Set(config.keys.map((k) => k.mode))) {
    const list = compatibleTemplates(config, templates, mode);
    if (!list.length)
      errors.push(
        `Нет ${mode === 'major' ? 'мажорных' : 'минорных'} прогрессий для этих ограничений. Измени уровень/ступени/типы аккордов или выбери «Изолированные / Free Random». Jazz и Blues начинаются с уровня 3.`,
      );
    else if (
      config.generationMode === 'fixed' &&
      config.progressionId &&
      !list.some((t) => t.id === config.progressionId)
    )
      errors.push(
        'Фиксированная прогрессия не подходит ко всем выбранным тональностям и ограничениям. Выбери один лад или другую прогрессию.',
      );
  }
  return errors;
}
export function diatonicType(degree: number, key: MusicalKey, seventh = false) {
  return (
    key.mode === 'major'
      ? seventh
        ? ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5']
        : ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']
      : seventh
        ? ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7']
        : ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']
  )[degree - 1];
}
export function chooseKey(config: PracticeConfig, state: GeneratorState, rng: Random): MusicalKey {
  if (config.keyOrder === 'random') return rng.pick(config.keys);
  const keys =
    config.keyOrder === 'fifths'
      ? [...config.keys].sort((a, b) => pitchClass(a.pc * 7) - pitchClass(b.pc * 7))
      : config.keys;
  return keys[state.phrase % keys.length];
}
export function generateHarmony(
  config: PracticeConfig,
  templates: ProgressionTemplate[],
  state: GeneratorState,
  difficult: DifficultTask[] = [],
) {
  const rng = new Random(state.seed);
  const key = chooseKey(config, state, rng);
  const free =
    config.generationMode === 'free-random' ||
    (config.trainer === 'chord' && config.chordMode === 'isolated');
  const choices = compatibleTemplates(config, templates, key.mode);
  let template: ProgressionTemplate;
  let relatives: RelativeChord[];
  if (free) {
    template = {
      id: 'isolated',
      name: 'Изолированные аккорды',
      style: config.style,
      mode: key.mode,
      difficulty: 1,
      chords: [],
      weight: 1,
      tags: [],
    };
    const allowed = CHORDS.filter(
      (c) =>
        c.level <= levelOf(config) &&
        (!config.enabledChordTypes.length || config.enabledChordTypes.includes(c.id)),
    );
    relatives = Array.from({ length: 8 }, () => {
      const degree = rng.pick(config.enabledDegrees);
      return {
        degree,
        accidental: key.mode === 'minor' ? MINOR_ALTERATIONS[degree - 1] : 0,
        type:
          config.trainer === 'degree' && !config.enabledChordTypes.length
            ? diatonicType(degree, key)
            : rng.pick(allowed).id,
      };
    });
  } else {
    if (!choices.length)
      throw new Error(configProblems(config, templates)[0] ?? 'Нет подходящих прогрессий.');
    template =
      config.generationMode === 'fixed'
        ? (choices.find((t) => t.id === config.progressionId) ?? choices[0])
        : rng.weighted(choices, (t) => {
            const first = parseChord(t.chords[0]);
            const previous = state.lastRoot ?? 1;
            const adaptation =
              config.generationMode === 'adaptive'
                ? difficult
                    .filter(
                      (d) =>
                        d.style === config.style &&
                        d.key.pc === key.pc &&
                        d.key.mode === key.mode &&
                        d.phraseId === t.id,
                    )
                    .reduce((n, d) => n + Math.min(d.count, 10) * 2, 0)
                : 0;
            return (
              t.weight * (1 + adaptation) * transitionWeight(config.style, previous, first.degree)
            );
          });
    relatives = template.chords.map((token) => {
      const c = parseChord(token);
      return { ...c, type: rng.pick(candidates(c, config)) };
    });
  }
  relatives = relatives.map((c) => {
    let type = c.type;
    if (!config.enabledChordTypes.length && config.trainer === 'degree') {
      const task =
        config.degreeTask === 'mixed'
          ? rng.pick(['triads', 'sevenths', 'extended'])
          : config.degreeTask;
      if (task === 'triads' || task === 'bass' || task === 'inversions') {
        const family = CHORD_BY_ID[type].family;
        type =
          family === 'minor'
            ? 'minor'
            : family === 'diminished'
              ? 'diminished'
              : family === 'augmented'
                ? 'augmented'
                : family === 'suspended'
                  ? type
                  : 'major';
      } else if (task === 'sevenths' || task === 'extended') {
        const family = CHORD_BY_ID[type].family;
        type =
          family === 'minor'
            ? task === 'extended'
              ? 'm9'
              : 'm7'
            : family === 'diminished'
              ? 'm7b5'
              : family === 'dominant' || c.degree === 5
                ? task === 'extended'
                  ? '9'
                  : '7'
                : task === 'extended'
                  ? 'maj9'
                  : 'maj7';
      }
    }
    return { ...c, type };
  });
  const chords: HarmonicChord[] = relatives.map((c) => buildChord(key, c));
  if (config.style === 'blues')
    for (const chord of chords) {
      if (chord.degree === 1)
        chord.function = 'Блюзовая тоника · септима здесь часть устойчивой окраски';
      if (chord.degree === 4) chord.function = 'Блюзовая субдоминанта · ответ тонике';
    }
  return {
    key,
    chords,
    template,
    state: {
      ...state,
      seed: rng.seed,
      phrase: state.phrase + 1,
      keyIndex: config.keys.findIndex((k) => k.pc === key.pc && k.mode === key.mode),
      lastRoot: relatives.at(-1)?.degree,
    },
  };
}
