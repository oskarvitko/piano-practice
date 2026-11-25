import type { MusicalExample, PlaybackPlan, ScaleType } from '../types';

export type TrainerType = 'degree' | 'chord' | 'style' | 'fill' | 'scale';
export type MusicStyle = 'worship' | 'gospel' | 'jazz' | 'pop' | 'blues';
export type KeyMode = 'major' | 'minor';
export interface MusicalKey {
  pc: number;
  mode: KeyMode;
}
export type GenerationMode = 'fixed' | 'random' | 'adaptive' | 'free-random';
export type HintMode = 'hidden' | 'chord-name' | 'notes' | 'keyboard' | 'full';
export type PracticePhase =
  'configuration' | 'ready' | 'countdown' | 'playing' | 'paused' | 'hint' | 'completed';
export type Channel = 'metronome' | 'bass' | 'harmony' | 'melody' | 'voice';
export interface ChannelSetting {
  enabled: boolean;
  volume: number;
}
export type Channels = Record<Channel, ChannelSetting>;
export type VoicingKind =
  | 'root'
  | 'first'
  | 'second'
  | 'third'
  | 'slash'
  | 'no3'
  | 'no5'
  | 'open'
  | 'close'
  | 'shell'
  | 'drop2'
  | 'rootless'
  | 'top'
  | 'smooth';
export type FillKind =
  | 'free'
  | 'target'
  | 'pentatonic'
  | 'major'
  | 'major-blues'
  | 'minor-blues'
  | 'chromatic'
  | 'enclosure'
  | 'arpeggio'
  | 'mixed';
export type PracticeScale = ScaleType | 'natural-minor' | 'harmonic-minor';
export interface PracticeConfig {
  trainer: TrainerType;
  keys: MusicalKey[];
  keyOrder: 'selected' | 'random' | 'fifths';
  style: MusicStyle;
  bpm: number;
  meter: '4/4' | '3/4' | '6/8' | '2/4';
  changeEvery: 'beat' | 'two-beats' | 'bar' | 'two-bars' | 'four-bars' | 'manual';
  difficulty: 1 | 2 | 3 | 4 | 5 | 'custom';
  generationMode: GenerationMode;
  progressionId: string;
  durationMinutes: number | null;
  previewCount: 0 | 1 | 2 | 4;
  hintMode: HintMode;
  degreeDisplay: 'arabic' | 'roman' | 'both' | 'chord';
  degreeTask: 'bass' | 'triads' | 'sevenths' | 'extended' | 'inversions' | 'mixed';
  chordMode: 'harmonic' | 'isolated' | 'voicing';
  voiceLanguage: 'en' | 'pl';
  voiceTiming: 'on-change' | 'one-beat-before' | 'two-beats-before' | 'off';
  anticipatoryVoice: boolean;
  enabledChordTypes: string[];
  enabledDegrees: number[];
  voicings: VoicingKind[];
  channels: Channels;
  fillKind: FillKind;
  mix:
    | 'major-pentatonic'
    | 'pentatonic-major-blues'
    | 'pentatonic-minor-blues'
    | 'major-chromatic'
    | 'arpeggio-pentatonic'
    | 'arpeggio-chromatic'
    | 'two-patterns';
  scale: PracticeScale;
  pattern: string;
  direction: 'up' | 'down' | 'both' | 'random' | 'mixed';
  octaves: 1 | 2 | 3;
  subdivision: 1 | 2 | 3 | 4;
  repetitions: number;
  hands: 'right' | 'left' | 'both';
}
export interface ChordDefinition {
  id: string;
  suffix: string;
  name: string;
  category: string;
  formula: string;
  intervals: number[];
  level: number;
  family: 'major' | 'minor' | 'dominant' | 'diminished' | 'augmented' | 'suspended';
}
/** Roman token roots/alterations are relative to the parallel major scale, including minor templates. */
export interface ProgressionTemplate {
  id: string;
  name: string;
  style: MusicStyle;
  mode: KeyMode;
  difficulty: number;
  chords: string[];
  weight: number;
  tags: string[];
}
export interface RelativeChord {
  degree: number;
  accidental: number;
  type: string;
  bassDegree?: number;
  bassAccidental?: number;
}
export interface HarmonicChord extends RelativeChord {
  root: number;
  rootName: string;
  symbol: string;
  roman: string;
  degreeLabel: string;
  bass: number;
  names: string[];
  formula: string;
  function: string;
}
export interface ChordVoicing {
  leftHand: number[];
  rightHand: number[];
  kind: VoicingKind;
  instruction: string;
  names: Record<number, string>;
}
export interface PracticeTask {
  id: string;
  trainer: TrainerType;
  key: MusicalKey;
  chord: HarmonicChord;
  voicing: ChordVoicing;
  previousChord?: HarmonicChord;
  nextChord: HarmonicChord;
  nextVoicing: ChordVoicing;
  phraseId: string;
  phraseName: string;
  phraseIndex: number;
  phraseLength: number;
  durationBeats: number;
  instruction: string;
  fillKind?: FillKind;
  targetNotes: number[];
  examples: MusicalExample[];
  plan?: PlaybackPlan;
}
export interface DifficultTask {
  id: string;
  key: MusicalKey;
  degree: number;
  chordType: string;
  chord: string;
  voicing: VoicingKind;
  previousChord?: string;
  nextChord: string;
  nextType: string;
  fillKind?: FillKind;
  bpm: number;
  style: MusicStyle;
  phraseId: string;
  count: number;
  lastAt: number;
}
export interface PracticeStatistics {
  activeSeconds: number;
  bpmSeconds: number;
  tasks: number;
  chords: number;
  transitions: number;
  keys: string[];
  chordTypes: string[];
  hints: number;
  hard: number;
}
export interface GeneratorState {
  seed: number;
  phrase: number;
  keyIndex: number;
  lastRoot?: number;
  previousVoicing?: number[];
}
export interface TrainerSession {
  id: string;
  config: PracticeConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  phase: PracticePhase;
  statistics: PracticeStatistics;
  difficult: DifficultTask[];
  queue: PracticeTask[];
  index: number;
  generator: GeneratorState;
  beat: number;
}
