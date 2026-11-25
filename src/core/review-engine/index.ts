import type { ReviewItem } from '../types';
export const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;
export const DAY = 86_400_000;
export const reviewKey = (programId: string, exerciseId: string, root: number) =>
  `${programId}::${exerciseId}::${root}`;
export function learnItem(
  programId: string,
  exerciseId: string,
  root: number,
  now: number,
): ReviewItem {
  return {
    key: reviewKey(programId, exerciseId, root),
    programId,
    exerciseId,
    root,
    firstLearnedAt: now,
    nextReviewAt: now + DAY,
    repetitionIndex: 0,
    mastery: false,
  };
}
export function reviewItem(item: ReviewItem, success: boolean, now: number): ReviewItem {
  if (item.mastery) return item;
  if (!success) return { ...item, lastReviewedAt: now, nextReviewAt: now };
  const repetitionIndex = item.repetitionIndex + 1;
  return {
    ...item,
    lastReviewedAt: now,
    repetitionIndex,
    mastery: repetitionIndex >= REVIEW_DAYS.length,
    nextReviewAt:
      repetitionIndex >= REVIEW_DAYS.length
        ? item.nextReviewAt
        : Math.max(now, item.firstLearnedAt + REVIEW_DAYS[repetitionIndex] * DAY),
  };
}
export const dueReviews = (items: ReviewItem[], now: number, limit = 4) =>
  items
    .filter((i) => !i.mastery && i.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt || a.key.localeCompare(b.key))
    .slice(0, limit);
export const isRootMastered = (items: ReviewItem[], root: number) =>
  items.some((i) => i.root === root && i.basePassed === true && i.mastery);
