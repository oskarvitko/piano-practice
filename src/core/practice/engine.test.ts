import { expect, it } from 'vitest';
import { defaultConfig, meterInfo } from './config';
import { PracticeEngine, aggregateSessions } from './engine';
import { configProblems, generateHarmony } from './harmony';
import { generateTasks } from './generator';
import { practiceLibrary } from '../../features/practice/library';
import type { PracticeConfig } from './types';
import { trainerSessionSchema } from './validation';

const state = { seed: 42, phrase: 0, keyIndex: 0 };
it('generates deterministic bounded long sessions in every style and mode', () => {
  for (const style of ['worship', 'gospel', 'jazz', 'pop', 'blues'] as const)
    for (const mode of ['major', 'minor'] as const) {
      const config = {
        ...defaultConfig('style'),
        style,
        keys: [{ pc: 6, mode }],
        difficulty: 5 as const,
      };
      expect(generateTasks(config, practiceLibrary, state)).toEqual(
        generateTasks(config, practiceLibrary, state),
      );
      const engine = new PracticeEngine(config, practiceLibrary, [], 42);
      for (let i = 0; i < 1000; i++) {
        const current = engine.current;
        const next = engine.next;
        expect(current.nextChord.symbol).toBe(next.chord.symbol);
        expect(next.previousChord?.symbol).toBe(current.chord.symbol);
        expect(current.nextVoicing).toEqual(next.voicing);
        expect(engine.session.queue.length).toBeLessThan(40);
        engine.advance();
      }
    }
}, 20000);
it('handles incompatible restrictions and never silently widens selected chord types', () => {
  const config = { ...defaultConfig('chord'), enabledChordTypes: ['sus2', 'sus4'] };
  expect(configProblems(config, practiceLibrary.progressions).length).toBeGreaterThan(0);
  const isolated = { ...config, difficulty: 'custom' as const, chordMode: 'isolated' as const };
  expect(configProblems(isolated, practiceLibrary.progressions)).toEqual([]);
  expect(
    generateHarmony(isolated, practiceLibrary.progressions, state).chords.every((c) =>
      ['sus2', 'sus4'].includes(c.type),
    ),
  ).toBe(true);
  const fixed = {
    ...defaultConfig('style'),
    generationMode: 'fixed' as const,
    progressionId: 'worship-four-pillars',
  };
  expect(generateHarmony(fixed, practiceLibrary.progressions, state).template.id).toBe(
    'worship-four-pillars',
  );
  expect(
    generateHarmony(fixed, practiceLibrary.progressions, { ...state, seed: 999, phrase: 20 })
      .template.id,
  ).toBe('worship-four-pillars');
  expect(
    configProblems({ ...defaultConfig('style'), style: 'jazz' }, practiceLibrary.progressions).join(
      ' ',
    ),
  ).toContain('уровня 3');
  const degree = {
    ...defaultConfig('degree'),
    difficulty: 3 as const,
    generationMode: 'free-random' as const,
    degreeTask: 'sevenths' as const,
  };
  expect(
    generateHarmony(degree, practiceLibrary.progressions, state).chords.every((c) =>
      c.formula.includes('7'),
    ),
  ).toBe(true);
  expect(
    generateHarmony(
      { ...degree, enabledChordTypes: ['sus2'] },
      practiceLibrary.progressions,
      state,
    ).chords.every((c) => c.type === 'sus2'),
  ).toBe(true);
});
it('runs countdown, pauses without time, resumes same task, supports hints and manual next', () => {
  const e = new PracticeEngine(defaultConfig('degree'), practiceLibrary, [], 42);
  const first = e.current.id;
  e.start();
  for (let i = 0; i < 48; i++) e.pulse();
  expect(e.session.statistics.activeSeconds).toBe(0);
  expect(e.session.phase).toBe('countdown');
  e.pulse();
  expect(e.session.phase).toBe('playing');
  expect(e.session.statistics.tasks).toBe(1);
  e.pause();
  const elapsed = e.session.statistics.activeSeconds;
  for (let i = 0; i < 100; i++) e.pulse();
  expect(e.session.statistics.activeSeconds).toBe(elapsed);
  e.hint();
  expect(e.session.statistics.hints).toBe(1);
  e.closeHint();
  expect(e.current.id).toBe(first);
  e.start();
  expect(e.current.id).toBe(first);
  e.closeHint(true);
  expect(e.current.id).not.toBe(first);
  expect(e.session.phase).toBe('paused');
  const restored = new PracticeEngine(e.session.config, practiceLibrary, [], 10, e.snapshot());
  expect(restored.session.phase).toBe('paused');
  expect(restored.current.id).toBe(e.current.id);
  expect(trainerSessionSchema.safeParse(restored.snapshot()).success).toBe(true);
});
it('finishes on active time, computes time-weighted BPM and keeps unlimited sessions running', () => {
  const e = new PracticeEngine(
    { ...defaultConfig('degree'), durationMinutes: 5 },
    practiceLibrary,
    [],
    42,
  );
  e.start();
  for (let i = 0; i < 48; i++) e.pulse();
  for (let i = 0; i < 120 * 12; i++) e.pulse();
  e.setBpm(120);
  for (let i = 0; i < 360 * 12; i++) e.pulse();
  expect(e.session.phase).toBe('completed');
  expect(e.session.statistics.activeSeconds).toBeCloseTo(300);
  expect(e.session.statistics.bpmSeconds / 300).toBeCloseTo(96);
  const stats = aggregateSessions([e.snapshot()]);
  expect(stats.sessions).toBe(1);
  expect(stats.averageBpm).toBeCloseTo(96);
  const unlimited = new PracticeEngine(
    { ...defaultConfig('degree'), durationMinutes: null, changeEvery: 'manual' },
    practiceLibrary,
    [],
    42,
  );
  const id = unlimited.current.id;
  unlimited.start();
  for (let i = 0; i < 6000; i++) unlimited.pulse();
  expect(unlimited.current.id).toBe(id);
  expect(unlimited.session.phase).toBe('playing');
});
it('uses two dotted-quarter pulses per 6/8 bar and remembers explicit difficult transitions', () => {
  expect(meterInfo('6/8')).toMatchObject({ beats: 2, subbeats: 3 });
  const e = new PracticeEngine(
    { ...defaultConfig('degree'), meter: '6/8' },
    practiceLibrary,
    [],
    42,
  );
  expect(e.current.durationBeats).toBe(2);
  e.markHard(123);
  e.markHard(124);
  expect(e.session.statistics.hard).toBe(2);
  expect(e.session.difficult[0]).toMatchObject({
    count: 2,
    lastAt: 124,
    bpm: 60,
    style: 'worship',
  });
});
it('adaptive weighting repeats hard musical phrases more often without breaking templates', () => {
  const config: PracticeConfig = { ...defaultConfig('degree'), generationMode: 'adaptive' };
  const e = new PracticeEngine(config, practiceLibrary, [], 42);
  for (let i = 0; i < 5; i++) e.markHard();
  const target = e.session.difficult[0];
  let baseline = 0;
  let adapted = 0;
  for (let seed = 1; seed <= 800; seed++) {
    const s = { ...state, seed: seed * 1234567 };
    if (generateHarmony(config, practiceLibrary.progressions, s).template.id === target.phraseId)
      baseline++;
    if (
      generateHarmony(config, practiceLibrary.progressions, s, [target]).template.id ===
      target.phraseId
    )
      adapted++;
  }
  expect(adapted).toBeGreaterThan(baseline * 2);
});
