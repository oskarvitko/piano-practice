import { create } from 'zustand';
import { db } from '../database/db';
import { PracticeRepository } from '../database/repository';
import { programs } from '../programs/registry';
import { defaultPreferences, type Preferences } from '../core/types';
export const repository = new PracticeRepository(db, programs);
type Snapshot = Awaited<ReturnType<PracticeRepository['snapshot']>>;
interface AppStore extends Snapshot {
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  savePreferences: (patch: Partial<Preferences>) => Promise<void>;
  clearError: () => void;
}
export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  error: null,
  preferences: defaultPreferences,
  programProgress: [],
  lessonProgress: [],
  sessions: [],
  reviews: [],
  refresh: async () => {
    try {
      set({ ...(await repository.snapshot()), ready: true, error: null });
    } catch {
      set({
        ready: true,
        error:
          'Не удалось открыть локальное хранилище. Проверь, что Safari разрешает хранение данных, и перезагрузи страницу.',
      });
    }
  },
  savePreferences: async (patch) => {
    const value = { ...get().preferences, ...patch };
    try {
      await repository.savePreferences(value);
      set({ preferences: value });
    } catch {
      set({ error: 'Не удалось сохранить настройки. Проверь свободное место на устройстве.' });
    }
  },
  clearError: () => set({ error: null }),
}));
