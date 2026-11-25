import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudioService } from './service';
import { examplePlaybackPlan } from '../core/music/examples';
import { EXAMPLE_LIBRARY } from '../programs/scales-and-runs/examples';

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
  transport: {
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
