import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudioService } from './service';
import { examplePlaybackPlan } from '../core/music/examples';
import { EXAMPLE_LIBRARY } from '../programs/scales-and-runs/examples';
import { defaultConfig, withHintMode, withVoiceEnabled } from '../core/practice/config';

interface PartRecord {
  values: unknown[];
  loop: boolean;
  loopEnd: number;
  offset: number;
  disposed: boolean;
  invoke: (time: number, index: number) => void;
}
const fake = vi.hoisted(() => ({
  now: 0,
  parts: [] as PartRecord[],
  draws: [] as (() => void)[],
  instruments: [] as { kind: string; attacks: unknown[][]; releases: number }[],
  pulses: [] as ((time: number) => void)[],
  sources: [] as { started: number; stopped: boolean }[],
  loaded: [] as string[],
  failVoice: false,
  transport: {
    bpm: { value: 120 },
    scheduleRepeat: vi.fn(),
    clear: vi.fn(),
    state: 'stopped',
    seconds: 0,
    start() {
      this.state = 'started';
    },
    stop() {
      this.state = 'stopped';
    },
    getSecondsAtTime(time: number) {
      return time;
    },
  },
}));
vi.mock('tone', () => {
  class Gain {
    gain = { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), rampTo: vi.fn() };
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
    dispose() {}
  }
  class Instrument {
    attacks: unknown[][] = [];
    releases = 0;
    loaded = true;
    constructor(readonly kind: string) {
      fake.instruments.push(this);
    }
    connect() {
      return this;
    }
    triggerAttackRelease(...args: unknown[]) {
      this.attacks.push(args);
    }
    releaseAll() {
      this.releases++;
    }
    triggerRelease() {}
    dispose() {}
  }
  return {
    ToneAudioBuffer: class {
      duration = 0.4;
      loaded = true;
      async load(path: string) {
        if (fake.failVoice) throw new Error('offline');
        fake.loaded.push(path);
        return this;
      }
      dispose() {}
    },
    ToneBufferSource: class {
      started = -1;
      stopped = false;
      onended?: () => void;
      constructor() {
        fake.sources.push(this);
      }
      connect() {
        return this;
      }
      start(time: number) {
        this.started = time;
      }
      stop() {
        this.stopped = true;
      }
      dispose() {}
    },
    Gain,
    Synth: class extends Instrument {
      constructor() {
        super('synth');
      }
    },
    PolySynth: class extends Instrument {
      constructor() {
        super('poly');
      }
    },
    Sampler: class extends Instrument {
      constructor() {
        super('sampler');
      }
    },
    Part: class<T> implements PartRecord {
      loop = false;
      loopEnd = 0;
      offset = 0;
      disposed = false;
      constructor(
        private callback: (time: number, event: T) => void,
        public values: T[],
      ) {
        fake.parts.push(this);
      }
      invoke(time: number, index: number) {
        this.callback(time, this.values[index]);
      }
      start(_time: number, offset = 0) {
        this.offset = offset;
        return this;
      }
      dispose() {
        this.disposed = true;
      }
    },
    start: () => Promise.resolve(),
    getContext: () => ({ state: 'running', on: vi.fn() }),
    getTransport: () => fake.transport,
    getDraw: () => ({
      schedule: (callback: () => void) => fake.draws.push(callback),
      cancel: () => {
        fake.draws.length = 0;
      },
    }),
    now: () => fake.now,
    immediate: () => fake.now,
    Frequency: (note: number) => ({ toNote: () => note }),
  };
});

let service: AudioService;
const plan = examplePlaybackPlan(EXAMPLE_LIBRARY[0]);
beforeEach(() => {
  fake.now = 0;
  fake.transport.seconds = 0;
  fake.transport.state = 'stopped';
  fake.parts.length = 0;
  fake.draws.length = 0;
  fake.instruments.length = 0;
  fake.pulses.length = 0;
  fake.sources.length = 0;
  fake.loaded.length = 0;
  fake.failVoice = false;
  fake.transport.scheduleRepeat.mockImplementation((callback: (time: number) => void) => {
    fake.pulses.push(callback);
    return fake.pulses.length;
  });
  service = new AudioService();
});
afterEach(() => service.dispose());

it('plays sustained chords and simultaneous melody with independent voices', async () => {
  await service.play(plan, false);
  const notes = fake.parts[0];
  notes.invoke(0.15, 0);
  notes.invoke(2.15, 1);
  const [right, left] = fake.instruments.filter((instrument) => instrument.kind === 'sampler');
  expect(left.attacks[0]).toEqual([[48, 52, 55], 4, 0.15, 0.48]);
  expect(right.attacks[0]).toEqual([[67], 0.5, 2.15, 0.75]);
  notes.invoke(4.15, 5);
  notes.invoke(4.15, 6);
  expect(left.attacks[1]).toEqual([[53, 57, 60], 4, 4.15, 0.48]);
  expect(right.attacks[1]).toEqual([[69], 2, 4.15, 0.86]);
});

it('resumes at the exact beat with held notes while retaining the whole loop', async () => {
  await service.play(plan, true);
  fake.transport.seconds = 3.4;
  service.pause();
  expect(service.snapshot().positionBeat).toBeCloseTo(3.25);
  expect(service.snapshot().status).toBe('paused');
  fake.now = 3.4;
  await service.play(plan, true, true);
  expect(fake.parts[2].loop).toBe(true);
  expect(fake.parts[2].loopEnd).toBe(8);
  expect(fake.parts[2].offset).toBeCloseTo(3.25);
  const [right, left] = fake.instruments.filter((instrument) => instrument.kind === 'sampler');
  expect(left.attacks.at(-1)?.[0]).toEqual([48, 52, 55]);
  expect(left.attacks.at(-1)?.[1]).toBeCloseTo(0.75);
  expect(right.attacks.at(-1)?.[0]).toEqual([72]);
  expect(right.attacks.at(-1)?.[1]).toBeCloseTo(0.25);
});

it('cancels both schedules and queued highlights on stop, and starts a different example at zero', async () => {
  await service.play(plan, false);
  fake.parts[1].invoke(2.15, 1);
  const queued = [...fake.draws];
  service.stop();
  queued.forEach((callback) => callback());
  expect(service.snapshot().notes).toEqual([]);
  expect(service.snapshot().leftNotes).toEqual([]);
  expect(service.snapshot().status).toBe('stopped');
  expect(fake.parts.every((part) => part.disposed)).toBe(true);
  await service.play(plan, false);
  fake.transport.seconds = 2.5;
  service.pause();
  await service.play(examplePlaybackPlan(EXAMPLE_LIBRARY[1]), false, true);
  expect(fake.parts.at(-2)?.offset).toBe(0);
  expect(service.snapshot().planId).toBe(examplePlaybackPlan(EXAMPLE_LIBRARY[1]).id);
});

it('rebuilds both schedules at a changed BPM without overlapping the previous playback', async () => {
  await service.play(plan, true);
  const old = [...fake.parts];
  service.restart(120, true);
  await Promise.resolve();
  await Promise.resolve();
  expect(old.every((part) => part.disposed)).toBe(true);
  expect(fake.parts.at(-2)?.loopEnd).toBe(4);
  expect(fake.parts.at(-1)?.loopEnd).toBe(4);
});

it('drives Practice from the transport, changes tempo live and invalidates old callbacks on stop', async () => {
  const pulse = vi.fn(),
    draw = vi.fn();
  const config = defaultConfig('chord');
  await service.beginPractice(60, config.channels, pulse);
  expect(fake.transport.scheduleRepeat).toHaveBeenCalledWith(expect.any(Function), '32t', 0);
  fake.pulses[0](0.15);
  expect(pulse).toHaveBeenCalledOnce();
  service.practiceTempo(137);
  expect(fake.transport.bpm.value).toBe(137);
  service.practiceNote(
    { channel: 'harmony', notes: [60, 64, 67], durationBeats: 2, velocity: 0.6 },
    1,
    120,
  );
  expect(
    fake.instruments.some((i) =>
      i.attacks.some((a) => JSON.stringify(a) === JSON.stringify([[60, 64, 67], 1, 1, 0.6])),
    ),
  ).toBe(true);
  service.practiceDraw(2, draw);
  const delayed = [...fake.draws];
  service.stopAll();
  fake.pulses[0](3);
  delayed.forEach((f) => f());
  expect(pulse).toHaveBeenCalledOnce();
  expect(draw).not.toHaveBeenCalled();
  expect(fake.transport.clear).toHaveBeenCalledWith(1);
  expect(fake.transport.state).toBe('stopped');
  await service.beginPractice(80, config.channels, pulse, true);
  expect(fake.transport.bpm.value).toBe(120);
  service.practiceTempo(100, true);
  expect(fake.transport.bpm.value).toBe(150);
});
it('plays local compound voice labels without overlap, cancels queued speech and reports missing files', async () => {
  const config = defaultConfig('degree');
  await service.beginPractice(200, config.channels, () => {});
  await service.prepareVoice('pl');
  await service.prepareVoice('pl');
  expect(fake.loaded).toHaveLength(9);
  expect(service.announce(1, 'pl', 3, -1)).toBe(true);
  expect(fake.sources.map((s) => s.started)).toEqual([1, 1.435]);
  expect(service.announce(1.3, 'pl', 4)).toBe(false);
  expect(fake.sources).toHaveLength(2);
  service.stopAll();
  expect(fake.sources.every((s) => s.stopped)).toBe(true);
  fake.failVoice = true;
  await expect(service.prepareVoice('en')).rejects.toThrow('Голос ещё не загружен');
});
it('auditions voice before Start and stops speech immediately when disabled', async () => {
  const config = withVoiceEnabled(defaultConfig('degree'), true);
  service.configurePracticeChannels(config.channels);
  expect(await service.previewVoice('en', 4)).toBe(true);
  expect(fake.sources).toHaveLength(1);
  expect(fake.sources[0].started).toBe(0);
  expect(fake.transport.state).toBe('stopped');
  service.configurePracticeChannels(withVoiceEnabled(config, false).channels);
  expect(fake.sources[0].stopped).toBe(true);
});
it('cancels voice previews still loading when voice is disabled or the screen is left', async () => {
  const config = withVoiceEnabled(defaultConfig('degree'), true);
  service.configurePracticeChannels(config.channels);
  const pending = service.previewVoice('pl', 2);
  service.configurePracticeChannels(withVoiceEnabled(config, false).channels);
  expect(await pending).toBe(false);
  service.configurePracticeChannels(config.channels);
  const leaving = service.previewVoice('pl', 3);
  service.stopAll();
  expect(await leaving).toBe(false);
  expect(fake.sources).toHaveLength(0);
});
it('auditions chord shapes without starting the clock and releases them on hint off', async () => {
  const config = withHintMode(defaultConfig('chord'), 'keyboard');
  const sound = {
    channel: 'harmony' as const,
    notes: [60, 64, 67],
    durationBeats: 4,
    velocity: 0.6,
  };
  service.configurePracticeChannels(config.channels);
  await service.previewPractice([sound], 60);
  const instrument = fake.instruments.find((item) => item.attacks.length > 0)!;
  expect(instrument.attacks[0][0]).toEqual([60, 64, 67]);
  expect(fake.transport.state).toBe('stopped');
  const releases = instrument.releases;
  service.configurePracticeChannels(withHintMode(config, 'hidden').channels);
  expect(instrument.releases).toBeGreaterThan(releases);
  service.configurePracticeChannels(config.channels);
  const pending = service.previewPractice([sound], 60);
  service.configurePracticeChannels(withHintMode(config, 'hidden').channels);
  await pending;
  expect(instrument.attacks).toHaveLength(1);
});
