import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Play, Settings2, RotateCcw } from 'lucide-react';
import { defaultConfig, keyName, STYLES, TRAINERS } from '../../core/practice/config';
import { aggregateSessions } from '../../core/practice/engine';
import type {
  DifficultTask,
  PracticeConfig,
  TrainerSession,
  TrainerType,
} from '../../core/practice/types';
import { Dialog, ErrorMessage, formatTime, Loading } from '../../components/ui';
import { practiceController, trainerRepository } from './controller';
import { SessionStatistics } from './Session';
export function PracticeHome() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<Record<string, PracticeConfig>>({});
  const [saved, setSaved] = useState<TrainerSession>();
  const [last, setLast] = useState<TrainerType>('degree');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false;
    void Promise.all([
      Promise.all(
        (Object.keys(TRAINERS) as TrainerType[]).map(
          async (trainer) => [trainer, await trainerRepository.config(trainer)] as const,
        ),
      ),
      trainerRepository.unfinished(),
      trainerRepository.lastTrainer(),
    ])
      .then(([values, session, trainer]) => {
        if (!stopped) {
          setConfigs(Object.fromEntries(values));
          setSaved(session);
          setLast(trainer);
        }
      })
      .catch(() => setError('Не удалось загрузить последние тренировки'));
    return () => {
      stopped = true;
    };
  }, []);
  const launch = async (config: PracticeConfig, session?: TrainerSession) => {
    setBusy(true);
    try {
      await practiceController.prepare(config, session);
      navigate('/practice/session');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось открыть тренировку');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page practice-home">
      <div className="practice-page-top">
        <span className="eyebrow">PRACTICE · БЕЗ РАСПИСАНИЯ</span>
        <Link to="/practice/history">
          <History size={18} />
          История
        </Link>
      </div>
      <h1>Садись. Выбирай. Играй.</h1>
      <p className="page-intro">
        Пять тренажёров для свободной практики. Твой темп, твоя музыка — сегодня и после завершения
        курса.
      </p>
      <section className="practice-resume">
        <div>
          <span className="eyebrow">
            {saved ? 'ЕСТЬ НЕЗАВЕРШЁННАЯ ТРЕНИРОВКА' : 'ПРОДОЛЖИ С ТОГО, ЧТО ЗНАКОМО'}
          </span>
          <h2>{TRAINERS[saved?.config.trainer ?? last].name}</h2>
          <p>
            {saved
              ? `${formatTime(saved.statistics.activeSeconds)} практики · ${saved.config.bpm} BPM · сохранено в паузе`
              : 'Последние настройки уже под рукой. Звук включается только по твоему нажатию.'}
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void launch(saved?.config ?? configs[last] ?? defaultConfig(last), saved)}
        >
          <RotateCcw size={19} />
          {saved ? 'Resume · продолжить' : 'Повторить последнюю'}
        </button>
      </section>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="practice-trainer-grid">
        {(Object.entries(TRAINERS) as [TrainerType, (typeof TRAINERS)[TrainerType]][]).map(
          ([trainer, info]) => {
            const config = configs[trainer] ?? defaultConfig(trainer);
            return (
              <article className="practice-trainer-card" key={trainer}>
                <span className="practice-card-mark" aria-hidden="true">
                  {trainer === 'degree'
                    ? 'Ⅳ'
                    : trainer === 'chord'
                      ? '♭9'
                      : trainer === 'style'
                        ? '♫'
                        : trainer === 'fill'
                          ? '↗'
                          : '♩'}
                </span>
                <h2>{info.name}</h2>
                <p>{info.description}</p>
                <div className="practice-last-settings">
                  <span>{config.keys.map(keyName).join(' · ')}</span>
                  <span>
                    {config.bpm} BPM · {STYLES[config.style]}
                  </span>
                </div>
                <div>
                  <Link className="button secondary" to={`/practice/${trainer}`}>
                    <Settings2 size={16} />
                    Настроить
                  </Link>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void launch(config)}
                  >
                    <Play size={17} />
                    Быстрый старт
                  </button>
                </div>
              </article>
            );
          },
        )}
      </div>
      <p className="muted">
        Играешь на физическом пианино. MIDI не требуется; результат оцениваешь сам. Прогресс
        Learning хранится отдельно.
      </p>
    </div>
  );
}
export function PracticeHistory() {
  const [sessions, setSessions] = useState<TrainerSession[]>();
  const [hard, setHard] = useState<DifficultTask[]>([]);
  const [period, setPeriod] = useState('7');
  const [selected, setSelected] = useState<TrainerSession>();
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([trainerRepository.history(), trainerRepository.difficult()])
      .then(([s, h]) => {
        setSessions(s);
        setHard(h);
      })
      .catch(() => setError('Не удалось прочитать историю'));
  }, []);
  if (!sessions) return error ? <ErrorMessage>{error}</ErrorMessage> : <Loading />;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from =
    period === 'all'
      ? 0
      : period === 'today'
        ? today.getTime()
        : Date.now() - Number(period) * 86400000;
  const stats = aggregateSessions(sessions, from);
  const marks = new Map<string, DifficultTask>();
  for (const s of sessions.filter((s) => s.startedAt >= from && s.phase === 'completed'))
    for (const item of s.difficult) {
      const old = marks.get(item.id);
      marks.set(item.id, { ...item, count: (old?.count ?? 0) + item.count });
    }
  const difficult = [...marks.values()].sort((a, b) => b.count - a.count);
  const transitions = new Map<string, number>();
  for (const h of difficult) {
    const label = `${h.chord} → ${h.nextChord}`;
    transitions.set(label, (transitions.get(label) ?? 0) + h.count);
  }
  return (
    <div className="page practice-history">
      <Link className="back-link" to="/practice">
        <ArrowLeft size={16} />
        Practice
      </Link>
      <span className="eyebrow">ПОНЕМНОГУ, НО РЕГУЛЯРНО</span>
      <h1>Твоя история практики</h1>
      <div className="practice-periods" role="group" aria-label="Период статистики">
        {Object.entries({ today: 'Сегодня', '7': '7 дней', '30': '30 дней', all: 'Всё время' }).map(
          ([id, label]) => (
            <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)}>
              {label}
            </button>
          ),
        )}
      </div>
      <div className="practice-stat-grid">
        <div>
          <strong>{stats.sessions}</strong>
          <span>тренировки</span>
        </div>
        <div>
          <strong>{formatTime(stats.activeSeconds)}</strong>
          <span>активное время</span>
        </div>
        <div>
          <strong>{Math.round(stats.averageBpm)}</strong>
          <span>средний BPM</span>
        </div>
        <div>
          <strong>{stats.tasks}</strong>
          <span>задания</span>
        </div>
        <div>
          <strong>{stats.hints}</strong>
          <span>подсказки</span>
        </div>
        <div>
          <strong>{stats.hard}</strong>
          <span>сложные задания</span>
        </div>
      </div>
      <p className="muted">
        Паузы, отсчёт и прослушивание подсказок не входят в активное время. Отсутствие отметки
        «Сложно» не означает правильное исполнение.
      </p>
      <section className="practice-panel">
        <h2>Сложные аккорды</h2>
        {difficult.length ? (
          difficult.slice(0, 8).map((h) => (
            <p key={h.id}>
              {keyName(h.key)} · {h.chord} · {h.voicing} — {h.count} отметок
            </p>
          ))
        ) : (
          <p className="muted">
            Во время игры нажимай «Сложно». Эти отметки помогают адаптивному режиму.
          </p>
        )}
        <h3>Сложные переходы</h3>
        {[...transitions]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, count]) => (
            <p key={label}>
              {label} — {count}
            </p>
          ))}
        {hard.length > 0 && (
          <button className="text-button" onClick={() => setReset(true)}>
            Сбросить сложные задания
          </button>
        )}
      </section>
      <h2>Тренировки</h2>
      <div className="practice-history-list">
        {sessions
          .filter((s) => s.startedAt >= from)
          .map((s) => (
            <button key={s.id} onClick={() => setSelected(s)}>
              <div>
                <strong>{TRAINERS[s.config.trainer].name}</strong>
                <span>
                  {new Date(s.startedAt).toLocaleString('ru-RU')} ·{' '}
                  {s.config.keys.map(keyName).join(', ')}
                </span>
              </div>
              <span>
                {formatTime(s.statistics.activeSeconds)} ·{' '}
                {s.phase === 'completed' ? 'Завершена' : 'Пауза'}
              </span>
            </button>
          ))}
      </div>
      {!sessions.some((s) => s.startedAt >= from) && <p>В этом периоде пока нет тренировок.</p>}
      {selected && (
        <Dialog title="Тренировка" onClose={() => setSelected(undefined)}>
          <SessionStatistics session={selected} />
        </Dialog>
      )}
      {reset && (
        <Dialog title="Сбросить сложные задания?" onClose={() => setReset(false)}>
          <p>
            Адаптивный режим начнёт накопление заново. История тренировок и Learning сохранятся.
          </p>
          <button className="button secondary" onClick={() => setReset(false)}>
            Отмена
          </button>
          <button
            className="button primary"
            onClick={() =>
              void trainerRepository
                .resetHard()
                .then(() => {
                  setHard([]);
                  setReset(false);
                })
                .catch(() => setError('Не удалось сбросить отметки'))
            }
          >
            Сбросить
          </button>
        </Dialog>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
