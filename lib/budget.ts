import { Transaction } from './types';

/** Sums a record's values, but only over the given key set (ignores any extra keys the record might carry). */
export function sumOverKeys(record: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (record[key] ?? 0), 0);
}

/**
 * Suggests a weekly limit per category from historical average weekly spend, looking back up
 * to `weeksToConsider` weeks. Averages over however much history actually exists within that
 * window (not always the full window), so a user with only 2 weeks of data doesn't get limits
 * diluted by 6 weeks of assumed zero spend. Rounds to the nearest 5 for a tidier number.
 */
export function suggestWeeklyBudget(
  transactions: Transaction[],
  categoryIds: string[],
  weeksToConsider = 8
): Record<string, number> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - weeksToConsider * 7);

  const idSet = new Set(categoryIds);
  const totals: Record<string, number> = {};
  for (const id of categoryIds) totals[id] = 0;

  let oldestRelevantMs = now.getTime();
  for (const t of transactions) {
    const createdMs = new Date(t.createdAt).getTime();
    if (createdMs < windowStart.getTime() || !idSet.has(t.category)) continue;
    totals[t.category] += t.amount;
    if (createdMs < oldestRelevantMs) oldestRelevantMs = createdMs;
  }

  const daysCovered = Math.max(1, (now.getTime() - oldestRelevantMs) / (1000 * 60 * 60 * 24));
  const weeksCovered = Math.max(1, daysCovered / 7);

  const suggestion: Record<string, number> = {};
  for (const id of categoryIds) {
    suggestion[id] = Math.round(totals[id] / weeksCovered / 5) * 5;
  }
  return suggestion;
}

export interface CategorySlice {
  id: string;
  amount: number;
  pct: number; // 0-100, rounded, share of the total across all returned slices
}

/** Categories with spend, sorted descending by amount. Zero/negative entries are excluded. */
export function buildCategoryBreakdown(spendByCategory: Record<string, number>): CategorySlice[] {
  const total = Object.values(spendByCategory).reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return [];
  return Object.entries(spendByCategory)
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, amount, pct: Math.round((amount / total) * 100) }))
    .sort((a, b) => b.amount - a.amount);
}
