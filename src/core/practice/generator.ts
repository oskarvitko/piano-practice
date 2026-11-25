import { buildChord, supportsVoicing, voiceChord } from './chords';
import { taskBeats } from './config';
import { generateHarmony, Random, chooseKey } from './harmony';
import { harmonyExample, scaleExample, scalePlan, transitionExample } from './examples';
import type {
  DifficultTask,
  GeneratorState,
  PracticeConfig,
  PracticeTask,
  ProgressionTemplate,
  VoicingKind,
} from './types';

export interface PracticeLibrary {
  progressions: ProgressionTemplate[];
  patterns: Record<string, string>;
}
export function connectTasks(
  task: PracticeTask,
  next: PracticeTask,
  config: PracticeConfig,
): PracticeTask {
  if (task.trainer === 'scale') return task;
  const linked = { ...task, nextChord: next.chord, nextVoicing: next.voicing };
  if (task.trainer === 'fill') {
    linked.examples = [
      transitionExample(
        task.key,
        task.chord,
        next.chord,
        task.voicing,
        next.voicing,
        config.bpm,
        config.fillKind,
        0,
        config.mix,
      ),
      transitionExample(
        next.key,
        next.chord,
        next.nextChord,
        next.voicing,
        next.nextVoicing,
        config.bpm,
        config.fillKind,
        1,
        config.mix,
      ),
    ];
    linked.targetNotes = linked.examples[0].targetNotes.map((n) => n.note);
    linked.instruction = linked.examples[0].title;
  } else linked.examples = [harmonyExample(linked, config.bpm)];
  return linked;
}
export function generateTasks(
  config: PracticeConfig,
  library: PracticeLibrary,
  state: GeneratorState,
  difficult: DifficultTask[] = [],
) {
  if (config.trainer === 'scale') {
    const rng = new Random(state.seed);
    const key = chooseKey(config, state, rng);
    const pattern = ['random', 'mixed'].includes(config.direction)
      ? rng.pick(Object.keys(library.patterns))
      : config.pattern;
    const direction =
      config.direction === 'random'
        ? rng.pick(['up', 'down', 'both'] as const)
        : config.direction === 'mixed'
          ? state.phrase % 2
            ? 'down'
            : 'up'
          : config.direction;
    const plan = scalePlan(key, { ...config, direction }, library.patterns, pattern);
    const chord = buildChord(key, {
      degree: 1,
      accidental: 0,
      type: key.mode === 'minor' ? 'minor' : 'major',
    });
    const voicing = voiceChord(chord);
    const task: PracticeTask = {
      id: `scale-${state.phrase}-${key.pc}`,
      trainer: 'scale',
      key,
      chord,
      voicing,
      nextChord: chord,
      nextVoicing: voicing,
      phraseId: `scale-${config.scale}-${pattern}`,
      phraseName: `${config.scale} · ${pattern}`,
      phraseIndex: 0,
      phraseLength: 1,
      durationBeats: plan.lengthBeats,
      instruction: `${config.scale} · ${pattern === 'scale' ? 'гамма' : pattern} · ${direction === 'up' ? 'вверх' : direction === 'down' ? 'вниз' : 'вверх и вниз'} · ${config.octaves} окт. · ${config.repetitions} повт. · ${config.hands === 'both' ? 'две руки' : config.hands === 'left' ? 'левая рука' : 'правая рука'}`,
      targetNotes: [],
      examples: [],
      plan,
    };
    task.examples = [scaleExample(task, config)];
    return { tasks: [task], state: { ...state, seed: rng.seed, phrase: state.phrase + 1 } };
  }
  const result = generateHarmony(config, library.progressions, state, difficult);
  const rng = new Random(result.state.seed);
  let previous = state.previousVoicing ?? [];
  const voices = result.chords.map((chord) => {
    let choices: VoicingKind[] = config.voicings.length ? config.voicings : ['smooth'];
    if (
      config.difficulty === 1 &&
      config.voicings.length === 1 &&
      config.voicings[0] === 'smooth' &&
      config.chordMode !== 'voicing' &&
      config.degreeTask !== 'inversions'
    )
      choices = ['root'];
    if (config.trainer === 'degree' && config.degreeTask === 'inversions')
      choices = ['root', 'first', 'second'];
    choices = choices.filter((kind) => supportsVoicing(chord.type, kind));
    if (!choices.length)
      throw new Error(
        'Выбранные расположения требуют септаккордов. Добавь основной вид или выбери подходящие типы аккордов.',
      );
    const voice = voiceChord(chord, rng.pick(choices), previous);
    previous = voice.rightHand;
    return voice;
  });
  const tasks = result.chords.map((chord, i): PracticeTask => {
    const next = result.chords[(i + 1) % result.chords.length];
    const nextVoicing = voices[(i + 1) % voices.length];
    const task: PracticeTask = {
      id: `${state.phrase}-${i}-${result.key.pc}`,
      trainer: config.trainer,
      key: result.key,
      chord,
      voicing: voices[i],
      previousChord: i ? result.chords[i - 1] : undefined,
      nextChord: next,
      nextVoicing,
      phraseId: result.template.id,
      phraseName: result.template.name,
      phraseIndex: i,
      phraseLength: result.chords.length,
      durationBeats: taskBeats(config),
      instruction:
        config.trainer === 'degree' && config.degreeTask === 'bass'
          ? 'Сыграй основной тон ступени'
          : `${voices[i].instruction}${config.trainer === 'degree' && ['sevenths', 'extended', 'mixed'].includes(config.degreeTask) ? ` · тип ${chord.type}` : ''}`,
      targetNotes: [],
      examples: [],
    };
    if (config.trainer === 'fill') {
      const first = transitionExample(
        result.key,
        chord,
        next,
        voices[i],
        nextVoicing,
        config.bpm,
        config.fillKind,
        0,
        config.mix,
      );
      const secondNext = result.chords[(i + 2) % result.chords.length];
      const second = transitionExample(
        result.key,
        next,
        secondNext,
        nextVoicing,
        voices[(i + 2) % voices.length],
        config.bpm,
        config.fillKind,
        1,
        config.mix,
      );
      task.fillKind = config.fillKind;
      task.examples = [first, second];
      task.targetNotes = first.targetNotes.map((n) => n.note);
      task.instruction = `${first.title}. Цель: ${first.targetNotes.map((n) => `${n.function} ${n.chord}`).join(', ')}.`;
      task.durationBeats = Math.max(task.durationBeats, 8);
    } else task.examples = [harmonyExample(task, config.bpm)];
    return task;
  });
  return { tasks, state: { ...result.state, seed: rng.seed, previousVoicing: previous } };
}
