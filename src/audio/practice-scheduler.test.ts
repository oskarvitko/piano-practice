import { expect, it } from 'vitest';
import { defaultConfig, withHintMode, withVoiceEnabled } from '../core/practice/config';
import { PracticeEngine } from '../core/practice/engine';
import { practiceLibrary } from '../features/practice/library';
import { metronomePulse, practiceSounds, voiceLead, voiceTask } from './practice-scheduler';
import { readFileSync, existsSync } from 'node:fs';

it('schedules independent simultaneous bass and harmony without duplicate attacks between pulses', () => {
  const config = defaultConfig('chord');
  const task = new PracticeEngine(config, practiceLibrary, [], 42).current;
  const initial = practiceSounds(task, config, 0);
  expect(initial.map((e) => e.channel)).toEqual(['bass', 'harmony']);
  expect(practiceSounds(task, config, 1 / 12)).toEqual([]);
  expect(practiceSounds(task, config, 1)).toEqual([]);
  for (const bpm of [30, 80, 200])
    expect((initial[0].durationBeats * 60) / bpm).toBeCloseTo((3.6 * 60) / bpm);
});
it('groups 6/8 in two pulses of three eighths, with one bar accent', () => {
  const config = { ...defaultConfig('degree'), meter: '6/8' as const };
  const clicks = Array.from({ length: 24 }, (_, i) => metronomePulse(config, i / 12)).filter(
    Boolean,
  );
  expect(clicks).toHaveLength(6);
  expect(clicks.filter((c) => c!.accent)).toHaveLength(1);
  expect(clicks.filter((c) => c!.strong)).toHaveLength(2);
});
it('does not reveal future degrees without explicit permission when preview is hidden', () => {
  const config = defaultConfig('degree');
  config.channels.voice.enabled = true;
  expect(voiceLead(config)).toBe(1);
  expect(voiceLead({ ...config, previewCount: 0 })).toBe(0);
  expect(voiceLead({ ...config, previewCount: 0, anticipatoryVoice: true })).toBe(1);
  expect(voiceLead({ ...config, voiceTiming: 'two-beats-before' })).toBe(2);
  expect(voiceLead({ ...config, voiceTiming: 'on-change' })).toBe(0);
});
it('bundles real PCM voice clips for both languages with short measured durations', () => {
  for (const lang of ['en', 'pl'])
    for (const word of ['1', '2', '3', '4', '5', '6', '7', 'flat', 'sharp']) {
      const path = `public/audio/voice/${lang}/${word}.wav`;
      expect(existsSync(path)).toBe(true);
      const wav = readFileSync(path);
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wav.length).toBeGreaterThan(4000);
      expect(wav.length).toBeLessThan(40000);
    }
});
it('announces two pulses ahead across one-pulse tasks, including during countdown', () => {
  const config = {
    ...defaultConfig('degree'),
    changeEvery: 'beat' as const,
    voiceTiming: 'two-beats-before' as const,
  };
  config.channels.voice.enabled = true;
  const { queue } = new PracticeEngine(config, practiceLibrary, [], 42).session;
  expect(voiceTask(config, queue, 0, -2)?.id).toBe(queue[0].id);
  expect(voiceTask(config, queue, 0, -1)?.id).toBe(queue[1].id);
  expect(voiceTask(config, queue, 0, 0)?.id).toBe(queue[2].id);
  expect(voiceTask(config, queue, 0, 1 / 12)).toBeUndefined();
  expect(voiceTask({ ...config, changeEvery: 'manual' }, queue, 0, 0)?.id).toBe(queue[0].id);
});
it('links the keyboard hint with musical channels and leaves voice/metronome independent', () => {
  const config = withVoiceEnabled(defaultConfig('chord'), true);
  config.channels.harmony.volume = 0;
  const on = withHintMode(config, 'keyboard');
  expect(on.channels.harmony).toEqual({ enabled: true, volume: 0.65 });
  const off = withHintMode(on, 'hidden');
  for (const channel of ['bass', 'harmony', 'melody'] as const) {
    expect(on.channels[channel].enabled).toBe(true);
    expect(off.channels[channel].enabled).toBe(false);
  }
  expect(off.channels.voice).toEqual(config.channels.voice);
  expect(off.channels.metronome).toEqual(config.channels.metronome);
  expect(config.hintMode).toBe('hidden');
});
it('enabling voice fixes conflicting off/zero-volume settings and announces current tasks without previews', () => {
  const config = defaultConfig('degree');
  config.voiceTiming = 'off';
  config.channels.voice.volume = 0;
  const on = withVoiceEnabled(config, true);
  expect(on.channels.voice).toEqual({ enabled: true, volume: 0.9 });
  expect(voiceLead(on)).toBe(0);
  const noPreview = { ...on, previewCount: 0 as const, voiceTiming: 'two-beats-before' as const };
  const { queue } = new PracticeEngine(noPreview, practiceLibrary, [], 42).session;
  expect(voiceTask(noPreview, queue, 0, -2)).toBeUndefined();
  expect(voiceTask(noPreview, queue, 0, 0)?.id).toBe(queue[0].id);
  expect(voiceTask(noPreview, queue, 1, 0)?.id).toBe(queue[1].id);
  expect(voiceLead(withVoiceEnabled(on, false))).toBeNull();
});
