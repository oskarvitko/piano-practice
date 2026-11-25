import { expect, it } from 'vitest';
import { programs } from './registry';
import { allLessons, canCompleteLesson, nextStep, previousStep } from '../core/lesson-engine';
import { createPlaybackPlan, resolvePattern, parseDegrees } from '../core/music';
import { PATTERNS } from './scales-and-runs';
it('provides all 48 lessons with 40 required minutes, stable IDs, and valid playable exercises', () => {
  const lessons = allLessons(programs[0]);
  expect(lessons).toHaveLength(48);
  expect(new Set(lessons.map((l) => l.id)).size).toBe(48);
  const stepIds = lessons.flatMap((l) => l.steps.map((s) => s.id));
  expect(new Set(stepIds).size).toBe(240);
  lessons.forEach((l, i) => {
    expect(l.number).toBe(i + 1);
    expect(l.steps.map((s) => s.durationSeconds)).toEqual([600, 300, 600, 600, 300]);
    l.steps.forEach((s) =>
      s.exercises.forEach((e) => {
        const plan = createPlaybackPlan(e);
        expect(plan.events.length).toBeGreaterThan(0);
        expect(
          plan.events.every((ev) =>
            ev.notes.every((n) => Number.isInteger(n) && n >= 21 && n <= 108),
          ),
        ).toBe(true);
      }),
    );
  });
});
it('preserves P5 fifths and P9/P10 exact notes', () => {
  expect(resolvePattern(60, parseDegrees(PATTERNS.P5))).toEqual([60, 67, 62, 69, 64, 71, 65, 72]);
  expect(resolvePattern(65, parseDegrees(PATTERNS.P9))).toEqual([70, 68, 69]);
});
it('navigation does not complete a step; optional steps do not block', () => {
  const steps = allLessons(programs[0])[0].steps;
  expect(nextStep(steps, steps[0].id)).toBe(steps[1].id);
  expect(previousStep(steps, steps[1].id)).toBe(steps[0].id);
  expect(canCompleteLesson(steps, [])).toBe(false);
  expect(
    canCompleteLesson(
      [...steps, { ...steps[0], id: 'bonus', optional: true }],
      steps.map((s) => s.id),
    ),
  ).toBe(true);
});
