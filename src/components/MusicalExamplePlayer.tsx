import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MusicalExample } from '../core/types';
import { degreeLabel, getNoteName, pitchClass, spellDegree } from '../core/music';
import { examplePlaybackPlan, rhythmLabel, transposeExample } from '../core/music/examples';
import { audioService } from '../audio/service';
import { frameAtBeat } from '../audio/scheduler';
import { useAppStore } from '../stores/app';
import { AudioControls } from './AudioControls';
import { PianoKeyboard } from './PianoKeyboard';
import { IconButton } from './ui';

export function MusicalExamplePlayer({
  examples,
  title,
  instruction,
}: {
  examples: MusicalExample[];
  title?: string;
  instruction?: string;
}) {
  const [selected, setSelected] = useState(0);
  const [root, setRoot] = useState(examples[0]?.root ?? 60);
  const selectId = useId();
  const original = examples[selected] ?? examples[0];
  const example = useMemo(() => original && transposeExample(original, root), [original, root]);
  if (!example) return null;
  return (
    <section className="exercise-card musical-example" aria-label="Музыкальные примеры">
      <span className="eyebrow">
        <Music2 size={15} /> ПРИЁМ В МУЗЫКЕ
      </span>
      {title && <h3 className="example-exercise-title">{title}</h3>}
      {instruction && <p className="exercise-instruction">{instruction}</p>}
      <div className="example-selectors">
        <label htmlFor={selectId}>
          Пример {selected + 1} из {examples.length}
          <select
            id={selectId}
            value={selected}
            onChange={(event) => {
              audioService.stopAll();
              setSelected(Number(event.target.value));
            }}
          >
            {examples.map((item, index) => (
              <option key={item.id} value={index}>
                {index + 1}. {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тональность
          <select
            value={pitchClass(root)}
            onChange={(event) => {
              audioService.stopAll();
              const pc = Number(event.target.value);
              setRoot(original.root + ((pc - pitchClass(original.root) + 18) % 12) - 6);
            }}
          >
            {Array.from({ length: 12 }, (_, pc) => (
              <option value={pc} key={pc}>
                {getNoteName(60 + pc, 60 + pc)} major
              </option>
            ))}
          </select>
        </label>
      </div>
      <ExamplePhrase key={`${example.id}-${root}`} example={example} />
    </section>
  );
}

function ExamplePhrase({ example }: { example: MusicalExample }) {
  const preferences = useAppStore((store) => store.preferences);
  const [bpm, setBpm] = useState(
    preferences.audio.bpmOverride ? preferences.audio.bpm : example.bpm,
  );
  const [manual, setManual] = useState(0);
  const plan = useMemo(() => examplePlaybackPlan(example, bpm), [example, bpm]);
  const audio = useSyncExternalStore(audioService.subscribe, audioService.snapshot);
  const own = audio.planId === plan.id;
  const playing = own && audio.status === 'playing';
  const paused = own && audio.status === 'paused';
  const positions = useMemo(
    () => [...new Set(example.events.map((event) => event.startBeat))].sort((a, b) => a - b),
    [example],
  );
  const beat = playing || paused ? audio.positionBeat : positions[manual];
  const frame = playing
    ? {
        notes: audio.notes,
        leftNotes: audio.leftNotes,
        rightNotes: audio.rightNotes,
        eventIndexes: audio.eventIndexes,
      }
    : frameAtBeat(plan, beat);
  const positionIndex = Math.max(
    0,
    positions.reduce((latest, position, index) => (position <= beat ? index : latest), 0),
  );
  const seek = (index: number) => {
    audioService.stop();
    setManual(Math.max(0, Math.min(positions.length - 1, index)));
  };
  const seekBeat = (at: number) => seek(positions.indexOf(at));
  const melody = example.events
    .map((event, index) => ({ ...event, index }))
    .filter((event) => event.hand === 'right');
  const names: Record<number, string> = {};
  const labels: Record<number, string> = {};
  for (const event of melody)
    event.notes.forEach((note, index) => {
      const degree = event.degrees?.[index];
      if (degree) {
        names[note] = spellDegree(example.root, degree);
        labels[note] = degreeLabel(degree);
      }
    });
  const target =
    example.targetNotes.find((item) => item.beat <= beat && frame.rightNotes.includes(item.note)) ??
    example.targetNotes.find((item) => item.beat >= beat) ??
    example.targetNotes.at(-1);
  const allNotes = example.events.flatMap((event) => event.notes);
  return (
    <>
      <div className="example-description">
        <h4>{example.title}</h4>
        <p>{example.description}</p>
        <span>
          {example.beatsPerBar}/4 · {example.lengthBeats / example.beatsPerBar} такта ·
          рекомендуется {example.bpm} BPM
        </span>
      </div>
      <div className="example-progression" role="group" aria-label="Аккордовая прогрессия">
        {example.progression.map((chord, index) => (
          <button
            key={`${chord.name}-${index}`}
            className={
              chord.startBeat <= beat && beat < chord.startBeat + chord.durationBeats
                ? 'current-chord'
                : ''
            }
            aria-pressed={chord.startBeat <= beat && beat < chord.startBeat + chord.durationBeats}
            onClick={() => seekBeat(chord.startBeat)}
          >
            <small>
              {index === 0
                ? 'Начало'
                : index === example.progression.length - 1
                  ? 'Разрешение'
                  : `Такт ${index + 1}`}
            </small>
            <strong>{chord.name}</strong>
            <span>{chord.symbol}</span>
          </button>
        ))}
      </div>
      <div className="phrase-position">
        <span>
          Такт {Math.floor(beat / example.beatsPerBar) + 1} · доля{' '}
          {Number(((beat % example.beatsPerBar) + 1).toFixed(2))}
        </span>
        <span>
          Событие {positionIndex + 1} / {positions.length}
        </span>
      </div>
      <div
        className="phrase-progress"
        role="progressbar"
        aria-label="Позиция в музыкальной фразе"
        aria-valuemin={0}
        aria-valuemax={example.lengthBeats}
        aria-valuenow={beat}
      >
        <span style={{ width: `${(beat / example.lengthBeats) * 100}%` }} />
      </div>
      <div className="melody-heading">
        <strong>Правая рука · мелодия</strong>
        <span>Нота · ступень · длительность</span>
      </div>
      <div className="example-melody" aria-label="Ноты и ритм мелодии">
        {melody.map((event) => {
          const isTarget = example.targetNotes.some(
            (target) => target.beat === event.startBeat && event.notes.includes(target.note),
          );
          return (
            <button
              key={event.index}
              className={`${frame.eventIndexes.includes(event.index) ? 'current-note' : ''} ${isTarget ? 'target-event' : ''}`}
              aria-pressed={frame.eventIndexes.includes(event.index)}
              onClick={() => seekBeat(event.startBeat)}
              aria-label={`${event.notes.map((note) => names[note] ?? getNoteName(note, example.root, true)).join(', ')}, ${rhythmLabel(event.durationBeats)}${isTarget ? ', целевая нота' : ''}`}
            >
              <strong>
                {isTarget && <span aria-hidden="true">◇ </span>}
                {event.notes
                  .map((note, index) =>
                    event.degrees?.[index]
                      ? spellDegree(example.root, event.degrees[index])
                      : getNoteName(note, example.root, true),
                  )
                  .join(' · ')}
              </strong>
              <small>
                {event.degrees?.map(degreeLabel).join(' · ')} · {rhythmLabel(event.durationBeats)}
              </small>
            </button>
          );
        })}
      </div>
      <p className="left-hand-line">
        <strong>Левая рука:</strong>{' '}
        {example.progression
          .map(
            (chord) =>
              `${chord.name} (${chord.notes.map((note) => getNoteName(note, example.root, true)).join('–')})`,
          )
          .join(' → ')}
        . Держи каждый аккорд {example.beatsPerBar} доли.
      </p>
      <PianoKeyboard
        notes={allNotes}
        active={frame.notes}
        activeLeft={frame.leftNotes}
        activeRight={frame.rightNotes}
        targets={example.targetNotes.map((target) => target.note)}
        root={example.root}
        names={names}
        labels={labels}
        display={preferences.keyboard}
      />
      <div className="example-keyboard-legend">
        <span className="left-legend">● Левая рука</span>
        <span className="right-legend">▲ Правая рука</span>
        <span className="target-legend">◇ Цель</span>
        <Link to="/settings#keyboard">Подписи клавиш</Link>
      </div>
      <div className="example-step-controls">
        <IconButton
          label="Предыдущее музыкальное событие"
          disabled={positionIndex === 0}
          onClick={() => seek(positionIndex - 1)}
        >
          <ChevronLeft size={20} />
        </IconButton>
        <span>Разбери фразу по событиям</span>
        <IconButton
          label="Следующее музыкальное событие"
          disabled={positionIndex === positions.length - 1}
          onClick={() => seek(positionIndex + 1)}
        >
          <ChevronRight size={20} />
        </IconButton>
      </div>
      {target && (
        <div className="example-target">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>
              {names[target.note] ?? getNoteName(target.note, example.root, true)} —{' '}
              {target.function} {target.chord}
            </strong>
            <p>
              Попади в эту ноту вместе с аккордом {target.chord}, в начале такта{' '}
              {Math.floor(target.beat / example.beatsPerBar) + 1}.
            </p>
          </div>
        </div>
      )}
      <AudioControls
        plan={plan}
        bpm={bpm}
        onBpmChange={setBpm}
        onStop={() => setManual(0)}
        recommendedBpm={example.bpm}
      />
      <details className="practice-notes example-method">
        <summary>Как разучивать пример</summary>
        <ol>
          <li>Прочитай объяснение и найди целевую ноту следующего аккорда.</li>
          <li>Прослушай фразу целиком: аккорд, пассаж и разрешение.</li>
          <li>Разбери ноты и ритм по событиям, затем сыграй каждую руку отдельно.</li>
          <li>Нажми «Медленнее» и повтори пример двумя руками.</li>
          <li>Верни рекомендуемый темп, когда получится чисто.</li>
          <li>Выбери второй пример и сравни другой аккордовый переход.</li>
          <li>Создай собственную вариацию: измени начало или ритм, сохрани цель.</li>
          <li>Примени приём к другой прогрессии; затем перенеси его в другую тональность.</li>
        </ol>
      </details>
    </>
  );
}
