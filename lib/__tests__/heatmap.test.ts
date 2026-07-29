import {
  buildHeatGrid,
  dominantCategory,
  topHotSpots,
  describeHotSpot,
  maxCellAmount,
  currentDaypartIndex,
  currentWeekdayIndex,
  DAYPART_HINTS,
} from '../heatmap';
import { Transaction } from '../types';

function tx(createdAt: string, amount: number, category = 'food'): Transaction {
  return { id: createdAt + amount, amount, category, createdAt };
}

describe('buildHeatGrid', () => {
  it('returns a 7x4 grid of empty cells for no transactions', () => {
    const grid = buildHeatGrid([]);
    expect(grid).toHaveLength(7);
    for (const week of grid) {
      expect(week).toHaveLength(4);
      for (const cell of week) {
        expect(cell.amount).toBe(0);
        expect(cell.count).toBe(0);
        expect(cell.byCategory).toEqual({});
      }
    }
  });

  it('buckets a transaction into the correct weekday/daypart cell', () => {
    // 2026-07-27 is a Monday; 14:00 falls in the "day" daypart (11:00-15:00).
    const grid = buildHeatGrid([tx('2026-07-27T14:00:00', 500, 'cafe')]);
    const mondayDayCell = grid[0][1];
    expect(mondayDayCell.amount).toBe(500);
    expect(mondayDayCell.count).toBe(1);
    expect(mondayDayCell.byCategory.cafe).toBe(500);
    // every other cell stays empty
    const total = grid.flat().reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(500);
  });

  it('accumulates multiple transactions in the same cell and tracks per-category totals', () => {
    const grid = buildHeatGrid([
      tx('2026-07-27T20:00:00', 300, 'cafe'), // Monday night
      tx('2026-07-27T21:30:00', 700, 'entertainment'), // Monday night
    ]);
    const mondayNightCell = grid[0][3];
    expect(mondayNightCell.amount).toBe(1000);
    expect(mondayNightCell.count).toBe(2);
    expect(mondayNightCell.byCategory).toEqual({ cafe: 300, entertainment: 700 });
  });
});

describe('dominantCategory', () => {
  it('returns null for a cell with no spending', () => {
    const grid = buildHeatGrid([]);
    expect(dominantCategory(grid[0][0])).toBeNull();
  });

  it('returns the category with the highest amount', () => {
    const grid = buildHeatGrid([
      tx('2026-07-27T20:00:00', 300, 'cafe'),
      tx('2026-07-27T20:15:00', 700, 'entertainment'),
      tx('2026-07-27T20:30:00', 100, 'other'),
    ]);
    expect(dominantCategory(grid[0][3])).toBe('entertainment');
  });
});

describe('topHotSpots', () => {
  it('excludes empty cells and sorts by amount descending', () => {
    const grid = buildHeatGrid([
      tx('2026-07-27T08:00:00', 100), // Mon morning
      tx('2026-07-28T14:00:00', 900), // Tue day
      tx('2026-07-29T20:00:00', 500), // Wed night
    ]);
    const top = topHotSpots(grid, 2);
    expect(top).toHaveLength(2);
    expect(top[0].amount).toBe(900);
    expect(top[1].amount).toBe(500);
  });

  it('defaults to a limit of 3', () => {
    const grid = buildHeatGrid([
      tx('2026-07-27T08:00:00', 100),
      tx('2026-07-28T14:00:00', 200),
      tx('2026-07-29T20:00:00', 300),
      tx('2026-07-30T08:00:00', 400),
    ]);
    expect(topHotSpots(grid)).toHaveLength(3);
  });
});

describe('describeHotSpot', () => {
  it('formats weekday, daypart label, and the fixed time-of-day hint', () => {
    const grid = buildHeatGrid([tx('2026-07-27T20:00:00', 500)]); // Monday night
    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daypartLabels = ['Morning', 'Day', 'Evening', 'Night'];
    const desc = describeHotSpot(grid[0][3], weekdayLabels, daypartLabels);
    expect(desc).toBe(`Mon · Night (${DAYPART_HINTS[3]})`);
  });
});

describe('maxCellAmount', () => {
  it('returns 0 for an all-empty grid', () => {
    expect(maxCellAmount(buildHeatGrid([]))).toBe(0);
  });

  it('returns the largest single-cell amount', () => {
    const grid = buildHeatGrid([tx('2026-07-27T08:00:00', 100), tx('2026-07-28T14:00:00', 900)]);
    expect(maxCellAmount(grid)).toBe(900);
  });
});

describe('currentWeekdayIndex / currentDaypartIndex', () => {
  it('converts JS getDay() (0=Sun) to a Monday-first index', () => {
    expect(currentWeekdayIndex(new Date('2026-07-27T12:00:00'))).toBe(0); // Monday
    expect(currentWeekdayIndex(new Date('2026-08-02T12:00:00'))).toBe(6); // Sunday
  });

  it('buckets hours into the right daypart', () => {
    expect(currentDaypartIndex(new Date('2026-07-27T06:00:00'))).toBe(0); // morning starts at 6
    expect(currentDaypartIndex(new Date('2026-07-27T10:59:00'))).toBe(0);
    expect(currentDaypartIndex(new Date('2026-07-27T11:00:00'))).toBe(1); // day
    expect(currentDaypartIndex(new Date('2026-07-27T15:00:00'))).toBe(2); // evening
    expect(currentDaypartIndex(new Date('2026-07-27T02:00:00'))).toBe(3); // night wraps past midnight
  });
});
