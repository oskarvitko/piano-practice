import type { PlaybackPlan } from '../core/types';
export interface ScheduledNote {
  time: number;
  notes: number[];
  duration: number;
  index: number;
  hand?: 'left' | 'right';
  velocity?: number;
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
      ...(e.hand ? { hand: e.hand } : {}),
      ...(e.velocity !== undefined ? { velocity: e.velocity } : {}),
    })),
    length: (plan.lengthBeats - offset) * secondsPerBeat,
  };
}
export interface PlaybackFrame {
  beat: number;
  index: number;
  eventIndexes: number[];
  notes: number[];
  leftNotes: number[];
  rightNotes: number[];
}
export function frameAtBeat(plan: PlaybackPlan, beat: number): PlaybackFrame {
  const gate = plan.legato ? 1 : 0.85;
  const active = plan.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.beat <= beat && beat < event.beat + event.durationBeats * gate);
  const unique = (notes: number[]) => [...new Set(notes)];
  return {
    beat,
    index: plan.events.reduce((latest, event, index) => (event.beat <= beat ? index : latest), 0),
    eventIndexes: active.map(({ index }) => index),
    notes: unique(active.flatMap(({ event }) => event.notes)),
    leftNotes: unique(
      active.filter(({ event }) => event.hand === 'left').flatMap(({ event }) => event.notes),
    ),
    rightNotes: unique(
      active.filter(({ event }) => event.hand !== 'left').flatMap(({ event }) => event.notes),
    ),
  };
}
export function playbackFrames(plan: PlaybackPlan): PlaybackFrame[] {
  const gate = plan.legato ? 1 : 0.85;
  const beats = new Set([
    0,
    plan.lengthBeats,
    ...plan.events.flatMap((event) => [event.beat, event.beat + event.durationBeats * gate]),
  ]);
  return [...beats].sort((a, b) => a - b).map((beat) => frameAtBeat(plan, beat));
}
/** Re-articulate only notes that began before a resume point and are still held. */
export function heldNotesAtBeat(plan: PlaybackPlan, beat: number): ScheduledNote[] {
  const gate = plan.legato ? 1 : 0.88;
  return plan.events.flatMap((event, index) => {
    const remaining = event.beat + event.durationBeats * gate - beat;
    return event.beat < beat && remaining > 0
      ? [
          {
            time: 0,
            notes: event.notes,
            duration: (remaining * 60) / plan.bpm,
            index,
            hand: event.hand,
            velocity: event.velocity,
          },
        ]
      : [];
  });
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
