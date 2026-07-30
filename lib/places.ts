import { Transaction, isExpense } from './types';

export interface PlaceTotal {
  /** Display form: the spelling from the most recent transaction at this place. */
  place: string;
  amount: number;
  count: number;
}

/**
 * Aggregates spend by place, biggest first. Expenses only - "where your money goes" is a
 * spending question, and counting a salary's place would put your employer at the top.
 *
 * Grouping is case- and whitespace-insensitive, because the same shop gets typed "Pyaterochka",
 * "pyaterochka " and "Pyaterochka" across a month and three separate rows would be useless. The
 * label shown is the spelling from the newest entry, so correcting the spelling once fixes the
 * display without splitting the group.
 */
export function topPlaces(transactions: Transaction[], limit = 5): PlaceTotal[] {
  const groups = new Map<string, { place: string; amount: number; count: number; newest: number }>();

  for (const tx of transactions) {
    if (!isExpense(tx)) continue;
    const raw = (tx.place ?? '').trim();
    if (!raw) continue; // untagged spending has no place to attribute

    const key = raw.toLowerCase();
    const at = new Date(tx.createdAt).getTime();
    const existing = groups.get(key);
    if (existing) {
      existing.amount += tx.amount;
      existing.count += 1;
      if (at > existing.newest) {
        existing.newest = at;
        existing.place = raw;
      }
    } else {
      groups.set(key, { place: raw, amount: tx.amount, count: 1, newest: at });
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .slice(0, limit)
    .map(({ place, amount, count }) => ({ place, amount, count }));
}
