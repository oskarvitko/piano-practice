import type { Channel, PracticeConfig, PracticeTask } from '../core/practice/types';
import { meterInfo } from '../core/practice/config';

export interface PracticeSound {
  channel: Channel;
  notes: number[];
  durationBeats: number;
  velocity: number;
  hand?: 'left' | 'right';
}
export function practiceSounds(
  task: PracticeTask,
  config: PracticeConfig,
  beat: number,
): PracticeSound[] {
  const events: PracticeSound[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;
  if (task.trainer === 'scale') {
    for (const event of task.plan?.events ?? [])
      if (near(event.beat, beat))
        events.push({
          channel: 'melody',
          notes: event.notes,
          durationBeats: event.durationBeats * 0.9,
          velocity: event.velocity ?? 0.7,
          hand: event.hand,
        });
    return events;
  }
  const example = task.trainer === 'fill' ? task.examples[0] : null;
  if (example) {
    for (const event of example.events)
      if (near(event.startBeat, beat)) {
        if (event.hand === 'right')
          events.push({
            channel: 'melody',
            notes: event.notes,
            durationBeats: event.durationBeats,
            velocity: 0.75,
            hand: 'right',
          });
        else {
          const target = event.startBeat >= 4;
          const chord = target ? task.nextVoicing : task.voicing;
          events.push({
            channel: 'bass',
            notes: [chord.leftHand[0]],
            durationBeats: event.durationBeats * 0.95,
            velocity: 0.65,
            hand: 'left',
          });
          events.push({
            channel: 'harmony',
            notes: [...chord.leftHand.slice(1), ...chord.rightHand],
            durationBeats: event.durationBeats * 0.95,
            velocity: 0.55,
            hand: 'right',
          });
        }
      }
  } else if (
    near(beat, 0) ||
    (config.changeEvery === 'manual' && near(beat % meterInfo(config.meter).beats, 0))
  ) {
    const duration =
      config.changeEvery === 'manual' ? meterInfo(config.meter).beats : task.durationBeats;
    events.push({
      channel: 'bass',
      notes: [task.voicing.leftHand[0]],
      durationBeats: duration * 0.9,
      velocity: 0.65,
      hand: 'left',
    });
    if (!(config.trainer === 'degree' && config.degreeTask === 'bass'))
      events.push({
        channel: 'harmony',
        notes: [...task.voicing.leftHand.slice(1), ...task.voicing.rightHand],
        durationBeats: duration * 0.9,
        velocity: 0.55,
        hand: 'right',
      });
  }
  if (
    config.style === 'blues' &&
    task.trainer !== 'fill' &&
    (near(beat % 1, 0) || near(beat % 1, 2 / 3))
  ) {
    if (!events.some((e) => e.channel === 'bass'))
      events.push({
        channel: 'bass',
        notes: [task.chord.bass + (Math.floor(beat) % 2 ? 7 : 0)],
        durationBeats: 0.28,
        velocity: 0.5,
        hand: 'left',
      });
  }
  return events;
}
export function voiceLead(config: PracticeConfig) {
  if (!config.channels.voice.enabled || config.voiceTiming === 'off') return null;
  if (config.previewCount === 0 && !config.anticipatoryVoice && config.voiceTiming !== 'on-change')
    return null;
  return config.voiceTiming === 'two-beats-before'
    ? 2
    : config.voiceTiming === 'one-beat-before'
      ? 1
      : 0;
}
export function metronomePulse(config: PracticeConfig, totalBeat: number) {
  const { beats, subbeats } = meterInfo(config.meter);
  const rounded = Math.round(totalBeat * subbeats);
  if (Math.abs(totalBeat * subbeats - rounded) > 1e-5) return null;
  return { accent: Math.abs(totalBeat % beats) < 1e-5, strong: Math.abs(totalBeat % 1) < 1e-5 };
}

/** Find an upcoming onset even when the lead spans more than one short task. */
export function voiceTask(
  config: PracticeConfig,
  queue: PracticeTask[],
  index: number,
  beat: number,
) {
  const lead = voiceLead(config);
  if (lead === null) return undefined;
  let onset = -beat;
  for (let i = index; i < queue.length; i++) {
    if (Math.abs(onset - lead) < 1e-5) return queue[i];
    if (onset > lead || config.changeEvery === 'manual') break;
    onset += queue[i].durationBeats;
  }
  return undefined;
}
