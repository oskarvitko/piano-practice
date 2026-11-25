import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Play, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { CHORDS } from '../../core/practice/chords';
import {
  defaultConfig,
  FILLS,
  KEY_NAMES,
  meterInfo,
  STYLES,
  TRAINERS,
  VOICINGS,
} from '../../core/practice/config';
import { compatibleTemplates, configProblems } from '../../core/practice/harmony';
import type { Channel, PracticeConfig, TrainerType } from '../../core/practice/types';
import { ErrorMessage, Loading } from '../../components/ui';
import { practiceController, trainerRepository } from './controller';
import { practiceLibrary } from './library';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="practice-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ChannelsForm({
  config,
  onChange,
}: {
  config: PracticeConfig;
  onChange: (config: PracticeConfig) => void;
}) {
  const labels: Record<Channel, string> = {
    metronome: 'Метроном',
    bass: 'Бас',
    harmony: 'Аккорды',
    melody: 'Мелодия примера',
    voice: 'Голос ступеней',
  };
  return (
    <div className="practice-channels">
      {(Object.keys(labels) as Channel[]).map((channel) => (
        <div className="practice-channel" key={channel}>
          <label>
            <input
              type="checkbox"
              checked={config.channels[channel].enabled}
              onChange={(e) =>
                onChange({
                  ...config,
                  channels: {
                    ...config.channels,
                    [channel]: { ...config.channels[channel], enabled: e.target.checked },
                  },
                })
              }
            />
            {labels[channel]}
          </label>
          <input
            aria-label={`Громкость: ${labels[channel]}`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.channels[channel].volume}
            onChange={(e) =>
              onChange({
                ...config,
                channels: {
                  ...config.channels,
                  [channel]: { ...config.channels[channel], volume: Number(e.target.value) },
                },
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
export function PracticeConfiguration() {
  const { trainer } = useParams();
  const type = trainer as TrainerType;
  const navigate = useNavigate();
  const [config, setConfig] = useState<PracticeConfig>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!TRAINERS[type]) return;
    void trainerRepository
      .config(type)
      .then((value) => {
        if (!cancelled) setConfig(value);
      })
      .catch(() => setError('Не удалось загрузить настройки'));
    return () => {
      cancelled = true;
    };
  }, [type]);
  if (!TRAINERS[type])
    return (
      <div className="page">
        <p>Такого тренажёра нет.</p>
        <Link to="/practice">К тренажёрам</Link>
      </div>
    );
  if (!config || config.trainer !== type) return <Loading />;
  const change = (next: PracticeConfig) => {
    setConfig(next);
    if (next.keys.length && next.enabledDegrees.length && next.voicings.length)
      void trainerRepository
        .saveConfig(next)
        .catch(() => setError('Не удалось сохранить настройки'));
  };
  const patch = <K extends keyof PracticeConfig>(key: K, value: PracticeConfig[K]) =>
    change({ ...config, [key]: value });
  const problems = configProblems(config, practiceLibrary.progressions);
  const selectedMode = config.keys[0]?.mode ?? 'major';
  const templates = compatibleTemplates(config, practiceLibrary.progressions, selectedMode);
  const start = async () => {
    setBusy(true);
    try {
      await practiceController.prepare(config);
      navigate('/practice/session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подготовить тренировку');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page practice-config">
      <Link className="back-link" to="/practice">
        <ArrowLeft size={16} />
        Все тренажёры
      </Link>
      <span className="eyebrow">PRACTICE · ТВОЁ ВРЕМЯ ЗА ИНСТРУМЕНТОМ</span>
      <h1>{TRAINERS[type].name}</h1>
      <p className="page-intro">{TRAINERS[type].description}</p>
      <section className="practice-panel">
        <h2>Быстрый старт</h2>
        <div className="practice-form-grid">
          <Field label="Тональность">
            <select
              value={config.keys.length === 1 ? config.keys[0].pc : 'multi'}
              onChange={(e) => {
                if (e.target.value !== 'multi')
                  patch('keys', [{ pc: Number(e.target.value), mode: selectedMode }]);
              }}
            >
              {KEY_NAMES.map((name, pc) => (
                <option key={name} value={pc}>
                  {name}
                </option>
              ))}
              <option value="multi">Несколько тональностей</option>
            </select>
          </Field>
          <Field label="Лад">
            <select
              value={selectedMode}
              onChange={(e) =>
                change({
                  ...config,
                  keys: config.keys.map((k) => ({
                    ...k,
                    mode: e.target.value as 'major' | 'minor',
                  })),
                  scale:
                    type === 'scale'
                      ? e.target.value === 'minor'
                        ? 'natural-minor'
                        : 'major'
                      : config.scale,
                })
              }
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </Field>
          <Field label="Стиль">
            <select
              value={config.style}
              onChange={(e) => {
                const style = e.target.value as PracticeConfig['style'];
                change({
                  ...config,
                  style,
                  progressionId: '',
                  difficulty:
                    config.difficulty !== 'custom' &&
                    ['jazz', 'blues'].includes(style) &&
                    config.difficulty < 3
                      ? 3
                      : config.difficulty,
                });
              }}
            >
              {Object.entries(STYLES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сложность">
            <select
              value={config.difficulty}
              onChange={(e) =>
                patch(
                  'difficulty',
                  e.target.value === 'custom' ? 'custom' : (Number(e.target.value) as 1),
                )
              }
            >
              {['1 · Foundation', '2 · Diatonic', '3 · Extended', '4 · Advanced', '5 · Expert'].map(
                (label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ),
              )}
              <option value="custom">Custom · свои ограничения</option>
            </select>
          </Field>
          <Field label="BPM">
            <input
              type="number"
              min="30"
              max="200"
              step="1"
              value={config.bpm}
              onChange={(e) => patch('bpm', Math.max(30, Math.min(200, Number(e.target.value))))}
            />
          </Field>
          <Field label="Продолжительность">
            <select
              value={config.durationMinutes ?? 'unlimited'}
              onChange={(e) =>
                patch(
                  'durationMinutes',
                  e.target.value === 'unlimited' ? null : Number(e.target.value),
                )
              }
            >
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option value={n} key={n}>
                  {n} минут
                </option>
              ))}
              <option value="unlimited">Unlimited · без ограничения</option>
            </select>
          </Field>
        </div>
        <input
          className="practice-bpm-slider"
          aria-label="Темп тренировки"
          type="range"
          min="30"
          max="200"
          step="1"
          value={config.bpm}
          onChange={(e) => patch('bpm', Number(e.target.value))}
        />
        <div className="practice-presets">
          {[40, 60, 80, 100, 120, 140].map((n) => (
            <button key={n} aria-pressed={config.bpm === n} onClick={() => patch('bpm', n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="muted">
          {meterInfo(config.meter).label}. Jazz и Blues используют септаккорды, начиная с уровня 3.
        </p>
      </section>
      {type === 'degree' && (
        <section className="practice-panel">
          <h2>Задание на ступени</h2>
          <div className="practice-form-grid">
            <Field label="Что показывать">
              <select
                value={config.degreeDisplay}
                onChange={(e) =>
                  patch('degreeDisplay', e.target.value as PracticeConfig['degreeDisplay'])
                }
              >
                <option value="arabic">Только цифра · 1, 2, 3…</option>
                <option value="roman">Римская ступень · I, ii, iii…</option>
                <option value="both">Ступень + аккорд</option>
                <option value="chord">Только аккорд</option>
              </select>
            </Field>
            <Field label="Что играть">
              <select
                value={config.degreeTask}
                onChange={(e) => {
                  const value = e.target.value as PracticeConfig['degreeTask'];
                  change({
                    ...config,
                    degreeTask: value,
                    difficulty:
                      ['sevenths', 'extended', 'mixed'].includes(value) &&
                      config.difficulty !== 'custom' &&
                      config.difficulty < 3
                        ? 3
                        : config.difficulty,
                  });
                }}
              >
                <option value="bass">Только бас</option>
                <option value="triads">Трезвучия</option>
                <option value="sevenths">Септаккорды</option>
                <option value="extended">Расширенные</option>
                <option value="inversions">Обращения</option>
                <option value="mixed">Смешанные задания</option>
              </select>
            </Field>
          </div>
        </section>
      )}
      {type === 'chord' && (
        <section className="practice-panel">
          <h2>Режим аккордов</h2>
          <Field label="Режим">
            <select
              value={config.chordMode}
              onChange={(e) => patch('chordMode', e.target.value as PracticeConfig['chordMode'])}
            >
              <option value="harmonic">Harmonic · внутри прогрессии</option>
              <option value="isolated">Isolated · отдельные аккорды</option>
              <option value="voicing">Voicing · конкретное расположение</option>
            </select>
          </Field>
        </section>
      )}
      {type === 'fill' && (
        <section className="practice-panel">
          <h2>Музыкальная фраза</h2>
          <Field label="Тип филла">
            <select
              value={config.fillKind}
              onChange={(e) => patch('fillKind', e.target.value as PracticeConfig['fillKind'])}
            >
              {Object.entries(FILLS).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {config.fillKind === 'mixed' && (
            <Field label="Комбинация">
              <select
                value={config.mix}
                onChange={(e) => patch('mix', e.target.value as PracticeConfig['mix'])}
              >
                {Object.entries({
                  'major-pentatonic': 'Major + Pentatonic',
                  'pentatonic-major-blues': 'Pentatonic + Major Blues',
                  'pentatonic-minor-blues': 'Pentatonic + Minor Blues',
                  'major-chromatic': 'Major + Chromatic',
                  'arpeggio-pentatonic': 'Arpeggio + Pentatonic',
                  'arpeggio-chromatic': 'Arpeggio + Chromatic',
                  'two-patterns': 'Два мелодических паттерна',
                }).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <p className="muted">
            Один переход занимает не менее двух тактов 4/4: исходный аккорд, филл и разрешение.
            Подсказка содержит два разных контекста.
          </p>
        </section>
      )}
      {type === 'scale' && (
        <section className="practice-panel">
          <h2>Гамма и движение</h2>
          <div className="practice-form-grid">
            <Field label="Гамма">
              <select
                value={config.scale}
                onChange={(e) => patch('scale', e.target.value as PracticeConfig['scale'])}
              >
                {[
                  'major',
                  'natural-minor',
                  'harmonic-minor',
                  'major-pentatonic',
                  'minor-pentatonic',
                  'major-blues',
                  'minor-blues',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Паттерн">
              <select value={config.pattern} onChange={(e) => patch('pattern', e.target.value)}>
                <option value="scale">Гамма целиком</option>
                {Object.entries(practiceLibrary.patterns).map(([id, formula]) => (
                  <option key={id} value={id}>
                    {id} · {formula}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Направление">
              <select
                value={config.direction}
                onChange={(e) => patch('direction', e.target.value as PracticeConfig['direction'])}
              >
                {Object.entries({
                  up: 'Вверх',
                  down: 'Вниз',
                  both: 'Вверх и вниз',
                  random: 'Случайный паттерн',
                  mixed: 'Смешанные паттерны',
                }).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Октавы">
              <select
                value={config.octaves}
                onChange={(e) => patch('octaves', Number(e.target.value) as 1)}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Ритм">
              <select
                value={config.subdivision}
                onChange={(e) => patch('subdivision', Number(e.target.value) as 1)}
              >
                <option value="1">Четверти</option>
                <option value="2">Восьмые</option>
                <option value="3">Восьмые триоли</option>
                <option value="4">Шестнадцатые</option>
              </select>
            </Field>
            <Field label="Повторения">
              <input
                type="number"
                min="1"
                max="16"
                value={config.repetitions}
                onChange={(e) =>
                  patch('repetitions', Math.max(1, Math.min(16, Number(e.target.value))))
                }
              />
            </Field>
            <Field label="Руки">
              <select
                value={config.hands}
                onChange={(e) => patch('hands', e.target.value as PracticeConfig['hands'])}
              >
                <option value="right">Правая</option>
                <option value="left">Левая</option>
                <option value="both">Обе · левая на две октавы ниже</option>
              </select>
            </Field>
          </div>
          <p className="muted">
            В 6/8 BPM — четверть с точкой, три обычные восьмые на долю. Включи «Мелодия примера»,
            если хочешь играть вместе со звуком.
          </p>
        </section>
      )}
      <details className="practice-panel practice-advanced">
        <summary>
          <SlidersHorizontal size={18} />
          Дополнительные настройки
        </summary>
        <h3>Тональности</h3>
        <div className="practice-key-grid">
          {KEY_NAMES.map((name, pc) => (
            <button
              key={name}
              aria-pressed={config.keys.some((k) => k.pc === pc)}
              onClick={() => {
                const exists = config.keys.some((k) => k.pc === pc);
                if (exists && config.keys.length === 1) return;
                patch(
                  'keys',
                  exists
                    ? config.keys.filter((k) => k.pc !== pc)
                    : [...config.keys, { pc, mode: selectedMode }],
                );
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="practice-form-grid">
          <Field label="Порядок тональностей">
            <select
              value={config.keyOrder}
              onChange={(e) => patch('keyOrder', e.target.value as PracticeConfig['keyOrder'])}
            >
              <option value="selected">По выбранному списку</option>
              <option value="random">Random Key</option>
              <option value="fifths">Квинтовый круг</option>
            </select>
          </Field>
          <button
            className="button secondary"
            onClick={() =>
              change({
                ...config,
                keys: KEY_NAMES.map((_, pc) => ({ pc, mode: selectedMode })),
                keyOrder: 'random',
              })
            }
          >
            Все 12 · случайная тональность
          </button>
          <Field label="Генерация">
            <select
              value={config.generationMode}
              onChange={(e) =>
                patch('generationMode', e.target.value as PracticeConfig['generationMode'])
              }
            >
              <option value="fixed">Fixed Progression</option>
              <option value="random">Random Progressions</option>
              <option value="adaptive">Adaptive · чаще сложные фразы</option>
              <option value="free-random">Free Random · без гармонической связи</option>
            </select>
          </Field>
          {config.generationMode === 'fixed' && (
            <Field label="Прогрессия">
              <select
                value={config.progressionId}
                onChange={(e) => patch('progressionId', e.target.value)}
              >
                <option value="">Первая подходящая</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.chords.join('–')}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Размер">
            <select
              value={config.meter}
              onChange={(e) => patch('meter', e.target.value as PracticeConfig['meter'])}
            >
              {['4/4', '3/4', '6/8', '2/4'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Смена задания">
            <select
              value={config.changeEvery}
              onChange={(e) =>
                patch('changeEvery', e.target.value as PracticeConfig['changeEvery'])
              }
            >
              {Object.entries({
                beat: 'Каждую долю',
                'two-beats': 'Каждые 2 доли',
                bar: 'Каждый такт',
                'two-bars': 'Каждые 2 такта',
                'four-bars': 'Каждые 4 такта',
                manual: 'Вручную',
              }).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Предпросмотр">
            <select
              value={config.previewCount}
              onChange={(e) => patch('previewCount', Number(e.target.value) as 0)}
            >
              {[0, 1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? '0 · без подготовки' : `${n} следующих задания`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Подсказки">
            <select
              value={config.hintMode}
              onChange={(e) => patch('hintMode', e.target.value as PracticeConfig['hintMode'])}
            >
              {Object.entries({
                hidden: 'Скрыты',
                'chord-name': 'Название аккорда',
                notes: 'Название и ноты',
                keyboard: 'Клавиатура',
                full: 'Полная демонстрация',
              }).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Язык голоса">
            <select
              value={config.voiceLanguage}
              onChange={(e) => patch('voiceLanguage', e.target.value as 'en' | 'pl')}
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </Field>
          <Field label="Когда произносить">
            <select
              value={config.voiceTiming}
              onChange={(e) =>
                patch('voiceTiming', e.target.value as PracticeConfig['voiceTiming'])
              }
            >
              <option value="on-change">При смене</option>
              <option value="one-beat-before">За одну долю</option>
              <option value="two-beats-before">За две доли</option>
              <option value="off">Выключено</option>
            </select>
          </Field>
        </div>
        <label className="practice-check">
          <input
            type="checkbox"
            checked={config.anticipatoryVoice}
            onChange={(e) => patch('anticipatoryVoice', e.target.checked)}
          />
          Разрешить голосовую подсказку заранее, даже без предпросмотра
        </label>
        <p className="muted">
          На высоком темпе объявления пропускаются, если предыдущее слово ещё звучит. Очередь речи
          не накапливается.
        </p>
        <h3>Сопровождение</h3>
        <ChannelsForm config={config} onChange={change} />
        <h3>Допустимые ступени</h3>
        <div className="practice-presets">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              aria-pressed={config.enabledDegrees.includes(n)}
              onClick={() => {
                if (config.enabledDegrees.length === 1 && config.enabledDegrees.includes(n)) return;
                patch(
                  'enabledDegrees',
                  config.enabledDegrees.includes(n)
                    ? config.enabledDegrees.filter((x) => x !== n)
                    : [...config.enabledDegrees, n],
                );
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <h3>Расположения</h3>
        <div className="practice-options">
          {Object.entries(VOICINGS).map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={config.voicings.includes(id as never)}
                onChange={(e) => {
                  if (!e.target.checked && config.voicings.length === 1) return;
                  patch(
                    'voicings',
                    e.target.checked
                      ? [...config.voicings, id as never]
                      : config.voicings.filter((v) => v !== id),
                  );
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <h3>Типы аккордов</h3>
        <p className="muted">
          Пустой выбор — подходящие типы выбранного стиля и уровня. Для всех типов выбери Custom.
          Ограничения не нарушаются скрытно.
        </p>
        <button className="text-button" onClick={() => patch('enabledChordTypes', [])}>
          Автоматически по стилю
        </button>
        {[...new Set(CHORDS.map((c) => c.category))].map((category) => (
          <fieldset className="practice-chord-category" key={category}>
            <legend>{category}</legend>
            <button
              type="button"
              className="text-button small"
              onClick={() =>
                patch('enabledChordTypes', [
                  ...new Set([
                    ...config.enabledChordTypes,
                    ...CHORDS.filter((c) => c.category === category).map((c) => c.id),
                  ]),
                ])
              }
            >
              Выбрать категорию
            </button>
            <div className="practice-options">
              {CHORDS.filter((c) => c.category === category).map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={config.enabledChordTypes.includes(c.id)}
                    onChange={(e) =>
                      patch(
                        'enabledChordTypes',
                        e.target.checked
                          ? [...config.enabledChordTypes, c.id]
                          : config.enabledChordTypes.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </details>
      {problems.map((message) => (
        <ErrorMessage key={message}>{message}</ErrorMessage>
      ))}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="practice-config-start">
        <button
          className="button primary"
          disabled={busy || problems.length > 0}
          onClick={() => void start()}
        >
          <Play size={20} />
          Подготовить тренировку
        </button>
        <button className="text-button" onClick={() => change(defaultConfig(type))}>
          Настройки по умолчанию
        </button>
        <span>Звук начнётся после нажатия Start на следующем экране.</span>
      </div>
    </div>
  );
}
