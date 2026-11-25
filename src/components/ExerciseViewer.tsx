import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Hand,
  Play,
  Square,
  Pause,
  Repeat2,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  Music2,
} from 'lucide-react';
import type { Exercise } from '../core/types';
import {
  createPlaybackPlan,
  degreeLabel,
  getNoteName,
  parseDegrees,
  resolveDegree,
  SCALE_FORMULAS,
  spellDegree,
  visualizationNotes,
} from '../core/music';
import { audioService } from '../audio/service';
import { useAppStore } from '../stores/app';
import { PianoKeyboard } from './PianoKeyboard';
import { ErrorMessage, IconButton } from './ui';

export function ExerciseViewer({
  exercise,
  initialHidden = false,
}: {
  exercise: Exercise;
  initialHidden?: boolean;
}) {
  const [manual, setManual] = useState(0);
  const [hidden, setHidden] = useState(initialHidden);
  const [details, setDetails] = useState(false);
  const audio = useSyncExternalStore(audioService.subscribe, audioService.snapshot);
  const { preferences, savePreferences } = useAppStore();
  const prefs = preferences.audio;
  const [bpm, setBpm] = useState(
    prefs.bpmOverride ? prefs.bpm : (exercise.playback?.bpm ?? prefs.bpm),
  );
  const plan = useMemo(() => createPlaybackPlan(exercise, bpm), [exercise, bpm]);
  const v = exercise.visualization;
  useEffect(() => {
    audioService.configure({ ...prefs, bpm });
  }, [prefs, bpm]);
  useEffect(() => () => audioService.stopAll(), []);
  const changeBpm = (n: number) => {
    const next = Math.max(40, Math.min(180, Math.round(n / 5) * 5));
    setBpm(next);
    audioService.configure({ ...prefs, bpm: next });
    audioService.restart(next, prefs.loop);
    if (audio.metronome) void audioService.startMetronome();
    void savePreferences({ audio: { ...prefs, bpm: next, bpmOverride: true } });
  };
  const updatePrefs = (patch: Partial<typeof prefs>) => {
    const value = { ...prefs, ...patch, bpm };
    audioService.configure(value);
    void savePreferences({ audio: value });
    if (patch.loop !== undefined) audioService.restart(bpm, value.loop);
    if ((patch.subdivision || patch.beatsPerBar) && audio.metronome)
      void audioService.startMetronome();
  };
  const labels: Record<number, string> = {};
  const names: Record<number, string> = {};
  if (v.type === 'scale')
    for (let oct = 0; oct <= v.octaves; oct++)
      for (const d of parseDegrees(SCALE_FORMULAS[v.scale])) {
        const note = resolveDegree(v.root, { ...d, octave: oct });
        labels[note] = degreeLabel(d);
        names[note] = spellDegree(v.root, { ...d, octave: oct });
      }
  if (v.type === 'sequence')
    v.pattern.forEach((d) => {
      const note = resolveDegree(v.root, d);
      labels[note] = degreeLabel(d);
      names[note] = spellDegree(v.root, d);
    });
  const current = audio.status === 'playing' || audio.status === 'paused' ? audio.index : manual;
  const notes =
    v.type === 'progression' ? v.chords[current % v.chords.length].notes : visualizationNotes(v);
  const focus = audio.notes.length
    ? audio.notes
    : audio.status === 'playing'
      ? []
      : v.type === 'sequence' || v.type === 'progression'
        ? (plan.events[current]?.notes ?? [])
        : [];
  const noteNames =
    v.type === 'sequence'
      ? v.pattern.map((d) => spellDegree(v.root, d, true))
      : v.type === 'scale'
        ? parseDegrees(SCALE_FORMULAS[v.scale]).map((d) => spellDegree(v.root, d, false))
        : notes.map((n) => getNoteName(n, v.root, true));
  const manualStep = (delta: number) => {
    audioService.stop();
    setManual((manual + delta + plan.events.length) % plan.events.length);
  };
  return (
    <section className="exercise-card" aria-label="Музыкальное упражнение">
      <div className="exercise-heading">
        <span className="eyebrow">
          <Music2 size={15} />{' '}
          {v.type === 'scale'
            ? 'ГАММА'
            : v.type === 'sequence'
              ? 'ПОСЛЕДОВАТЕЛЬНОСТЬ'
              : v.type === 'chord'
                ? 'АККОРД'
                : 'ГАРМОНИЯ'}
        </span>
        <button className="text-button small" onClick={() => setHidden(!hidden)}>
          {hidden ? <Eye size={17} /> : <EyeOff size={17} />} {hidden ? 'Показать' : 'Скрыть'}{' '}
          подсказку
        </button>
      </div>
      <div className="exercise-title-row">
        <h3>{exercise.title}</h3>
        <span className="hand-label">
          <Hand size={15} />
          {exercise.hand ?? 'RH'}
        </span>
      </div>
      <p className="exercise-instruction">{exercise.instructions[0]}</p>
      {hidden ? (
        <div className="hidden-notes">
          <EyeOff size={28} />
          <p>Попробуй сыграть по памяти</p>
          <span>Открой подсказку, когда захочешь себя проверить.</span>
        </div>
      ) : (
        <>
          <div className="formula">
            {exercise.formula ?? (v.type === 'chord' ? v.name : '')}
            {exercise.target && <span className="target-note">Цель: {exercise.target}</span>}
          </div>
          <div className="note-sequence" aria-label="Ноты">
            {noteNames.map((n, i) => (
              <span
                key={`${i}-${n}`}
                className={v.type === 'sequence' && current === i ? 'current-note' : ''}
              >
                {n}
              </span>
            ))}
          </div>
          {v.type === 'progression' && (
            <div className="chord-tabs">
              {v.chords.map((chord, i) => (
                <button
                  key={`${chord.name}-${i}`}
                  className={current === i ? 'selected' : ''}
                  aria-pressed={current === i}
                  onClick={() => {
                    audioService.stop();
                    setManual(i);
                  }}
                >
                  {chord.name}
                </button>
              ))}
            </div>
          )}
          <PianoKeyboard
            notes={notes}
            rangeNotes={visualizationNotes(v)}
            active={focus}
            root={v.root}
            labels={labels}
            names={names}
            fingering={exercise.fingering}
            display={preferences.keyboard}
            onNote={(n) => void audioService.note(n)}
          />
          <div className="keyboard-caption">
            <div className="keyboard-legend">
              {preferences.keyboard.degrees && <span>Цифры — ступени</span>}
              {preferences.keyboard.tonicMarker && <span>● Тоника</span>}
              {preferences.keyboard.fingering && exercise.fingering && <span>↳ Палец</span>}
              <Link to="/settings#keyboard">Подписи клавиш</Link>
            </div>
            {(v.type === 'sequence' || v.type === 'progression') && (
              <div className="manual-controls">
                <IconButton label="Предыдущая нота или аккорд" onClick={() => manualStep(-1)}>
                  <ChevronLeft size={18} />
                </IconButton>
                <span>
                  {current + 1} / {plan.events.length}
                </span>
                <IconButton label="Следующая нота или аккорд" onClick={() => manualStep(1)}>
                  <ChevronRight size={18} />
                </IconButton>
              </div>
            )}
          </div>
        </>
      )}
      <div className="audio-controls">
        <button
          className="audio-play"
          aria-label={audio.status === 'playing' ? 'Пауза воспроизведения' : 'Слушать упражнение'}
          disabled={audio.status === 'loading'}
          onClick={() =>
            audio.status === 'playing'
              ? audioService.pause()
              : void audioService.play(plan, prefs.loop, true)
          }
        >
          {audio.status === 'playing' ? (
            <Pause size={23} />
          ) : (
            <Play size={23} fill="currentColor" />
          )}
        </button>
        <div className="audio-title">
          <strong>
            {audio.status === 'loading'
              ? 'Подключаем звук…'
              : audio.status === 'playing'
                ? 'Играет пример'
                : audio.status === 'paused'
                  ? 'Продолжить пример'
                  : 'Послушать пример'}
          </strong>
          <span>
            {audio.mode === 'piano' ? 'Пианино' : 'Синтезатор'} ·{' '}
            {prefs.muted ? 'без звука' : 'с подсветкой нот'}
          </span>
        </div>
        <IconButton
          label="Остановить воспроизведение"
          onClick={() => {
            audioService.stop();
            setManual(0);
          }}
        >
          <Square size={18} />
        </IconButton>
        <IconButton
          label="Повторять по кругу"
          aria-pressed={prefs.loop}
          className={prefs.loop ? 'is-active' : ''}
          onClick={() => updatePrefs({ loop: !prefs.loop })}
        >
          <Repeat2 size={21} />
        </IconButton>
      </div>
      <div className="audio-secondary">
        <div className="bpm-control">
          <IconButton
            label="Уменьшить темп"
            onClick={() => changeBpm(bpm - 5)}
            disabled={bpm <= 40}
          >
            <Minus size={17} />
          </IconButton>
          <label>
            <input
              aria-label="Темп BPM"
              type="number"
              min={40}
              max={180}
              step={5}
              value={bpm}
              onChange={(e) => {
                if (e.target.value) changeBpm(Number(e.target.value));
              }}
            />
            <span>BPM</span>
          </label>
          <IconButton
            label="Увеличить темп"
            onClick={() => changeBpm(bpm + 5)}
            disabled={bpm >= 180}
          >
            <Plus size={17} />
          </IconButton>
        </div>
        <button
          className="text-button small"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          Звук и метроном
        </button>
      </div>
      <div className="tempo-slider">
        <span aria-hidden="true">40</span>
        <input
          aria-label="Темп воспроизведения, BPM"
          aria-valuetext={`${bpm} ударов в минуту`}
          type="range"
          min={40}
          max={180}
          step={5}
          value={bpm}
          onChange={(e) => changeBpm(Number(e.target.value))}
        />
        <span aria-hidden="true">180</span>
      </div>
      {details && (
        <div className="audio-settings">
          <div className="volume-row">
            <IconButton
              label={prefs.muted ? 'Включить звук' : 'Выключить звук'}
              aria-pressed={prefs.muted}
              onClick={() => updatePrefs({ muted: !prefs.muted })}
            >
              {prefs.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </IconButton>
            <input
              aria-label="Громкость"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
            />
            <span>{Math.round(prefs.volume * 100)}%</span>
          </div>
          <div className="metronome-row">
            <button
              className={`button secondary small ${audio.metronome ? 'is-active' : ''}`}
              aria-pressed={audio.metronome}
              onClick={() =>
                audio.metronome ? audioService.stopMetronome() : void audioService.startMetronome()
              }
            >
              {audio.metronome ? <Pause size={16} /> : <Play size={16} />}Метроном
            </button>
            <div className="beat-dots" aria-label={`Доля ${audio.beat + 1}`}>
              {Array.from({ length: prefs.beatsPerBar }, (_, i) => (
                <span key={i} className={audio.metronome && audio.beat === i ? 'lit' : ''}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="field-pair">
            <label>
              Деление
              <select
                value={prefs.subdivision}
                onChange={(e) =>
                  updatePrefs({ subdivision: Number(e.target.value) as 1 | 2 | 3 | 4 })
                }
              >
                <option value={1}>Четверти</option>
                <option value={2}>Восьмые</option>
                <option value={3}>Триоли</option>
                <option value={4}>Шестнадцатые</option>
              </select>
            </label>
            <label>
              Размер
              <select
                value={prefs.beatsPerBar}
                onChange={(e) => updatePrefs({ beatsPerBar: Number(e.target.value) })}
              >
                <option value={3}>3/4</option>
                <option value={4}>4/4</option>
                <option value={6}>6/4</option>
              </select>
            </label>
          </div>
          <p className="hint">Метроном и таймер запускаются отдельно. Первая доля — с акцентом.</p>
        </div>
      )}
      {audio.error && <ErrorMessage>{audio.error}</ErrorMessage>}
      <details className="practice-notes">
        <summary>На что обратить внимание</summary>
        {exercise.instructions.slice(1).map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <p>LH — левая рука, RH — правая. Нажми на клавишу, чтобы услышать отдельную ноту.</p>
      </details>
    </section>
  );
}
