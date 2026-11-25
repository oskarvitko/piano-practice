import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Hand, Music2 } from 'lucide-react';
import type { Exercise, MusicalExample } from '../core/types';
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
import { IconButton } from './ui';
import { AudioControls } from './AudioControls';
import { MusicalExamplePlayer } from './MusicalExamplePlayer';

export function ExerciseViewer({
  exercise,
  initialHidden = false,
  examples = exercise.examples ?? [],
}: {
  exercise: Exercise;
  initialHidden?: boolean;
  examples?: MusicalExample[];
}) {
  const [mode, setMode] = useState<'exercise' | 'examples'>(
    examples.length && !initialHidden ? 'examples' : 'exercise',
  );
  return (
    <div className="exercise-workspace">
      {examples.length > 0 && (
        <div className="exercise-modes" role="group" aria-label="Режим упражнения">
          <button
            aria-pressed={mode === 'exercise'}
            onClick={() => {
              audioService.stopAll();
              setMode('exercise');
            }}
          >
            Разбор упражнения
          </button>
          <button
            aria-pressed={mode === 'examples'}
            onClick={() => {
              audioService.stopAll();
              setMode('examples');
            }}
          >
            Музыкальные примеры · {examples.length}
          </button>
        </div>
      )}
      {mode === 'examples' && examples.length ? (
        <MusicalExamplePlayer
          examples={examples}
          title={exercise.title}
          instruction={exercise.instructions[0]}
        />
      ) : (
        <ExerciseStudy exercise={exercise} initialHidden={initialHidden} />
      )}
    </div>
  );
}

function ExerciseStudy({
  exercise,
  initialHidden = false,
}: {
  exercise: Exercise;
  initialHidden?: boolean;
}) {
  const [manual, setManual] = useState(0);
  const [hidden, setHidden] = useState(initialHidden);
  const state = useSyncExternalStore(audioService.subscribe, audioService.snapshot);
  const audio =
    state.planId === exercise.id
      ? state
      : {
          ...state,
          status: 'stopped',
          index: 0,
          notes: state.planId?.startsWith('note-') ? state.notes : [],
        };
  const preferences = useAppStore((store) => store.preferences);
  const prefs = preferences.audio;
  const [bpm, setBpm] = useState(
    prefs.bpmOverride ? prefs.bpm : (exercise.playback?.bpm ?? prefs.bpm),
  );
  const plan = useMemo(() => createPlaybackPlan(exercise, bpm), [exercise, bpm]);
  const v = exercise.visualization;
  useEffect(() => () => audioService.stopAll(), []);
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
      <AudioControls plan={plan} bpm={bpm} onBpmChange={setBpm} onStop={() => setManual(0)} />
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
