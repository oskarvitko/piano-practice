import { audioService } from '../../audio/service';
import { metronomePulse, practiceSounds, voiceTask } from '../../audio/practice-scheduler';
import { db } from '../../database/db';
import { TrainerRepository } from '../../database/trainers';
import { PracticeEngine, hardIdentity } from '../../core/practice/engine';
import { configProblems } from '../../core/practice/harmony';
import { meterInfo } from '../../core/practice/config';
import type { Channel, PracticeConfig, TrainerSession } from '../../core/practice/types';
import { practiceLibrary } from './library';

export const trainerRepository = new TrainerRepository(db);
interface State {
  session: TrainerSession | null;
  loading: boolean;
  error: string | null;
  countdown: number;
  taskBeat: number;
  left: number[];
  right: number[];
  melody: number[];
  bass: number[];
}
class PracticeController {
  private engine?: PracticeEngine;
  private listeners = new Set<() => void>();
  private state: State = {
    session: null,
    loading: false,
    error: null,
    countdown: 0,
    taskBeat: 0,
    left: [],
    right: [],
    melody: [],
    bass: [],
  };
  private generation = 0;
  private tick = 0;
  private lastSave = 0;
  private held: { end: number; notes: number[]; hand: 'left' | 'right'; channel: Channel }[] = [];
  constructor() {
    audioService.onInterruption(() => {
      if (this.engine && ['playing', 'countdown'].includes(this.engine.session.phase))
        this.pause(false);
    });
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<State> = {}) {
    this.state = {
      ...this.state,
      ...patch,
      session: this.engine
        ? { ...this.engine.session, statistics: { ...this.engine.session.statistics } }
        : null,
    };
    this.listeners.forEach((fn) => fn());
  }
  private save() {
    if (this.engine)
      void trainerRepository
        .checkpoint(this.engine.snapshot())
        .catch(() =>
          this.update({ error: 'Не удалось сохранить тренировку. Проверь свободное место.' }),
        );
  }
  async prepare(config: PracticeConfig, existing?: TrainerSession) {
    this.pause();
    const problems = configProblems(config, practiceLibrary.progressions);
    if (problems.length) throw new Error(problems.join(' '));
    const hard = await trainerRepository.difficult();
    this.engine = new PracticeEngine(config, practiceLibrary, hard, Date.now(), existing);
    this.lastSave = this.engine.session.statistics.activeSeconds;
    await trainerRepository.saveConfig(config);
    this.update({
      error: null,
      taskBeat: 0,
      countdown: 0,
      left: [],
      right: [],
      melody: [],
      bass: [],
    });
    this.save();
  }
  async start(next = false) {
    if (!this.engine || this.state.loading) return;
    const token = ++this.generation;
    // This call must stay before the first await to unlock audio on iOS from the tap.
    const unlock = audioService.unlock();
    this.update({ loading: true, error: null });
    try {
      await unlock;
      if (this.engine.session.config.channels.voice.enabled)
        await audioService.prepareVoice(this.engine.session.config.voiceLanguage);
      if (token !== this.generation) return;
      if (next) this.engine.advance();
      this.held = [];
      this.tick = 0;
      // beginPractice stops prior audio before the new engine enters its countdown.
      await audioService.beginPractice(
        this.engine.session.config.bpm,
        this.engine.session.config.channels,
        (time) => this.pulse(time),
        this.engine.session.config.meter === '6/8',
      );
      if (token !== this.generation) return;
      this.engine.start();
      this.update({ loading: false, countdown: meterInfo(this.engine.session.config.meter).beats });
      this.save();
    } catch (error) {
      if (token === this.generation) {
        this.engine.pause();
        this.update({
          loading: false,
          error: error instanceof Error ? error.message : 'Не удалось запустить звук',
        });
      }
    }
  }
  private pulse(time: number) {
    const engine = this.engine;
    if (!engine) return;
    const previous = engine.current.id;
    const config = engine.session.config;
    const step = config.meter === '6/8' ? 1 / 18 : 1 / 12;
    const result = engine.pulse(step);
    if (result.completed) {
      audioService.practiceDraw(time, () => {
        this.update({ left: [], right: [], melody: [], bass: [] });
        audioService.stopAll();
        this.save();
      });
      return;
    }
    const counting = result.phase === 'countdown';
    const total = this.tick++ * step;
    const metro = metronomePulse(config, total);
    if (metro && (counting || config.channels.metronome.enabled))
      audioService.practiceClick(time, metro.accent, metro.strong);
    if (counting && this.tick === 1) {
      // Countdown is intentionally audible even with a muted practice metronome.
      audioService.configurePracticeChannels({
        ...config.channels,
        metronome: { ...config.channels.metronome, enabled: true },
      });
    }
    if (!counting) {
      if (result.changed) audioService.configurePracticeChannels(config.channels);
      if (previous !== engine.current.id || result.changed) this.held = [];
      for (const sound of practiceSounds(engine.current, config, result.taskBeat)) {
        if (config.channels[sound.channel].enabled)
          audioService.practiceNote(sound, time, config.bpm);
        this.held.push({
          end: total + sound.durationBeats,
          notes: sound.notes,
          hand: sound.hand ?? 'right',
          channel: sound.channel,
        });
      }
    }
    const announceTask = voiceTask(
      config,
      engine.session.queue,
      engine.session.index,
      result.taskBeat,
    );
    if (announceTask) {
      const label = announceTask.chord.degreeLabel;
      audioService.announce(
        time,
        config.voiceLanguage,
        announceTask.chord.degree,
        label.includes('♭') ? -1 : label.includes('♯') ? 1 : 0,
      );
    }
    this.held = this.held.filter((event) => event.end > total + 1e-5);
    if (this.tick % (config.meter === '6/8' ? 6 : 3) === 1 || result.changed || counting) {
      const visible = {
        session: { ...engine.session, statistics: { ...engine.session.statistics } },
        taskBeat: Math.max(0, result.taskBeat),
        countdown: result.countdown,
        left: this.held.filter((e) => e.hand === 'left').flatMap((e) => e.notes),
        right: this.held.filter((e) => e.hand === 'right').flatMap((e) => e.notes),
        melody: this.held.filter((e) => e.channel === 'melody').flatMap((e) => e.notes),
        bass: this.held.filter((e) => e.channel === 'bass').flatMap((e) => e.notes),
      };
      audioService.practiceDraw(time, () => {
        this.state = { ...this.state, ...visible };
        this.listeners.forEach((fn) => fn());
      });
    }
    if (engine.session.statistics.activeSeconds - this.lastSave >= 5) {
      this.lastSave = engine.session.statistics.activeSeconds;
      this.save();
    }
  }
  pause(stopAudio = true) {
    ++this.generation;
    this.engine?.pause();
    if (stopAudio) audioService.stopAll();
    this.update({ loading: false, left: [], right: [], melody: [], bass: [] });
    this.save();
  }
  hint() {
    this.pause();
    this.engine?.hint();
    this.update();
    this.save();
  }
  closeHint(next = false) {
    audioService.stopAll();
    this.engine?.closeHint(next);
    this.update();
    this.save();
  }
  hard() {
    if (!this.engine) return;
    this.engine.markHard();
    const item = this.engine.session.difficult.find(
      (d) => d.id === hardIdentity(this.engine!.current, this.engine!.session.config.style),
    )!;
    void trainerRepository
      .hard(item)
      .catch(() => this.update({ error: 'Не удалось сохранить сложное задание' }));
    this.update();
    this.save();
  }
  next() {
    const running = ['playing', 'countdown'].includes(this.engine?.session.phase ?? '');
    this.pause();
    this.engine?.advance();
    this.update({ taskBeat: 0 });
    this.save();
    if (running) void this.start();
  }
  bpm(value: number) {
    this.engine?.setBpm(value);
    if (this.engine) {
      audioService.practiceTempo(
        this.engine.session.config.bpm,
        this.engine.session.config.meter === '6/8',
      );
      void trainerRepository.saveConfig(this.engine.session.config).catch(() => {});
    }
    this.update();
    this.save();
  }
  config(config: PracticeConfig) {
    if (config.channels.voice.enabled)
      void audioService
        .prepareVoice(config.voiceLanguage)
        .catch((error) =>
          this.update({ error: error instanceof Error ? error.message : 'Голос недоступен' }),
        );
    this.engine?.setConfig(config);
    audioService.configurePracticeChannels(config.channels);
    void trainerRepository
      .saveConfig(config)
      .catch(() => this.update({ error: 'Не удалось сохранить настройки' }));
    this.update();
    this.save();
  }
  finish() {
    this.engine?.finish();
    audioService.stopAll();
    this.update({ left: [], right: [], melody: [], bass: [] });
    this.save();
  }
}
export const practiceController = new PracticeController();
