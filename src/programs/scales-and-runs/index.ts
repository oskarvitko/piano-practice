import type { Exercise, Lesson, Program, ScaleType, Step } from '../../core/types';
import { getChordNotes, getNoteName, parseDegrees, SCALE_FORMULAS } from '../../core/music';

export const PATTERNS = {
  P1: '1 2 3 | 2 3 4 | 3 4 5 | 4 5 6',
  P2: '1 2 3 4 | 2 3 4 5 | 3 4 5 6',
  P3: '8 7 6 5 | 7 6 5 4 | 6 5 4 3',
  P4: '1 3 2 4 3 5 4 6',
  P5: '1 5 2 6 3 7 4 8',
  P6: '1 3 2 1 | 2 4 3 2 | 3 5 4 3',
  P7: '8 6 5 | 6 5 3 | 5 3 2 | 3 2 1',
  P8: '3 4 #4 5 #5 6',
  P9: '4 #2 3',
  P10: '8 b7 5 b5 4 b3 1',
} as const;
type PatternId = keyof typeof PATTERNS;
const KEYS = [
  { name: 'C', root: 60 },
  { name: 'G', root: 55 },
  { name: 'D', root: 62 },
  { name: 'A', root: 57 },
  { name: 'E', root: 64 },
  { name: 'F', root: 65 },
];
const FOUR: ScaleType[] = ['major', 'major-pentatonic', 'major-blues', 'minor-blues'];
const LABELS: Record<ScaleType, string> = {
  major: 'Major',
  'major-pentatonic': 'Major Pentatonic',
  'minor-pentatonic': 'Minor Pentatonic',
  'major-blues': 'Major Blues',
  'minor-blues': 'Minor Blues',
};
const ALL = Object.keys(PATTERNS) as PatternId[];
const topics = [
  {
    id: 'foundations',
    title: 'Major и пентатоника',
    scales: ['major', 'major-pentatonic'] as ScaleType[],
    patterns: ['P1', 'P2'] as PatternId[],
    runs: ['major'],
    progression: ['I', 'V', 'vi', 'IV'],
  },
  {
    id: 'blues',
    title: 'Блюз: два характера',
    scales: ['major-blues', 'minor-blues'] as ScaleType[],
    patterns: ['P7', 'P10'] as PatternId[],
    runs: ['blues', 'minor'],
    progression: ['I', 'IV'],
  },
  {
    id: 'sequences',
    title: 'Секвенции и движение',
    scales: FOUR,
    patterns: ['P1', 'P2', 'P3', 'P6'] as PatternId[],
    runs: ['enclosure'],
    progression: ['I', 'V', 'vi', 'IV'],
  },
  {
    id: 'leaps',
    title: 'Скачки и хроматика',
    scales: ['major', 'major-blues', 'minor-blues'] as ScaleType[],
    patterns: ['P4', 'P5', 'P8'] as PatternId[],
    runs: ['chromatic'],
    progression: ['I', 'IV', 'V', 'I'],
  },
  {
    id: 'fills',
    title: 'Раны и филлы',
    scales: ['major-pentatonic', 'major-blues', 'minor-blues'] as ScaleType[],
    patterns: ['P7', 'P9', 'P10'] as PatternId[],
    runs: ['major', 'to-vi', 'to-v', 'enclosure'],
    progression: ['I', 'IV', 'vi', 'V'],
  },
  {
    id: 'assessment',
    title: 'Проверка и свобода',
    scales: FOUR,
    patterns: ALL,
    runs: ['major', 'to-vi', 'to-v', 'enclosure'],
    progression: ['I', 'IV', 'vi', 'V'],
  },
];
export function scaleExercise(root: number, scale: ScaleType): Exercise {
  const key = getNoteName(root, root);
  return {
    id: `${key.toLowerCase()}-${scale}`,
    title: `${key} ${LABELS[scale]}`,
    hand: 'RH',
    formula: SCALE_FORMULAS[scale],
    instructions: [
      'Играй вверх и вниз на две октавы. Держи кисть свободной, звук — ровным.',
      'Начни с восьмых при 60 BPM. К шестнадцатым переходи только после чистого исполнения.',
    ],
    visualization: { type: 'scale', root, scale, octaves: 2 },
    playback: { bpm: 60, subdivision: 2, direction: 'both' },
    ...(root === 60 && scale === 'major'
      ? {
          fingering: {
            60: '1',
            62: '2',
            64: '3',
            65: '1',
            67: '2',
            69: '3',
            71: '4',
            72: '1',
            74: '2',
            76: '3',
            77: '1',
            79: '2',
            81: '3',
            83: '4',
            84: '5',
          },
        }
      : {}),
  };
}
function patternExercise(root: number, pattern: PatternId): Exercise {
  const key = getNoteName(root, root);
  return {
    id: `${key.toLowerCase()}-${pattern.toLowerCase()}`,
    title: `${pattern} · ${key}`,
    hand: 'RH',
    formula: PATTERNS[pattern],
    instructions: [
      pattern === 'P5'
        ? 'Сохраняй квинтовые скачки: 4 → 8 — чистая квинта. Не переноси 8 в нижнюю октаву.'
        : pattern === 'P9'
          ? 'Окружи терцию сверху и снизу: 4 → #2 → 3. Устойчивая цель — 3.'
          : pattern === 'P10'
            ? 'Нисходящий minor blues. Начни с верхней тоники и заверши на нижней.'
            : 'Сначала сыграй каждую группу отдельно, затем соедини без пауз.',
      'Повтори в ранее изученных тональностях. Начни при 50–70 BPM.',
    ],
    visualization: { type: 'sequence', root, pattern: parseDegrees(PATTERNS[pattern]) },
    playback: { bpm: 60, subdivision: 2 },
  };
}
function runExercise(root: number, id: string): Exercise {
  const runs: Record<
    string,
    { title: string; formula: string; target: string; instruction: string }
  > = {
    major: {
      title: 'I → IV · мажорный ран',
      formula: '1 2 3 5 6',
      target: '6',
      instruction: 'На I сыграй ран, заверши на ступени 6 — терции аккорда IV.',
    },
    blues: {
      title: 'I → IV · блюзовый ран',
      formula: '2 b3 3 5 6',
      target: '6',
      instruction: 'b3 — проходящая нота к 3. На смене аккорда приходи в 6, терцию IV.',
    },
    minor: {
      title: 'Minor blues над I',
      formula: PATTERNS.P10,
      target: '1',
      instruction: 'Проверь на слух напряжение b3 и b5 над мажорным I. Разреши фразу в тонику.',
    },
    'to-vi': {
      title: 'IV → vi · мягкое разрешение',
      formula: '6 5 3 2 1',
      target: '1',
      instruction: 'На смене IV → vi приди в 1 — терцию минорного vi.',
    },
    'to-v': {
      title: 'vi → V · движение к доминанте',
      formula: '1 2 3 5 7',
      target: '7',
      instruction: 'На смене vi → V приди в 7 — терцию V. Сохраняй указанную октаву.',
    },
    enclosure: {
      title: 'V → I · окружение терции',
      formula: PATTERNS.P9,
      target: '3',
      instruction: '4 → #2 → 3: окружи терцию тоники. Заверши на 3 одновременно со сменой V → I.',
    },
    chromatic: {
      title: 'I → IV · хроматический подъём',
      formula: PATTERNS.P8,
      target: '6',
      instruction: '3 → 4 → #4 → 5 → #5 → 6. Хроматические ноты проходящие; цель — терция IV.',
    },
  };
  const run = runs[id];
  return {
    id: `${getNoteName(root, root).toLowerCase()}-run-${id}`,
    title: run.title,
    hand: 'LH + RH',
    formula: run.formula,
    target: run.target,
    instructions: [
      run.instruction,
      'Левая рука держит бас или аккорд. Правая играет короткий филл в паузе, не поверх вокальной фразы.',
    ],
    visualization: { type: 'sequence', root, pattern: parseDegrees(run.formula) },
    playback: { bpm: 60, subdivision: 2 },
  };
}
function progressionExercise(root: number, degrees: string[]): Exercise {
  const offsets: Record<string, number> = { I: 0, IV: 5, V: 7, vi: 9 };
  return {
    id: `${getNoteName(root, root).toLowerCase()}-progression-${degrees.join('-')}`,
    title: `${getNoteName(root, root)} · ${degrees.join('–')}`,
    hand: 'LH + RH',
    formula: degrees.join(' – '),
    instructions: [
      'Левая рука — бас и аккорды, правая — короткие фразы из изученных гамм.',
      'Оставляй пространство: одна фраза — один ответ. Филл только в паузе; последняя нота — нота следующего аккорда.',
    ],
    visualization: {
      type: 'progression',
      root,
      chords: degrees.map((d) => ({
        name: `${getNoteName(root + offsets[d], root)}${d === 'vi' ? 'm' : ''} (${d})`,
        notes: getChordNotes(root - 12 + offsets[d], d === 'vi' ? 'minor' : 'major'),
      })),
    },
    playback: { bpm: 60, holdBeats: 4 },
  };
}
export function assessmentExercise(root: number): Exercise {
  return {
    ...progressionExercise(root, ['I', 'IV', 'vi', 'V']),
    id: `assessment-${getNoteName(root, root).toLowerCase()}`,
    title: `Проверка ${getNoteName(root, root)}`,
    instructions: [
      'Без подсказки: четыре гаммы, P1–P10 и переходы I → IV, IV → vi, vi → V, V → I.',
      'Сыграй две минуты свободной импровизации. Чистота и осмысленное разрешение важнее скорости.',
      'Отметь результат честно. При неудаче материал останется на повторение.',
    ],
  };
}
function makeSteps(
  lessonId: string,
  roots: number[],
  topic: (typeof topics)[number],
  consolidation = false,
): Step[] {
  const split = roots.length > 1 ? ['Раздели время поровну между двумя тональностями.'] : [];
  return [
    {
      id: `${lessonId}-review`,
      title: 'Вспомнить и разогреться',
      reviewSlot: true,
      durationSeconds: 600,
      instructions: [
        '10 минут на повторение. Просроченные задания появятся здесь автоматически; если их нет — закрепляй текущий материал.',
        ...split,
      ],
      exercises: roots.map((r) => scaleExercise(r, 'major')),
    },
    {
      id: `${lessonId}-scales`,
      title: 'Гаммы',
      durationSeconds: 300,
      instructions: [
        topic.id === 'assessment'
          ? 'Сначала сыграй все четыре гаммы без подсказки. Открой клавиатуру только для проверки.'
          : 'Ровные восьмые, свободная кисть. Сыграй гаммы вверх и вниз.',
        ...split,
      ],
      exercises: roots.flatMap((r) => topic.scales.map((s) => scaleExercise(r, s))),
    },
    {
      id: `${lessonId}-patterns`,
      title: 'Паттерны',
      durationSeconds: 600,
      instructions: [
        consolidation
          ? 'Удели больше времени слабым паттернам. Меняй тональность без подсказки.'
          : 'Повторяй маленькими группами, затем соедини в одну фразу.',
        ...split,
      ],
      exercises: roots.flatMap((r) => topic.patterns.map((p) => patternExercise(r, p))),
    },
    {
      id: `${lessonId}-runs`,
      title: 'Раны и филлы',
      durationSeconds: 600,
      instructions: [
        'Сначала найди целевую ноту следующего аккорда, затем сыграй ведущую к ней фразу.',
        ...split,
      ],
      exercises: roots.flatMap((r) => topic.runs.map((id) => runExercise(r, id))),
    },
    {
      id: `${lessonId}-improv`,
      title: topic.id === 'assessment' ? 'Импровизация и проверка' : 'Свободная импровизация',
      durationSeconds: 300,
      instructions: [
        consolidation
          ? 'По две минуты на тональность. Оставшееся время — на самооценку.'
          : 'Пробуй короткие фразы. Слушай, куда разрешается каждая из них.',
        topic.id === 'blues'
          ? 'Чередуй major blues и minor blues, прислушиваясь к окраске.'
          : topic.id === 'sequences'
            ? 'Используй нисходящие группы.'
            : topic.id === 'leaps'
              ? 'Чередуй скачки и плавное движение.'
              : 'Оставляй паузы между фразами.',
      ],
      exercises: roots.map((r) =>
        topic.id === 'assessment'
          ? assessmentExercise(r)
          : progressionExercise(r, topic.progression),
      ),
      ...(topic.id === 'assessment' ? { assessmentRoots: roots } : {}),
    },
  ];
}
export const scalesAndRuns: Program = {
  id: 'scales-patterns-runs',
  version: 1,
  title: 'Scales, Patterns & Runs',
  weeks: 16,
  description:
    'От первых гамм до свободных фраз. Научись слышать гармонию, находить нужные ноты и уверенно импровизировать.',
  modules: [
    ...KEYS.map((key, ki) => ({
      id: `key-${key.name.toLowerCase()}`,
      title: `Тональность ${key.name}`,
      description: `Недели ${ki * 2 + 1}–${ki * 2 + 2} · 6 уроков`,
      lessons: topics.map((topic, ti): Lesson => {
        const id = `${key.name.toLowerCase()}-${topic.id}`;
        return {
          id,
          title: topic.title,
          subtitle: `${key.name} · ${topic.scales.map((s) => LABELS[s]).join(' / ')}`,
          week: ki * 2 + Math.floor(ti / 3) + 1,
          number: ki * 6 + ti + 1,
          roots: [key.root],
          steps: makeSteps(id, [key.root], topic),
        };
      }),
    })),
    ...Array.from({ length: 2 }, (_, block) => ({
      id: `consolidation-${block + 1}`,
      title: block === 0 ? 'Соединяем тональности' : 'Играем свободно',
      description: `Недели ${13 + block * 2}–${14 + block * 2} · 6 уроков`,
      lessons: KEYS.map((key, i): Lesson => {
        const next = KEYS[(i + 1) % KEYS.length];
        const id = `consolidation-${block + 1}-${key.name.toLowerCase()}-${next.name.toLowerCase()}`;
        const topic = {
          ...topics[block === 1 ? 5 : 2],
          patterns: block === 1 ? ALL : ALL.slice((i % 3) * 3, i % 3 === 2 ? 10 : (i % 3) * 3 + 3),
          runs: i % 2 === 0 ? ['major', 'to-vi', 'to-v', 'enclosure'] : ['chromatic', 'enclosure'],
          progression: ['I', 'IV', 'vi', 'V'],
        };
        return {
          id,
          title: `${key.name} + ${next.name} · ${block === 0 ? 'закрепление' : 'без подсказки'}`,
          week: 13 + block * 2 + Math.floor(i / 3),
          number: 37 + block * 6 + i,
          roots: [key.root, next.root],
          steps: makeSteps(id, [key.root, next.root], topic, true),
        };
      }),
    })),
  ],
};
