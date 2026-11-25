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
