import * as Tone from 'tone';
import type { AudioPreferences, PlaybackPlan } from '../core/types';
import { defaultPreferences } from '../core/types';
import { CancellationToken, scheduleNotes, type ScheduledNote } from './scheduler';

export const PIANO_FILES = ['C2', 'Fs2', 'C3', 'Fs3', 'C4', 'Fs4', 'C5', 'Fs5', 'C6'] as const;
type AudioState = {
  status: 'stopped' | 'loading' | 'playing' | 'paused';
  notes: number[];
  index: number;
  metronome: boolean;
  beat: number;
  mode: 'piano' | 'synth';
  error: string | null;
};
class AudioService {
  private sampler?: Tone.Sampler;
  private synth?: Tone.PolySynth;
  private click?: Tone.Synth;
  private master?: Tone.Gain;
  private pianoGate?: Tone.Gain;
  private metroGate?: Tone.Gain;
  private part?: Tone.Part<ScheduledNote>;
  private metro?: Tone.Clock;
  private initialized = false;
  private operation = 0;
  private token = new CancellationToken();
  private metroToken = new CancellationToken();
  private prefs: AudioPreferences = { ...defaultPreferences.audio };
  private plan?: PlaybackPlan;
  private state: AudioState = {
    status: 'stopped',
    notes: [],
    index: 0,
    metronome: false,
    beat: 0,
    mode: 'synth',
    error: null,
  };
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private update(value: Partial<AudioState>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((fn) => fn());
  }
  async unlock() {
    // Tone.start() is called synchronously within the user's click, before any fetch/await.
    const unlock = Tone.start();
    await unlock;
    if (Tone.getContext().state !== 'running')
      throw new Error('Звук недоступен. Нажми Play ещё раз и проверь беззвучный режим.');
    if (!this.initialized) {
      this.initialized = true;
      this.master = new Tone.Gain(this.prefs.muted ? 0 : this.prefs.volume).toDestination();
      this.pianoGate = new Tone.Gain(0).connect(this.master);
      this.metroGate = new Tone.Gain(0).connect(this.master);
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.7, sustain: 0.15, release: 0.3 },
        volume: -12,
      }).connect(this.pianoGate);
      this.click = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 },
        volume: -12,
      }).connect(this.metroGate);
      this.sampler = new Tone.Sampler({
        urls: Object.fromEntries(
          PIANO_FILES.map((note) => [note.replace('s', '#'), `${note}.mp3`]),
        ),
        baseUrl: `${import.meta.env.BASE_URL}audio/piano/`,
        release: 0.45,
        onload: () => this.update({ mode: 'piano' }),
        onerror: () => this.update({ mode: 'synth' }),
      }).connect(this.pianoGate);
      Tone.getContext().on('statechange', () => {
        if (Tone.getContext().state !== 'running') this.stopAll();
      });
    }
  }
  configure(preferences: AudioPreferences) {
    this.prefs = preferences;
    this.master?.gain.rampTo(preferences.muted ? 0 : preferences.volume, 0.02);
  }
  private ensureTransport() {
    const transport = Tone.getTransport();
    if (transport.state !== 'started') transport.start();
    return transport;
  }
  private clearPart() {
    this.token.cancel();
    this.part?.dispose();
    this.part = undefined;
    this.sampler?.releaseAll(Tone.immediate());
    this.synth?.releaseAll(Tone.immediate());
    if (this.pianoGate) {
      this.pianoGate.gain.cancelScheduledValues(0);
      this.pianoGate.gain.setValueAtTime(0, Tone.immediate());
    }
  }
  async play(plan: PlaybackPlan, loop: boolean, resume = false) {
    const from = resume && this.state.status === 'paused' ? this.state.index : 0;
    this.clearPart();
    const op = ++this.operation;
    this.plan = plan;
    this.update({ status: 'loading', error: null, notes: [] });
    try {
      await this.unlock();
      if (op !== this.operation) return;
      const transport = this.ensureTransport();
      const schedule = scheduleNotes(plan);
      const transportStart = transport.seconds + 0.15;
      this.pianoGate!.gain.setValueAtTime(1, Tone.now() + 0.15);
      this.part = new Tone.Part<ScheduledNote>((time, event) => {
        if (event.index === -1) {
          Tone.getDraw().schedule(
            this.token.guard(() => this.stop()),
            time,
          );
          return;
        }
        const notes = event.notes.map((n) => Tone.Frequency(n, 'midi').toNote());
        const instrument = this.sampler?.loaded ? this.sampler : this.synth!;
        instrument.triggerAttackRelease(notes, event.duration * 0.88, time, 0.75);
        Tone.getDraw().schedule(
          this.token.guard(() => this.update({ notes: event.notes, index: event.index })),
          time,
        );
        Tone.getDraw().schedule(
          this.token.guard(() => this.update({ notes: [] })),
          time + event.duration * 0.85,
        );
      }, schedule.events);
      this.part.loop = loop;
      this.part.loopEnd = schedule.length;
      if (!loop) this.part.add({ time: schedule.length, notes: [], duration: 0, index: -1 });
      this.part.start(transportStart, ((plan.events[from]?.beat ?? 0) * 60) / plan.bpm);
      this.update({ status: 'playing', index: from });
    } catch (error) {
      if (op === this.operation) {
        this.clearPart();
        this.update({
          status: 'stopped',
          error: error instanceof Error ? error.message : 'Не удалось включить звук',
        });
      }
    }
  }
  pause() {
    ++this.operation;
    this.clearPart();
    this.update({ status: 'paused', notes: [] });
  }
  stop() {
    ++this.operation;
    this.clearPart();
    this.update({ status: 'stopped', notes: [], index: 0 });
  }
  restart(bpm: number, loop: boolean) {
    if (this.plan && this.state.status === 'playing') void this.play({ ...this.plan, bpm }, loop);
    else if (this.state.status === 'paused') this.stop();
  }
  async note(midi: number) {
    await this.play(
      { bpm: 80, events: [{ notes: [midi], beat: 0, durationBeats: 1 }], lengthBeats: 1 },
      false,
    );
  }
  async startMetronome() {
    const token = ++this.metroOperation;
    this.stopMetronome(false);
    try {
      await this.unlock();
      if (token !== this.metroOperation) return;
      const prefs = this.prefs;
      this.metroGate!.gain.setValueAtTime(1, Tone.now() + 0.12);
      let tick = 0;
      this.metro = new Tone.Clock(
        (time) => {
          const beat = Math.floor(tick / prefs.subdivision) % prefs.beatsPerBar;
          const accent = tick % (prefs.subdivision * prefs.beatsPerBar) === 0;
          this.click!.triggerAttackRelease(
            accent ? 1400 : tick % prefs.subdivision === 0 ? 1000 : 750,
            0.025,
            time,
            accent ? 0.85 : 0.45,
          );
          Tone.getDraw().schedule(
            this.metroToken.guard(() => this.update({ beat })),
            time,
          );
          tick++;
        },
        (prefs.bpm / 60) * prefs.subdivision,
      );
      this.metro.start(Tone.now() + 0.15);
      this.update({ metronome: true, beat: 0, error: null });
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : 'Метроном недоступен' });
    }
  }
  private metroOperation = 0;
  stopMetronome(invalidate = true) {
    if (invalidate) ++this.metroOperation;
    this.metroToken.cancel();
    this.metro?.dispose();
    this.metro = undefined;
    this.click?.triggerRelease(Tone.immediate());
    if (this.metroGate) {
      this.metroGate.gain.cancelScheduledValues(0);
      this.metroGate.gain.setValueAtTime(0, Tone.immediate());
    }
    this.update({ metronome: false, beat: 0 });
  }
  stopAll() {
    this.stop();
    this.stopMetronome();
    Tone.getTransport().stop();
    Tone.getDraw().cancel();
  }
  dispose() {
    this.stopAll();
    this.sampler?.dispose();
    this.synth?.dispose();
    this.click?.dispose();
    this.pianoGate?.dispose();
    this.metroGate?.dispose();
    this.master?.dispose();
    this.initialized = false;
  }
}
export const audioService = new AudioService();
