import type { Exercise, Program } from '../core/types';
import { scalesAndRuns } from './scales-and-runs';
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
export const programs: readonly Program[] = deepFreeze([scalesAndRuns]);
export const getProgram = (id: string) => programs.find((p) => p.id === id);
export function exerciseCatalog(program: Program): Map<string, Exercise> {
  const exercises = program.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.steps.flatMap((s) => s.exercises)),
  );
  return new Map(exercises.map((e) => [e.id, e]));
}
