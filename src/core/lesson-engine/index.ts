import type { Lesson, PracticeSession, Program, Step } from '../types';
export const allLessons = (program: Program) => program.modules.flatMap((m) => m.lessons);
export const getNextLesson = (program: Program, completedIds: readonly string[]) =>
  allLessons(program).find((l) => !completedIds.includes(l.id));
export const attemptSteps = (lesson: Lesson, attempt?: PracticeSession): Step[] =>
  attempt?.reviewOnly
    ? attempt.frozenReviewStep
      ? [attempt.frozenReviewStep]
      : []
    : lesson.steps.map((s) =>
        s.id === attempt?.frozenReviewStep?.id ? attempt.frozenReviewStep : s,
      );
export function goToStep(steps: Step[], id: string): string {
  if (!steps.some((s) => s.id === id)) throw new Error('Шаг не найден');
  return id;
}
export const nextStep = (steps: Step[], id: string) =>
  steps[Math.min(steps.length - 1, steps.findIndex((s) => s.id === id) + 1)].id;
export const previousStep = (steps: Step[], id: string) =>
  steps[Math.max(0, steps.findIndex((s) => s.id === id) - 1)].id;
export const canCompleteLesson = (steps: Step[], completedIds: string[]) =>
  steps.filter((s) => !s.optional).every((s) => completedIds.includes(s.id));
export const completionFraction = (steps: Step[], completedIds: string[]) => {
  const required = steps.filter((s) => !s.optional);
  return required.length
    ? required.filter((s) => completedIds.includes(s.id)).length / required.length
    : 1;
};
