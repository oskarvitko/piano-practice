import * as Tone from 'tone';
import type { AudioPreferences, PlaybackPlan } from '../core/types';
import { defaultPreferences } from '../core/types';
import {
  CancellationToken,
  frameAtBeat,
  heldNotesAtBeat,
  playbackFrames,
  scheduleNotes,
  type PlaybackFrame,
  type ScheduledNote,
} from './scheduler';
import { startPlaybackContext } from './playback-context';
import type { Channel, Channels } from '../core/practice/types';
import type { PracticeSound } from './practice-scheduler';

export const PIANO_FILES = ['C2', 'Fs2', 'C3', 'Fs3', 'C4', 'Fs4', 'C5', 'Fs5', 'C6'] as const;
type AudioState = {
  status: 'stopped' | 'loading' | 'playing' | 'paused';
  notes: number[];
  index: number;
  positionBeat: number;
  planId: string | null;
  leftNotes: number[];
  rightNotes: number[];
  eventIndexes: number[];
  metronome: boolean;
  beat: number;
  mode: 'piano' | 'synth';
  error: string | null;
};
export class AudioService {
  private practiceRepeat?: number;
  private practiceClickSynth?: Tone.Synth;
  private practiceBuses?: Record<Channel, Tone.Gain>;
  private practiceVoices: Partial<
    Record<Channel, { sampler: Tone.Sampler; synth: Tone.PolySynth }>
  > = {};
  private voiceBuffers = new Map<string, Tone.ToneAudioBuffer>();
  private speechSources = new Set<Tone.ToneBufferSource>();
  private voiceBusyUntil = 0;
  private practiceGeneration = 0;
  private interruptions = new Set<() => void>();
  onInterruption(fn: () => void) {
    this.interruptions.add(fn);
    return () => {
      this.interruptions.delete(fn);
    };
  }
  private sampler?: Tone.Sampler;
  private synth?: Tone.PolySynth;
  private leftSampler?: Tone.Sampler;
  private leftSynth?: Tone.PolySynth;
  private click?: Tone.Synth;
  private master?: Tone.Gain;
  private pianoGate?: Tone.Gain;
  private metroGate?: Tone.Gain;
  private part?: Tone.Part<ScheduledNote>;
  private visualPart?: Tone.Part<PlaybackFrame & { time: number }>;
  private startedAt = 0;
  private offsetBeat = 0;
  private looping = false;
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
    positionBeat: 0,
    planId: null,
    leftNotes: [],
    rightNotes: [],
    eventIndexes: [],
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
    if (typeof window !== 'undefined' && typeof window.AudioContext !== 'function')
      throw new Error(
        'Этот браузер не поддерживает Web Audio. Открой приложение в Safari, Chrome или Edge.',
      );
    // Tone.start() is called synchronously within the user's click, before any fetch/await.
    const unlock = startPlaybackContext(() => Tone.start());
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
    this.visualPart?.dispose();
    this.visualPart = undefined;
    this.sampler?.releaseAll(Tone.immediate());
    this.synth?.releaseAll(Tone.immediate());
    this.leftSampler?.releaseAll(Tone.immediate());
    this.leftSynth?.releaseAll(Tone.immediate());
    if (this.pianoGate) {
      this.pianoGate.gain.cancelScheduledValues(0);
      this.pianoGate.gain.setValueAtTime(0, Tone.immediate());
    }
  }
  private ensureLeftHand() {
    if (this.leftSynth) return;
    this.leftSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.7, sustain: 0.15, release: 0.3 },
      volume: -12,
    }).connect(this.pianoGate!);
    // Independent voices prevent a melody release from cutting off the same pitch in a chord.
    this.leftSampler = new Tone.Sampler({
      urls: Object.fromEntries(PIANO_FILES.map((note) => [note.replace('s', '#'), `${note}.mp3`])),
      baseUrl: `${import.meta.env.BASE_URL}audio/piano/`,
      release: 0.45,
      onerror: () => {},
    }).connect(this.pianoGate!);
  }
  private trigger(event: ScheduledNote, time: number, duration = event.duration) {
    const sampler = event.hand === 'left' ? this.leftSampler : this.sampler;
    const synth = event.hand === 'left' ? this.leftSynth : this.synth;
    const instrument = sampler?.loaded ? sampler : synth!;
    instrument.triggerAttackRelease(
      event.notes.map((note) => Tone.Frequency(note, 'midi').toNote()),
      duration,
      time,
      event.velocity ?? 0.75,
    );
  }
  private position() {
    if (!this.plan || this.state.status !== 'playing') return this.state.positionBeat;
    const beat =
      (Math.max(0, Tone.getTransport().seconds - this.startedAt) * this.plan.bpm) / 60 +
      this.offsetBeat;
    return this.looping ? beat % this.plan.lengthBeats : Math.min(beat, this.plan.lengthBeats);
  }
  private showFrame(frame: PlaybackFrame) {
    this.update({
      positionBeat: frame.beat,
      index: frame.index,
      notes: frame.notes,
      leftNotes: frame.leftNotes,
      rightNotes: frame.rightNotes,
      eventIndexes: frame.eventIndexes,
    });
  }
  async play(plan: PlaybackPlan, loop: boolean, resume = false) {
    const from =
      resume && this.state.status === 'paused' && this.state.planId === (plan.id ?? null)
        ? this.state.positionBeat
        : 0;
    this.clearPart();
    const op = ++this.operation;
    this.plan = plan;
    this.update({
      status: 'loading',
      error: null,
      notes: [],
      leftNotes: [],
      rightNotes: [],
      eventIndexes: [],
      planId: plan.id ?? null,
      positionBeat: from,
    });
    try {
      await this.unlock();
      if (op !== this.operation) return;
      if (plan.events.some((event) => event.hand === 'left')) this.ensureLeftHand();
      const transport = this.ensureTransport();
      const schedule = scheduleNotes(plan);
      const audioStart = Tone.now() + 0.15;
      const transportStart = transport.getSecondsAtTime(audioStart);
      this.startedAt = transportStart;
      this.offsetBeat = from;
      this.looping = loop;
      this.pianoGate!.gain.setValueAtTime(1, audioStart);
      this.part = new Tone.Part<ScheduledNote>((time, event) => {
        this.trigger(event, time, event.duration * (plan.legato ? 1 : 0.88));
      }, schedule.events);
      this.part.loop = loop;
      this.part.loopEnd = schedule.length;
      const frames = playbackFrames(plan).filter((frame) => !loop || frame.beat < plan.lengthBeats);
      this.visualPart = new Tone.Part<PlaybackFrame & { time: number }>(
        (time, frame) => {
          Tone.getDraw().schedule(
            this.token.guard(() => {
              if (!loop && frame.beat >= plan.lengthBeats) this.stop();
              else this.showFrame(frame);
            }),
            time,
          );
        },
        frames.map((frame) => ({ ...frame, time: (frame.beat * 60) / plan.bpm })),
      );
      this.visualPart.loop = loop;
      this.visualPart.loopEnd = schedule.length;
      this.part.start(transportStart, (from * 60) / plan.bpm);
      this.visualPart.start(transportStart, (from * 60) / plan.bpm);
      for (const held of heldNotesAtBeat(plan, from)) this.trigger(held, audioStart);
      Tone.getDraw().schedule(
        this.token.guard(() => this.showFrame(frameAtBeat(plan, from))),
        audioStart,
      );
      this.update({ status: 'playing' });
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
    const positionBeat = this.position();
    ++this.operation;
    this.clearPart();
    this.update({
      status: 'paused',
      notes: [],
      leftNotes: [],
      rightNotes: [],
      eventIndexes: [],
      positionBeat,
    });
  }
  stop() {
    ++this.operation;
    this.clearPart();
    this.update({
      status: 'stopped',
      notes: [],
      leftNotes: [],
      rightNotes: [],
      eventIndexes: [],
      index: 0,
      positionBeat: 0,
    });
  }
  restart(bpm: number, loop: boolean) {
    if (this.plan && this.state.status === 'playing') void this.play({ ...this.plan, bpm }, loop);
    else if (this.state.status === 'paused') this.stop();
  }
  async note(midi: number) {
    await this.play(
      {
        id: `note-${midi}`,
        bpm: 80,
        events: [{ notes: [midi], beat: 0, durationBeats: 1 }],
        lengthBeats: 1,
      },
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
    const wasPractice = this.practiceRepeat !== undefined;
    this.stopPractice();
    this.stop();
    this.stopMetronome();
    if (this.initialized) {
      Tone.getTransport().stop();
      Tone.getDraw().cancel();
    }
    if (wasPractice) this.interruptions.forEach((fn) => fn());
  }
  private ensurePracticeBuses() {
    if (this.practiceBuses) return;
    this.practiceBuses = Object.fromEntries(
      ['metronome', 'bass', 'harmony', 'melody', 'voice'].map((channel) => [
        channel,
        new Tone.Gain(0).connect(this.master!),
      ]),
    ) as Record<Channel, Tone.Gain>;
    this.practiceClickSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 },
      volume: -14,
    }).connect(this.practiceBuses.metronome);
    for (const channel of ['bass', 'harmony', 'melody'] as const) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.15 },
        volume: -12,
      }).connect(this.practiceBuses[channel]);
      const sampler = new Tone.Sampler({
        urls: Object.fromEntries(
          PIANO_FILES.map((note) => [note.replace('s', '#'), `${note}.mp3`]),
        ),
        baseUrl: `${import.meta.env.BASE_URL}audio/piano/`,
        release: 0.25,
        onerror: () => {},
      }).connect(this.practiceBuses[channel]);
      this.practiceVoices[channel] = { sampler, synth };
    }
  }
  async prepareVoice(language: 'en' | 'pl') {
    const errors: string[] = [];
    await Promise.all(
      ['1', '2', '3', '4', '5', '6', '7', 'flat', 'sharp'].map(async (word) => {
        const key = `${language}/${word}`;
        if (this.voiceBuffers.has(key)) return;
        try {
          const buffer = new Tone.ToneAudioBuffer();
          await buffer.load(`${import.meta.env.BASE_URL}audio/voice/${key}.wav`);
          this.voiceBuffers.set(key, buffer);
        } catch {
          errors.push(word);
        }
      }),
    );
    if (errors.length)
      throw new Error(
        'Голос ещё не загружен. Подключись к интернету и загрузи офлайн-ресурсы в настройках.',
      );
  }
  async beginPractice(
    bpm: number,
    channels: Channels,
    pulse: (time: number) => void,
    compound = false,
  ) {
    this.stopAll();
    const generation = ++this.practiceGeneration;
    await this.unlock();
    if (generation !== this.practiceGeneration) return;
    this.ensurePracticeBuses();
    this.configurePracticeChannels(channels);
    const transport = Tone.getTransport();
    transport.bpm.value = bpm * (compound ? 1.5 : 1);
    this.practiceRepeat = transport.scheduleRepeat(
      (time) => {
        if (generation === this.practiceGeneration) pulse(time);
      },
      '32t',
      0,
    );
    transport.start(Tone.now() + 0.15);
    this.update({ status: 'playing', planId: 'practice-stream', error: null });
  }
  configurePracticeChannels(channels: Channels) {
    for (const channel of Object.keys(channels) as Channel[])
      this.practiceBuses?.[channel].gain.rampTo(
        channels[channel].enabled ? channels[channel].volume : 0,
        0.015,
      );
    // Learning's global mute does not silently disable independent Practice channels.
    this.master?.gain.rampTo(0.85, 0.015);
  }
  practiceTempo(bpm: number, compound = false) {
    if (this.initialized) Tone.getTransport().bpm.value = bpm * (compound ? 1.5 : 1);
  }
  practiceNote(sound: PracticeSound, time: number, bpm: number) {
    const voice = this.practiceVoices[sound.channel];
    if (!voice) return;
    const instrument = voice.sampler.loaded ? voice.sampler : voice.synth;
    instrument.triggerAttackRelease(
      sound.notes.map((note) => Tone.Frequency(note, 'midi').toNote()),
      (sound.durationBeats * 60) / bpm,
      time,
      sound.velocity,
    );
  }
  practiceClick(time: number, accent: boolean, strong: boolean) {
    this.practiceClickSynth?.triggerAttackRelease(
      accent ? 1400 : strong ? 1000 : 750,
      0.025,
      time,
      accent ? 0.85 : 0.55,
    );
  }
  practiceDraw(time: number, fn: () => void) {
    const generation = this.practiceGeneration;
    Tone.getDraw().schedule(() => {
      if (generation === this.practiceGeneration) fn();
    }, time);
  }
  announce(time: number, language: 'en' | 'pl', degree: number, accidental = 0) {
    if (!this.practiceBuses || time < this.voiceBusyUntil - 0.001) return false;
    const words = [...(accidental ? [accidental < 0 ? 'flat' : 'sharp'] : []), String(degree)];
    const buffers = words.map((word) => this.voiceBuffers.get(`${language}/${word}`));
    if (buffers.some((buffer) => !buffer?.loaded)) return false;
    let cursor = time;
    for (const buffer of buffers) {
      const source = new Tone.ToneBufferSource(buffer!).connect(this.practiceBuses.voice);
      this.speechSources.add(source);
      source.onended = () => {
        this.speechSources.delete(source);
        source.dispose();
      };
      source.start(cursor);
      cursor += buffer!.duration + 0.035;
    }
    this.voiceBusyUntil = cursor;
    return true;
  }
  stopPractice() {
    ++this.practiceGeneration;
    if (this.practiceRepeat !== undefined) Tone.getTransport().clear(this.practiceRepeat);
    this.practiceRepeat = undefined;
    this.voiceBusyUntil = 0;
    this.practiceClickSynth?.triggerRelease(Tone.immediate());
    for (const voices of Object.values(this.practiceVoices)) {
      voices.sampler.releaseAll(Tone.immediate());
      voices.synth.releaseAll(Tone.immediate());
    }
    for (const source of this.speechSources) {
      source.stop(Tone.immediate());
      source.dispose();
    }
    this.speechSources.clear();
    for (const bus of Object.values(this.practiceBuses ?? {})) {
      bus.gain.cancelScheduledValues(0);
      bus.gain.setValueAtTime(0, Tone.immediate());
    }
  }
  dispose() {
    this.stopAll();
    this.sampler?.dispose();
    this.synth?.dispose();
    this.leftSampler?.dispose();
    this.leftSynth?.dispose();
    this.leftSampler = undefined;
    this.leftSynth = undefined;
    this.click?.dispose();
    this.pianoGate?.dispose();
    this.metroGate?.dispose();
    this.master?.dispose();
    this.initialized = false;
    for (const voices of Object.values(this.practiceVoices)) {
      voices.sampler.dispose();
      voices.synth.dispose();
    }
    for (const bus of Object.values(this.practiceBuses ?? {})) bus.dispose();
    for (const buffer of this.voiceBuffers.values()) buffer.dispose();
    this.practiceBuses = undefined;
    this.practiceClickSynth?.dispose();
    this.practiceClickSynth = undefined;
    this.practiceVoices = {};
    this.voiceBuffers.clear();
  }
}
export const audioService = new AudioService();
