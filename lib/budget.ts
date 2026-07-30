import { BudgetPeriod, Transaction, isExpense } from './types';

/** Days in one budget period. A month is approximated at 30 days for averaging purposes. */
export function periodLengthDays(period: BudgetPeriod): number {
  return period === 'month' ? 30 : 7;
}

/** Sums a record's values, but only over the given key set (ignores any extra keys the record might carry). */
export function sumOverKeys(record: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (record[key] ?? 0), 0);
}

/**
 * Suggests a per-period limit per category from historical average spend, looking back up to
 * `periodsToConsider` periods. Averages over however much history actually exists within that
 * window (not always the full window), so a user with only 2 weeks of data doesn't get limits
 * diluted by 6 weeks of assumed zero spend. Rounds to the nearest 5 for a tidier number.
 */
export function suggestBudget(
  transactions: Transaction[],
  categoryIds: string[],
  period: BudgetPeriod = 'week',
  periodsToConsider = 8
): Record<string, number> {
  const periodDays = periodLengthDays(period);
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - periodsToConsider * periodDays);

  const idSet = new Set(categoryIds);
  const totals: Record<string, number> = {};
  for (const id of categoryIds) totals[id] = 0;

  let oldestRelevantMs = now.getTime();
  for (const t of transactions) {
    if (!isExpense(t)) continue; // income must never inflate a spending limit
    const createdMs = new Date(t.createdAt).getTime();
    if (createdMs < windowStart.getTime() || !idSet.has(t.category)) continue;
    totals[t.category] += t.amount;
    if (createdMs < oldestRelevantMs) oldestRelevantMs = createdMs;
  }

  const daysCovered = Math.max(1, (now.getTime() - oldestRelevantMs) / (1000 * 60 * 60 * 24));
  const periodsCovered = Math.max(1, daysCovered / periodDays);

  const suggestion: Record<string, number> = {};
  for (const id of categoryIds) {
    suggestion[id] = Math.round(totals[id] / periodsCovered / 5) * 5;
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
