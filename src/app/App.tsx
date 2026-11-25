import { Component, useEffect, type ReactNode } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, House, Layers, Settings2, Sparkles } from 'lucide-react';
import { Brand, ErrorMessage, Loading } from '../components/ui';
import { ProgramsPage, OverviewPage } from '../pages/Programs';
import { LessonPage, CompletedPage } from '../pages/Lesson';
import { SettingsPage } from '../pages/Settings';
import { useAppStore } from '../stores/app';
import { getProgram } from '../programs/registry';
import { getNextLesson } from '../core/lesson-engine';
import { audioService } from '../audio/service';
import { OfflineStatus } from '../features/offline/OfflineStatus';
import { NotificationToast } from '../components/NotificationToast';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>Не удалось открыть приложение</h1>
        <p>Прогресс остаётся в локальном хранилище. Попробуй перезагрузить страницу.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Перезагрузить
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Home() {
  const { preferences, lessonProgress } = useAppStore();
  const program = preferences.activeProgramId && getProgram(preferences.activeProgramId);
  if (!program) return <Navigate to="/programs" replace />;
  const next = getNextLesson(
    program,
    lessonProgress
      .filter((l) => l.programId === program.id && l.status === 'completed')
      .map((l) => l.lessonId),
  );
  return (
    <Navigate to={next ? `/lesson/${program.id}/${next.id}` : `/program/${program.id}`} replace />
  );
}
function Shell() {
  const { ready, error, refresh, preferences, lessonProgress } = useAppStore();
  const location = useLocation();
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme =
        preferences.theme === 'system' ? (media.matches ? 'dark' : 'light') : preferences.theme;
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#101827' : '#f2f6fc');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);
  useEffect(() => {
    audioService.stopAll();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) audioService.stopAll();
    };
    const stop = () => audioService.stopAll();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
    };
  }, []);
  const active = preferences.activeProgramId;
  const completed = lessonProgress.filter(
    (l) => l.programId === active && l.status === 'completed',
  ).length;
  return (
    <div className="app-shell">
      <NotificationToast />
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        К содержимому
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand-link" aria-label="Piano Practice, главная">
          <Brand />
        </Link>
        <div className="sidebar-subtitle">Место для твоей музыки</div>
        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/" end>
            <House size={20} />
            Моя практика
          </NavLink>
          <NavLink
            to={active ? `/program/${active}` : '/programs'}
            className={() =>
              active &&
              (location.pathname.startsWith('/lesson/') ||
                location.pathname.startsWith('/program/'))
                ? 'active'
                : ''
            }
          >
            <BookOpen size={20} />
            План занятий
          </NavLink>
          <NavLink to="/programs">
            <Layers size={20} />
            Программы
          </NavLink>
          <NavLink to="/settings">
            <Settings2 size={20} />
            Настройки
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <Sparkles size={22} />
          <p>
            Не быстрее.
            <br />
            Музыкальнее.
          </p>
          <span>
            40 минут внимания к себе
            <br />и своему инструменту.
          </span>
        </div>
        <div className="sidebar-footer">
          <span>{active ? `${completed} уроков пройдено` : 'Начни с одной ноты'}</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-header">
          <Link to="/" aria-label="Piano Practice, главная">
            <Brand />
          </Link>
          <Link to="/settings" className="icon-button" aria-label="Настройки">
            <Settings2 size={21} />
          </Link>
        </header>
        <div className="desktop-topbar">
          <span>
            Личная студия <ChevronRight size={14} />
            <strong>
              {location.pathname.startsWith('/lesson/')
                ? 'Практика'
                : location.pathname === '/settings'
                  ? 'Настройки'
                  : location.pathname.startsWith('/program/')
                    ? 'План программы'
                    : 'Программы'}
            </strong>
          </span>
          <span className="quiet-label">Твой ритм. Твой прогресс.</span>
        </div>
        <main id="main-content" tabIndex={-1}>
          {!ready ? (
            <Loading />
          ) : error ? (
            <div className="page">
              <ErrorMessage>{error}</ErrorMessage>
              <button className="button secondary" onClick={() => void refresh()}>
                Попробовать снова
              </button>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/program/:id" element={<OverviewPage />} />
              <Route path="/lesson/:programId/:lessonId" element={<LessonPage />} />
              <Route path="/lesson/:programId/:lessonId/completed" element={<CompletedPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
        <footer className="mobile-footer">
          <OfflineStatus />
        </footer>
      </div>
    </div>
  );
}
export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ErrorBoundary>
  );
}
