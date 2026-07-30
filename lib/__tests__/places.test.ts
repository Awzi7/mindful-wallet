import { topPlaces } from '../places';
import { Transaction } from '../types';

let seq = 0;
function tx(place: string | undefined, amount: number, extra: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    amount,
    category: 'food',
    place,
    createdAt: new Date(2026, 6, 1, 12, seq).toISOString(),
    ...extra,
  };
}

beforeEach(() => {
  seq = 0;
});

describe('topPlaces', () => {
  it('returns nothing when no transaction carries a place', () => {
    expect(topPlaces([tx(undefined, 10), tx('', 20), tx('   ', 30)])).toEqual([]);
  });

  it('sums spend per place and counts visits', () => {
    const result = topPlaces([tx('Coffee House', 5), tx('Coffee House', 7), tx('Bakery', 3)]);

    expect(result[0]).toEqual({ place: 'Coffee House', amount: 12, count: 2 });
    expect(result[1]).toEqual({ place: 'Bakery', amount: 3, count: 1 });
  });

  it('groups the same place typed with different case and padding', () => {
    const result = topPlaces([tx('Pyaterochka', 10), tx('pyaterochka ', 15), tx('  PYATEROCHKA', 5)]);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(30);
    expect(result[0].count).toBe(3);
  });

  it('displays the spelling from the most recent entry', () => {
    // tx() increments the minute each call, so the second one is newer.
    const result = topPlaces([tx('corner shop', 10), tx('Corner Shop', 10)]);

    expect(result[0].place).toBe('Corner Shop');
  });

  it('excludes income so an employer cannot top the list', () => {
    const result = topPlaces([tx('Employer', 5000, { type: 'income', category: 'salary' }), tx('Bakery', 3)]);

    expect(result).toEqual([{ place: 'Bakery', amount: 3, count: 1 }]);
  });

  it('orders by amount, not by visit count', () => {
    const result = topPlaces([
      tx('Cheap Cafe', 1),
      tx('Cheap Cafe', 1),
      tx('Cheap Cafe', 1),
      tx('Big Store', 100),
    ]);

    expect(result[0].place).toBe('Big Store');
  });

  it('honours the limit', () => {
    const result = topPlaces([tx('A', 10), tx('B', 9), tx('C', 8), tx('D', 7)], 2);

    expect(result.map((r) => r.place)).toEqual(['A', 'B']);
  });
});
