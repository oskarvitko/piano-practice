import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Square, Eye, Flag, Settings2, SkipForward, RotateCcw } from 'lucide-react';
import { practiceController as controller, trainerRepository } from './controller';
import { ChannelsForm, Field } from './Configuration';
import {
  keyboardHintEnabled,
  keyName,
  meterInfo,
  STYLES,
  TRAINERS,
  withHintMode,
} from '../../core/practice/config';
import { voiceLead } from '../../audio/practice-scheduler';
import { supportsVoicing, voiceChord } from '../../core/practice/chords';
import type { PracticeConfig, PracticeTask, TrainerSession } from '../../core/practice/types';
import { MusicalExamplePlayer } from '../../components/MusicalExamplePlayer';
import { PianoKeyboard } from '../../components/PianoKeyboard';
import { Dialog, ErrorMessage, formatTime, Loading } from '../../components/ui';
import { audioService } from '../../audio/service';
import { useAppStore } from '../../stores/app';
import { hardIdentity } from '../../core/practice/engine';
import { getNoteName } from '../../core/music';

export function taskLabel(task: PracticeTask, config: PracticeConfig) {
  if (task.trainer === 'scale')
    return task.key.mode === 'major' ? keyName(task.key) : keyName(task.key);
  if (task.trainer !== 'degree') return task.chord.symbol;
  return config.degreeDisplay === 'arabic'
    ? task.chord.degreeLabel
    : config.degreeDisplay === 'roman'
      ? task.chord.roman
      : config.degreeDisplay === 'both'
        ? `${task.chord.degreeLabel} · ${task.chord.symbol}`
        : task.chord.symbol;
}
export function SessionStatistics({ session }: { session: TrainerSession }) {
  const stats = session.statistics;
  const hardest = [...session.difficult].sort((a, b) => b.count - a.count).slice(0, 5);
  return (
    <section className="practice-panel practice-results">
      <span className="eyebrow">ТВОЯ ПРАКТИКА</span>
      <h2>Время, которое осталось в руках</h2>
      <div className="practice-stat-grid">
        {[
          [formatTime(stats.activeSeconds), 'практика'],
          [
            stats.activeSeconds
              ? Math.round(stats.bpmSeconds / stats.activeSeconds)
              : session.config.bpm,
            'средний BPM',
          ],
          [stats.tasks, 'задания'],
          [stats.chords, 'аккорды'],
          [stats.transitions, 'переходы'],
          [stats.hints, 'подсказки'],
          [stats.hard, 'отметки «Сложно»'],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p>
        <strong>Тональности:</strong> {stats.keys.join(' · ') || '—'}
      </p>
      <p>
        <strong>Типы аккордов:</strong> {stats.chordTypes.join(', ') || '—'}
      </p>
      {hardest.length > 0 && (
        <>
          <h3>На что обратить внимание</h3>
          {hardest.map((item) => (
            <p key={item.id}>
              {keyName(item.key)} · {item.chord} → {item.nextChord} · {item.count} отметок
            </p>
          ))}
        </>
      )}
      <p className="muted">
        Это статистика практики и твоих отметок. Приложение не оценивает точность исполнения на
        физическом пианино.
      </p>
    </section>
  );
}
export function PracticeSessionScreen() {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const session = state.session;
  const [settings, setSettings] = useState(false);
  const [showMidi, setShowMidi] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(session));
  const keyboard = useAppStore((s) => s.preferences.keyboard);
  useEffect(() => {
    if (controller.snapshot().session) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void trainerRepository
      .unfinished()
      .then(async (saved) => {
        if (saved && !cancelled) await controller.prepare(saved.config, saved);
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          setLoadError('Не удалось восстановить тренировку');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const pause = () => controller.pause();
    const hide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', pause);
    window.addEventListener('blur', pause);
    return () => {
      pause();
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('blur', pause);
    };
  }, []);
  const running = session?.phase === 'playing' || session?.phase === 'countdown';
  useEffect(() => {
    if (session?.phase === 'completed') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [session?.phase]);
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let gone = false;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock
      .request('screen')
      .then((value) => {
        if (gone) void value.release();
        else lock = value;
      })
      .catch(() => {});
    return () => {
      gone = true;
      void lock?.release();
    };
  }, [running]);
  if (!loaded) return <Loading />;
  if (!session)
    return (
      <div className="page">
        <h1>Тренировка ждёт тебя</h1>
        {loadError && <ErrorMessage>{loadError}</ErrorMessage>}
        <Link className="button primary" to="/practice">
          Выбрать тренажёр
        </Link>
      </div>
    );
  const config = session.config;
  const task = session.queue[session.index];
  const next = session.queue.slice(session.index + 1, session.index + 1 + config.previewCount);
  const previous = session.queue[session.index - 1];
  const meter = meterInfo(config.meter);
  const beat = Math.floor((session.beat + 1e-6) % meter.beats);
  const remaining =
    config.durationMinutes === null
      ? null
      : Math.max(0, config.durationMinutes * 60 - session.statistics.activeSeconds);
  if (session.phase === 'completed')
    return (
      <div className="page">
        <span className="eyebrow">ТРЕНИРОВКА ЗАВЕРШЕНА</span>
        <h1>Хорошая встреча с музыкой.</h1>
        <SessionStatistics session={session} />
        <div className="practice-actions">
          <Link className="button primary" to={`/practice/${config.trainer}`}>
            Ещё одна тренировка
          </Link>
          <Link className="button secondary" to="/practice">
            Все тренажёры
          </Link>
          <Link to="/practice/history">История</Link>
        </div>
      </div>
    );
  const hinted = config.hintMode !== 'hidden';
  const displayKeyboard = keyboardHintEnabled(config);
  const voiceOn =
    config.channels.voice.enabled &&
    config.voiceTiming !== 'off' &&
    config.channels.voice.volume > 0;
  const lead = voiceLead(config);
  const notes = task.plan
    ? [...new Set(task.plan.events.flatMap((e) => e.notes))]
    : [...task.voicing.leftHand, ...task.voicing.rightHand];
  const chordDiagram = task.trainer !== 'scale' && task.trainer !== 'fill';
  const bassOnly = config.trainer === 'degree' && config.degreeTask === 'bass';
  const hintHands = chordDiagram
    ? [
        {
          label: 'Левая рука',
          notes: bassOnly ? task.voicing.leftHand.slice(0, 1) : task.voicing.leftHand,
          left: true,
        },
        ...(!bassOnly
          ? [{ label: 'Правая рука', notes: task.voicing.rightHand, left: false }]
          : []),
      ]
    : [];
  const updateHint = (mode: PracticeConfig['hintMode']) => {
    controller.config(withHintMode(config, mode));
  };
  return (
    <div
      className={`practice-session ${displayKeyboard ? 'has-keyboard-hint' : ''}`}
      data-phase={session.phase}
      data-settings-saving={state.settingsSaving}
    >
      <header className="practice-session-heading">
        <Link to="/practice">Practice</Link>
        <span>{TRAINERS[config.trainer].name}</span>
        <button
          className="icon-button"
          aria-label="Настройки тренировки"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={21} />
        </button>
      </header>
      <div className="practice-context">
        <strong>{keyName(task.key)}</strong>
        <span>{STYLES[config.style]}</span>
        <span>{config.meter}</span>
      </div>
      <div className="practice-task-stage">
        {session.phase === 'countdown' ? (
          <div className="practice-countdown" role="status">
            <span>Приготовься</span>
            <strong>{state.countdown}</strong>
            <small>{meter.label}</small>
          </div>
        ) : (
          <>
            <div className="practice-neighbours">
              <div>
                <small>Было</small>
                <span>{previous ? taskLabel(previous, config) : '—'}</span>
              </div>
              <span className="eyebrow">
                {session.phase === 'ready'
                  ? 'ГОТОВО К СТАРТУ'
                  : session.phase === 'paused'
                    ? 'ПАУЗА'
                    : 'СЕЙЧАС'}
              </span>
              <div>
                <small>{config.previewCount ? 'Дальше' : 'Без предпросмотра'}</small>
                <span>{config.previewCount && next[0] ? taskLabel(next[0], config) : '—'}</span>
              </div>
            </div>
            <div
              className={`practice-task-value ${config.trainer === 'degree' ? 'is-degree' : ''}`}
              aria-live="off"
            >
              {taskLabel(task, config)}
            </div>
            <p className="practice-task-instruction">{task.instruction}</p>
            {config.trainer === 'fill' && (
              <p className="practice-fill-target">
                {task.chord.symbol} → {task.nextChord.symbol} ·{' '}
                {task.examples[0]?.targetNotes.map((n) => `${n.function} ${n.chord}`).join(', ')}
              </p>
            )}
          </>
        )}
      </div>
      <div className="practice-primary-actions">
        <button
          className="button secondary"
          aria-pressed={displayKeyboard}
          onClick={() => controller.toggleHint()}
        >
          <Eye size={19} />
          Подсказка
        </button>
        <button
          className="button primary"
          disabled={state.loading}
          onClick={() => (running ? controller.pause() : void controller.start())}
        >
          {running ? <Pause size={20} /> : <Play size={20} />}{' '}
          {state.loading
            ? 'Загружаем…'
            : running
              ? 'Пауза'
              : session.phase === 'ready'
                ? 'Start'
                : 'Продолжить'}
        </button>
        <button className="button secondary" onClick={() => controller.hard()}>
          <Flag size={18} />
          Сложно
          {session.difficult.some((d) => d.id === hardIdentity(task, config.style)) ? ' ✓' : ''}
        </button>
      </div>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <div className="practice-voice-panel">
        <label className="practice-check">
          <input
            type="checkbox"
            role="switch"
            checked={voiceOn}
            onChange={(e) => controller.voice(e.target.checked)}
          />
          Голос
        </label>
        <span className="practice-voice-description">
          {voiceOn
            ? `${config.voiceLanguage === 'en' ? 'English' : 'Polski'} · ${lead === 2 ? 'за две доли' : lead === 1 ? 'за одну долю' : 'при смене задания'}`
            : 'Выключен'}
        </span>
        <button
          className="text-button"
          disabled={state.voiceLoading}
          onClick={() => controller.testVoice()}
        >
          {state.voiceLoading ? 'Загружаем…' : 'Проверить голос'}
        </button>
        {state.voiceMessage && <p role="status">{state.voiceMessage}</p>}
        {state.settingsSaving && <p role="status">Сохраняем настройки…</p>}
      </div>
      {displayKeyboard && (
        <section className="practice-live-hint" aria-label="Подсказка текущего задания">
          <div className="practice-hint-caption">
            <strong>{config.trainer === 'scale' ? task.instruction : task.chord.symbol}</strong>
            <span>
              {config.trainer === 'scale' || config.trainer === 'fill'
                ? 'Клавиши и пример'
                : 'Клавиши и звук аккорда'}
            </span>
          </div>
          {chordDiagram ? (
            <div className="practice-hint-hands">
              {hintHands.map((hand) => (
                <div key={hand.label}>
                  <p className="practice-hint-hand-label">
                    {hand.left ? '●' : '▼'} {hand.label} ·{' '}
                    {hand.notes
                      .map((n) => task.voicing.names[n] ?? getNoteName(n, 60 + task.key.pc))
                      .join(' · ')}
                  </p>
                  <PianoKeyboard
                    notes={hand.notes}
                    root={60 + task.key.pc}
                    active={hand.notes}
                    activeLabel="в аккорде"
                    activeLeft={hand.left ? hand.notes : []}
                    activeRight={hand.left ? [] : hand.notes}
                    names={task.voicing.names}
                    showMidi={showMidi}
                    display={keyboard}
                    compact
                    onNote={(note) => {
                      controller.pause();
                      void audioService.note(note);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <PianoKeyboard
              notes={notes}
              rangeNotes={
                task.trainer === 'fill'
                  ? [
                      ...notes,
                      ...task.examples.flatMap((example) =>
                        example.events.flatMap((event) => event.notes),
                      ),
                    ]
                  : notes
              }
              root={60 + task.key.pc}
              active={
                task.trainer === 'scale' || task.trainer === 'fill'
                  ? [...state.left, ...state.right]
                  : notes
              }
              activeLeft={
                task.trainer === 'scale' || task.trainer === 'fill'
                  ? state.left
                  : task.voicing.leftHand
              }
              activeRight={
                task.trainer === 'scale' || task.trainer === 'fill'
                  ? state.right
                  : task.voicing.rightHand
              }
              activeBass={state.bass}
              activeMelody={state.melody}
              targets={task.targetNotes}
              names={task.voicing.names}
              showMidi={showMidi}
              display={keyboard}
              compact
              onNote={(note) => {
                controller.pause();
                void audioService.note(note);
              }}
            />
          )}
          {!chordDiagram && <p className="practice-hint-legend">● Левая рука · ▼ Правая рука</p>}
        </section>
      )}
      <div className="practice-beats" aria-label={`Доля ${beat + 1} из ${meter.beats}`}>
        {Array.from({ length: meter.beats }, (_, i) => (
          <span key={i} className={i === beat && running ? 'current' : ''}>
            {config.meter === '6/8' ? (
              <>
                <i />
                <i />
                <i />
              </>
            ) : (
              i + 1
            )}
          </span>
        ))}
      </div>
      <div className="practice-time">
        <span>
          Такт {Math.floor(session.beat / meter.beats) + 1} · {config.meter}
        </span>
        <strong>
          {remaining === null
            ? formatTime(session.statistics.activeSeconds)
            : formatTime(remaining)}
        </strong>
        <span>{remaining === null ? 'без ограничения' : 'осталось'}</span>
      </div>
      <div className="practice-phrase-progress">
        <span style={{ width: `${Math.min(100, (state.taskBeat / task.durationBeats) * 100)}%` }} />
      </div>
      <div className="practice-session-tempo">
        <button aria-label="Темп минус один" onClick={() => controller.bpm(config.bpm - 1)}>
          −
        </button>
        <label>
          <input
            aria-label="BPM тренировки"
            type="number"
            min="30"
            max="200"
            value={config.bpm}
            onChange={(e) => controller.bpm(Number(e.target.value))}
          />
          <span>BPM</span>
        </label>
        <button aria-label="Темп плюс один" onClick={() => controller.bpm(config.bpm + 1)}>
          +
        </button>
        <input
          aria-label="Темп во время тренировки"
          type="range"
          min="30"
          max="200"
          value={config.bpm}
          onChange={(e) => controller.bpm(Number(e.target.value))}
        />
      </div>
      <div className="practice-secondary-actions">
        <button className="text-button" onClick={() => controller.hint()}>
          <Eye size={17} />
          Разбор
        </button>
        <button className="text-button" onClick={() => controller.next()}>
          <SkipForward size={17} />
          Следующее
        </button>
        <button className="text-button" onClick={() => controller.finish()}>
          <Square size={16} />
          Завершить
        </button>
      </div>
      <details className="practice-session-details">
        <summary>Фраза и подсказки</summary>
        <p>
          {task.phraseName} · {task.phraseIndex + 1} / {task.phraseLength}
        </p>
        {next.length > 1 && (
          <div className="practice-preview">
            {next.map((item) => (
              <span key={item.id}>{taskLabel(item, config)}</span>
            ))}
          </div>
        )}
        <Field label="Показывать подсказки">
          <select
            value={config.hintMode}
            onChange={(e) => updateHint(e.target.value as PracticeConfig['hintMode'])}
          >
            <option value="hidden">Скрыты</option>
            <option value="chord-name">Название аккорда</option>
            <option value="notes">Название и ноты</option>
            <option value="keyboard">Клавиши и звук</option>
            <option value="full">Полная подсказка со звуком</option>
          </select>
        </Field>
        <label className="practice-check">
          <input
            type="checkbox"
            checked={showMidi}
            onChange={(e) => setShowMidi(e.target.checked)}
          />
          MIDI-номера на клавишах
        </label>
      </details>
      {hinted && !displayKeyboard && (
        <div className="practice-inline-hint">
          <strong>{config.trainer === 'scale' ? task.instruction : task.chord.symbol}</strong>
          {config.hintMode !== 'chord-name' && (
            <span>
              {config.trainer === 'scale'
                ? [...new Set(notes.map((n) => getNoteName(n, 60 + task.key.pc)))].join(' · ')
                : `${task.chord.names.join(' · ')} · ${task.chord.formula}`}
            </span>
          )}
        </div>
      )}
      {settings && (
        <Dialog title="Настройки тренировки" onClose={() => setSettings(false)}>
          <p>{meter.label}. Изменения применяются сразу.</p>
          <ChannelsForm config={config} onChange={(value) => controller.config(value)} />
          <Field label="Предпросмотр">
            <select
              value={config.previewCount}
              onChange={(e) =>
                controller.config({ ...config, previewCount: Number(e.target.value) as 0 })
              }
            >
              {[0, 1, 2, 4].map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Язык голоса">
            <select
              value={config.voiceLanguage}
              onChange={(e) => {
                controller.pause();
                controller.config({ ...config, voiceLanguage: e.target.value as 'en' | 'pl' });
              }}
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </Field>
          <Field label="Когда произносить">
            <select
              value={config.voiceTiming}
              onChange={(e) =>
                controller.config({
                  ...config,
                  voiceTiming: e.target.value as PracticeConfig['voiceTiming'],
                })
              }
            >
              <option value="on-change">При смене задания</option>
              <option value="one-beat-before">За одну долю</option>
              <option value="two-beats-before">За две доли</option>
              <option value="off">Выключено</option>
            </select>
          </Field>
          <p className="muted">
            Голос произносит номер ступени на выбранном языке. Без предпросмотра — при смене
            задания. Кнопка «Проверить голос» включает его и произносит текущую ступень сразу.
          </p>
          <p className="muted">
            Тональность, стиль и типы заданий выбираются перед новой тренировкой. Здесь сохраняется
            текущая музыкальная фраза.
          </p>
          <button className="button primary" onClick={() => setSettings(false)}>
            Готово
          </button>
        </Dialog>
      )}
      {session.phase === 'hint' && (
        <Dialog title="Разбор задания" onClose={() => controller.closeHint()}>
          <p className="eyebrow">
            {keyName(task.key)} · {task.chord.roman}
          </p>
          <h3>{task.trainer === 'scale' ? task.instruction : task.chord.symbol}</h3>
          <p>
            {task.trainer === 'scale'
              ? [...new Set(notes.map((n) => getNoteName(n, 60 + task.key.pc)))].join(' · ')
              : `${task.chord.names.join(' · ')} · ${task.chord.formula}`}
          </p>
          {task.trainer !== 'scale' && (
            <>
              <p>{task.chord.function}</p>
              <p>{task.voicing.instruction}</p>
            </>
          )}
          <PianoKeyboard
            notes={notes}
            root={60 + task.key.pc}
            active={notes}
            activeLeft={
              task.plan
                ? task.plan.events.filter((e) => e.hand === 'left').flatMap((e) => e.notes)
                : task.voicing.leftHand
            }
            activeRight={
              task.plan
                ? task.plan.events.filter((e) => e.hand === 'right').flatMap((e) => e.notes)
                : task.voicing.rightHand
            }
            targets={task.targetNotes}
            names={task.voicing.names}
            display={keyboard}
            showMidi={showMidi}
            onNote={(note) => void audioService.note(note)}
          />
          {task.trainer !== 'scale' && (
            <details>
              <summary>Другие расположения</summary>
              {(['close', 'open', 'shell'] as const)
                .filter((kind) => supportsVoicing(task.chord.type, kind))
                .map((kind) => {
                  const alt = voiceChord(task.chord, kind);
                  return (
                    <p key={kind}>
                      {alt.instruction}:{' '}
                      {[...alt.leftHand, ...alt.rightHand].map((n) => alt.names[n]).join(' · ')}
                    </p>
                  );
                })}
            </details>
          )}
          <MusicalExamplePlayer
            key={task.id}
            examples={task.examples.map((e) => ({ ...e, bpm: config.bpm }))}
            practice
          />
          <div className="practice-hint-actions">
            <button
              className="button primary"
              onClick={() => {
                controller.closeHint();
                void controller.start();
              }}
            >
              <RotateCcw size={18} />
              Повторить с отсчётом
            </button>
            <button
              className="button secondary"
              onClick={() => {
                controller.closeHint(true);
                void controller.start();
              }}
            >
              Следующее с отсчётом
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
