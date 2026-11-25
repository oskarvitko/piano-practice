import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useNotifications } from '../stores/notifications';
import { IconButton } from './ui';

export function NotificationToast() {
  const { notice, dismiss } = useNotifications();
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => dismiss(notice.id), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice, dismiss]);
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {notice && (
        <div className="completion-toast" key={notice.id}>
          <span className="toast-check" aria-hidden="true">
            <Check size={21} />
          </span>
          <div className="toast-copy">
            <strong>{notice.title}</strong>
            <p>{notice.description}</p>
          </div>
          <IconButton label="Закрыть уведомление" onClick={() => dismiss(notice.id)}>
            <X size={18} />
          </IconButton>
          <span className="toast-lifetime" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
