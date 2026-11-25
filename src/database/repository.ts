import type {
  AttemptStep,
  Lesson,
  PracticeSession,
  Preferences,
  Program,
  ReviewItem,
  Step,
} from '../core/types';
import { defaultPreferences } from '../core/types';
import {
  allLessons,
  attemptSteps,
  canCompleteLesson,
  getNextLesson,
  goToStep,
  nextStep,
} from '../core/lesson-engine';
import { dueReviews, learnItem, reviewItem, reviewKey } from '../core/review-engine';
import { PracticeDB } from './db';

export class PracticeRepository {
  constructor(
    readonly db: PracticeDB,
    readonly programs: readonly Program[],
    private now: () => number = Date.now,
  ) {}
  async preferences(): Promise<Preferences> {
    const saved = (await this.db.settings.get('preferences'))?.value as
      Partial<Preferences> | undefined;
    return {
      ...defaultPreferences,
      ...saved,
      audio: { ...defaultPreferences.audio, ...saved?.audio },
      keyboard: { ...defaultPreferences.keyboard, ...saved?.keyboard },
    };
  }
  async savePreferences(value: Preferences) {
    await this.db.settings.put({ key: 'preferences', value });
  }
  async snapshot() {
    const [preferences, programProgress, lessonProgress, sessions, reviews] = await Promise.all([
      this.preferences(),
      this.db.programProgress.toArray(),
      this.db.lessonProgress.toArray(),
      this.db.practiceSessions.toArray(),
      this.db.reviewItems.toArray(),
    ]);
    return { preferences, programProgress, lessonProgress, sessions, reviews };
  }
  definitions(programId: string, lessonId: string) {
    const program = this.programs.find((p) => p.id === programId);
    const lesson = program && allLessons(program).find((l) => l.id === lessonId);
    if (!program || !lesson) throw new Error('Программа или урок не найдены');
    return { program, lesson };
  }
  private frozenReview(program: Program, lesson: Lesson, items: ReviewItem[]): Step | undefined {
    const slot = lesson.steps.find((step) => step.reviewSlot);
    if (!slot) return undefined;
    const catalog = new Map(
      allLessons(program).flatMap((l) =>
        l.steps.flatMap((s) => s.exercises.map((e) => [e.id, e] as const)),
      ),
    );
    const due = dueReviews(
      items.filter((i) => catalog.has(i.exerciseId)),
      this.now(),
    );
    if (!due.length) return undefined;
    return {
      id: slot.id,
      title: 'Повторение по памяти',
      durationSeconds: Math.min(600, slot.durationSeconds),
      reviewSlot: true,
      instructions: [
        `Сегодня ${due.length} задания на повторение. Раздели 10 минут поровну. Сначала сыграй по памяти, затем проверь себя.`,
        `Для каждого задания выбери «Получилось» или «Ещё повторить». Неудача вернёт материал в следующее занятие.`,
      ],
      exercises: due.map((i) => catalog.get(i.exerciseId)!),
      reviewKeys: due.map((i) => i.key),
    };
  }
  async startLesson(
    programId: string,
    lessonId: string,
    options: { newAttempt?: boolean; reviewOnly?: boolean } = {},
  ): Promise<PracticeSession> {
    const { program, lesson } = this.definitions(programId, lessonId);
    return this.db.transaction('rw', this.db.tables, async () => {
      const completed = (
        await this.db.lessonProgress.where('programId').equals(programId).toArray()
      )
        .filter((l) => l.status === 'completed')
        .map((l) => l.lessonId);
      const recommended = getNextLesson(program, completed);
      if (!options.reviewOnly && !completed.includes(lessonId) && recommended?.id !== lessonId)
        throw new Error('Этот урок пока доступен для просмотра. Продолжи текущий урок.');
      if (options.reviewOnly && recommended)
        throw new Error('Режим повторения доступен после завершения курса');
      const preferences = await this.preferences();
      await this.savePreferences({ ...preferences, activeProgramId: programId });
      if (!options.newAttempt) {
        const existing = (
          await this.db.practiceSessions
            .where('[programId+lessonId]')
            .equals([programId, lessonId])
            .toArray()
        )
          .filter(
            (s) => s.status === 'active' && Boolean(s.reviewOnly) === Boolean(options.reviewOnly),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (existing) return existing;
      }
      const now = this.now();
      const id = crypto.randomUUID();
      const frozenReviewStep = this.frozenReview(
        program,
        lesson,
        await this.db.reviewItems.where('programId').equals(programId).toArray(),
      );
      if (options.reviewOnly && !frozenReviewStep)
        throw new Error('На сегодня повторений нет. Следующая проверка появится в плане.');
      const session: PracticeSession = {
        id,
        attemptId: id,
        programId,
        lessonId,
        status: 'active',
        replay: completed.includes(lessonId),
        startedAt: now,
        updatedAt: now,
        currentStepId: options.reviewOnly ? frozenReviewStep!.id : lesson.steps[0].id,
        activeSeconds: 0,
        steps: {},
        reviewResults: {},
        assessmentResults: {},
        ...(frozenReviewStep ? { frozenReviewStep } : {}),
        ...(options.reviewOnly ? { reviewOnly: true } : {}),
      };
      await this.db.practiceSessions.add(session);
      if (!(await this.db.programProgress.get(programId)))
        await this.db.programProgress.put({
          programId,
          version: program.version,
          status: 'active',
          currentLessonId: recommended?.id,
          startedAt: now,
          updatedAt: now,
        });
      if (!session.replay)
        await this.db.lessonProgress.put({
          programId,
          lessonId,
          status: 'active',
          currentStepId: session.currentStepId,
          startedAt: now,
        });
      return session;
    });
  }
  async navigate(sessionId: string, stepId: string): Promise<PracticeSession> {
    return this.db.transaction('rw', this.db.practiceSessions, this.db.lessonProgress, async () => {
      const s = await this.requireSession(sessionId);
      const { lesson } = this.definitions(s.programId, s.lessonId);
      goToStep(attemptSteps(lesson, s), stepId);
      s.currentStepId = stepId;
      s.updatedAt = this.now();
      await this.db.practiceSessions.put(s);
      if (!s.replay)
        await this.db.lessonProgress.update([s.programId, s.lessonId], { currentStepId: stepId });
      return s;
    });
  }
  private async requireSession(id: string) {
    const s = await this.db.practiceSessions.get(id);
    if (!s) throw new Error('Сессия не найдена');
    return s;
  }
  async checkpoint(sessionId: string, stepId: string, value: AttemptStep): Promise<void> {
    await this.db.transaction('rw', this.db.practiceSessions, async () => {
      const s = await this.requireSession(sessionId);
      if (s.status === 'completed') return;
      const old = s.steps[stepId];
      s.steps[stepId] = { ...value, ...(old?.completedAt ? { completedAt: old.completedAt } : {}) };
      s.activeSeconds = Object.values(s.steps).reduce((sum, step) => sum + step.elapsedSeconds, 0);
      s.updatedAt = this.now();
      await this.db.practiceSessions.put(s);
    });
  }
  async recordResult(
    sessionId: string,
    key: string,
    success: boolean,
    kind: 'review' | 'assessment',
  ) {
    await this.db.transaction('rw', this.db.practiceSessions, async () => {
      const s = await this.requireSession(sessionId);
      if (s.status === 'completed') return;
      s[kind === 'review' ? 'reviewResults' : 'assessmentResults'][key] = success;
      await this.db.practiceSessions.put(s);
    });
  }
  async completeStep(sessionId: string, stepId: string): Promise<PracticeSession> {
    return this.db.transaction('rw', this.db.tables, async () => {
      const s = await this.requireSession(sessionId);
      if (s.status === 'completed') return s;
      const { program, lesson } = this.definitions(s.programId, s.lessonId);
      const steps = attemptSteps(lesson, s);
      const step = steps.find((v) => v.id === stepId);
      if (!step) throw new Error('Шаг не найден');
      if (s.steps[stepId]?.completedAt) return s;
      if (step.reviewKeys?.some((key) => s.reviewResults[key] === undefined))
        throw new Error('Отметь результат каждого повторения');
      if (step.assessmentRoots?.some((root) => s.assessmentResults[String(root)] === undefined))
        throw new Error('Отметь результат проверки для каждой тональности');
      const now = this.now();
      s.steps[stepId] = {
        ...(s.steps[stepId] ?? { elapsedSeconds: 0, timerSeconds: 0 }),
        completedAt: now,
      };
      if (!s.replay)
        await this.db.stepProgress.put({
          programId: s.programId,
          lessonId: s.lessonId,
          stepId,
          status: 'completed',
          elapsedSeconds: s.steps[stepId].elapsedSeconds,
          completedAt: now,
        });
      for (const key of step.reviewKeys ?? []) {
        const item = await this.db.reviewItems.get(key);
        if (item) {
          const success = s.reviewResults[key];
          const updated =
            item.basePassed === false && success
              ? { ...learnItem(item.programId, item.exerciseId, item.root, now), basePassed: true }
              : reviewItem(item, success, now);
          await this.db.reviewItems.put(updated);
        }
      }
      if (!s.reviewOnly && !step.reviewKeys && !step.reviewSlot)
        for (const e of step.exercises) {
          const key = reviewKey(s.programId, e.id, e.visualization.root);
          const existing = await this.db.reviewItems.get(key);
          const isAssessment = step.assessmentRoots?.includes(e.visualization.root) ?? false;
          const passed = isAssessment
            ? s.assessmentResults[String(e.visualization.root)]
            : undefined;
          if (!existing)
            await this.db.reviewItems.put({
              ...learnItem(s.programId, e.id, e.visualization.root, now),
              ...(isAssessment
                ? { basePassed: passed, nextReviewAt: passed ? now + 86_400_000 : now }
                : {}),
            });
          else if (isAssessment && passed && !existing.basePassed)
            await this.db.reviewItems.put({
              ...learnItem(s.programId, e.id, e.visualization.root, now),
              basePassed: true,
            });
        }
      const completedIds = Object.keys(s.steps).filter(
        (id) => s.steps[id].completedAt !== undefined,
      );
      if (canCompleteLesson(steps, completedIds)) {
        s.status = 'completed';
        s.completedAt = now;
        if (!s.replay && !s.reviewOnly) {
          await this.db.lessonProgress.update([s.programId, s.lessonId], {
            status: 'completed',
            completedAt: now,
          });
          const completed = (
            await this.db.lessonProgress.where('programId').equals(s.programId).toArray()
          )
            .filter((l) => l.status === 'completed')
            .map((l) => l.lessonId);
          const next = getNextLesson(program, completed);
          await this.db.programProgress.update(s.programId, {
            currentLessonId: next?.id,
            status: next ? 'active' : 'completed',
            updatedAt: now,
          });
        }
      } else
        s.currentStepId =
          steps.find((st) => !st.optional && !completedIds.includes(st.id))?.id ??
          nextStep(steps, stepId);
      s.updatedAt = now;
      await this.db.practiceSessions.put(s);
      if (!s.replay)
        await this.db.lessonProgress.update([s.programId, s.lessonId], {
          currentStepId: s.currentStepId,
        });
      return s;
    });
  }
}
