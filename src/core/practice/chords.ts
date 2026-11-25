import { MAJOR, parseDegrees, pitchClass, resolveDegree, spellDegree } from '../music';
import type {
  ChordDefinition,
  ChordVoicing,
  HarmonicChord,
  MusicalKey,
  RelativeChord,
  VoicingKind,
} from './types';
import { VOICINGS } from './config';

const rows: [string, string, string, string, string, number, ChordDefinition['family']][] = [
  ['major', '', 'Major', 'Трезвучия', '1 3 5', 1, 'major'],
  ['minor', 'm', 'Minor', 'Трезвучия', '1 b3 5', 1, 'minor'],
  ['diminished', 'dim', 'Diminished', 'Трезвучия', '1 b3 b5', 2, 'diminished'],
  ['augmented', 'aug', 'Augmented', 'Трезвучия', '1 3 #5', 4, 'augmented'],
  ['sus2', 'sus2', 'Sus2', 'Sus', '1 2 5', 2, 'suspended'],
  ['sus4', 'sus4', 'Sus4', 'Sus', '1 4 5', 2, 'suspended'],
  ['7sus4', '7sus4', '7sus4', 'Sus', '1 4 5 b7', 3, 'dominant'],
  ['add2', 'add2', 'Add2', 'Добавленные ноты', '1 2 3 5', 2, 'major'],
  ['add4', 'add4', 'Add4', 'Добавленные ноты', '1 3 4 5', 2, 'major'],
  ['add9', 'add9', 'Add9', 'Добавленные ноты', '1 3 5 9', 2, 'major'],
  ['add11', 'add11', 'Add11', 'Добавленные ноты', '1 3 5 11', 3, 'major'],
  ['madd9', 'm(add9)', 'Minor add9', 'Добавленные ноты', '1 b3 5 9', 2, 'minor'],
  ['6', '6', '6', 'Секстаккорды', '1 3 5 6', 3, 'major'],
  ['m6', 'm6', 'm6', 'Секстаккорды', '1 b3 5 6', 3, 'minor'],
  ['6/9', '6/9', '6/9', 'Секстаккорды', '1 3 5 6 9', 3, 'major'],
  ['7', '7', 'Dominant7', 'Септаккорды', '1 3 5 b7', 3, 'dominant'],
  ['maj7', 'maj7', 'Maj7', 'Септаккорды', '1 3 5 7', 3, 'major'],
  ['m7', 'm7', 'm7', 'Септаккорды', '1 b3 5 b7', 3, 'minor'],
  ['mMaj7', 'mMaj7', 'mMaj7', 'Септаккорды', '1 b3 5 7', 4, 'minor'],
  ['dim7', 'dim7', 'dim7', 'Септаккорды', '1 b3 b5 bb7', 4, 'diminished'],
  ['m7b5', 'm7b5', 'm7♭5', 'Септаккорды', '1 b3 b5 b7', 3, 'diminished'],
  ['9', '9', '9', 'Расширенные', '1 3 5 b7 9', 3, 'dominant'],
  ['maj9', 'maj9', 'Maj9', 'Расширенные', '1 3 5 7 9', 3, 'major'],
  ['m9', 'm9', 'm9', 'Расширенные', '1 b3 5 b7 9', 3, 'minor'],
  ['11', '11', '11', 'Расширенные', '1 3 5 b7 9 11', 4, 'dominant'],
  ['maj11', 'maj11', 'Maj11', 'Расширенные', '1 3 5 7 9 11', 4, 'major'],
  ['m11', 'm11', 'm11', 'Расширенные', '1 b3 5 b7 9 11', 4, 'minor'],
  ['13', '13', '13', 'Расширенные', '1 3 5 b7 9 11 13', 4, 'dominant'],
  ['maj13', 'maj13', 'Maj13', 'Расширенные', '1 3 5 7 9 11 13', 4, 'major'],
  ['m13', 'm13', 'm13', 'Расширенные', '1 b3 5 b7 9 11 13', 4, 'minor'],
  ['7b5', '7♭5', '7♭5', 'Альтерированные', '1 3 b5 b7', 5, 'dominant'],
  ['7#5', '7♯5', '7♯5', 'Альтерированные', '1 3 #5 b7', 5, 'dominant'],
  ['7b9', '7♭9', '7♭9', 'Альтерированные', '1 3 5 b7 b9', 5, 'dominant'],
  ['7#9', '7♯9', '7♯9', 'Альтерированные', '1 3 5 b7 #9', 5, 'dominant'],
  ['7#11', '7♯11', '7♯11', 'Альтерированные', '1 3 5 b7 #11', 5, 'dominant'],
  ['7b13', '7♭13', '7♭13', 'Альтерированные', '1 3 5 b7 b13', 5, 'dominant'],
];
export const CHORDS: ChordDefinition[] = rows.map(
  ([id, suffix, name, category, formula, level, family]) => ({
    id,
    suffix,
    name,
    category,
    formula,
    level,
    family,
    intervals: parseDegrees(formula).map((d) => resolveDegree(0, d)),
  }),
);
export const CHORD_BY_ID = Object.fromEntries(CHORDS.map((c) => [c.id, c])) as Record<
  string,
  ChordDefinition
>;
const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export const MINOR_ALTERATIONS = [0, 0, -1, 0, 0, -1, -1];
export function parseChord(token: string): RelativeChord {
  const match = /^([b#]?)([ivIV]+)(.*?)(?:\/([b#]?)([1-7]))?$/.exec(token);
  if (!match) throw new Error(`Неверный аккорд: ${token}`);
  const degree = romans.indexOf(match[2].toUpperCase()) + 1;
  const suffix = match[3];
  const aliases: Record<string, string> = {
    '°': 'diminished',
    dim: 'diminished',
    '°7': 'dim7',
    ø7: 'm7b5',
    '+': 'augmented',
    aug: 'augmented',
  };
  let type = aliases[suffix] ?? suffix;
  if (!type) type = match[2] === match[2].toLowerCase() ? 'minor' : 'major';
  else if (match[2] === match[2].toLowerCase() && ['7', '9', '11', '13', '6'].includes(type))
    type = `m${type}`;
  if (!degree || !CHORD_BY_ID[type]) throw new Error(`Неизвестный аккорд: ${token} (${type})`);
  return {
    degree,
    accidental: match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0,
    type,
    ...(match[5]
      ? {
          bassDegree: Number(match[5]),
          bassAccidental: match[4] === 'b' ? -1 : match[4] === '#' ? 1 : 0,
        }
      : {}),
  };
}
export function spelledPitch(midi: number, letter: string, octave = false) {
  const natural = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[letter];
  const diff = ((pitchClass(midi) - natural + 18) % 12) - 6;
  return `${letter}${diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff)}${octave ? Math.floor((midi - diff) / 12) - 1 : ''}`;
}
export function chordToneName(
  chord: Pick<HarmonicChord, 'root' | 'rootName' | 'type'>,
  midi: number,
  octave = false,
) {
  const definition = CHORD_BY_ID[chord.type];
  const index = definition.intervals.findIndex(
    (n) => pitchClass(n) === pitchClass(midi - chord.root),
  );
  const d = parseDegrees(definition.formula)[Math.max(0, index)];
  const letters = 'CDEFGAB';
  return spelledPitch(
    midi,
    letters[(letters.indexOf(chord.rootName[0]) + d.degree - 1) % 7],
    octave,
  );
}
export function buildChord(key: MusicalKey, relative: RelativeChord): HarmonicChord {
  const root = 60 + key.pc + MAJOR[relative.degree - 1] + relative.accidental;
  const rootName = spellDegree(
    60 + key.pc,
    { degree: relative.degree as 1, accidental: relative.accidental as -1 },
    false,
  );
  const definition = CHORD_BY_ID[relative.type];
  const bass = relative.bassDegree
    ? 36 + key.pc + MAJOR[relative.bassDegree - 1] + (relative.bassAccidental ?? 0)
    : root - 24;
  const bassName = relative.bassDegree
    ? spellDegree(
        60 + key.pc,
        { degree: relative.bassDegree as 1, accidental: (relative.bassAccidental ?? 0) as -1 },
        false,
      )
    : rootName;
  const acc =
    relative.accidental - (key.mode === 'minor' ? MINOR_ALTERATIONS[relative.degree - 1] : 0);
  const prefix = relative.accidental < 0 ? 'b' : relative.accidental > 0 ? '#' : '';
  const roman = `${prefix}${['minor', 'diminished'].includes(definition.family) ? romans[relative.degree - 1].toLowerCase() : romans[relative.degree - 1]}${definition.family === 'diminished' ? (relative.type === 'diminished' ? '°' : relative.type === 'dim7' ? '°7' : 'ø7') : definition.suffix.replace(/^m(?!aj)/, '')}`;
  const fn =
    definition.family === 'dominant'
      ? relative.degree === 5
        ? 'Доминанта · ведёт к тонике'
        : 'Вторичная / заместительная доминанта · слушай следующий аккорд'
      : relative.degree === 1
        ? 'Тоника · опора'
        : relative.degree === 2 || relative.degree === 4
          ? 'Субдоминанта · подготовка движения'
          : relative.degree === 5 || relative.degree === 7
            ? 'Доминантовая функция · напряжение'
            : 'Тоническая группа / связующий аккорд';
  const partial = { ...relative, root, rootName };
  return {
    ...partial,
    bass,
    symbol: rootName + definition.suffix + (relative.bassDegree ? `/${bassName}` : ''),
    roman,
    degreeLabel: `${acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc)}${relative.degree}`,
    names: definition.intervals.map((n) => chordToneName(partial, root + n)),
    formula: definition.formula,
    function: fn,
  };
}
export function voicingDistance(a: number[], b: number[]) {
  if (!a.length || !b.length) return 0;
  return (
    b.reduce((sum, n) => sum + Math.min(...a.map((m) => Math.abs(n - m))), 0) +
    Math.abs(a.length - b.length) * 2
  );
}
export function supportsVoicing(type: string, kind: VoicingKind) {
  const definition = CHORD_BY_ID[type];
  const degrees = parseDegrees(definition.formula);
  if (kind === 'third' || kind === 'drop2') return definition.intervals.length >= 4;
  if (kind === 'shell')
    return degrees.some((d) => d.degree === 3) && degrees.some((d) => d.degree === 7);
  return true;
}
export function voiceChord(
  chord: HarmonicChord,
  kind: VoicingKind = 'smooth',
  previous: number[] = [],
): ChordVoicing {
  if (!supportsVoicing(chord.type, kind))
    throw new Error(
      `${VOICINGS[kind]} требует подходящего септаккорда. Измени типы аккордов или расположение.`,
    );
  const definition = CHORD_BY_ID[chord.type];
  const degrees = parseDegrees(definition.formula);
  let intervals = [...definition.intervals];
  if (kind === 'no3') intervals = intervals.filter((_, i) => degrees[i].degree !== 3);
  if (kind === 'no5') intervals = intervals.filter((_, i) => degrees[i].degree !== 5);
  if (kind === 'rootless') intervals = intervals.filter((n) => n !== 0);
  if (kind === 'shell') intervals = intervals.filter((_, i) => [3, 7].includes(degrees[i].degree));
  if (!intervals.length) intervals = [0, definition.intervals.at(-1)!];
  const base = 60 + pitchClass(chord.root);
  let notes = intervals.map((n) => base + n);
  const inversion = { root: 0, first: 1, second: 2, third: 3 }[kind as 'root'];
  if (inversion !== undefined) {
    for (let i = 0; i < Math.min(inversion, notes.length - 1); i++) notes.push(notes.shift()! + 12);
    notes.sort((a, b) => a - b);
  } else {
    notes = [...new Set(intervals.map((n) => base + pitchClass(n)))].sort((a, b) => a - b);
    if (kind === 'drop2' && notes.length >= 4) {
      notes[notes.length - 2] -= 12;
      notes.sort((a, b) => a - b);
    } else if (kind === 'open' && notes.length >= 3) {
      notes[1] += 12;
      notes.sort((a, b) => a - b);
    } else if (kind === 'top') {
      const top =
        base + (definition.intervals.find((n) => n === 3 || n === 4) ?? intervals.at(-1)!);
      notes = notes.map((n) => (n >= top ? n - 12 : n));
      notes[notes.findIndex((n) => pitchClass(n) === pitchClass(top))] = top;
      notes.sort((a, b) => a - b);
    } else if (kind === 'smooth') {
      const candidates: number[][] = [];
      for (let rotation = 0; rotation < notes.length; rotation++)
        for (const shift of [-12, 0, 12]) {
          const v = [...notes.slice(rotation), ...notes.slice(0, rotation).map((n) => n + 12)].map(
            (n) => n + shift,
          );
          if (v[0] >= 48 && v.at(-1)! <= 84) candidates.push(v);
        }
      notes =
        candidates.sort(
          (a, b) =>
            voicingDistance(previous, a) +
            Math.abs(a[0] - 60) * 0.15 -
            (voicingDistance(previous, b) + Math.abs(b[0] - 60) * 0.15),
        )[0] ?? notes;
    }
  }
  while (notes.at(-1)! > 88) notes = notes.map((n) => n - 12);
  let bass = chord.bass;
  if (kind === 'slash' && !chord.bassDegree)
    bass =
      36 + pitchClass(chord.root) + (definition.intervals.find((n) => n === 3 || n === 4) ?? 7);
  if (['first', 'second', 'third'].includes(kind)) bass = notes[0] - 24;
  const leftHand = [bass];
  // Dense extended structures are shared between the hands; every requested pitch is retained.
  while (notes.length > 5 || (notes.length > 2 && notes.at(-1)! - notes[0] > 12))
    leftHand.push(notes.shift()! - 12);
  if (leftHand.length > 1) {
    while (Math.max(...leftHand) - leftHand[0] > 12) leftHand[0] += 12;
    bass = leftHand[0];
  }
  const names = Object.fromEntries(
    [...leftHand, ...notes].map((n) => [n, chordToneName(chord, n, true)]),
  );
  if (chord.bassDegree)
    names[bass] =
      spellDegree(
        60 + pitchClass(chord.root - MAJOR[chord.degree - 1] - chord.accidental),
        { degree: chord.bassDegree as 1, accidental: (chord.bassAccidental ?? 0) as -1 },
        false,
      ) + String(Math.floor(bass / 12) - 1);
  return {
    leftHand: [...new Set(leftHand)],
    rightHand: notes,
    kind,
    names,
    instruction: `${VOICINGS[kind]}${kind === 'top' ? ` · сверху ${chordToneName(chord, notes.at(-1)!, true)}` : kind === 'slash' ? ` · бас ${names[bass]}` : ''}`,
  };
}
