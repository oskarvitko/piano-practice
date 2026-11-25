import type { Degree, MusicalExample, MusicalEvent } from '../../core/types';
import { getChordNotes, parseDegrees, pitchClass, resolveDegree } from '../../core/music';
import { chordName, transposeExample } from '../../core/music/examples';

type ChordSymbol = 'I' | 'ii' | 'IV' | 'V' | 'vi';
type Phrase = { transition: number; notes: string; rhythm: number[] };
interface Definition {
  id: string;
  title: string;
  description: string;
  progression: ChordSymbol[];
  phrases: Phrase[];
  bpm?: number;
}
const eighths = (transition: number, notes: string, hold = 2): Phrase => ({
  transition,
  notes,
  rhythm: parseDegrees(notes).map((_, i, all) => (i === all.length - 1 ? hold : 0.5)),
});
const phrase = (transition: number, notes: string, rhythm: number[]): Phrase => ({
  transition,
  notes,
  rhythm,
});
const definitions: Definition[] = [
  {
    id: 'target-i-iv',
    title: 'Пентатоника к терции IV',
    description:
      'Левая рука держит I. Правая повторяет короткий мотив; последняя нота становится терцией IV точно на сильной доле.',
    progression: ['I', 'IV'],
    phrases: [eighths(0, '5 6 8 5 6')],
  },
  {
    id: 'target-vi-v',
    title: 'Из минора к доминанте',
    description:
      'Поднимись от квинты vi к верхней тонике и мягко опустись в терцию V. Услышь, как новая гармония меняет смысл последней ноты.',
    progression: ['vi', 'V'],
    phrases: [eighths(0, '3 5 6 8 7')],
  },
  {
    id: 'blues-i-iv',
    title: 'Блюзовый ответ вниз',
    description:
      'Короткий нисходящий филл: малая терция даёт блюзовую окраску, а нижняя тоника становится квинтой IV. Оставь паузу перед фразой.',
    progression: ['I', 'IV'],
    phrases: [eighths(0, '8 6 5 3 b3 2 1')],
  },
  {
    id: 'blues-iv-i',
    title: 'Ответ в терцию тоники',
    description:
      'Ответь на IV блюзовым движением вниз. Последние b3 → 3 снимают напряжение одновременно с возвращением I.',
    progression: ['IV', 'I'],
    phrases: [eighths(0, '4 b6 5 b5 4 b3 3')],
  },
  {
    id: 'minor-i-iv',
    title: 'Minor blues и смена опоры',
    description:
      'Пройди minor blues от верхней тоники к нижней. На IV та же финальная нота звучит уже как квинта.',
    progression: ['I', 'IV'],
    phrases: [eighths(0, '8 b7 5 b5 4 b3 1')],
  },
  {
    id: 'minor-v-vi',
    title: 'Блюзовый филл в минор',
    description:
      'Начни с блюзового напряжения над V, затем смягчи конец ступенями 2 → 1. Финальная нота — терция vi.',
    progression: ['V', 'vi'],
    phrases: [eighths(0, 'b7 5 4 b3 2 1')],
  },
  {
    id: 'soft-iv-vi',
    title: 'Мягкое нисходящее разрешение',
    description:
      'Нисходящая пентатоническая фраза соединяет IV и vi. Задержись на терции минорного аккорда и сравни её с исходной гармонией.',
    progression: ['IV', 'vi'],
    phrases: [phrase(0, '6 5 3 2 1', [0.75, 0.25, 0.5, 0.5, 2])],
  },
  {
    id: 'soft-i-vi',
    title: 'Поворот к минорной терции',
    description:
      'После восходящего начала сделай небольшой скачок вниз. Ступень 1 становится терцией vi; не ускоряйся перед сменой аккорда.',
    progression: ['I', 'vi'],
    phrases: [eighths(0, '3 5 6 2 1')],
  },
  {
    id: 'dominant-iv-v',
    title: 'Подвод к терции V',
    description:
      'Сначала спустись по гамме, затем развернись вверх через проходящую #4. Заверши на терции V, а не на проходящей ноте.',
    progression: ['IV', 'V'],
    phrases: [eighths(0, '6 5 4 #4 5 6 7')],
  },
  {
    id: 'chromatic-i-iv',
    title: 'Хроматическая лестница',
    description:
      'Сыграй 3 → 4 → #4 → 5 → #5 → 6. Две хроматические ноты короткие; устойчивый конец совпадает с терцией IV.',
    progression: ['I', 'IV'],
    phrases: [phrase(0, '3 4 #4 5 #5 6', [0.5, 0.5, 0.25, 0.5, 0.25, 2])],
  },
  {
    id: 'chromatic-i-v',
    title: 'Полутон к терции доминанты',
    description:
      'Две ноты гаммы подводят к b7 → 7. Малая септима здесь проходящая, а большая становится терцией следующего V.',
    progression: ['I', 'V'],
    phrases: [phrase(0, '5 6 b7 7', [1, 0.5, 0.5, 2])],
  },
  {
    id: 'enclosure-v-i',
    title: 'Окружение терции тоники',
    description:
      'Начни с квинты, затем окружи цель сверху и снизу: 4 → #2 → 3. Разрешение приходится на вступление I.',
    progression: ['V', 'I'],
    phrases: [phrase(0, '5 4 #2 3', [1, 0.5, 0.5, 2])],
  },
  {
    id: 'enclosure-i-iv',
    title: 'Две соседние ноты вокруг IV',
    description:
      'После квинты возьми верхнего и нижнего хроматического соседа цели: b7 → #5 → 6. Встреть IV на его терции.',
    progression: ['I', 'IV'],
    phrases: [phrase(0, '5 b7 #5 6', [1, 0.5, 0.5, 2])],
  },
  {
    id: 'descending-iv-i',
    title: 'Нисходящие группы в ответ',
    description:
      'Соедини две пентатонические группы. Вторая группа заканчивается терцией I и отвечает на первую.',
    progression: ['IV', 'I'],
    phrases: [eighths(0, '8 6 5 6 5 3')],
  },
  {
    id: 'descending-vi-v',
    title: 'Спуск и поворот к V',
    description:
      'Нисходящий рисунок оставляет пространство, а скачок в конце приводит к терции V. Сыграй финал спокойно.',
    progression: ['vi', 'V'],
    phrases: [eighths(0, '8 6 5 3 2 7')],
  },
  {
    id: 'dialogue-i-iv',
    title: 'Вопрос и длинный ответ',
    description:
      'Две короткие ноты после паузы и длинное разрешение — достаточно для законченной фразы. Придумай другой вопрос с той же целевой нотой.',
    progression: ['I', 'IV'],
    phrases: [phrase(0, '3 5 6', [1, 0.5, 2])],
  },
  {
    id: 'dialogue-iv-i',
    title: 'Возвращение домой',
    description:
      'Ответь нисходящим мотивом на IV. Последняя нота становится терцией I; после неё оставь тишину.',
    progression: ['IV', 'I'],
    phrases: [phrase(0, '6 5 3', [0.5, 1, 2])],
  },
  {
    id: 'sequence-ii-v-i',
    title: 'Мотив через ii–V–I',
    description:
      'Развивай маленькую секвенцию, а не длинную гамму. Первый ответ ведёт в терцию V, второй — в терцию I через окружение.',
    progression: ['ii', 'V', 'I'],
    bpm: 65,
    phrases: [
      phrase(0, '2 3 4 3 4 5 7', [0.5, 0.25, 0.25, 0.5, 0.25, 0.25, 1]),
      eighths(1, '5 4 2 #2 3'),
    ],
  },
  {
    id: 'sequence-four-chords',
    title: 'Одна идея, четыре аккорда',
    description:
      'Повторяй характер нисходящего мотива, меняя окончание под следующий аккорд. Не заполняй мелодией весь такт.',
    progression: ['I', 'V', 'vi', 'IV'],
    bpm: 65,
    phrases: [
      eighths(0, '8 6 5 3 2 7', 1),
      eighths(1, '7 6 5 3 2 1', 1),
      phrase(2, '8 7 5 6', [0.5, 0.5, 1, 2]),
    ],
  },
  {
    id: 'leaps-ii-v-i',
    title: 'Скачок, затем плавный ответ',
    description:
      'Сыграй арпеджированный скачок на ii и заполни его плавным движением к V. На возвращении к I используй короткий хроматический подвод.',
    progression: ['ii', 'V', 'I'],
    bpm: 70,
    phrases: [eighths(0, '2 6 4 8 7', 1), phrase(1, '5 2 4 #2 3', [0.5, 0.5, 0.5, 0.5, 2])],
  },
  {
    id: 'leaps-cycle',
    title: 'Широкий жест и точная цель',
    description:
      'Чередуй скачки с движением по соседним нотам. Каждое окончание выбирай заранее: терции IV, I и V.',
    progression: ['vi', 'IV', 'I', 'V'],
    bpm: 70,
    phrases: [eighths(0, '3 8 5 6', 1), eighths(1, '6 2 5 4 3', 1), eighths(2, '3 8 6 b7 7')],
  },
  {
    id: 'fills-cycle',
    title: 'Три филла между аккордами',
    description:
      'Здесь три разные фразы: восходящий ран, мягкий спуск и подвод к доминанте. Сначала выучи каждый переход, затем соедини всю фразу.',
    progression: ['I', 'IV', 'vi', 'V'],
    bpm: 70,
    phrases: [eighths(0, '5 6 8 5 6', 1), eighths(1, '6 5 3 2 1', 1), eighths(2, '3 5 6 8 7')],
  },
  {
    id: 'fills-answer',
    title: 'Филлы с хроматическим ответом',
    description:
      'Двигайся от vi через IV и I к V. Сохраняй паузы, а хроматические ноты используй только как подводы к устойчивым целям.',
    progression: ['vi', 'IV', 'I', 'V'],
    bpm: 75,
    phrases: [eighths(0, '8 6 5 6', 1), eighths(1, '6 5 4 #2 3', 1), eighths(2, '3 5 6 b7 7')],
  },
  {
    id: 'advanced-cadence',
    title: 'Каденция с шестнадцатыми',
    description:
      'Сохрани два такта напряжения и ясное разрешение в I. Быстрые ноты собраны в короткие группы; сперва сыграй при медленном темпе.',
    progression: ['ii', 'V', 'I'],
    bpm: 80,
    phrases: [
      phrase(0, '2 3 4 #4 5 6 b7 7', [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 1]),
      phrase(1, '8 7 b7 6 b6 5 4 #2 3', [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 2]),
    ],
  },
  {
    id: 'advanced-cycle',
    title: 'Разговор четырёх гармоний',
    description:
      'Сочетай пунктирный ритм, пентатонику и окружения. Меняй длину фразы, сохраняя точное попадание в следующую гармонию.',
    progression: ['vi', 'IV', 'I', 'V'],
    bpm: 85,
    phrases: [
      phrase(0, '3 5 6 8 b7 #5 6', [0.75, 0.25, 0.5, 0.25, 0.25, 0.5, 1]),
      phrase(1, '8 6 5 4 #2 3', [0.75, 0.25, 0.5, 0.25, 0.25, 1]),
      phrase(2, '3 5 8 6 b7 7', [0.5, 0.25, 0.25, 0.5, 0.5, 2]),
    ],
  },
];

function buildExample(definition: Definition): MusicalExample {
  const degrees: Record<ChordSymbol, Degree> = {
    I: { degree: 1 },
    ii: { degree: 2 },
    IV: { degree: 4 },
    V: { degree: 5 },
    vi: { degree: 6 },
  };
  const root = 60;
  const progression = definition.progression.map((symbol, index) => {
    const degree = degrees[symbol];
    const quality = symbol === 'ii' || symbol === 'vi' ? ('minor' as const) : ('major' as const);
    return {
      symbol,
      degree,
      quality,
      name: chordName(root, { degree, quality }),
      notes: getChordNotes(resolveDegree(root - 12, degree), quality),
      startBeat: index * 4,
      durationBeats: 4,
    };
  });
  const events: MusicalEvent[] = progression.map((chord) => ({
    notes: chord.notes,
    startBeat: chord.startBeat,
    durationBeats: chord.durationBeats,
    hand: 'left',
    role: 'chord',
    velocity: 0.48,
  }));
  const targetNotes: MusicalExample['targetNotes'] = [];
  for (const phrase of definition.phrases) {
    const notes = parseDegrees(phrase.notes);
    if (notes.length !== phrase.rhythm.length) throw new Error(`Rhythm mismatch: ${definition.id}`);
    const chord = progression[phrase.transition + 1];
    let beat =
      chord.startBeat - phrase.rhythm.slice(0, -1).reduce((sum, duration) => sum + duration, 0);
    for (const [index, degree] of notes.entries()) {
      const midi = resolveDegree(root, degree);
      events.push({
        startBeat: beat,
        durationBeats: phrase.rhythm[index],
        notes: [midi],
        hand: 'right',
        role: 'melody',
        velocity: index === notes.length - 1 ? 0.86 : 0.75,
        degrees: [degree],
      });
      if (index === notes.length - 1) {
        const interval = pitchClass(midi - chord.notes[0]);
        const fn = (
          {
            0: 'основной тон',
            3: 'терция',
            4: 'терция',
            7: 'квинта',
            10: 'септима',
            11: 'септима',
          } as Record<number, string>
        )[interval];
        if (!fn) throw new Error(`Non-chord target: ${definition.id}`);
        targetNotes.push({ beat, note: midi, chord: chord.name, function: fn });
      }
      beat += phrase.rhythm[index];
    }
  }
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    root,
    bpm: definition.bpm ?? 60,
    beatsPerBar: 4,
    lengthBeats: progression.length * 4,
    progression,
    events: events.sort((a, b) => a.startBeat - b.startBeat),
    targetNotes,
  };
}
export const EXAMPLE_LIBRARY = definitions.map(buildExample);
const library = new Map(EXAMPLE_LIBRARY.map((example) => [example.id, example]));
const contexts: Record<string, string[]> = {
  major: ['target-i-iv', 'target-vi-v'],
  blues: ['blues-i-iv', 'blues-iv-i'],
  minor: ['minor-i-iv', 'minor-v-vi'],
  'to-vi': ['soft-iv-vi', 'soft-i-vi'],
  'to-v': ['target-vi-v', 'dominant-iv-v'],
  enclosure: ['enclosure-v-i', 'enclosure-i-iv'],
  chromatic: ['chromatic-i-iv', 'chromatic-i-v'],
  P7: ['descending-iv-i', 'descending-vi-v'],
  P8: ['chromatic-i-iv', 'chromatic-i-v'],
  P9: ['enclosure-v-i', 'enclosure-i-iv'],
  P10: ['minor-i-iv', 'minor-v-vi'],
  'improv-foundations': ['dialogue-i-iv', 'dialogue-iv-i'],
  'improv-blues': ['blues-i-iv', 'minor-v-vi'],
  'improv-sequences': ['sequence-ii-v-i', 'sequence-four-chords'],
  'improv-leaps': ['leaps-ii-v-i', 'leaps-cycle'],
  'improv-fills': ['fills-cycle', 'fills-answer'],
  'improv-assessment': ['advanced-cadence', 'advanced-cycle'],
};
export function examplesFor(root: number, technique: string, advanced = false): MusicalExample[] {
  const ids = contexts[technique] ?? [];
  const selected = advanced && ids.length ? [...ids, 'advanced-cadence'] : ids;
  return [...new Set(selected)].map((id) => {
    const example = transposeExample(library.get(id)!, root);
    return { ...example, id: `${id}-${root}` };
  });
}
