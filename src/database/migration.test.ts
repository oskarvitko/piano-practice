import Dexie from 'dexie';
import { expect, it } from 'vitest';
import { PracticeDB } from './db';
it('migrates version-one timer checkpoints and retains stable progress IDs', async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    settings: 'key',
    programProgress: 'programId',
    lessonProgress: '[programId+lessonId],programId,status',
    stepProgress: '[programId+lessonId+stepId],[programId+lessonId]',
    practiceSessions: 'id,[programId+lessonId],programId,status,updatedAt',
    reviewItems: 'key,[programId+exerciseId+root],programId,nextReviewAt',
  });
  await old.table('practiceSessions').put({
    id: 'stable-attempt',
    programId: 'p',
    lessonId: 'l',
    steps: { 'stable-step': { elapsedSeconds: 42 } },
    status: 'active',
  });
  old.close();
  const upgraded = new PracticeDB(name);
  const row = await upgraded.practiceSessions.get('stable-attempt');
  expect(row?.attemptId).toBe('stable-attempt');
  expect(row?.steps['stable-step'].timerSeconds).toBe(42);
  expect(row?.reviewResults).toEqual({});
  await upgraded.delete();
});
it('adds independent Practice tables to version two without touching Learning data', async () => {
  const name = `migration-v2-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old
    .version(2)
    .stores({
      settings: 'key',
      programProgress: 'programId',
      lessonProgress: '[programId+lessonId],programId,status',
      stepProgress: '[programId+lessonId+stepId],[programId+lessonId]',
      practiceSessions: 'id,[programId+lessonId],programId,status,updatedAt,attemptId',
      reviewItems: 'key,[programId+exerciseId+root],programId,nextReviewAt',
    });
  const progress = {
    programId: 'scales-and-runs',
    currentLessonId: 'week-4-day-2',
    startedAt: 123,
  };
  const attempt = {
    id: 'attempt-v2',
    attemptId: 'attempt-v2',
    programId: 'scales-and-runs',
    lessonId: 'week-4-day-2',
    steps: { warmup: { elapsedSeconds: 57, timerSeconds: 12 } },
    reviewResults: {},
    assessmentResults: {},
    status: 'active',
  };
  await old.table('programProgress').put(progress);
  await old.table('practiceSessions').put(attempt);
  old.close();
  const upgraded = new PracticeDB(name);
  expect(await upgraded.programProgress.get(progress.programId)).toEqual(progress);
  expect(await upgraded.practiceSessions.get(attempt.id)).toEqual(attempt);
  expect(await upgraded.trainerSessions.count()).toBe(0);
  expect(await upgraded.difficultTasks.count()).toBe(0);
  await upgraded.delete();
});
