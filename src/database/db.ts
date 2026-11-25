import Dexie, { type Table } from 'dexie';
import type {
  LessonProgress,
  PracticeSession,
  ProgramProgress,
  ReviewItem,
  StepProgress,
} from '../core/types';
export interface Setting {
  key: string;
  value: unknown;
}
export class PracticeDB extends Dexie {
  settings!: Table<Setting, string>;
  programProgress!: Table<ProgramProgress, string>;
  lessonProgress!: Table<LessonProgress, [string, string]>;
  stepProgress!: Table<StepProgress, [string, string, string]>;
  practiceSessions!: Table<PracticeSession, string>;
  reviewItems!: Table<ReviewItem, string>;
  constructor(name = 'piano-practice') {
    super(name);
    const schema = {
      settings: 'key',
      programProgress: 'programId',
      lessonProgress: '[programId+lessonId],programId,status',
      stepProgress: '[programId+lessonId+stepId],[programId+lessonId]',
      practiceSessions: 'id,[programId+lessonId],programId,status,updatedAt',
      reviewItems: 'key,[programId+exerciseId+root],programId,nextReviewAt',
    };
    this.version(1).stores(schema);
    this.version(2)
      .stores({
        ...schema,
        practiceSessions: 'id,[programId+lessonId],programId,status,updatedAt,attemptId',
      })
      .upgrade(async (tx) => {
        await tx
          .table('practiceSessions')
          .toCollection()
          .modify((row: PracticeSession) => {
            row.attemptId ??= row.id;
            row.reviewResults ??= {};
            row.assessmentResults ??= {};
            for (const step of Object.values(row.steps)) step.timerSeconds ??= step.elapsedSeconds;
          });
      });
  }
}
export const db = new PracticeDB();
