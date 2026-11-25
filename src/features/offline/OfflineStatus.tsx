import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudDownload, WifiOff, RefreshCw, Check } from 'lucide-react';
import { PIANO_FILES } from '../../audio/service';
import { Dialog } from '../../components/ui';
export function OfflineStatus() {
  const { pathname } = useLocation();
  const activeLesson =
    (pathname.startsWith('/lesson/') && !pathname.endsWith('/completed')) ||
    pathname === '/practice/session';
  const [offline, setOffline] = useState(!navigator.onLine);
  const [cached, setCached] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const resources = [
    ...PIANO_FILES.map((name) => `audio/piano/${name}.mp3`),
    ...['en', 'pl'].flatMap((language) =>
      ['1', '2', '3', '4', '5', '6', '7', 'flat', 'sharp'].map(
        (word) => `audio/voice/${language}/${word}.wav`,
      ),
    ),
  ];
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const cache = await caches.open('piano-practice-resources-v1');
      for (const file of resources) {
        const url = `${import.meta.env.BASE_URL}${file}`;
        if (await caches.match(url)) continue;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Не все ресурсы доступны');
        await cache.put(url, response);
      }
      setCached(true);
    } catch {
      setDownloadError('Не удалось загрузить все звуки. Проверь интернет и попробуй снова.');
    } finally {
      setDownloading(false);
    }
  };
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
        resources.map((file) =>
          caches.match(new URL(`${import.meta.env.BASE_URL}${file}`, location.origin).href, {
            ignoreSearch: true,
          }),
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
  }, [offlineReady, setNeedRefresh]); // Resource paths are a fixed bundled list.
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
      {!cached && !activeLesson && (
        <button
          className="text-button small"
          disabled={downloading || offline}
          onClick={() => void download()}
        >
          {downloading ? 'Загружаем пианино и голоса…' : 'Загрузить звуки для офлайн-занятий'}
        </button>
      )}
      {downloadError && <span role="status">{downloadError}</span>}
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
