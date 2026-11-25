import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudDownload, WifiOff, RefreshCw, Check } from 'lucide-react';
import { PIANO_FILES } from '../../audio/service';
import { Dialog } from '../../components/ui';
export function OfflineStatus() {
  const { pathname } = useLocation();
  const activeLesson = pathname.startsWith('/lesson/') && !pathname.endsWith('/completed');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [cached, setCached] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, registration) => {
      if (navigator.onLine) void registration?.update().catch(() => {});
    },
    onRegisterError: (error) => console.warn('Service worker registration:', error),
  });
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    return () => {
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!('caches' in window) || !('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) setNeedRefresh(true);
      if (!registration?.active) return;
      const files = await Promise.all(
        PIANO_FILES.map((name) =>
          caches.match(
            new URL(`${import.meta.env.BASE_URL}audio/piano/${name}.mp3`, location.origin).href,
            { ignoreSearch: true },
          ),
        ),
      );
      if (!cancelled) setCached(files.every(Boolean));
    };
    const check = () =>
      void verify().catch(() => {
        if (!cancelled) setCached(false);
      });
    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [offlineReady, setNeedRefresh]);
  return (
    <>
      <div className="offline-status">
        {offline ? (
          <WifiOff size={14} />
        ) : cached ? (
          <Check size={14} />
        ) : (
          <CloudDownload size={14} />
        )}
        <span>
          {cached
            ? offline
              ? 'Офлайн · всё под рукой'
              : 'Готово к занятиям офлайн'
            : offline
              ? 'Офлайн · звук синтезатора'
              : 'Подготовка офлайн-режима'}
        </span>
      </div>
      {needRefresh && !activeLesson && (
        <button className="update-banner" onClick={() => setConfirm(true)}>
          <RefreshCw size={16} />
          Доступна новая версия
        </button>
      )}
      {confirm && !activeLesson && (
        <Dialog title="Обновить приложение?" onClose={() => setConfirm(false)}>
          <p>Страница перезагрузится. Сохранённый прогресс останется на устройстве.</p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setConfirm(false)}>
              Позже
            </button>
            <button className="button primary" onClick={() => void updateServiceWorker(true)}>
              Обновить
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
