import { emptyStatistics, keyName, meterInfo } from './config';
import { connectTasks, generateTasks, type PracticeLibrary } from './generator';
import type { DifficultTask, PracticeConfig, TrainerSession, PracticeTask } from './types';

export function hardIdentity(task: PracticeTask, style = '') {
  return `${style}-${task.key.pc}-${task.key.mode}-${task.chord.symbol}-${task.voicing.kind}-${task.previousChord?.symbol ?? ''}-${task.nextChord.symbol}-${task.fillKind ?? ''}`;
}
export class PracticeEngine {
  session: TrainerSession;
  private taskElapsed = 0;
  private countdown = 0;
  private presented = false;
  constructor(
    config: PracticeConfig,
    private library: PracticeLibrary,
    private hard: DifficultTask[] = [],
    seed = Date.now(),
    existing?: TrainerSession,
  ) {
    this.session = existing
      ? structuredClone(existing)
      : {
          id: `practice-${Date.now()}-${(seed >>> 0).toString(36)}`,
          config: structuredClone(config),
          startedAt: Date.now(),
          updatedAt: Date.now(),
          phase: 'ready',
          statistics: emptyStatistics(),
          difficult: [],
          queue: [],
          index: 0,
          generator: { seed: seed >>> 0, phrase: 0, keyIndex: 0 },
          beat: 0,
        };
    if (existing && existing.phase !== 'completed') this.session.phase = 'paused';
    this.ensureQueue();
  }
  get current() {
    return this.session.queue[this.session.index];
  }
  get next() {
    return this.session.queue[this.session.index + 1];
  }
  private ensureQueue() {
    while (this.session.queue.length - this.session.index < 6) {
      const result = generateTasks(
        this.session.config,
        this.library,
        this.session.generator,
        this.hard,
      );
      const last = this.session.queue.length - 1;
      if (last >= 0) result.tasks[0].previousChord = this.session.queue[last].chord;
      if (last >= 0)
        this.session.queue[last] = connectTasks(
          this.session.queue[last],
          result.tasks[0],
          this.session.config,
        );
      this.session.queue.push(...result.tasks);
      this.session.generator = result.state;
    }
  }
  start() {
    if (this.session.phase === 'completed') return;
    this.session.phase = 'countdown';
    this.countdown = meterInfo(this.session.config.meter).beats;
    this.taskElapsed = 0;
    this.session.beat = 0;
    this.presented = false;
  }
  pause() {
    if (['playing', 'countdown'].includes(this.session.phase)) this.session.phase = 'paused';
  }
  hint() {
    this.pause();
    this.session.phase = 'hint';
    this.session.statistics.hints++;
  }
  closeHint(next = false) {
    if (next) this.advance();
    this.session.phase = 'paused';
  }
  finish() {
    this.session.phase = 'completed';
    this.session.completedAt = Date.now();
    this.session.updatedAt = Date.now();
  }
  setBpm(bpm: number) {
    this.session.config.bpm = Math.min(200, Math.max(30, Math.round(bpm)));
  }
  setConfig(config: PracticeConfig) {
    this.session.config = structuredClone(config);
  }
  markHard(now = Date.now()) {
    const t = this.current;
    const id = hardIdentity(t, this.session.config.style);
    const known = this.session.difficult.find((d) => d.id === id);
    if (known) {
      known.count++;
      known.lastAt = now;
    } else
      this.session.difficult.push({
        id,
        key: t.key,
        degree: t.chord.degree,
        chordType: t.chord.type,
        chord: t.chord.symbol,
        voicing: t.voicing.kind,
        previousChord: t.previousChord?.symbol,
        nextChord: t.nextChord.symbol,
        nextType: t.nextChord.type,
        fillKind: t.fillKind,
        bpm: this.session.config.bpm,
        style: this.session.config.style,
        phraseId: t.phraseId,
        count: 1,
        lastAt: now,
      });
    this.session.statistics.hard++;
    this.hard = [
      ...this.hard.filter((d) => d.id !== id),
      { ...this.session.difficult.find((d) => d.id === id)! },
    ];
  }
  private present() {
    if (this.presented) return;
    this.presented = true;
    const stats = this.session.statistics;
    stats.tasks++;
    if (this.current.trainer !== 'scale') {
      stats.chords++;
      if (stats.chords > 1) stats.transitions++;
    }
    const key = keyName(this.current.key);
    if (!stats.keys.includes(key)) stats.keys.push(key);
    if (this.current.trainer !== 'scale' && !stats.chordTypes.includes(this.current.chord.type))
      stats.chordTypes.push(this.current.chord.type);
  }
  advance() {
    this.session.index++;
    this.taskElapsed = 0;
    this.presented = false;
    if (this.session.index > 16) {
      this.session.queue = this.session.queue.slice(this.session.index - 1);
      this.session.index = 1;
    }
    this.ensureQueue();
  }
  /** One audio-clock subdivision, called before scheduling that subdivision. */
  pulse(step = 1 / 12) {
    const s = this.session;
    let changed = false;
    if (s.phase === 'countdown') {
      const left = this.countdown;
      this.countdown = Math.max(0, this.countdown - step);
      if (left <= 1e-7) {
        s.phase = 'playing';
        this.taskElapsed = 0;
        s.beat = 0;
        changed = true;
        this.present();
      } else
        return {
          phase: s.phase,
          countdown: Math.ceil(left),
          taskBeat: -left,
          changed: false,
          completed: false,
        };
    }
    if (s.phase !== 'playing')
      return {
        phase: s.phase,
        countdown: 0,
        taskBeat: this.taskElapsed,
        changed: false,
        completed: s.phase === 'completed',
      };
    if (
      this.taskElapsed >= this.current.durationBeats - 1e-7 &&
      s.config.changeEvery !== 'manual'
    ) {
      this.advance();
      changed = true;
    }
    this.present();
    const taskBeat = this.taskElapsed;
    s.beat += step;
    this.taskElapsed += step;
    const seconds = (step * 60) / s.config.bpm;
    const remaining =
      s.config.durationMinutes === null
        ? Infinity
        : s.config.durationMinutes * 60 - s.statistics.activeSeconds;
    const delta = Math.max(0, Math.min(seconds, remaining));
    s.statistics.activeSeconds += delta;
    s.statistics.bpmSeconds += delta * s.config.bpm;
    s.updatedAt = Date.now();
    if (remaining <= (step * 60) / s.config.bpm + 1e-7) this.finish();
    return {
      phase: s.phase,
      countdown: 0,
      taskBeat,
      changed,
      completed: remaining <= (step * 60) / s.config.bpm + 1e-7,
    };
  }
  snapshot() {
    return structuredClone(this.session);
  }
}
export function aggregateSessions(sessions: TrainerSession[], from = 0) {
  const chosen = sessions.filter((s) => s.startedAt >= from && s.phase === 'completed');
  const stats = emptyStatistics();
  for (const s of chosen) {
    for (const key of [
      'activeSeconds',
      'bpmSeconds',
      'tasks',
      'chords',
      'transitions',
      'hints',
      'hard',
    ] as const)
      stats[key] += s.statistics[key];
    stats.keys = [...new Set([...stats.keys, ...s.statistics.keys])];
    stats.chordTypes = [...new Set([...stats.chordTypes, ...s.statistics.chordTypes])];
  }
  return {
    ...stats,
    sessions: chosen.length,
    averageBpm: stats.activeSeconds ? stats.bpmSeconds / stats.activeSeconds : 0,
  };
}
