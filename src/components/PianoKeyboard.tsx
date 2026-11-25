import { getKeyboardRange, getNoteName, isBlackKey, pitchClass } from '../core/music';
import { useId } from 'react';
import { defaultPreferences, type KeyboardPreferences } from '../core/types';
interface Props {
  notes: number[];
  rangeNotes?: number[];
  active?: number[];
  activeLabel?: string;
  activeLeft?: number[];
  activeRight?: number[];
  targets?: number[];
  activeBass?: number[];
  activeMelody?: number[];
  showMidi?: boolean;
  root: number;
  labels?: Record<number, string>;
  names?: Record<number, string>;
  fingering?: Record<number, string>;
  display?: KeyboardPreferences;
  onNote?: (midi: number) => void;
  compact?: boolean;
}
export function PianoKeyboard({
  notes,
  rangeNotes,
  active = [],
  activeLabel = 'звучит',
  activeLeft = [],
  activeRight = [],
  targets = [],
  activeBass = [],
  activeMelody = [],
  showMidi = false,
  root,
  labels = {},
  names = {},
  fingering = {},
  display = defaultPreferences.keyboard,
  onNote,
  compact = false,
}: Props) {
  const mixedId = useId().replaceAll(':', '');
  const range = getKeyboardRange(rangeNotes ?? notes);
  const all = Array.from({ length: range.end - range.start + 1 }, (_, i) => i + range.start);
  const white = all.filter((n) => !isBlackKey(n));
  const width = white.length * 42;
  const height = compact && !display.octaves && !display.fingering ? 120 : 170;
  const key = (note: number, black: boolean) => {
    const whiteBefore = all.filter((n) => n < note && !isBlackKey(n)).length;
    const x = black ? whiteBefore * 42 - 13 : whiteBefore * 42;
    const chosen = notes.includes(note);
    const playing = active.includes(note);
    const left = activeLeft.includes(note);
    const right = activeRight.includes(note);
    const target = targets.includes(note);
    const tonic = pitchClass(note) === pitchClass(root);
    const name = names[note] ?? getNoteName(note, root, true);
    const degree =
      labels[note] ??
      ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'][pitchClass(note - root)];
    const keyHeight = black ? height * 0.61 : height;
    const extraLabels = [
      ...(display.octaves
        ? [{ className: 'key-octave', text: String(Math.floor(note / 12) - 1) }]
        : []),
      ...(display.fingering && fingering[note]
        ? [{ className: 'key-fingering', text: `↳ ${fingering[note]}` }]
        : []),
    ];
    const nameY = keyHeight - 15 - extraLabels.length * 13;
    return (
      <g
        key={note}
        className={`piano-key ${black ? 'black' : 'white'} ${chosen ? 'selected' : ''} ${playing ? 'playing' : ''} ${left ? 'left-hand' : ''} ${right ? 'right-hand' : ''} ${target ? 'target-key' : ''} ${activeMelody.includes(note) ? 'melody-key' : ''}`}
        role={onNote ? 'button' : undefined}
        tabIndex={onNote ? 0 : undefined}
        aria-label={`${name}${tonic ? ', тоника' : ''}${labels[note] ? `, ступень ${labels[note]}` : ''}${playing ? `, ${activeLabel}` : ''}${left ? ', левая рука' : ''}${right ? ', правая рука' : ''}${target ? ', целевая нота' : ''}${activeBass.includes(note) ? ', бас' : ''}${activeMelody.includes(note) ? ', мелодия' : ''}${showMidi ? `, MIDI ${note}` : ''}`}
        onClick={() => onNote?.(note)}
        onKeyDown={(e) => {
          if (onNote && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onNote(note);
          }
        }}
      >
        <rect
          x={x + 1}
          y={1}
          width={black ? 26 : 40}
          height={black ? height * 0.61 : height - 2}
          rx={black ? 4 : 5}
          style={left && right ? { fill: `url(#${mixedId})` } : undefined}
        />
        {chosen && display.degrees && (
          <text
            className="degree-label"
            x={x + (black ? 14 : 21)}
            y={nameY - (display.noteNames ? 20 : 0)}
            textAnchor="middle"
          >
            {degree}
          </text>
        )}
        {display.noteNames && (
          <text className="key-name" x={x + (black ? 14 : 21)} y={nameY} textAnchor="middle">
            {name.replace(/-?\d+$/, '')}
          </text>
        )}
        {extraLabels.map((label, index) => (
          <text
            key={label.className}
            className={label.className}
            x={x + (black ? 14 : 21)}
            y={nameY + (index + 1) * 13}
            textAnchor="middle"
          >
            {label.text}
          </text>
        ))}
        {tonic && chosen && display.tonicMarker && (
          <circle
            className="tonic-dot"
            cx={x + (black ? 14 : 21)}
            cy={black ? 31 : nameY - (display.degrees && display.noteNames ? 40 : 24)}
            r={3.5}
          />
        )}
        {left && (
          <circle
            className="active-marker"
            cx={x + (black ? 14 : 21)}
            cy={right ? 32 : 20}
            r={3.5}
          />
        )}
        {target && (
          <path className="target-marker" d={`M${x + (black ? 14 : 21)} 6 l4 4 l-4 4 l-4 -4 z`} />
        )}
        {showMidi && (
          <text
            className="key-midi"
            x={x + (black ? 13 : 20)}
            y={black ? height * 0.48 : height - 32}
            textAnchor="middle"
          >
            {note}
          </text>
        )}
        {playing && (!left || right) && (
          <path className="active-marker" d={`M${x + (black ? 10 : 17)} 18 l4 6 l4 -6 z`} />
        )}
      </g>
    );
  };
  return (
    <div
      className="keyboard-scroll"
      role="region"
      aria-label="Клавиатура пианино. Если не помещается, прокрути горизонтально."
      tabIndex={0}
    >
      <svg
        className="piano-keyboard"
        role="group"
        aria-label="Ноты упражнения"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: compact ? undefined : Math.max(300, white.length * 29), width: '100%' }}
      >
        <defs>
          <linearGradient id={mixedId}>
            <stop offset="50%" stopColor="var(--left-hand-key)" />
            <stop offset="50%" stopColor="var(--right-hand-key)" />
          </linearGradient>
        </defs>
        {white.map((n) => key(n, false))}
        {all.filter(isBlackKey).map((n) => key(n, true))}
      </svg>
    </div>
  );
}
