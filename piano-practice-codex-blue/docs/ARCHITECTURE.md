# Архитектура
React + Vite + TypeScript strict, vite-plugin-pwa, Dexie, Zustand, React Router HashRouter, Tailwind, Lucide, Vitest, Tone.js. Библиотеки кроме React/Vite/IndexedDB — рекомендуемые. 
```
src/app/ (router, providers)
src/pages/ (lesson, completed, overview, programs, settings)
src/features/ (lesson-player, navigation, timer, review, progress, audio-player)
src/components/ (PianoKeyboard, ScaleViewer, ChordViewer, SequenceViewer, ProgressionViewer, ui)
src/audio/ (Tone.js adapter, scheduler, sampler, metronome)
src/core/music/ (notes, scales, chords, degrees, patterns)
src/core/lesson-engine/
src/core/review-engine/
src/core/types/
src/programs/registry.ts
src/programs/scales-and-runs/
src/database/ (db, migrations, repositories)
src/stores/
```
Core — pure TS, без React, Dexie и конкретных программ. Репозитории внедряются в orchestration layer. IndexedDB — источник истины, Zustand — runtime UI. Программы bundled TS, загружаются в память; не копировать определения в DB.
```ts
type Degree = { degree: 1|2|3|4|5|6|7; accidental?: -2|-1|0|1|2; octave?: number };
type MidiNote = number;
type ScaleType = 'major'|'major-pentatonic'|'minor-pentatonic'|'major-blues'|'minor-blues';
type Visualization =
 | {type:'scale'; root:MidiNote; scale:ScaleType; octaves:number}
 | {type:'chord'; name:string; notes:MidiNote[]}
 | {type:'sequence'; root:MidiNote; pattern:Degree[]; bpm?:number}
 | {type:'progression'; chords:{name:string;notes:MidiNote[]}[]};
interface Step {id:string;title:string;instructions:string[];durationSeconds?:number;optional?:boolean;visualization?:Visualization;reviewItems?:string[]}
interface Lesson {id:string;title:string;steps:Step[]}
interface Module {id:string;title:string;lessons:Lesson[]}
interface Program {id:string;version:number;title:string;description:string;modules:Module[]}
```
Support multiple visualizations per step via sub-exercises or array if needed. Stable semantic IDs, never array index. Root MIDI fixes octave; degree relative to major scale, octave offset explicit; 8 = 1+octave. Spelling by key (F major Bb not A#); enharmonic MIDI same. Major [0,2,4,5,7,9,11], pent [0,2,4,7,9], minor pent [0,3,5,7,10], major blues [0,2,3,4,7,9], minor blues [0,3,5,6,7,10]. Functions getScaleNotes, resolveDegree, resolvePattern, getChordNotes, transposeNotes, getNoteName, getKeyboardRange. Test all 12 roots, accidentals, octave boundaries, chord inversions, black key layout.
## Persistence
Dexie tables: settings (key/value, activeProgramId), programProgress (programId, version, status, currentLessonId, timestamps), lessonProgress ([programId+lessonId], status,currentStepId,timestamps), stepProgress ([programId+lessonId+stepId],status,elapsedSeconds,completedAt), practiceSessions (id, programId, lessonId, attemptId, timestamps, activeSeconds, frozenReviewStepIds), reviewItems ([programId+exerciseId+root], firstLearnedAt,lastReviewedAt,nextReviewAt,repetitionIndex, mastery). Store timer checkpoint per attempt/step. Replay attempts separate from canonical completion. DB transactions for completing steps/lessons and scheduling reviews; idempotent completion. Version migrations preserve stable IDs; explicit mapping for renamed IDs. Unknown imported IDs retained or reported, never silently destroy progress.
## Lesson engine
startLesson, resumeLesson, nextStep, previousStep, goToStep, completeStep, completeLesson, getNextLesson. Separate navigation from completion; optional steps do not block. Review steps frozen at attempt start. On root route hydrate DB before redirect. After completion update canonical status and next pointer atomically. Hash routes /, /programs, /program/:id, /lesson/:programId/:lessonId, /lesson/:programId/:lessonId/completed, /settings. Completed screen reachable only for completed attempt.
## Build
Vite base /piano-practice/ (adjust to repo), PWA registerType prompt, precache JS/CSS/HTML/SVG/PNG/fonts/audio and all program chunks, relative start_url/scope ./, standalone. No external CDN dependency. GitHub Actions npm ci, typecheck, test, build, upload-pages-artifact, deploy-pages; permissions pages:write/id-token:write. Use lockfile. Test production build at subpath.

## Audio architecture
Pure TS music engine resolves MIDI notes to timed events; browser audio adapter owns Tone.js and is separate from React and core. A single audio service per app manages sampler, fallback synth, transport and metronome; release voices and cancel scheduled callbacks on stop/dispose. Convert MIDI with Tone.Frequency(midi, 'midi'). Use audio-clock scheduling, not setInterval; synchronize UI via Tone.Draw or equivalent. Playback and timer have separate state. Define optional playback metadata on exercises (BPM, subdivision, direction, note durations, chord hold); defaults preserve existing program definitions.
```ts
interface PlaybackEvent { notes: MidiNote[]; beat: number; durationBeats: number; }
interface PlaybackPlan { bpm: number; events: PlaybackEvent[]; lengthBeats: number; }
interface AudioPlayer {
  unlock(): Promise<void>;
  play(plan: PlaybackPlan, loop: boolean): Promise<void>;
  pause(): void;
  stop(): void;
  setVolume(value: number): void;
  dispose(): void;
}
```
Store audio preferences in settings; no audio buffers in IndexedDB. Bundle licensed samples under public/audio/piano with attribution and use BASE_URL for paths. Explicitly include audio extensions in Workbox precache or a versioned offline cache; verify file size limits and total quota. Use synth fallback on load/decode failure. Unit-test event timing, chord simultaneity, loop boundaries, cancellation and MIDI mapping; manual iOS tests for unlock, interruption and offline audio.
