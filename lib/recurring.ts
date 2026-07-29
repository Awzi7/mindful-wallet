import { Transaction, isExpense } from './types';

export interface RecurringExpense {
  category: string;
  place?: string;
  amount: number;
  occurrences: number;
  lastDate: string; // ISO
  nextEstimate: string; // ISO
}

interface DetectOptions {
  minOccurrences?: number;
  intervalDays?: number;
  intervalToleranceDays?: number;
  amountTolerancePct?: number;
  activeWithinDays?: number;
}

/**
 * Heuristically flags transactions that look like a recurring monthly charge (subscriptions,
 * rent, etc.): grouped by category + place, similar amount, spaced roughly a month apart, with
 * the most recent occurrence still "active" (not something the user already cancelled months
 * ago). Pure pattern-matching over local history — no ML, same honesty stance as the rest of
 * this app's "smart" features.
 */
export function detectRecurringExpenses(transactions: Transaction[], options: DetectOptions = {}): RecurringExpense[] {
  const {
    minOccurrences = 2,
    intervalDays = 30,
    intervalToleranceDays = 5,
    amountTolerancePct = 0.15,
    activeWithinDays = 45,
  } = options;

  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!isExpense(t)) continue; // a monthly salary is not a subscription to cancel
    const key = `${t.category}::${(t.place ?? '').trim().toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const now = Date.now();
  const results: RecurringExpense[] = [];

  for (const [key, txs] of groups) {
    if (txs.length < minOccurrences) continue;
    const sorted = [...txs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Cluster to transactions with an amount close to the most recent one, so a place that mixes
    // a subscription with unrelated one-off purchases doesn't get treated as one pattern.
    const recentAmount = sorted[sorted.length - 1].amount;
    const cluster = sorted.filter((t) => Math.abs(t.amount - recentAmount) <= recentAmount * amountTolerancePct);
    if (cluster.length < minOccurrences) continue;

    const gaps: number[] = [];
    for (let i = 1; i < cluster.length; i++) {
      const days = (new Date(cluster[i].createdAt).getTime() - new Date(cluster[i - 1].createdAt).getTime()) / 86400000;
      gaps.push(days);
    }
    // Every consecutive gap in the cluster must be close to the target interval — a couple of
    // matching amounts with a wildly irregular cadence isn't a subscription, just coincidence.
    const regularGaps = gaps.filter((g) => Math.abs(g - intervalDays) <= intervalToleranceDays);
    if (regularGaps.length < gaps.length) continue;

    const last = cluster[cluster.length - 1];
    const lastDate = new Date(last.createdAt);
    const daysSinceLast = (now - lastDate.getTime()) / 86400000;
    if (daysSinceLast > activeWithinDays) continue;

    const avgGap = regularGaps.reduce((s, g) => s + g, 0) / regularGaps.length;
    const nextEstimate = new Date(lastDate.getTime() + avgGap * 86400000);

    const [category, place] = key.split('::');
    results.push({
      category,
      place: place || undefined,
      amount: recentAmount,
      occurrences: cluster.length,
      lastDate: last.createdAt,
      nextEstimate: nextEstimate.toISOString(),
    });
  }

  return results.sort((a, b) => new Date(a.nextEstimate).getTime() - new Date(b.nextEstimate).getTime());
}
