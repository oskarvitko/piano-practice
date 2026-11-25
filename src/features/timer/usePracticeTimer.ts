import { useCallback, useEffect, useMemo, useState } from 'react';
import { PracticeTimer } from './PracticeTimer';
import { repository } from '../../stores/app';
import type { PracticeSession } from '../../core/types';
export function usePracticeTimer(session: PracticeSession | undefined, stepId: string) {
  const timer = useMemo(() => new PracticeTimer(session?.steps[stepId]), [session?.id, stepId]); // Checkpoints never restart a running clock.
  const [value, setValue] = useState(timer.value());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useCallback(async () => {
    if (session) await repository.checkpoint(session.id, stepId, timer.value());
  }, [session?.id, stepId, timer]);
  const pauseAndSave = useCallback(async () => {
    timer.pause();
    setRunning(false);
    setValue(timer.value());
    await save();
  }, [timer, save]);
  useEffect(() => {
    let ticks = 0;
    const interval = setInterval(() => {
      setValue(timer.value());
      if (timer.running && ++ticks % 20 === 0)
        void save().catch(() =>
          setError('Не удалось сохранить время. Освободи место на устройстве.'),
        );
    }, 250);
    const pause = () => {
      void pauseAndSave().catch(() => setError('Не удалось сохранить время'));
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pause);
    return () => {
      clearInterval(interval);
      timer.pause();
      void save().catch(() => {});
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pause);
    };
  }, [timer, save, pauseAndSave]);
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let cancelled = false;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock
      .request('screen')
      .then((result) => {
        if (cancelled) void result.release();
        else lock = result;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [running]);
  const toggle = async () => {
    if (timer.running) await pauseAndSave();
    else {
      timer.start();
      setRunning(true);
      await save();
    }
  };
  const reset = async () => {
    timer.reset();
    setRunning(false);
    setValue(timer.value());
    await save();
  };
  return { value, running, toggle, reset, pauseAndSave, error };
}
