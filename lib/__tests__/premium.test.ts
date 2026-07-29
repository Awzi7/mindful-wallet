import { hasReachedFreeLimit, FREE_CUSTOM_CATEGORY_LIMIT } from '../premium';

describe('hasReachedFreeLimit', () => {
  it('is never true for premium users, no matter how much they have used', () => {
    expect(hasReachedFreeLimit(true, 0, 3)).toBe(false);
    expect(hasReachedFreeLimit(true, 999, 3)).toBe(false);
  });

  it('is false for free users below the limit', () => {
    expect(hasReachedFreeLimit(false, 0, 3)).toBe(false);
    expect(hasReachedFreeLimit(false, 2, 3)).toBe(false);
  });

  it('is true for free users at or above the limit', () => {
    expect(hasReachedFreeLimit(false, 3, 3)).toBe(true);
    expect(hasReachedFreeLimit(false, 10, 3)).toBe(true);
  });
});

describe('free tier limit constants', () => {
  it('are positive, sane values', () => {
    expect(FREE_CUSTOM_CATEGORY_LIMIT).toBeGreaterThan(0);
  });
});
