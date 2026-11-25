import { expect, it } from 'vitest';
import { DAY, dueReviews, learnItem, reviewItem } from './index';
it('anchors intervals to first learning and requires all five successful reviews', () => {
  let item = learnItem('p', 'x', 60, 1000);
  for (const day of [1, 3, 7, 14, 30]) {
    expect(item.nextReviewAt).toBe(1000 + day * DAY);
    item = reviewItem(item, true, 1000 + day * DAY);
  }
  expect(item.mastery).toBe(true);
});
it('keeps failures due and orders overdue items within the review budget', () => {
  const item = learnItem('p', 'x', 60, 0);
  const failed = reviewItem(item, false, 5 * DAY);
  expect(failed.repetitionIndex).toBe(0);
  expect(failed.nextReviewAt).toBe(5 * DAY);
  expect(dueReviews([failed, learnItem('p', 'y', 62, 0)], 5 * DAY, 1)[0].exerciseId).toBe('y');
});
