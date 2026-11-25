import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AudioLines, X } from 'lucide-react';
export const formatTime = (seconds: number) => {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
};
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      {...props}
      type="button"
      className={`icon-button ${props.className ?? ''}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <AudioLines size={23} />
      </span>
      <span>
        piano<span className="brand-light">practice</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <span style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const active = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={22} />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <AudioLines size={32} />
      <p>Настраиваемся на практику…</p>
    </div>
  );
}
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div className="error-message" role="alert">
      {children}
    </div>
  );
}
