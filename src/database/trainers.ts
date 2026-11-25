import type { PracticeDB } from './db';
import type {
  DifficultTask,
  PracticeConfig,
  TrainerSession,
  TrainerType,
} from '../core/practice/types';
import { defaultConfig } from '../core/practice/config';
import { practiceConfigSchema } from '../core/practice/validation';
export class TrainerRepository {
  constructor(private db: PracticeDB) {}
  async config(trainer: TrainerType) {
    const record = await this.db.settings.get(`practice-config-${trainer}`);
    const parsed = practiceConfigSchema.safeParse(record?.value);
    return parsed.success ? parsed.data : defaultConfig(trainer);
  }
  async saveConfig(config: PracticeConfig) {
    await this.db.transaction('rw', this.db.settings, async () => {
      await this.db.settings.put({
        key: `practice-config-${config.trainer}`,
        value: practiceConfigSchema.parse(config),
      });
      await this.db.settings.put({ key: 'practice-last', value: config.trainer });
    });
  }
  async lastTrainer() {
    const row = await this.db.settings.get('practice-last');
    return (
      ['degree', 'chord', 'style', 'fill', 'scale'].includes(String(row?.value))
        ? row!.value
        : 'degree'
    ) as TrainerType;
  }
  async checkpoint(session: TrainerSession) {
    const snapshot = structuredClone(session);
    if (snapshot.phase === 'completed') {
      snapshot.queue = [{ ...snapshot.queue[snapshot.index], examples: [], plan: undefined }];
      snapshot.index = 0;
    }
    await this.db.trainerSessions.put(snapshot);
  }
  async unfinished(trainer?: TrainerType) {
    return (await this.db.trainerSessions.orderBy('updatedAt').reverse().toArray()).find(
      (s) => s.phase !== 'completed' && (!trainer || s.config.trainer === trainer),
    );
  }
  history() {
    return this.db.trainerSessions.orderBy('startedAt').reverse().toArray();
  }
  difficult() {
    return this.db.difficultTasks.toArray();
  }
  async hard(item: DifficultTask) {
    await this.db.transaction('rw', this.db.difficultTasks, async () => {
      const old = await this.db.difficultTasks.get(item.id);
      await this.db.difficultTasks.put({ ...item, count: (old?.count ?? 0) + 1 });
    });
  }
  resetHard() {
    return this.db.difficultTasks.clear();
  }
}
