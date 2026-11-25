import { afterEach, expect, it } from 'vitest';
import { PracticeDB } from './db';
import { TrainerRepository } from './trainers';
import { defaultConfig } from '../core/practice/config';
import { PracticeEngine } from '../core/practice/engine';
import { practiceLibrary } from '../features/practice/library';
import { exportBackup, importBackup, validateBackup } from './backup';
import { programs } from '../programs/registry';
const databases: PracticeDB[] = [];
function make() {
  const db = new PracticeDB(`trainer-test-${Math.random()}`);
  databases.push(db);
  return db;
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
it('persists settings, paused resume, history and hard marks without modifying Learning', async () => {
  const db = make();
  const repo = new TrainerRepository(db);
  await db.programProgress.put({
    programId: programs[0].id,
    version: 1,
    status: 'active',
    startedAt: 1,
    updatedAt: 1,
  });
  const config = { ...defaultConfig('degree'), bpm: 137 };
  await repo.saveConfig(config);
  expect((await repo.config('degree')).bpm).toBe(137);
  const e = new PracticeEngine(config, practiceLibrary, [], 42);
  e.start();
  for (let i = 0; i < 80; i++) e.pulse();
  e.markHard();
  await repo.checkpoint(e.snapshot());
  await repo.hard(e.session.difficult[0]);
  expect((await repo.unfinished())?.id).toBe(e.session.id);
  expect((await repo.difficult())[0].count).toBe(1);
  expect(await db.programProgress.count()).toBe(1);
  e.finish();
  await repo.checkpoint(e.snapshot());
  expect(await repo.unfinished()).toBeUndefined();
  expect((await repo.history())[0].phase).toBe('completed');
  expect(await repo.lastTrainer()).toBe('degree');
});
it('exports/imports Practice entities and accepts legacy backups atomically', async () => {
  const db = make();
  const repo = new TrainerRepository(db);
  const engine = new PracticeEngine(defaultConfig('fill'), practiceLibrary, [], 42);
  await repo.checkpoint(engine.snapshot());
  await repo.saveConfig(engine.session.config);
  const backup = await exportBackup(db);
  const parsed = validateBackup(JSON.stringify(backup), programs).backup;
  expect(parsed.trainerSessions?.[0].queue[0].examples).toHaveLength(2);
  await importBackup(db, parsed);
  expect(await db.trainerSessions.count()).toBe(1);
  const broken = structuredClone(backup);
  broken.trainerSessions![0].config.bpm = 999;
  expect(() => validateBackup(JSON.stringify(broken), programs)).toThrow();
  expect(await db.trainerSessions.count()).toBe(1);
  const legacy = structuredClone(backup);
  delete legacy.trainerSessions;
  delete legacy.difficultTasks;
  await importBackup(db, legacy);
  expect(await db.trainerSessions.count()).toBe(0);
});
