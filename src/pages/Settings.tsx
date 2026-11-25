import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Check,
  Download,
  HardDrive,
  Layers,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { db } from '../database/db';
import { exportBackup, importBackup, validateBackup, type Backup } from '../database/backup';
import { programs } from '../programs/registry';
import { useAppStore } from '../stores/app';
import { Dialog, ErrorMessage } from '../components/ui';
import { PianoKeyboard } from '../components/PianoKeyboard';
import type { KeyboardPreferences } from '../core/types';

const keyboardOptions: { key: keyof KeyboardPreferences; title: string; description: string }[] = [
  { key: 'noteNames', title: 'Названия нот', description: 'Буквы на клавишах: C, D, E…' },
  {
    key: 'degrees',
    title: 'Ступени',
    description: 'Положение ноты относительно тоники: 1, 2, ♭3…',
  },
  { key: 'octaves', title: 'Номера октав', description: 'Дополнительный ряд цифр: 3, 4, 5…' },
  {
    key: 'fingering',
    title: 'Аппликатура',
    description: 'Номера пальцев, если они указаны в упражнении.',
  },
  {
    key: 'tonicMarker',
    title: 'Метка тоники',
    description: 'Точка над основной нотой тональности.',
  },
];
export function SettingsPage() {
  const { preferences, savePreferences, refresh } = useAppStore();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#keyboard') return;
    const frame = requestAnimationFrame(() =>
      document.getElementById('keyboard')?.scrollIntoView(),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: Backup; warnings: string[] }>();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    const data = await exportBackup(db);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `piano-practice-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Резервная копия готова. Сохрани её в «Файлы» на iPhone.');
  };
  const load = async (file: File) => {
    if (file.size > 20_000_000) throw new Error('Файл слишком большой (максимум 20 МБ)');
    setPending(validateBackup(await file.text(), programs));
  };
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">УДОБНО ИМЕННО ТЕБЕ</span>
          <h1>Настройки</h1>
          <p>Немного заботы о твоём пространстве.</p>
        </div>
      </div>
      <section className="settings-card">
        <h2>Оформление</h2>
        <p>Выбери свет, в котором приятно заниматься.</p>
        <div className="theme-options">
          {(
            [
              { id: 'dark', label: 'Тёмная', Icon: Moon },
              { id: 'light', label: 'Светлая', Icon: Sun },
              { id: 'system', label: 'Как на устройстве', Icon: Monitor },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              className={preferences.theme === id ? 'selected' : ''}
              aria-pressed={preferences.theme === id}
              onClick={() => void run(() => savePreferences({ theme: id }))}
            >
              <Icon size={23} />
              <span>{label}</span>
              {preferences.theme === id && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-card" id="keyboard">
        <h2>Подписи клавиш</h2>
        <p>Оставь нужные подсказки. Настройки применяются ко всем упражнениям.</p>
        <div className="keyboard-preview">
          <span className="eyebrow">ПРЕДПРОСМОТР · ДО МАЖОР</span>
          <PianoKeyboard
            notes={[60, 62, 64, 65, 67, 69, 71, 72]}
            root={60}
            labels={{ 60: '1', 62: '2', 64: '3', 65: '4', 67: '5', 69: '6', 71: '7', 72: '1' }}
            fingering={{ 60: '1', 62: '2', 64: '3', 65: '1', 67: '2', 69: '3', 71: '4', 72: '5' }}
            display={preferences.keyboard}
            compact
          />
        </div>
        <div className="keyboard-options">
          {keyboardOptions.map(({ key, title, description }) => (
            <label className="switch-row" key={key}>
              <span className="switch-copy">
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={title}
                checked={preferences.keyboard[key]}
                disabled={busy}
                onChange={(event) => {
                  const checked = event.target.checked;
                  void run(() =>
                    savePreferences({ keyboard: { ...preferences.keyboard, [key]: checked } }),
                  );
                }}
              />
              <span className="switch-track" aria-hidden="true" />
            </label>
          ))}
        </div>
      </section>
      <section className="settings-card">
        <div className="settings-title">
          <HardDrive size={22} />
          <h2>Твой прогресс</h2>
        </div>
        <p>
          Занятия хранятся только в этом браузере, на этом устройстве. Safari может очистить данные
          при нехватке места. Сохраняй резервную копию время от времени.
        </p>
        <div className="backup-actions">
          <button className="button secondary" disabled={busy} onClick={() => void run(download)}>
            <Download size={18} />
            Экспорт в JSON
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={18} />
            Импорт из JSON
          </button>
          <input
            type="file"
            ref={input}
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void run(() => load(file));
              e.target.value = '';
            }}
          />
        </div>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!navigator.storage?.persist) {
                setMessage(
                  'Этот браузер управляет хранением автоматически. Резервная копия — самый надёжный способ сохранить прогресс.',
                );
                return;
              }
              const persisted = await navigator.storage.persist();
              setMessage(
                persisted
                  ? 'Браузер предоставил постоянное хранилище. Резервная копия всё равно пригодится.'
                  : 'Браузер не предоставил постоянное хранилище. Сохрани резервную копию.',
              );
            })
          }
        >
          <ShieldCheck size={17} />
          Запросить сохранение данных
        </button>
      </section>
      <section className="settings-card">
        <div className="settings-title">
          <Layers size={22} />
          <h2>Программа занятий</h2>
        </div>
        <p>У каждой программы свой прогресс. Переключение сохраняет твои достижения.</p>
        <Link to="/programs" className="button secondary">
          Выбрать программу
        </Link>
      </section>
      <section className="settings-card install-card">
        <h2>Пианино всегда рядом</h2>
        <p>
          На iPhone открой приложение в Safari, нажми «Поделиться» и выбери «На экран Домой».
          Дождись статуса «Готово к занятиям офлайн» перед отключением интернета.
        </p>
        <p className="hint">
          Звук включается только по нажатию. Если пианино не загрузится, будет доступен синтезатор.
          При блокировке экрана звук и таймер останавливаются.
        </p>
      </section>
      <section className="credits">
        <strong>
          Piano Practice <span>1.0</span>
        </strong>
        <p>
          Звук: Salamander Grand Piano, Alexander Holm ·{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          .<br />
          Локальные сэмплы из{' '}
          <a
            href="https://github.com/Tonejs/audio/tree/master/salamander"
            target="_blank"
            rel="noreferrer"
          >
            Tone.js Audio
          </a>
          . Девять исходных MP3 без изменений; транспонирование при воспроизведении.
        </p>
        <a href={`${import.meta.env.BASE_URL}audio/piano/LICENSE.txt`}>Лицензия сэмплов</a>
      </section>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {message && (
        <div className="success-message" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      {pending && (
        <Dialog title="Заменить текущий прогресс?" onClose={() => !busy && setPending(undefined)}>
          <p>
            Копия от {new Date(pending.backup.exportedAt).toLocaleString('ru-RU')}:{' '}
            {pending.backup.lessonProgress.filter((l) => l.status === 'completed').length}{' '}
            завершённых уроков, {pending.backup.practiceSessions.length} занятий.
          </p>
          <p>
            Все текущие данные и настройки будут заменены одной операцией. Перед импортом можно
            сохранить свою копию.
          </p>
          {pending.warnings.map((w) => (
            <p className="warning-text" key={w}>
              {w}
            </p>
          ))}
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(undefined)}
            >
              Отмена
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await importBackup(db, pending.backup);
                  await refresh();
                  setPending(undefined);
                  setMessage('Прогресс восстановлен. Можно продолжать занятия.');
                })
              }
            >
              {busy ? 'Восстанавливаем…' : 'Заменить прогресс'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
