import type { AttemptStep } from '../../core/types';
export class PracticeTimer {
  private startedAt: number | null = null;
  private elapsed: number;
  private countdown: number;
  constructor(
    initial: AttemptStep = { elapsedSeconds: 0, timerSeconds: 0 },
    private now: () => number = () => performance.now(),
  ) {
    this.elapsed = initial.elapsedSeconds;
    this.countdown = initial.timerSeconds;
  }
  get running() {
    return this.startedAt !== null;
  }
  start() {
    if (this.startedAt === null) this.startedAt = this.now();
  }
  value(): AttemptStep {
    const delta = this.startedAt === null ? 0 : Math.max(0, (this.now() - this.startedAt) / 1000);
    return { elapsedSeconds: this.elapsed + delta, timerSeconds: this.countdown + delta };
  }
  pause() {
    const v = this.value();
    this.elapsed = v.elapsedSeconds;
    this.countdown = v.timerSeconds;
    this.startedAt = null;
    return v;
  }
  reset() {
    this.pause();
    this.countdown = 0;
    return this.value();
  }
}
