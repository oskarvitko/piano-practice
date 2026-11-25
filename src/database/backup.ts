import { z } from 'zod';
import type { PracticeDB, Setting } from './db';
import type {
  LessonProgress,
  PracticeSession,
  Program,
  ProgramProgress,
  ReviewItem,
  StepProgress,
} from '../core/types';
import { allLessons } from '../core/lesson-engine';
const id = z
  .string()
  .min(1)
  .max(240)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v), 'Недопустимый ID');
const time = z.number().finite().nonnegative();
const midi = z.number().int().min(0).max(127);
const status = z.enum(['active', 'completed']);
const degree = z.object({
  degree: z.number().int().min(1).max(7),
  accidental: z.number().int().min(-2).max(2).optional(),
  octave: z.number().int().min(-4).max(4).optional(),
});
const visualization = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scale'),
    root: midi,
    scale: z.enum(['major', 'major-pentatonic', 'minor-pentatonic', 'major-blues', 'minor-blues']),
    octaves: z.number().int().min(1).max(3),
  }),
  z.object({
    type: z.literal('chord'),
    root: midi,
    name: z.string(),
    notes: z.array(midi).min(1).max(24),
  }),
  z.object({ type: z.literal('sequence'), root: midi, pattern: z.array(degree).min(1).max(256) }),
  z.object({
    type: z.literal('progression'),
    root: midi,
    chords: z
      .array(z.object({ name: z.string(), notes: z.array(midi).min(1).max(24) }))
      .min(1)
      .max(32),
  }),
]);
const exercise = z.object({
  id,
  title: z.string(),
  instructions: z.array(z.string()),
  visualization,
  playback: z
    .object({
      bpm: z.number().min(40).max(180).optional(),
      subdivision: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      direction: z.enum(['up', 'down', 'both']).optional(),
      durations: z.array(z.number().positive()).optional(),
      holdBeats: z.number().positive().optional(),
    })
    .optional(),
  hand: z.enum(['RH', 'LH', 'LH + RH']).optional(),
  fingering: z.record(z.string(), z.string()).optional(),
  formula: z.string().optional(),
  target: z.string().optional(),
});
const step = z.object({
  id,
  title: z.string(),
  instructions: z.array(z.string()),
  durationSeconds: time.max(2400),
  optional: z.boolean().optional(),
  exercises: z.array(exercise).max(256),
  reviewKeys: z.array(id).optional(),
  reviewSlot: z.boolean().optional(),
  assessmentRoots: z.array(midi).optional(),
});
const preferences = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  activeProgramId: id.optional(),
  keyboard: z
    .object({
      noteNames: z.boolean(),
      degrees: z.boolean(),
      octaves: z.boolean(),
      fingering: z.boolean(),
      tonicMarker: z.boolean(),
    })
    .partial()
    .optional(),
  audio: z.object({
    bpm: z.number().min(40).max(180),
    bpmOverride: z.boolean().optional(),
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
    loop: z.boolean(),
    subdivision: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    beatsPerBar: z.number().int().min(1).max(12),
  }),
});
const session = z
  .object({
    id,
    attemptId: id,
    programId: id,
    lessonId: id,
    status,
    replay: z.boolean(),
    startedAt: time,
    updatedAt: time,
    completedAt: time.optional(),
    currentStepId: id,
    activeSeconds: time,
    steps: z.record(
      id,
      z.object({ elapsedSeconds: time, timerSeconds: time, completedAt: time.optional() }),
    ),
    frozenReviewStep: step.optional(),
    reviewResults: z.record(id, z.boolean()),
    assessmentResults: z.record(id, z.boolean()),
    reviewOnly: z.boolean().optional(),
  })
  .passthrough();
const schema = z.object({
  format: z.literal('piano-practice'),
  version: z.literal(2),
  exportedAt: time,
  settings: z.array(z.object({ key: id, value: z.unknown() })).max(1000),
  programProgress: z
    .array(
      z
        .object({
          programId: id,
          version: z.number().int().positive(),
          status,
          currentLessonId: id.optional(),
          startedAt: time,
          updatedAt: time,
        })
        .passthrough(),
    )
    .max(1000),
  lessonProgress: z
    .array(
      z
        .object({
          programId: id,
          lessonId: id,
          status,
          currentStepId: id,
          startedAt: time,
          completedAt: time.optional(),
        })
        .passthrough(),
    )
    .max(10000),
  stepProgress: z
    .array(
      z
        .object({
          programId: id,
          lessonId: id,
          stepId: id,
          status,
          elapsedSeconds: time,
          completedAt: time.optional(),
        })
        .passthrough(),
    )
    .max(50000),
  practiceSessions: z.array(session).max(10000),
  reviewItems: z
    .array(
      z
        .object({
          key: id,
          programId: id,
          exerciseId: id,
          root: midi,
          firstLearnedAt: time,
          lastReviewedAt: time.optional(),
          nextReviewAt: time,
          repetitionIndex: z.number().int().min(0).max(5),
          mastery: z.boolean(),
          basePassed: z.boolean().optional(),
        })
        .passthrough(),
    )
    .max(20000),
});
export interface Backup {
  format: 'piano-practice';
  version: 2;
  exportedAt: number;
  settings: Setting[];
  programProgress: ProgramProgress[];
  lessonProgress: LessonProgress[];
  stepProgress: StepProgress[];
  practiceSessions: PracticeSession[];
  reviewItems: ReviewItem[];
}
export async function exportBackup(db: PracticeDB): Promise<Backup> {
  return db.transaction('r', db.tables, async () => ({
    format: 'piano-practice',
    version: 2,
    exportedAt: Date.now(),
    settings: await db.settings.toArray(),
    programProgress: await db.programProgress.toArray(),
    lessonProgress: await db.lessonProgress.toArray(),
    stepProgress: await db.stepProgress.toArray(),
    practiceSessions: await db.practiceSessions.toArray(),
    reviewItems: await db.reviewItems.toArray(),
  }));
}
export function validateBackup(
  text: string,
  programs: readonly Program[],
): { backup: Backup; warnings: string[] } {
  if (text.length > 20_000_000) throw new Error('Файл слишком большой (максимум 20 МБ)');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new Error('Некорректный файл прогресса: ' + parsed.error.issues[0]?.path.join('.'));
  const data = parsed.data as Backup;
  for (const setting of data.settings)
    if (setting.key === 'preferences' && !preferences.safeParse(setting.value).success)
      throw new Error('Некорректные настройки в резервной копии');
  const tables: [string, string[]][] = [
    ['settings', data.settings.map((x) => x.key)],
    ['programProgress', data.programProgress.map((x) => x.programId)],
    ['lessonProgress', data.lessonProgress.map((x) => JSON.stringify([x.programId, x.lessonId]))],
    [
      'stepProgress',
      data.stepProgress.map((x) => JSON.stringify([x.programId, x.lessonId, x.stepId])),
    ],
    ['practiceSessions', data.practiceSessions.map((x) => x.id)],
    ['reviewItems', data.reviewItems.map((x) => x.key)],
  ];
  for (const [name, ids] of tables)
    if (new Set(ids).size !== ids.length) throw new Error(`Повторяющиеся записи: ${name}`);
  const unknown = new Set<string>();
  for (const p of data.programProgress)
    if (!programs.some((def) => def.id === p.programId)) unknown.add(p.programId);
  for (const l of [...data.lessonProgress, ...data.practiceSessions]) {
    const p = programs.find((def) => def.id === l.programId);
    const lesson = p && allLessons(p).find((def) => def.id === l.lessonId);
    if (!lesson) unknown.add(`${l.programId}/${l.lessonId}`);
    else if (!lesson.steps.some((s) => s.id === l.currentStepId))
      unknown.add(`${l.programId}/${l.lessonId}/${l.currentStepId}`);
  }
  return {
    backup: data,
    warnings: unknown.size
      ? [
          `Неизвестных ID: ${unknown.size}. Эти записи будут сохранены; они станут доступны при возвращении соответствующих программ.`,
        ]
      : [],
  };
}
export async function importBackup(db: PracticeDB, backup: Backup): Promise<void> {
  // Validate again immediately before replacing all tables in one atomic transaction.
  const valid = validateBackup(JSON.stringify(backup), []).backup;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.settings.bulkPut(valid.settings);
    await db.programProgress.bulkPut(valid.programProgress);
    await db.lessonProgress.bulkPut(valid.lessonProgress);
    await db.stepProgress.bulkPut(valid.stepProgress);
    await db.practiceSessions.bulkPut(valid.practiceSessions);
    await db.reviewItems.bulkPut(valid.reviewItems);
  });
}
