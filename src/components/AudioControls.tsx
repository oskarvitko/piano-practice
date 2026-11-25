import { useEffect, useState, useSyncExternalStore } from 'react';
import { Minus, Plus, Play, Pause, Square, Repeat2, Volume2, VolumeX } from 'lucide-react';
import { audioService } from '../audio/service';
import { defaultPreferences, type AudioPreferences, type PlaybackPlan } from '../core/types';
import { useAppStore } from '../stores/app';
import { ErrorMessage, IconButton } from './ui';

export function AudioControls({
  plan,
  bpm,
  onBpmChange,
  onStop,
  recommendedBpm,
  practice = false,
}: {
  plan: PlaybackPlan;
  bpm: number;
  onBpmChange: (value: number) => void;
  onStop?: () => void;
  recommendedBpm?: number;
  practice?: boolean;
}) {
  const [details, setDetails] = useState(false);
  const state = useSyncExternalStore(audioService.subscribe, audioService.snapshot);
  const own = state.planId === plan.id;
  const audio = { ...state, status: own ? state.status : 'stopped' };
  const { preferences, savePreferences } = useAppStore();
  const prefs = preferences.audio;
  useEffect(() => {
    audioService.configure({ ...prefs, bpm });
  }, [prefs, bpm]);
  useEffect(() => () => audioService.stopAll(), []);
  const changeBpm = (value: number) => {
    const next = Math.max(
      practice ? 30 : 40,
      Math.min(practice ? 200 : 180, Math.round(value / (practice ? 1 : 5)) * (practice ? 1 : 5)),
    );
    onBpmChange(next);
    audioService.configure({ ...prefs, bpm: next });
    if (own) audioService.restart(next, prefs.loop);
    if (audio.metronome) void audioService.startMetronome();
    if (!practice) void savePreferences({ audio: { ...prefs, bpm: next, bpmOverride: true } });
  };
  const updatePrefs = (patch: Partial<AudioPreferences>) => {
    const value = { ...prefs, ...patch, bpm };
    audioService.configure(value);
    void savePreferences({ audio: { ...value, bpm: practice ? prefs.bpm : bpm } });
    if (patch.loop !== undefined && own) audioService.restart(bpm, value.loop);
    if ((patch.subdivision || patch.beatsPerBar) && audio.metronome)
      void audioService.startMetronome();
  };
  return (
    <div className="audio-player">
      <div className="audio-controls">
        <button
          className="audio-play"
          aria-label={audio.status === 'playing' ? 'Пауза воспроизведения' : 'Слушать упражнение'}
          disabled={audio.status === 'loading'}
          onClick={() =>
            audio.status === 'playing'
              ? audioService.pause()
              : void audioService.play(plan, prefs.loop, true)
          }
        >
          {audio.status === 'playing' ? (
            <Pause size={23} />
          ) : (
            <Play size={23} fill="currentColor" />
          )}
        </button>
        <div className="audio-title">
          <strong>
            {audio.status === 'loading'
              ? 'Подключаем звук…'
              : audio.status === 'playing'
                ? 'Играет пример'
                : audio.status === 'paused'
                  ? 'Продолжить пример'
                  : 'Послушать пример'}
          </strong>
          <span>
            {audio.mode === 'piano' ? 'Пианино' : 'Синтезатор'} ·{' '}
            {prefs.muted ? 'без звука' : 'с подсветкой нот'}
          </span>
        </div>
        <IconButton
          label="Остановить воспроизведение"
          onClick={() => {
            audioService.stop();
            onStop?.();
          }}
        >
          <Square size={18} />
        </IconButton>
        <IconButton
          label="Повторять по кругу"
          aria-pressed={prefs.loop}
          className={prefs.loop ? 'is-active' : ''}
          onClick={() => updatePrefs({ loop: !prefs.loop })}
        >
          <Repeat2 size={21} />
        </IconButton>
      </div>
      <div className="audio-secondary">
        <div className="bpm-control">
          <IconButton
            label="Уменьшить темп"
            onClick={() => changeBpm(bpm - (practice ? 1 : 5))}
            disabled={bpm <= (practice ? 30 : 40)}
          >
            <Minus size={17} />
          </IconButton>
          <label>
            <input
              aria-label="Темп BPM"
              type="number"
              min={practice ? 30 : 40}
              max={practice ? 200 : 180}
              step={practice ? 1 : 5}
              value={bpm}
              onChange={(e) => {
                if (e.target.value) changeBpm(Number(e.target.value));
              }}
            />
            <span>BPM</span>
          </label>
          <IconButton
            label="Увеличить темп"
            onClick={() => changeBpm(bpm + (practice ? 1 : 5))}
            disabled={bpm >= (practice ? 200 : 180)}
          >
            <Plus size={17} />
          </IconButton>
        </div>
        <button
          className="text-button small"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          Звук и метроном
        </button>
      </div>
      <div className="tempo-slider">
        <span aria-hidden="true">{practice ? 30 : 40}</span>
        <input
          aria-label="Темп воспроизведения, BPM"
          aria-valuetext={`${bpm} ударов в минуту`}
          type="range"
          min={practice ? 30 : 40}
          max={practice ? 200 : 180}
          step={practice ? 1 : 5}
          value={bpm}
          onChange={(e) => changeBpm(Number(e.target.value))}
        />
        <span aria-hidden="true">{practice ? 200 : 180}</span>
      </div>
      {(prefs.muted || prefs.volume === 0) && (
        <div className="audio-muted-notice" role="status">
          <span>
            <VolumeX size={17} /> {prefs.muted ? 'Звук выключен' : 'Громкость на нуле'}
          </span>
          <button
            className="text-button small"
            onClick={() =>
              updatePrefs({ muted: false, volume: prefs.volume || defaultPreferences.audio.volume })
            }
          >
            Вернуть звук
          </button>
        </div>
      )}
      {recommendedBpm !== undefined && (
        <div className="practice-tempos">
          <button
            className="text-button small"
            onClick={() => changeBpm(Math.max(40, recommendedBpm - 20))}
          >
            Медленнее
          </button>
          <button className="text-button small" onClick={() => changeBpm(recommendedBpm)}>
            Темп примера · {recommendedBpm} BPM
          </button>
        </div>
      )}
      {details && (
        <div className="audio-settings">
          <div className="volume-row">
            <IconButton
              label={prefs.muted ? 'Включить звук' : 'Выключить звук'}
              aria-pressed={prefs.muted}
              onClick={() => updatePrefs({ muted: !prefs.muted })}
            >
              {prefs.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </IconButton>
            <input
              aria-label="Громкость"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
            />
            <span>{Math.round(prefs.volume * 100)}%</span>
          </div>
          <div className="metronome-row">
            <button
              className={`button secondary small ${audio.metronome ? 'is-active' : ''}`}
              aria-pressed={audio.metronome}
              onClick={() =>
                audio.metronome ? audioService.stopMetronome() : void audioService.startMetronome()
              }
            >
              {audio.metronome ? <Pause size={16} /> : <Play size={16} />}Метроном
            </button>
            <div className="beat-dots" aria-label={`Доля ${audio.beat + 1}`}>
              {Array.from({ length: prefs.beatsPerBar }, (_, i) => (
                <span key={i} className={audio.metronome && audio.beat === i ? 'lit' : ''}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="field-pair">
            <label>
              Деление
              <select
                value={prefs.subdivision}
                onChange={(e) =>
                  updatePrefs({ subdivision: Number(e.target.value) as 1 | 2 | 3 | 4 })
                }
              >
                <option value={1}>Четверти</option>
                <option value={2}>Восьмые</option>
                <option value={3}>Триоли</option>
                <option value={4}>Шестнадцатые</option>
              </select>
            </label>
            <label>
              Размер
              <select
                value={prefs.beatsPerBar}
                onChange={(e) => updatePrefs({ beatsPerBar: Number(e.target.value) })}
              >
                <option value={3}>3/4</option>
                <option value={4}>4/4</option>
                <option value={6}>6/4</option>
              </select>
            </label>
          </div>
          <p className="hint">Метроном и таймер запускаются отдельно. Первая доля — с акцентом.</p>
          <p className="hint">
            Если на iPhone не слышно звук, прибавь громкость во время проигрывания и проверь, куда
            выводится звук — на динамик или Bluetooth. В старых версиях iOS может понадобиться
            выключить беззвучный режим.
          </p>
        </div>
      )}
      {audio.error && <ErrorMessage>{audio.error}</ErrorMessage>}
    </div>
  );
}
