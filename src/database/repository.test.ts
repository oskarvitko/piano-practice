import { afterEach, beforeEach, expect, it } from 'vitest';
import { PracticeDB } from './db';
import { PracticeRepository } from './repository';
import { programs } from '../programs/registry';
import { allLessons } from '../core/lesson-engine';
import { exportBackup, importBackup, validateBackup } from './backup';
import { DAY, learnItem } from '../core/review-engine';
import type { Program } from '../core/types';
import { defaultPreferences } from '../core/types';
let db: PracticeDB;
let repo: PracticeRepository;
let now: number;
const program = programs[0];
const lessons = allLessons(program);
beforeEach(() => {
  now = 1_000_000;
  db = new PracticeDB(`test-${crypto.randomUUID()}`);
  repo = new PracticeRepository(db, programs, () => now);
});
afterEach(async () => {
  await db.delete();
});
it('hydrates older preferences with keyboard defaults and keeps partial saved choices', async () => {
  await db.settings.put({
    key: 'preferences',
    value: { theme: 'light', audio: defaultPreferences.audio },
  });
  expect((await repo.preferences()).keyboard).toEqual({
    noteNames: true,
    degrees: true,
    octaves: false,
    fingering: false,
    tonicMarker: false,
  });
  expect((await repo.preferences()).theme).toBe('light');
  await db.settings.put({
    key: 'preferences',
    value: { keyboard: { degrees: false, octaves: true } },
  });
  expect((await repo.preferences()).keyboard).toEqual({
    ...defaultPreferences.keyboard,
    degrees: false,
    octaves: true,
  });
});
it('round-trips keyboard preferences, accepts old backups, and rejects malformed switches', async () => {
  const preferences = {
    ...defaultPreferences,
    keyboard: { ...defaultPreferences.keyboard, octaves: true, fingering: true },
  };
  await repo.savePreferences(preferences);
  const backup = await exportBackup(db);
  const checked = validateBackup(JSON.stringify(backup), programs);
  await repo.savePreferences(defaultPreferences);
  await importBackup(db, checked.backup);
  expect((await repo.preferences()).keyboard).toEqual(preferences.keyboard);
  const legacy = structuredClone(backup);
  legacy.settings = [
    { key: 'preferences', value: { theme: 'dark', audio: defaultPreferences.audio } },
  ];
  await importBackup(db, validateBackup(JSON.stringify(legacy), programs).backup);
  expect((await repo.preferences()).keyboard).toEqual(defaultPreferences.keyboard);
  const invalid = structuredClone(backup);
  invalid.settings = [
    {
      key: 'preferences',
      value: { ...preferences, keyboard: { ...preferences.keyboard, octaves: 'yes' } },
    },
  ];
  expect(() => validateBackup(JSON.stringify(invalid), programs)).toThrow();
  expect((await repo.preferences()).keyboard).toEqual(defaultPreferences.keyboard);
});
it('resumes the last visited step with timer checkpoint without marking it complete', async () => {
  const s = await repo.startLesson(program.id, lessons[0].id);
  await repo.navigate(s.id, lessons[0].steps[2].id);
  await repo.checkpoint(s.id, lessons[0].steps[2].id, { elapsedSeconds: 23, timerSeconds: 23 });
  const resumed = await repo.startLesson(program.id, lessons[0].id);
  expect(resumed.id).toBe(s.id);
  expect(resumed.currentStepId).toBe(lessons[0].steps[2].id);
  expect(resumed.steps[resumed.currentStepId].timerSeconds).toBe(23);
  expect(await db.stepProgress.count()).toBe(0);
});
it('completes atomically, is idempotent, and preserves achievements during replay', async () => {
  const s = await repo.startLesson(program.id, lessons[0].id);
  for (const step of lessons[0].steps) await repo.completeStep(s.id, step.id);
  const first = await db.lessonProgress.get([program.id, lessons[0].id]);
  expect(first?.status).toBe('completed');
  expect((await db.programProgress.get(program.id))?.currentLessonId).toBe(lessons[1].id);
  const reviewCount = await db.reviewItems.count();
  await repo.completeStep(s.id, lessons[0].steps[4].id);
  expect(await db.reviewItems.count()).toBe(reviewCount);
  now += 100;
  const replay = await repo.startLesson(program.id, lessons[0].id);
  expect(replay.replay).toBe(true);
  expect(replay.id).not.toBe(s.id);
  await repo.completeStep(replay.id, lessons[0].steps[0].id);
  expect((await db.lessonProgress.get([program.id, lessons[0].id]))?.completedAt).toBe(
    first?.completedAt,
  );
});
it('does not allow future lessons to advance the canonical program', async () => {
  await expect(repo.startLesson(program.id, lessons[2].id)).rejects.toThrow('для просмотра');
  expect(await db.programProgress.count()).toBe(0);
});
it('freezes due review material and requires explicit results', async () => {
  const exercise = lessons[0].steps[2].exercises[0];
  await db.reviewItems.put(learnItem(program.id, exercise.id, exercise.visualization.root, 0));
  now = 2 * DAY;
  const s = await repo.startLesson(program.id, lessons[0].id);
  expect(s.frozenReviewStep?.reviewKeys).toHaveLength(1);
  await expect(repo.completeStep(s.id, s.currentStepId)).rejects.toThrow('результат');
  const key = s.frozenReviewStep!.reviewKeys![0];
  await repo.recordResult(s.id, key, false, 'review');
  await repo.completeStep(s.id, s.currentStepId);
  expect((await db.reviewItems.get(key))?.repetitionIndex).toBe(0);
  now += 5 * DAY;
  expect((await repo.startLesson(program.id, lessons[0].id)).frozenReviewStep).toEqual(
    s.frozenReviewStep,
  );
});
it('round-trips backups, rejects corrupt input before writes, and preserves unknown programs', async () => {
  await repo.startLesson(program.id, lessons[0].id);
  const backup = await exportBackup(db);
  const text = JSON.stringify(backup);
  expect(validateBackup(text, programs).warnings).toEqual([]);
  await db.practiceSessions.clear();
  await importBackup(db, backup);
  expect(await db.practiceSessions.count()).toBe(1);
  expect(() => validateBackup(text.replace('"active"', '"broken"'), programs)).toThrow(
    'Некорректный',
  );
  expect(await db.practiceSessions.count()).toBe(1);
  const unknown = structuredClone(backup);
  unknown.programProgress[0].programId = 'future-program';
  expect(validateBackup(JSON.stringify(unknown), programs).warnings).toHaveLength(1);
  await importBackup(db, unknown);
  expect(await db.programProgress.get('future-program')).toBeDefined();
});
it('supports a second declarative program with independent progress', async () => {
  const second: Program = {
    id: 'second',
    version: 1,
    title: 'Second',
    description: 'test',
    modules: [
      {
        id: 'm',
        title: 'm',
        description: '',
        lessons: [
          {
            id: 'one',
            title: 'one',
            steps: [
              {
                id: 'one-step',
                title: 'step',
                durationSeconds: 60,
                instructions: [],
                exercises: [],
              },
            ],
          },
        ],
      },
    ],
  };
  repo = new PracticeRepository(db, [program, second], () => now);
  const first = await repo.startLesson(program.id, lessons[0].id);
  const other = await repo.startLesson(second.id, 'one');
  await repo.completeStep(other.id, 'one-step');
  expect((await db.programProgress.get(second.id))?.status).toBe('completed');
  expect((await db.practiceSessions.get(first.id))?.status).toBe('active');
});
it('rolls back a failed replacement instead of partially destroying the existing backup', async () => {
  await repo.startLesson(program.id, lessons[0].id);
  const original = await exportBackup(db);
  const replacement = structuredClone(original);
  replacement.programProgress[0].programId = 'fail-import';
  db.programProgress.hook('creating', (_key, value) => {
    if (value.programId === 'fail-import') throw new Error('Simulated storage failure');
  });
  await expect(importBackup(db, replacement)).rejects.toThrow('Simulated');
  expect(await db.practiceSessions.count()).toBe(1);
  expect((await db.programProgress.toArray())[0].programId).toBe(program.id);
});
it('can complete the full curriculum, then practice frozen reviews without altering lesson totals', async () => {
  for (const lesson of lessons) {
    const s = await repo.startLesson(program.id, lesson.id);
    for (const step of lesson.steps) {
      for (const root of step.assessmentRoots ?? [])
        await repo.recordResult(s.id, String(root), true, 'assessment');
      await repo.completeStep(s.id, step.id);
    }
  }
  expect(await db.lessonProgress.where('status').equals('completed').count()).toBe(48);
  expect((await db.programProgress.get(program.id))?.status).toBe('completed');
  now += DAY * 31;
  const review = await repo.startLesson(program.id, lessons.at(-1)!.id, { reviewOnly: true });
  expect(review.frozenReviewStep?.durationSeconds).toBe(600);
  expect(review.frozenReviewStep?.reviewKeys?.length).toBeLessThanOrEqual(4);
  for (const key of review.frozenReviewStep!.reviewKeys!)
    await repo.recordResult(review.id, key, true, 'review');
  const done = await repo.completeStep(review.id, review.currentStepId);
  expect(done.status).toBe('completed');
  expect(await db.lessonProgress.count()).toBe(48);
});
