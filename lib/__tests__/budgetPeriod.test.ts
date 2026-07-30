import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTransaction,
  getAveragePeriodIncome,
  getBudgetPeriod,
  getCurrentPeriodTransactions,
  getMonthWindow,
  getPeriodSpendByCategory,
  getPeriodWindow,
  getWeekWindow,
  setBudgetPeriod,
  setWeeklyBudget,
} from '../storage';
import { periodLengthDays, suggestBudget } from '../budget';
import { Transaction } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('budget period setting', () => {
  it('defaults to week so existing users are unaffected', async () => {
    await expect(getBudgetPeriod()).resolves.toBe('week');
  });

  it('falls back to week when the stored value is not a known period', async () => {
    await AsyncStorage.setItem('@mw/budgetPeriod', 'fortnight');
    await expect(getBudgetPeriod()).resolves.toBe('week');
  });

  it('round-trips a month setting', async () => {
    await setBudgetPeriod('month');
    await expect(getBudgetPeriod()).resolves.toBe('month');
  });
});

describe('period windows', () => {
  it('a month window covers the calendar month', () => {
    const { start, end } = getMonthWindow(new Date(2026, 6, 15));
    expect(start).toEqual(new Date(2026, 6, 1));
    expect(end).toEqual(new Date(2026, 7, 1));
  });

  it('a month window handles a December reference without rolling the year wrong', () => {
    const { start, end } = getMonthWindow(new Date(2026, 11, 20));
    expect(start).toEqual(new Date(2026, 11, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
  });

  it('getPeriodWindow picks the window matching the period', () => {
    const ref = new Date(2026, 6, 15);
    expect(getPeriodWindow('month', ref)).toEqual(getMonthWindow(ref));
    expect(getPeriodWindow('week', ref)).toEqual(getWeekWindow(ref));
  });
});

describe('spend totals follow the chosen period', () => {
  /**
   * The point of the feature: an expense from earlier in the month is outside the current week
   * but inside the current month, so switching period must change what counts toward a limit.
   */
  it('counts an earlier-in-the-month expense only once the period is monthly', async () => {
    const now = new Date();
    // Pick a day that is in this month but not in the current week, when one exists.
    const earlier = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
    const { start: weekStart } = getWeekWindow(now);
    const isOutsideThisWeek = earlier < weekStart;

    await setWeeklyBudget({ food: 100 });
    await addTransaction({ amount: 40, category: 'food', createdAt: earlier.toISOString() });

    await setBudgetPeriod('week');
    const weekTotals = await getPeriodSpendByCategory();

    await setBudgetPeriod('month');
    const monthTotals = await getPeriodSpendByCategory();

    expect(monthTotals.food).toBe(40);
    expect(weekTotals.food).toBe(isOutsideThisWeek ? 0 : 40);
  });

  it('getCurrentPeriodTransactions widens with the period', async () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
    await addTransaction({ amount: 10, category: 'food', createdAt: firstOfMonth.toISOString() });

    await setBudgetPeriod('month');
    const monthly: Transaction[] = await getCurrentPeriodTransactions();

    expect(monthly).toHaveLength(1);
  });
});

describe('suggestBudget scales with the period', () => {
  it('suggests a larger limit per month than per week for the same history', () => {
    const list: Transaction[] = [];
    // 10 a day for the last 28 days.
    for (let i = 0; i < 28; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push({ id: `t${i}`, amount: 10, category: 'food', createdAt: d.toISOString() });
    }

    const weekly = suggestBudget(list, ['food'], 'week');
    const monthly = suggestBudget(list, ['food'], 'month');

    expect(monthly.food).toBeGreaterThan(weekly.food);
  });

  it('reports the days in each period', () => {
    expect(periodLengthDays('week')).toBe(7);
    expect(periodLengthDays('month')).toBe(30);
  });
});

describe('average income matches the budget period', () => {
  /**
   * With a steady income stream the per-month average must be roughly 30/7 of the per-week one.
   * A single lump sum would *not* show this - it falls inside both windows and divides by the
   * same period count - so the stream is the case that actually pins the behaviour down.
   */
  it('scales a steady income stream by the period length', async () => {
    // The stream has to span the *monthly* window (8 * 30 days), not just the weekly one -
    // otherwise both averages see the same total income and come out equal.
    for (let week = 0; week < 35; week++) {
      const d = new Date();
      d.setDate(d.getDate() - week * 7);
      await addTransaction({ amount: 100, category: 'salary', type: 'income', createdAt: d.toISOString() });
    }

    const perWeek = await getAveragePeriodIncome('week', 8);
    const perMonth = await getAveragePeriodIncome('month', 8);

    // 8 weekly payments of 100 inside the 56-day window -> 100 per week.
    expect(perWeek).toBeCloseTo(100, 5);
    // The 240-day window catches ~34 of them -> well over 400 per month.
    expect(perMonth).toBeGreaterThan(perWeek * 3);
  });

  it('divides a lump sum by the period count, not the day count', async () => {
    await addTransaction({ amount: 4000, category: 'salary', type: 'income' });

    // 4000 earned within the trailing 8 periods averages to 500 per period, either way.
    await expect(getAveragePeriodIncome('week', 8)).resolves.toBe(500);
    await expect(getAveragePeriodIncome('month', 8)).resolves.toBe(500);
  });
});
