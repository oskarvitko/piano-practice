export type Degree = {
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  accidental?: -2 | -1 | 0 | 1 | 2;
  octave?: number;
};
export type ScaleType =
  'major' | 'major-pentatonic' | 'minor-pentatonic' | 'major-blues' | 'minor-blues';
export type Playback = {
  bpm?: number;
  subdivision?: 1 | 2 | 3 | 4;
  direction?: 'up' | 'down' | 'both';
  durations?: number[];
  holdBeats?: number;
};
export type Visualization =
  | { type: 'scale'; root: number; scale: ScaleType; octaves: number }
  | { type: 'chord'; name: string; notes: number[]; root: number }
  | { type: 'sequence'; root: number; pattern: Degree[] }
  | { type: 'progression'; root: number; chords: { name: string; notes: number[] }[] };
export interface Exercise {
  id: string;
  title: string;
  instructions: string[];
  visualization: Visualization;
  playback?: Playback;
  hand?: 'RH' | 'LH' | 'LH + RH';
  fingering?: Record<number, string>;
  formula?: string;
  target?: string;
  examples?: MusicalExample[];
}
export interface MusicalEvent {
  startBeat: number;
  durationBeats: number;
  notes: number[];
  hand: 'left' | 'right';
  role: 'bass' | 'chord' | 'melody';
  velocity?: number;
  degrees?: Degree[];
}
export interface MusicalChord {
  name: string;
  displaySuffix?: string;
  bassDegree?: Degree;
  symbol: string;
  degree: Degree;
  quality: 'major' | 'minor' | 'dominant7';
  notes: number[];
  startBeat: number;
  durationBeats: number;
}
export interface TargetNote {
  beat: number;
  note: number;
  chord: string;
  function: string;
}
export interface MusicalExample {
  id: string;
  title: string;
  description: string;
  root: number;
  bpm: number;
  beatsPerBar: number;
  meter?: '4/4' | '3/4' | '6/8' | '2/4';
  lengthBeats: number;
  progression: MusicalChord[];
  events: MusicalEvent[];
  targetNotes: TargetNote[];
}
export interface Step {
  id: string;
  title: string;
  instructions: string[];
  durationSeconds: number;
  optional?: boolean;
  exercises: Exercise[];
  reviewKeys?: string[];
  reviewSlot?: boolean;
  assessmentRoots?: number[];
  examples?: MusicalExample[];
}
export interface Lesson {
  id: string;
  title: string;
  subtitle?: string;
  steps: Step[];
  week?: number;
  number?: number;
  roots?: number[];
}
export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
export interface Program {
  id: string;
  version: number;
  title: string;
  description: string;
  weeks?: number;
  modules: Module[];
}
export interface PlaybackEvent {
  notes: number[];
  beat: number;
  durationBeats: number;
  hand?: 'left' | 'right';
  velocity?: number;
}
export interface PlaybackPlan {
  id?: string;
  bpm: number;
  events: PlaybackEvent[];
  lengthBeats: number;
  legato?: boolean;
}
export type Status = 'active' | 'completed';
export interface ProgramProgress {
  programId: string;
  version: number;
  status: Status;
  currentLessonId?: string;
  startedAt: number;
  updatedAt: number;
}
export interface LessonProgress {
  programId: string;
  lessonId: string;
  status: Status;
  currentStepId: string;
  startedAt: number;
  completedAt?: number;
}
export interface StepProgress {
  programId: string;
  lessonId: string;
  stepId: string;
  status: Status;
  elapsedSeconds: number;
  completedAt?: number;
}
export interface AttemptStep {
  elapsedSeconds: number;
  timerSeconds: number;
  completedAt?: number;
}
export interface PracticeSession {
  id: string;
  programId: string;
  lessonId: string;
  attemptId: string;
  status: Status;
  replay: boolean;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  currentStepId: string;
  activeSeconds: number;
  steps: Record<string, AttemptStep>;
  frozenReviewStep?: Step;
  reviewResults: Record<string, boolean>;
  assessmentResults: Record<string, boolean>;
  reviewOnly?: boolean;
}
export interface ReviewItem {
  key: string;
  programId: string;
  exerciseId: string;
  root: number;
  firstLearnedAt: number;
  lastReviewedAt?: number;
  nextReviewAt: number;
  repetitionIndex: number;
  mastery: boolean;
  basePassed?: boolean;
}
export interface AudioPreferences {
  bpm: number;
  bpmOverride?: boolean;
  volume: number;
  muted: boolean;
  loop: boolean;
  subdivision: 1 | 2 | 3 | 4;
  beatsPerBar: number;
}
export interface Preferences {
  theme: 'dark' | 'light' | 'system';
  activeProgramId?: string;
  audio: AudioPreferences;
  keyboard: KeyboardPreferences;
}
export interface KeyboardPreferences {
  noteNames: boolean;
  degrees: boolean;
  octaves: boolean;
  fingering: boolean;
  tonicMarker: boolean;
}
export const defaultPreferences: Preferences = {
  theme: 'dark',
  audio: { bpm: 80, volume: 0.65, muted: false, loop: false, subdivision: 1, beatsPerBar: 4 },
  keyboard: {
    noteNames: true,
    degrees: true,
    octaves: false,
    fingering: false,
    tonicMarker: false,
  },
};
