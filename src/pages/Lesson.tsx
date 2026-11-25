import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { getProgram } from '../programs/registry';
import { allLessons, attemptSteps, completionFraction, getNextLesson } from '../core/lesson-engine';
import { getNoteName } from '../core/music';
import type { Lesson, PracticeSession, Program, Step } from '../core/types';
import { db } from '../database/db';
import { repository, useAppStore } from '../stores/app';
import { audioService } from '../audio/service';
import { Dialog, ErrorMessage, formatTime, IconButton, Loading, Progress } from '../components/ui';
import { ExerciseViewer } from '../components/ExerciseViewer';
import { usePracticeTimer } from '../features/timer/usePracticeTimer';
import { useNotifications } from '../stores/notifications';

export function LessonPage() {
  const { programId, lessonId } = useParams();
  const [search] = useSearchParams();
  const reviewOnly = search.get('review') === '1';
  const program = getProgram(programId ?? '');
  const lesson = program && allLessons(program).find((l) => l.id === lessonId);
  const [attempt, setAttempt] = useState<PracticeSession>();
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewStep, setPreviewStep] = useState('');
  const [completionScroll, setCompletionScroll] = useState(0);
  const navigate = useNavigate();
  const refresh = useAppStore((s) => s.refresh);
  const notify = useNotifications((s) => s.notify);
  useEffect(() => {
    if (!completionScroll) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.step-heading h1')?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [completionScroll]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAttempt(undefined);
    setPreview(false);
    const load = async () => {
      if (!program || !lesson) {
        setLoading(false);
        return;
      }
      const completed = (await db.lessonProgress.where('programId').equals(program.id).toArray())
        .filter((l) => l.status === 'completed')
        .map((l) => l.lessonId);
      const next = getNextLesson(program, completed);
      if (!reviewOnly && next?.id !== lesson.id && !completed.includes(lesson.id)) {
        if (!cancelled) {
          setPreview(true);
          setPreviewStep(lesson.steps[0].id);
          setLoading(false);
        }
        return;
      }
      const session = await repository.startLesson(program.id, lesson.id, { reviewOnly });
      if (!cancelled) {
        setAttempt(session);
        setLoading(false);
        await refresh();
      }
    };
    void load().catch((e) => {
      if (!cancelled) {
        setError((e as Error).message);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      audioService.stopAll();
    };
  }, [programId, lessonId, reviewOnly, program, lesson, refresh]);
  if (!program || !lesson)
    return (
      <div className="page">
        <h1>Урок не найден</h1>
        <Link to="/programs">Выбрать программу</Link>
      </div>
    );
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="page">
        <ErrorMessage>{error}</ErrorMessage>
        <Link className="button secondary" to={`/program/${program.id}`}>
          К плану программы
        </Link>
      </div>
    );
  const steps = attemptSteps(lesson, attempt);
  const step =
    steps.find((s) => s.id === (preview ? previewStep : attempt?.currentStepId)) ?? steps[0];
  const changeStep = async (id: string) => {
    if (preview) setPreviewStep(id);
    else if (attempt) setAttempt(await repository.navigate(attempt.id, id));
  };
  const complete = async () => {
    if (!attempt) return;
    const updated = await repository.completeStep(attempt.id, step.id);
    await refresh();
    if (updated.status === 'completed') {
      notify('Урок завершён!', 'Все шаги пройдены. Твой прогресс сохранён.');
      navigate(`/lesson/${program.id}/${lesson.id}/completed?attempt=${updated.id}`, {
        replace: true,
      });
    } else {
      const next = steps.find((s) => s.id === updated.currentStepId);
      notify('Шаг завершён!', `«${step.title}» — готово.${next ? ` Дальше: ${next.title}.` : ''}`);
      setAttempt(updated);
      setCompletionScroll((value) => value + 1);
    }
  };
  const updateResult = async (key: string, success: boolean, kind: 'review' | 'assessment') => {
    if (!attempt) return;
    await repository.recordResult(attempt.id, key, success, kind);
    setAttempt(await db.practiceSessions.get(attempt.id));
  };
  return (
    <StepWorkspace
      key={`${attempt?.id ?? 'preview'}-${step.id}`}
      program={program}
      lesson={lesson}
      step={step}
      steps={steps}
      attempt={attempt}
      preview={preview}
      onNavigate={changeStep}
      onComplete={complete}
      onResult={updateResult}
    />
  );
}
function StepWorkspace({
  program,
  lesson,
  step,
  steps,
  attempt,
  preview,
  onNavigate,
  onComplete,
  onResult,
}: {
  program: Program;
  lesson: Lesson;
  step: Step;
  steps: Step[];
  attempt?: PracticeSession;
  preview: boolean;
  onNavigate: (id: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onResult: (key: string, success: boolean, kind: 'review' | 'assessment') => Promise<void>;
}) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = usePracticeTimer(attempt, step.id);
  const index = steps.findIndex((s) => s.id === step.id);
  const completed = Object.keys(attempt?.steps ?? {}).filter(
    (id) => attempt!.steps[id].completedAt !== undefined,
  );
  const alreadyDone = completed.includes(step.id);
  const fraction = completionFraction(steps, completed);
  const exercise = step.exercises[exerciseIndex];
  const module = program.modules.find((m) => m.lessons.some((l) => l.id === lesson.id));
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const change = async (id: string) => {
    await timer.pauseAndSave();
    audioService.stopAll();
    await onNavigate(id);
    setSheet(false);
  };
  const leave = async () => {
    await timer.pauseAndSave();
    audioService.stopAll();
    navigate(`/program/${program.id}`);
  };
  const needsResults =
    step.reviewKeys?.some((key) => attempt?.reviewResults[key] === undefined) ||
    step.assessmentRoots?.some((root) => attempt?.assessmentResults[String(root)] === undefined);
  return (
    <div className="page lesson-page">
      <div className="lesson-topline">
        <button className="back-link" onClick={() => void act(leave)}>
          <ChevronLeft size={17} />
          <span>{program.title}</span>
        </button>
        <div className="lesson-tools">
          <IconButton label="Весь план программы" onClick={() => void act(leave)}>
            <BookOpen size={21} />
          </IconButton>
          <IconButton label="План урока" onClick={() => setSheet(true)}>
            <ListMusic size={23} />
          </IconButton>
        </div>
      </div>
      <div className="lesson-context">
        <span>
          {module?.title} <span className="dot-separator">/</span> Неделя {lesson.week ?? 1}
        </span>
        <span>
          {attempt?.reviewOnly
            ? 'Повторение после курса'
            : `Урок ${String(lesson.number ?? 1).padStart(2, '0')}`}
          {attempt?.replay && !attempt.reviewOnly ? ' · повтор' : ''}
        </span>
      </div>
      <div className="step-progress">
        <div>
          <span>
            Шаг {index + 1} из {steps.length}
          </span>
          <strong>
            {Math.round(fraction * 100)}% <span>пройдено</span>
          </strong>
        </div>
        <Progress value={fraction} label="Завершённые обязательные шаги" />
      </div>
      {preview && (
        <div className="preview-banner">
          <Eye size={20} />
          <div>
            <strong>Знакомство с будущим уроком</strong>
            <span>Можно смотреть и слушать. Прохождение откроется после предыдущих уроков.</span>
          </div>
        </div>
      )}
      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="step-heading">
            <span className="eyebrow">
              {alreadyDone ? (
                <>
                  <Check size={15} />
                  ШАГ ЗАВЕРШЁН
                </>
              ) : (
                <>
                  <span className="tiny-line" />
                  СЕЙЧАС В ПРАКТИКЕ
                </>
              )}
            </span>
            <h1 tabIndex={-1}>{step.title}</h1>
            <p>{step.instructions[0]}</p>
            {step.instructions.slice(1).map((s, i) => (
              <p className="hint" key={i}>
                {s}
              </p>
            ))}
          </div>
          {step.exercises.length > 1 && (
            <div className="exercise-picker">
              <label htmlFor="exercise-select">
                Упражнение {exerciseIndex + 1} из {step.exercises.length}
              </label>
              <div>
                <select
                  id="exercise-select"
                  value={exerciseIndex}
                  onChange={(e) => {
                    audioService.stopAll();
                    setExerciseIndex(Number(e.target.value));
                  }}
                >
                  {step.exercises.map((e, i) => (
                    <option value={i} key={`${e.id}-${i}`}>
                      {e.title}
                    </option>
                  ))}
                </select>
                <IconButton
                  label="Следующее упражнение"
                  onClick={() => {
                    audioService.stopAll();
                    setExerciseIndex((exerciseIndex + 1) % step.exercises.length);
                  }}
                >
                  <ChevronRight size={19} />
                </IconButton>
              </div>
            </div>
          )}
          {exercise && (
            <ExerciseViewer
              key={exercise.id}
              exercise={exercise}
              initialHidden={Boolean(step.assessmentRoots || step.reviewKeys)}
            />
          )}
          {step.reviewKeys && (
            <section className="self-check">
              <h3>Как прошло повторение?</h3>
              {step.reviewKeys.map((key, i) => (
                <ResultRow
                  key={key}
                  title={step.exercises[i].title}
                  value={attempt?.reviewResults[key]}
                  disabled={preview || alreadyDone}
                  onResult={(result) => void act(() => onResult(key, result, 'review'))}
                />
              ))}
            </section>
          )}
          {step.assessmentRoots && (
            <section className="self-check">
              <h3>Проверка без подсказок</h3>
              <p>
                Четыре гаммы, десять паттернов, четыре перехода и две минуты импровизации. Оцени
                каждую тональность.
              </p>
              {step.assessmentRoots.map((root) => (
                <ResultRow
                  key={root}
                  title={`Тональность ${getNoteName(root, root)}`}
                  value={attempt?.assessmentResults[String(root)]}
                  disabled={preview || alreadyDone}
                  onResult={(result) =>
                    void act(() => onResult(String(root), result, 'assessment'))
                  }
                />
              ))}
            </section>
          )}
        </div>
        <aside className="practice-panel">
          <section className="timer-card">
            <span className="eyebrow">
              <Clock3 size={16} />
              ВРЕМЯ ДЛЯ ПРАКТИКИ
            </span>
            <div
              className={`timer-display ${timer.running ? 'running' : ''}`}
              role="timer"
              aria-label="Осталось времени"
            >
              {formatTime(Math.max(0, step.durationSeconds - timer.value.timerSeconds))}
            </div>
            <p>
              {timer.value.timerSeconds >= step.durationSeconds
                ? 'Время вышло. Заверши шаг, когда будешь готов.'
                : timer.running
                  ? 'Только ты и твой инструмент'
                  : timer.value.timerSeconds > 0
                    ? 'Пауза — тоже часть практики'
                    : `${Math.round(step.durationSeconds / 60)} минут на этот шаг`}
            </p>
            <div className="timer-buttons">
              <button
                className="button secondary"
                disabled={preview || busy}
                onClick={() => void act(timer.toggle)}
              >
                {timer.running ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                {timer.running
                  ? 'Пауза'
                  : timer.value.timerSeconds > 0
                    ? 'Продолжить'
                    : 'Начать таймер'}
              </button>
              <IconButton
                label="Сбросить таймер шага"
                disabled={preview || busy}
                onClick={() => void act(timer.reset)}
              >
                <RotateCcw size={18} />
              </IconButton>
            </div>
            <span className="timer-actual">Практика: {formatTime(timer.value.elapsedSeconds)}</span>
            {timer.error && <ErrorMessage>{timer.error}</ErrorMessage>}
          </section>
          <section className="session-note">
            <span className="note-icon">
              <Sparkles size={20} />
            </span>
            <strong>
              Сначала спокойно.
              <br />
              Потом свободно.
            </strong>
            <p>Чистое исполнение важнее темпа. Можно задержаться на любом упражнении.</p>
          </section>
          <div className="desktop-step-list">
            <span className="eyebrow">ПЛАН СЕГОДНЯ</span>
            {steps.map((s, i) => (
              <button
                key={s.id}
                className={s.id === step.id ? 'current' : ''}
                onClick={() => void act(() => change(s.id))}
              >
                <span>{completed.includes(s.id) ? <Check size={15} /> : i + 1}</span>
                <strong>{s.title}</strong>
                <small>{Math.round(s.durationSeconds / 60)} мин</small>
              </button>
            ))}
          </div>
        </aside>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="lesson-bottom">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void act(index === 0 ? leave : () => change(steps[index - 1].id))}
        >
          <ChevronLeft size={18} />
          Назад
        </button>
        {preview ? (
          <button
            className="button primary"
            onClick={() =>
              void act(index === steps.length - 1 ? leave : () => change(steps[index + 1].id))
            }
          >
            {index === steps.length - 1 ? 'К плану программы' : 'Следующий шаг'}
          </button>
        ) : (
          <button
            className="button primary"
            disabled={busy || Boolean(needsResults)}
            onClick={() =>
              void act(async () => {
                await timer.pauseAndSave();
                audioService.stopAll();
                if (alreadyDone) {
                  const next = steps.find((s) => !s.optional && !completed.includes(s.id));
                  if (next) await onNavigate(next.id);
                } else await onComplete();
              })
            }
          >
            <Check size={19} />
            {busy ? 'Сохраняем…' : alreadyDone ? 'К незавершённому шагу' : 'Завершить шаг'}
          </button>
        )}
      </div>
      {needsResults && !preview && (
        <p className="completion-hint">Сначала отметь результаты проверки выше.</p>
      )}
      {sheet && (
        <Dialog title="План занятия" className="step-sheet" onClose={() => setSheet(false)}>
          <p className="muted">
            Урок {lesson.number ?? 1} · {lesson.title}
          </p>
          <div className="sheet-step-list">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => void act(() => change(s.id))}
                className={s.id === step.id ? 'current' : ''}
              >
                <span className={`sheet-step-number ${completed.includes(s.id) ? 'done' : ''}`}>
                  {completed.includes(s.id) ? <Check size={20} /> : i + 1}
                </span>
                <span>
                  <strong>{s.title}</strong>
                  <small>
                    {s.id === step.id
                      ? 'Сейчас здесь'
                      : completed.includes(s.id)
                        ? 'Завершено'
                        : 'Ещё впереди'}
                  </small>
                </span>
                <span>{Math.round(s.durationSeconds / 60)} мин</span>
              </button>
            ))}
          </div>
          <p className="hint">
            Можно переходить между шагами в любом порядке. Просмотр не отмечает шаг выполненным.
          </p>
        </Dialog>
      )}
    </div>
  );
}
function ResultRow({
  title,
  value,
  disabled,
  onResult,
}: {
  title: string;
  value?: boolean;
  disabled: boolean;
  onResult: (success: boolean) => void;
}) {
  return (
    <div className="result-row">
      <strong>{title}</strong>
      <div>
        <button
          disabled={disabled}
          className={`button secondary small ${value === true ? 'is-active' : ''}`}
          aria-pressed={value === true}
          onClick={() => onResult(true)}
        >
          <Check size={15} />
          Получилось
        </button>
        <button
          disabled={disabled}
          className={`button secondary small ${value === false ? 'is-active' : ''}`}
          aria-pressed={value === false}
          onClick={() => onResult(false)}
        >
          Ещё повторить
        </button>
      </div>
    </div>
  );
}
export function CompletedPage() {
  const { programId, lessonId } = useParams();
  const [search] = useSearchParams();
  const { sessions, lessonProgress } = useAppStore();
  const program = getProgram(programId ?? '');
  const lesson = program && allLessons(program).find((l) => l.id === lessonId);
  const attempt = sessions
    .filter(
      (s) =>
        s.programId === programId &&
        s.lessonId === lessonId &&
        s.status === 'completed' &&
        (!search.get('attempt') || s.id === search.get('attempt')),
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
  if (!program || !lesson || !attempt)
    return <Navigate to={program ? `/program/${program.id}` : '/programs'} replace />;
  const completed = lessonProgress.filter(
    (l) => l.programId === program.id && l.status === 'completed',
  ).length;
  const total = allLessons(program).length;
  return (
    <div className="page completed-page">
      <div className="completion-ornament" aria-hidden="true">
        <span className="ornament-orbit" />
        <span className="completion-check">
          <Check size={44} strokeWidth={1.8} />
        </span>
        <span className="spark-one">✦</span>
        <span className="spark-two">✧</span>
      </div>
      <span className="eyebrow">ЕЩЁ ОДНА ХОРОШАЯ ВСТРЕЧА С МУЗЫКОЙ</span>
      <h1>
        {attempt.reviewOnly
          ? 'Материал закреплён.'
          : attempt.replay
            ? 'Отличное повторение.'
            : 'Практика завершена.'}
        <br />
        <span>Ты стал на шаг ближе.</span>
      </h1>
      <p>
        Урок {lesson.number ?? 1} · {lesson.title}
      </p>
      <div className="completion-stats">
        <div>
          <Clock3 size={22} />
          <strong>{formatTime(attempt.activeSeconds)}</strong>
          <span>активной практики</span>
        </div>
        <div>
          <Check size={22} />
          <strong>
            {Object.values(attempt.steps).filter((s) => s.completedAt !== undefined).length}
          </strong>
          <span>завершённых шагов</span>
        </div>
        <div>
          <Trophy size={22} />
          <strong>
            {completed}
            <small> / {total}</small>
          </strong>
          <span>уроков программы</span>
        </div>
      </div>
      <div className="completion-progress">
        <div>
          <span>Твой путь</span>
          <strong>{Math.round((completed / total) * 100)}%</strong>
        </div>
        <Progress value={completed / total} label="Прогресс курса" />
      </div>
      <p className="completion-note">
        {attempt.activeSeconds < 60
          ? 'Время считается только при включённом таймере. Галочки отражают твою самостоятельную оценку.'
          : 'Дай новому материалу немного отдохнуть. Повторение появится в нужный день.'}
      </p>
      <Link className="button primary" to={`/program/${program.id}`}>
        <BookOpen size={18} />К списку уроков
      </Link>
      <span className="saved-label">
        <Check size={15} />
        Прогресс сохранён на устройстве
      </span>
    </div>
  );
}
