import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Leaf,
  Music2,
  Play,
  Repeat2,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { programs, getProgram } from '../programs/registry';
import { allLessons, getNextLesson } from '../core/lesson-engine';
import { dueReviews, isRootMastered } from '../core/review-engine';
import { getNoteName } from '../core/music';
import { useAppStore, repository } from '../stores/app';
import { ErrorMessage, Progress } from '../components/ui';
import type { Lesson, Program } from '../core/types';
const lessonMinutes = (lesson?: Lesson) =>
  Math.round(
    (lesson?.steps.reduce((sum, step) => sum + (step.optional ? 0 : step.durationSeconds), 0) ??
      0) / 60,
  );
const programRoots = (program: Program) => [
  ...new Set(allLessons(program).flatMap((lesson) => lesson.roots ?? [])),
];
export function ProgramsPage() {
  const { programProgress } = useAppStore();
  return (
    <div className="page programs-page">
      <section className="welcome">
        <span className="eyebrow">
          <span className="tiny-line" />
          ПРАКТИКА, КОТОРАЯ ОСТАЁТСЯ С ТОБОЙ
        </span>
        <h1>
          Маленькие шаги.
          <br />
          <span>Свободная музыка.</span>
        </h1>
        <p>
          Садись за пианино. Всё остальное уже здесь:
          <br className="desktop-only" /> понятный план, живой звук и время для себя.
        </p>
      </section>
      <div className="section-heading">
        <h2>Твои программы</h2>
        <span>Программ: {programs.length}</span>
      </div>
      {programs.map((program) => (
        <article className="program-card" key={program.id}>
          <div className="program-art" aria-hidden="true">
            <div className="art-caption">НАЙДИ СВОЙ РИТМ</div>
            <svg viewBox="0 0 400 270">
              <g transform="translate(57 32) rotate(-12 150 110)">
                <rect x="-12" y="-12" width="310" height="224" rx="14" className="art-case" />
                {Array.from({ length: 9 }, (_, i) => (
                  <rect
                    key={i}
                    x={i * 32}
                    y="0"
                    width="29"
                    height="198"
                    rx="4"
                    className={
                      i === 0 || i === 2 || i === 4 || i === 5 || i === 7 ? 'art-blue' : 'art-white'
                    }
                  />
                ))}
                {[0, 1, 3, 4, 5, 7, 8].map((i) => (
                  <rect
                    key={i}
                    x={i * 32 + 21}
                    y="0"
                    width="20"
                    height="117"
                    rx="4"
                    className="art-black"
                  />
                ))}
              </g>
            </svg>
            <div className="art-bottom">
              <span>ПРАКТИКА И ИМПРОВИЗАЦИЯ</span>
              <Music2 size={20} />
            </div>
          </div>
          <div className="program-content">
            <div className="pill soft">
              <Sparkles size={14} />
              Системная практика
            </div>
            <h2>{program.title}</h2>
            <p>{program.description}</p>
            <div className="program-facts">
              <span>
                <CalendarDays size={17} />
                {program.weeks ? `${program.weeks} недель` : 'В своём темпе'}
              </span>
              <span>
                <BookOpen size={17} />
                {allLessons(program).length} уроков
              </span>
              <span>
                <Clock3 size={17} />
                {lessonMinutes(allLessons(program)[0])} минут
              </span>
            </div>
            <div className="key-chips">
              {programRoots(program).map((root) => (
                <span key={root}>{getNoteName(root, root)}</span>
              ))}
              <span className="keys-caption">
                {programRoots(program).length} тональностей.
                <br />
                Новые возможности.
              </span>
            </div>
            <Link to={`/program/${program.id}`} className="button primary full">
              {programProgress.some((p) => p.programId === program.id)
                ? 'Открыть программу'
                : 'Познакомиться с программой'}
            </Link>
          </div>
        </article>
      ))}
      <div className="feature-strip">
        <div>
          <span className="feature-icon">
            <Music2 size={20} />
          </span>
          <strong>Слышать и понимать</strong>
          <p>
            Звук пианино и подсветка
            <br />
            каждой ноты.
          </p>
        </div>
        <div>
          <span className="feature-icon">
            <Repeat2 size={20} />
          </span>
          <strong>Помнить надолго</strong>
          <p>
            Повторение в нужный момент,
            <br />
            без лишнего планирования.
          </p>
        </div>
        <div>
          <span className="feature-icon">
            <Leaf size={20} />
          </span>
          <strong>В своём темпе</strong>
          <p>
            Без оценок и спешки.
            <br />
            Даже без интернета.
          </p>
        </div>
      </div>
      <div className="gentle-note">
        <span>♪</span>
        <p>
          Три встречи с инструментом в неделю.
          <br />
          <strong>Четвёртая — просто для удовольствия.</strong>
        </p>
      </div>
    </div>
  );
}
export function OverviewPage() {
  const { id } = useParams();
  const program = getProgram(id ?? '');
  const navigate = useNavigate();
  const { lessonProgress, reviews, savePreferences, refresh } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!program)
    return (
      <div className="page">
        <h1>Программа не найдена</h1>
        <Link to="/programs">Все программы</Link>
      </div>
    );
  const lessons = allLessons(program);
  const completed = lessonProgress
    .filter((l) => l.programId === program.id && l.status === 'completed')
    .map((l) => l.lessonId);
  const next = getNextLesson(program, completed);
  const localReviews = reviews.filter((r) => r.programId === program.id);
  const due = dueReviews(localReviews, Date.now());
  const roots = [...new Set(lessons.flatMap((l) => l.roots ?? []))];
  const mastered = roots.filter((root) => isRootMastered(localReviews, root));
  const start = async () => {
    setBusy(true);
    try {
      await savePreferences({ activeProgramId: program.id });
      if (next) navigate(`/lesson/${program.id}/${next.id}`);
      else {
        const session = await repository.startLesson(program.id, lessons.at(-1)!.id, {
          reviewOnly: true,
        });
        await refresh();
        navigate(`/lesson/${program.id}/${session.lessonId}?review=1`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page overview-page">
      <Link to="/programs" className="back-link">
        <ChevronLeft size={17} />
        Все программы
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ТВОЙ ПУТЬ К ИМПРОВИЗАЦИИ</span>
          <h1>{program.title}</h1>
          <p>
            {program.weeks ? `${program.weeks} недель · ` : ''}
            {lessons.length} уроков · {lessonMinutes(lessons[0])} минут
          </p>
        </div>
        <span className="heading-icon">
          <BookOpen size={28} />
        </span>
      </div>
      <div className="overview-summary">
        <div className="summary-main">
          <div className="section-heading">
            <strong>{next ? 'Шаг за шагом, нота за нотой' : 'Все уроки пройдены!'}</strong>
            <span>
              {completed.length} / {lessons.length} уроков
            </span>
          </div>
          <Progress value={completed.length / lessons.length} label="Прогресс программы" />
          <p>
            {next
              ? `Следующий: урок ${next.number ?? ''} · ${next.title}`
              : 'Продолжай повторять материал. Освоение тональностей отмечается отдельно от уроков.'}
          </p>
          <button
            className="button primary"
            disabled={busy || (!next && !due.length)}
            onClick={() => void start()}
          >
            <Play size={17} fill="currentColor" />
            {next
              ? completed.length
                ? 'Продолжить практику'
                : 'Начать программу'
              : due.length
                ? 'Повторить материал'
                : 'На сегодня всё'}
          </button>
        </div>
        <div className="mastery-summary">
          <span className="eyebrow">УВЕРЕННО В РУКАХ</span>
          <strong>
            {mastered.length}
            <small> / {roots.length}</small>
          </strong>
          <span>тональностей освоено</span>
          <div className="mini-keys">
            {roots.map((root) => (
              <span
                key={root}
                className={mastered.includes(root) ? 'mastered' : ''}
                title={
                  mastered.includes(root)
                    ? 'Освоено'
                    : 'Нужны базовая проверка и повторение через 30 дней'
                }
              >
                {mastered.includes(root) && <Check size={12} />} {getNoteName(root, root)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="curriculum-heading">
        <h2>План программы</h2>
        <span>{lessons.length} встреч с музыкой</span>
      </div>
      <div className="module-list">
        {program.modules.map((module) => {
          const moduleCompleted = module.lessons.filter((l) => completed.includes(l.id)).length;
          const current = module.lessons.some((l) => l.id === next?.id);
          return (
            <details className="module" key={module.id} open={current || undefined}>
              <summary>
                <span
                  className={`module-symbol ${moduleCompleted === module.lessons.length ? 'done' : ''}`}
                >
                  {moduleCompleted === module.lessons.length ? (
                    <Check size={22} />
                  ) : (
                    <Music2 size={22} />
                  )}
                </span>
                <span className="module-name">
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </span>
                <span className="module-count">
                  {moduleCompleted}/{module.lessons.length}
                </span>
                <ChevronDown size={20} className="disclosure-chevron" />
              </summary>
              <div className="lesson-list">
                {module.lessons.map((lesson) => {
                  const done = completed.includes(lesson.id);
                  const isNext = lesson.id === next?.id;
                  return (
                    <Link
                      key={lesson.id}
                      to={`/lesson/${program.id}/${lesson.id}`}
                      className={`lesson-row ${isNext ? 'current' : ''}`}
                    >
                      <span className={`lesson-status ${done ? 'done' : ''}`}>
                        {done ? (
                          <Check size={18} />
                        ) : isNext ? (
                          <Play size={16} fill="currentColor" />
                        ) : (
                          <span>{String(lesson.number ?? '').padStart(2, '0')}</span>
                        )}
                      </span>
                      <span className="lesson-row-text">
                        <strong>{lesson.title}</strong>
                        <span>
                          {isNext
                            ? 'Следующее занятие'
                            : done
                              ? 'Пройдено · можно повторить'
                              : `Урок ${lesson.number ?? ''} · просмотр`}
                        </span>
                      </span>
                      <span className="lesson-duration">{lessonMinutes(lesson)} мин</span>
                      {done ? (
                        <Repeat2 size={17} />
                      ) : isNext ? (
                        <ChevronRight size={18} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      <section className="review-summary">
        <Repeat2 size={22} />
        <div>
          <h3>Чтобы музыка оставалась в руках</h3>
          <p>Проверки через 1, 3, 7, 14 и 30 дней. На повторение — не больше 10 минут занятия.</p>
          <p>
            {due.length
              ? `Есть задания на повторение: ${localReviews.filter((r) => !r.mastery && r.nextReviewAt <= Date.now()).length}. Они войдут в ближайшее занятие.`
              : localReviews.some((r) => !r.mastery)
                ? `Следующее повторение: ${new Date(Math.min(...localReviews.filter((r) => !r.mastery).map((r) => r.nextReviewAt))).toLocaleDateString('ru-RU')}.`
                : 'Начни заниматься, и здесь появится расписание повторений.'}
          </p>
        </div>
      </section>
    </div>
  );
}
