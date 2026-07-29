import { buildCategoryBreakdown, suggestWeeklyBudget, sumOverKeys } from '../budget';
import { Transaction } from '../types';

function tx(createdAt: string, amount: number, category: string): Transaction {
  return { id: createdAt + amount + category, amount, category, createdAt };
}

describe('sumOverKeys', () => {
  it('sums only the requested keys', () => {
    const record = { food: 100, cafe: 200, transport: 300 };
    expect(sumOverKeys(record, ['food', 'cafe'])).toBe(300);
  });

  it('treats a missing key as 0 instead of throwing or returning NaN', () => {
    const record = { food: 100 };
    expect(sumOverKeys(record, ['food', 'ghost-category'])).toBe(100);
  });

  it('returns 0 for an empty key list', () => {
    expect(sumOverKeys({ food: 100 }, [])).toBe(0);
  });

  // Regression guard: the weekly-spend record can carry extra categories the
  // budget doesn't track (e.g. a deleted custom category with old transactions
  // still on file). The total must only reflect currently-budgeted categories.
  it('ignores keys present in the record but not in the requested key set', () => {
    const weekSpend = { food: 100, cafe: 200, 'removed-custom-category': 5000 };
    const budgetKeys = ['food', 'cafe'];
    expect(sumOverKeys(weekSpend, budgetKeys)).toBe(300);
  });
});

describe('buildCategoryBreakdown', () => {
  it('returns slices sorted descending by amount with correct percentages', () => {
    const slices = buildCategoryBreakdown({ food: 100, cafe: 300, transport: 100 });
    expect(slices).toEqual([
      { id: 'cafe', amount: 300, pct: 60 },
      { id: 'food', amount: 100, pct: 20 },
      { id: 'transport', amount: 100, pct: 20 },
    ]);
  });

  it('excludes categories with zero or negative spend', () => {
    const slices = buildCategoryBreakdown({ food: 100, cafe: 0, transport: -5 });
    expect(slices).toEqual([{ id: 'food', amount: 100, pct: 100 }]);
  });

  it('returns an empty array when there is no spend at all', () => {
    expect(buildCategoryBreakdown({})).toEqual([]);
    expect(buildCategoryBreakdown({ food: 0 })).toEqual([]);
  });
});

describe('suggestWeeklyBudget', () => {
  it('averages spend over the weeks actually covered by history, not the full lookback window', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const suggestion = suggestWeeklyBudget([tx(twoWeeksAgo.toISOString(), 100, 'food')], ['food'], 8);

    // 100 spent over ~2 covered weeks -> 50/week.
    expect(suggestion.food).toBe(50);
  });

  it('ignores transactions older than the lookback window', () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 200);

    const suggestion = suggestWeeklyBudget([tx(longAgo.toISOString(), 999, 'food')], ['food'], 8);

    expect(suggestion.food).toBe(0);
  });

  it('ignores transactions for categories not in the requested set', () => {
    const suggestion = suggestWeeklyBudget([tx(new Date().toISOString(), 500, 'other-thing')], ['food'], 8);

    expect(suggestion.food).toBe(0);
    expect(suggestion['other-thing']).toBeUndefined();
  });

  it('returns 0 for every category when there are no transactions', () => {
    expect(suggestWeeklyBudget([], ['food', 'cafe'], 8)).toEqual({ food: 0, cafe: 0 });
  });
});
