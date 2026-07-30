import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTransaction,
  getAverageWeeklyIncome,
  getBalanceBetween,
  getThisWeekBalance,
  getPeriodSpendByCategory,
  setWeeklyBudget,
} from '../storage';
import { suggestBudget } from '../budget';
import { buildHeatGrid } from '../heatmap';
import { getDailySpendSeries, getMonthlySpendSeries, getWeeklySpendSeries } from '../trends';
import { detectRecurringExpenses } from '../recurring';
import { Transaction, expensesOnly, incomeOnly, isExpense, isIncome, sumAmount } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
});

function tx(createdAt: string, amount: number, category: string, type?: 'expense' | 'income'): Transaction {
  return { id: `${createdAt}-${amount}-${category}-${type ?? 'x'}`, amount, category, type, createdAt };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

describe('transaction type helpers', () => {
  it('treats a transaction with no type as an expense, so pre-income data keeps counting as spending', () => {
    const legacy = tx('2026-07-01T10:00:00.000Z', 50, 'food');
    expect(isExpense(legacy)).toBe(true);
    expect(isIncome(legacy)).toBe(false);
  });

  it('splits a mixed list into expenses and income', () => {
    const list = [
      tx('2026-07-01T10:00:00.000Z', 50, 'food', 'expense'),
      tx('2026-07-02T10:00:00.000Z', 1000, 'salary', 'income'),
      tx('2026-07-03T10:00:00.000Z', 20, 'cafe'),
    ];
    expect(sumAmount(expensesOnly(list))).toBe(70);
    expect(sumAmount(incomeOnly(list))).toBe(1000);
  });
});

describe('income never counts as spending', () => {
  it('is excluded from the weekly spend-by-category totals', async () => {
    await setWeeklyBudget({ food: 100, salary: 0 });
    await addTransaction({ amount: 30, category: 'food', type: 'expense' });
    await addTransaction({ amount: 5000, category: 'salary', type: 'income' });

    const totals = await getPeriodSpendByCategory();

    expect(totals.food).toBe(30);
    expect(totals.salary ?? 0).toBe(0);
  });

  it('does not inflate a suggested weekly budget', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const list = [tx(recent, 40, 'food', 'expense'), tx(recent, 9000, 'food', 'income')];

    const suggestion = suggestBudget(list, ['food'], 'week', 8);

    // Only the 40 expense may drive the limit; 9000 of income must be ignored.
    expect(suggestion.food).toBeLessThan(100);
  });

  it('is left out of the heat map grid', () => {
    const monday = '2026-07-27T12:00:00.000Z'; // a Monday, midday
    const grid = buildHeatGrid([tx(monday, 100, 'food', 'expense'), tx(monday, 7000, 'salary', 'income')]);
    const total = grid.flat().reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(100);
  });

  it('is left out of the daily, weekly, and monthly spend series', () => {
    const today = new Date().toISOString();
    const list = [tx(today, 25, 'food', 'expense'), tx(today, 8000, 'salary', 'income')];

    const daily = getDailySpendSeries(list, WEEKDAYS, 7);
    const weekly = getWeeklySpendSeries(list, 4);
    const monthly = getMonthlySpendSeries(list, 3);

    expect(daily.reduce((s, p) => s + p.total, 0)).toBe(25);
    expect(weekly.reduce((s, p) => s + p.total, 0)).toBe(25);
    expect(monthly.reduce((s, p) => s + p.total, 0)).toBe(25);
  });

  it('is never reported as a recurring subscription, even when perfectly monthly', () => {
    const list: Transaction[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 30);
      list.push(tx(d.toISOString(), 5000, 'salary', 'income'));
    }

    expect(detectRecurringExpenses(list)).toEqual([]);
  });
});

describe('spend-only totals used by the calendar heat map', () => {
  // Regression guard for a leak that shipped briefly: MonthCalendar summed every transaction,
  // so a payday painted itself as the month's darkest "spending" day and inflated the scale.
  it('sums only expenses per day', () => {
    const day = '2026-07-15T12:00:00.000Z';
    const list = [
      tx(day, 40, 'food', 'expense'),
      tx(day, 10, 'cafe'),
      tx(day, 9000, 'salary', 'income'),
    ];

    const perDay = sumAmount(expensesOnly(list));

    expect(perDay).toBe(50);
  });
});

describe('balance reporting', () => {
  it('reports income, spend, and net for the current week', async () => {
    await addTransaction({ amount: 200, category: 'food', type: 'expense' });
    await addTransaction({ amount: 500, category: 'salary', type: 'income' });

    const { income, spent, net } = await getThisWeekBalance();

    expect(income).toBe(500);
    expect(spent).toBe(200);
    expect(net).toBe(300);
  });

  it('goes negative when spending exceeds income', async () => {
    await addTransaction({ amount: 800, category: 'food', type: 'expense' });
    await addTransaction({ amount: 300, category: 'salary', type: 'income' });

    const { net } = await getThisWeekBalance();

    expect(net).toBe(-500);
  });

  it('ignores transactions outside the requested window', async () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 90);
    await addTransaction({ amount: 999, category: 'salary', type: 'income', createdAt: longAgo.toISOString() });
    await addTransaction({ amount: 100, category: 'salary', type: 'income' });

    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 1);
    const { income } = await getBalanceBetween(start, end);

    expect(income).toBe(100);
  });

  it('averages weekly income over the window length, not over paydays', async () => {
    // A single 4000 paycheque inside an 8-week window averages to 500/week.
    await addTransaction({ amount: 4000, category: 'salary', type: 'income' });

    const avg = await getAverageWeeklyIncome(8);

    expect(avg).toBe(500);
  });

  it('returns zero average income when nothing has been logged', async () => {
    expect(await getAverageWeeklyIncome(8)).toBe(0);
  });
});
