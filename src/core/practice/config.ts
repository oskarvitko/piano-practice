import type {
  PracticeConfig,
  TrainerType,
  MusicStyle,
  MusicalKey,
  VoicingKind,
  FillKind,
} from './types';

export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const STYLES: Record<MusicStyle, string> = {
  worship: 'CCM / Worship',
  gospel: 'Gospel',
  jazz: 'Jazz',
  pop: 'Pop',
  blues: 'Blues',
};
export const TRAINERS: Record<TrainerType, { name: string; description: string; icon: string }> = {
  degree: {
    name: 'Degree Trainer',
    description: 'Слышь гармонию и мгновенно находи ступени в любой тональности.',
    icon: '01',
  },
  chord: {
    name: 'Chord Trainer',
    description: 'Аккорды, обращения и удобные расположения — от трезвучий до альтераций.',
    icon: '02',
  },
  style: {
    name: 'Style Trainer',
    description: 'Играй связные прогрессии Worship, Gospel, Jazz, Pop и Blues.',
    icon: '03',
  },
  fill: {
    name: 'Fill & Run Trainer',
    description: 'Соединяй аккорды короткими фразами с осмысленным разрешением.',
    icon: '04',
  },
  scale: {
    name: 'Scale & Pattern Trainer',
    description: 'Гаммы и знакомые паттерны без уроков и обязательного порядка.',
    icon: '05',
  },
};
export const VOICINGS: Record<VoicingKind, string> = {
  root: 'Основной вид',
  first: 'Первое обращение',
  second: 'Второе обращение',
  third: 'Третье обращение',
  slash: 'Slash / заданный бас',
  no3: 'Без терции',
  no5: 'Без квинты',
  open: 'Открытое расположение',
  close: 'Тесное расположение',
  shell: 'Shell · 3 и 7',
  drop2: 'Drop 2',
  rootless: 'Без основного тона',
  top: 'Заданная верхняя нота',
  smooth: 'Плавное голосоведение',
};
export const FILLS: Record<FillKind, string> = {
  free: 'Свободная импровизация',
  target: 'Целевая нота',
  pentatonic: 'Пентатонический филл',
  major: 'Мажорный ран',
  'major-blues': 'Major Blues',
  'minor-blues': 'Minor Blues',
  chromatic: 'Хроматический подход',
  enclosure: 'Окружение',
  arpeggio: 'Арпеджио',
  mixed: 'Смешанные паттерны',
};
export const keyName = (key: MusicalKey) =>
  `${KEY_NAMES[key.pc]} ${key.mode === 'major' ? 'major' : 'minor'}`;
export function defaultConfig(trainer: TrainerType): PracticeConfig {
  return {
    trainer,
    keys: [{ pc: 0, mode: 'major' }],
    keyOrder: 'selected',
    style: 'worship',
    bpm: 60,
    meter: '4/4',
    changeEvery: 'bar',
    difficulty: 1,
    generationMode: 'random',
    progressionId: '',
    durationMinutes: 10,
    previewCount: 1,
    hintMode: 'hidden',
    degreeDisplay: 'arabic',
    degreeTask: 'triads',
    chordMode: 'harmonic',
    voiceLanguage: 'en',
    voiceTiming: 'one-beat-before',
    anticipatoryVoice: false,
    enabledChordTypes: [],
    enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
    voicings: ['smooth'],
    channels: {
      metronome: { enabled: true, volume: 0.65 },
      bass: { enabled: false, volume: 0.65 },
      harmony: { enabled: false, volume: 0.6 },
      melody: { enabled: false, volume: 0.7 },
      voice: { enabled: false, volume: 0.9 },
    },
    fillKind: 'target',
    mix: 'major-pentatonic',
    scale: 'major',
    pattern: 'scale',
    direction: 'both',
    octaves: 1,
    subdivision: 2,
    repetitions: 2,
    hands: 'right',
  };
}
/** Internal beats are the BPM pulse: quarter note, or dotted quarter in 6/8. */
export function meterInfo(meter: PracticeConfig['meter']) {
  return meter === '6/8'
    ? { beats: 2, subbeats: 3, label: 'BPM = четверть с точкой · 2 группы по 3 восьмых' }
    : { beats: Number(meter[0]), subbeats: 1, label: 'BPM = четверть' };
}
export function taskBeats(config: PracticeConfig) {
  const bar = meterInfo(config.meter).beats;
  return { beat: 1, 'two-beats': 2, bar, 'two-bars': bar * 2, 'four-bars': bar * 4, manual: bar }[
    config.changeEvery
  ];
}
export const emptyStatistics = () => ({
  activeSeconds: 0,
  bpmSeconds: 0,
  tasks: 0,
  chords: 0,
  transitions: 0,
  keys: [] as string[],
  chordTypes: [] as string[],
  hints: 0,
  hard: 0,
});
