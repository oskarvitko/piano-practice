import { create } from 'zustand';

interface Notice {
  id: string;
  title: string;
  description: string;
}
interface Notifications {
  notice: Notice | null;
  notify: (title: string, description: string) => void;
  dismiss: (id: string) => void;
}
export const useNotifications = create<Notifications>((set) => ({
  notice: null,
  notify: (title, description) => set({ notice: { id: crypto.randomUUID(), title, description } }),
  dismiss: (id) => set((state) => (state.notice?.id === id ? { notice: null } : state)),
}));
