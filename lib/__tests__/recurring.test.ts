import { detectRecurringExpenses } from '../recurring';
import { Transaction } from '../types';

function tx(daysAgo: number, amount: number, category: string, place?: string): Transaction {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { id: `${daysAgo}-${amount}-${category}`, amount, category, place, createdAt: d.toISOString() };
}

describe('detectRecurringExpenses', () => {
  it('detects a monthly charge with similar amount and regular spacing', () => {
    const transactions = [
      tx(90, 15, 'entertainment', 'Netflix'),
      tx(60, 15, 'entertainment', 'Netflix'),
      tx(30, 15, 'entertainment', 'Netflix'),
      tx(1, 15, 'entertainment', 'Netflix'),
    ];

    const results = detectRecurringExpenses(transactions);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ category: 'entertainment', place: 'netflix', amount: 15, occurrences: 4 });
  });

  it('requires at least the minimum number of occurrences', () => {
    const transactions = [tx(30, 15, 'entertainment', 'Netflix'), tx(1, 15, 'entertainment', 'Netflix')];
    expect(detectRecurringExpenses(transactions, { minOccurrences: 3 })).toHaveLength(0);
  });

  it('ignores transactions with irregular spacing', () => {
    const transactions = [
      tx(80, 15, 'entertainment', 'Netflix'),
      tx(55, 15, 'entertainment', 'Netflix'),
      tx(10, 15, 'entertainment', 'Netflix'),
      tx(1, 15, 'entertainment', 'Netflix'),
    ];
    expect(detectRecurringExpenses(transactions)).toHaveLength(0);
  });

  it('ignores a pattern that has clearly stopped (most recent occurrence too long ago)', () => {
    const transactions = [tx(150, 15, 'entertainment', 'Netflix'), tx(120, 15, 'entertainment', 'Netflix'), tx(90, 15, 'entertainment', 'Netflix')];
    expect(detectRecurringExpenses(transactions)).toHaveLength(0);
  });

  it('does not cluster together transactions with very different amounts at the same place', () => {
    const transactions = [
      tx(90, 15, 'cafe', 'Corner Cafe'),
      tx(60, 40, 'cafe', 'Corner Cafe'),
      tx(30, 12, 'cafe', 'Corner Cafe'),
      tx(1, 38, 'cafe', 'Corner Cafe'),
    ];
    expect(detectRecurringExpenses(transactions)).toHaveLength(0);
  });

  it('treats transactions with no place as their own group by category alone', () => {
    const transactions = [tx(90, 800, 'other'), tx(60, 800, 'other'), tx(30, 800, 'other'), tx(1, 800, 'other')];
    const results = detectRecurringExpenses(transactions);
    expect(results).toHaveLength(1);
    expect(results[0].place).toBeUndefined();
  });
});
