import type { PlaybackPlan } from '../core/types';
export interface ScheduledNote {
  time: number;
  notes: number[];
  duration: number;
  index: number;
}
export function scheduleNotes(
  plan: PlaybackPlan,
  fromIndex = 0,
): { events: ScheduledNote[]; length: number } {
  const secondsPerBeat = 60 / plan.bpm;
  const offset = plan.events[fromIndex]?.beat ?? 0;
  return {
    events: plan.events.slice(fromIndex).map((e, i) => ({
      time: (e.beat - offset) * secondsPerBeat,
      notes: e.notes,
      duration: e.durationBeats * secondsPerBeat,
      index: i + fromIndex,
    })),
    length: (plan.lengthBeats - offset) * secondsPerBeat,
  };
}
/** Each cancellation invalidates callbacks that an audio clock has already queued. */
export class CancellationToken {
  private generation = 0;
  cancel() {
    this.generation++;
  }
  guard(callback: () => void) {
    const generation = this.generation;
    return () => {
      if (generation === this.generation) callback();
    };
  }
}
