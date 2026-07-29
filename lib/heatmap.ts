import { Transaction, isExpense } from './types';

export const DAYPART_KEYS = ['morning', 'day', 'evening', 'night'] as const;
export const DAYPART_HINTS = ['6:00–11:00', '11:00–15:00', '15:00–19:00', '19:00–6:00'];

function mondayIndex(jsDay: number): number {
  // JS getDay(): 0=Sun..6=Sat -> convert to 0=Mon..6=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

function daypartIndex(hour: number): number {
  if (hour >= 6 && hour < 11) return 0;
  if (hour >= 11 && hour < 15) return 1;
  if (hour >= 15 && hour < 19) return 2;
  return 3; // 19:00–06:00
}

export interface HeatCell {
  weekday: number; // 0=Mon..6=Sun
  daypart: number; // 0..3
  amount: number;
  count: number;
  byCategory: Record<string, number>;
}

export function buildHeatGrid(transactions: Transaction[]): HeatCell[][] {
  const grid: HeatCell[][] = Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 4 }, (_, daypart) => ({
      weekday,
      daypart,
      amount: 0,
      count: 0,
      byCategory: {} as Record<string, number>,
    }))
  );
  for (const t of transactions) {
    if (!isExpense(t)) continue; // the heat map shows where money goes out, not in
    const d = new Date(t.createdAt);
    const w = mondayIndex(d.getDay());
    const p = daypartIndex(d.getHours());
    grid[w][p].amount += t.amount;
    grid[w][p].count += 1;
    grid[w][p].byCategory[t.category] = (grid[w][p].byCategory[t.category] ?? 0) + t.amount;
  }
  return grid;
}

export function dominantCategory(cell: HeatCell): string | null {
  let best: string | null = null;
  let bestAmount = 0;
  for (const [cat, amount] of Object.entries(cell.byCategory)) {
    if (amount > bestAmount) {
      bestAmount = amount;
      best = cat;
    }
  }
  return best;
}

export function topHotSpots(grid: HeatCell[][], limit = 3): HeatCell[] {
  const flat = grid.flat().filter((c) => c.amount > 0);
  flat.sort((a, b) => b.amount - a.amount);
  return flat.slice(0, limit);
}

/** weekdayLabels/daypartLabels: 7- and 4-element translated label arrays from the caller. */
export function describeHotSpot(cell: HeatCell, weekdayLabels: string[], daypartLabels: string[]): string {
  return `${weekdayLabels[cell.weekday]} · ${daypartLabels[cell.daypart]} (${DAYPART_HINTS[cell.daypart]})`;
}

export function maxCellAmount(grid: HeatCell[][]): number {
  return grid.flat().reduce((m, c) => Math.max(m, c.amount), 0);
}

export function currentDaypartIndex(date = new Date()): number {
  return daypartIndex(date.getHours());
}

export function currentWeekdayIndex(date = new Date()): number {
  return mondayIndex(date.getDay());
}
