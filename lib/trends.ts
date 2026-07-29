import { Transaction, isExpense } from './types';
import { getSyncLanguage } from './i18n/current';
import { LOCALE_MAP } from './i18n/dictionaries';

export interface DailyPoint {
  date: string; // yyyy-mm-dd
  label: string; // short day label, e.g. "Mon 12"
  total: number;
}

/** weekdayLabels must be Monday-first (index 0 = Mon .. 6 = Sun), matching heatmap.weekdays. */
export function getDailySpendSeries(transactions: Transaction[], weekdayLabels: string[], days = 14): DailyPoint[] {
  const now = new Date();
  const totalsByDate = new Map<string, number>();

  for (const t of transactions) {
    if (!isExpense(t)) continue; // spend trend, so income is excluded
    const d = new Date(t.createdAt);
    const key = toDateKey(d);
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + t.amount);
  }

  const series: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    series.push({
      date: key,
      label: `${weekdayLabels[(d.getDay() + 6) % 7]} ${d.getDate()}`,
      total: totalsByDate.get(key) ?? 0,
    });
  }
  return series;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + mondayOffset);
  return monday;
}

/**
 * Weekly-bucketed totals (Monday-start weeks), for longer ranges (e.g. 6 months) where daily
 * points would be too dense to read on a small chart. Points are labeled by each week's start date.
 */
export function getWeeklySpendSeries(transactions: Transaction[], weeks = 26): DailyPoint[] {
  const currentMonday = mondayOf(new Date());
  const totalsByWeekStart = new Map<string, number>();

  for (const t of transactions) {
    if (!isExpense(t)) continue; // spend trend, so income is excluded
    const key = toDateKey(mondayOf(new Date(t.createdAt)));
    totalsByWeekStart.set(key, (totalsByWeekStart.get(key) ?? 0) + t.amount);
  }

  const series: DailyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const key = toDateKey(weekStart);
    series.push({
      date: key,
      label: `${weekStart.getDate()}.${weekStart.getMonth() + 1}`,
      total: totalsByWeekStart.get(key) ?? 0,
    });
  }
  return series;
}

/**
 * Calendar-month-bucketed totals, for the longest range (year). Labels use the
 * current UI language's short month name (e.g. "Jan", "янв.") via Intl, so no
 * extra label plumbing is needed from callers.
 */
export function getMonthlySpendSeries(transactions: Transaction[], months = 12): DailyPoint[] {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalsByMonthStart = new Map<string, number>();

  for (const t of transactions) {
    if (!isExpense(t)) continue; // spend trend, so income is excluded
    const d = new Date(t.createdAt);
    const key = toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
    totalsByMonthStart.set(key, (totalsByMonthStart.get(key) ?? 0) + t.amount);
  }

  const monthFormatter = new Intl.DateTimeFormat(LOCALE_MAP[getSyncLanguage()], { month: 'short' });
  const series: DailyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
    const key = toDateKey(monthStart);
    series.push({
      date: key,
      label: monthFormatter.format(monthStart),
      total: totalsByMonthStart.get(key) ?? 0,
    });
  }
  return series;
}
