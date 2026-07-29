import { getDailySpendSeries, getMonthlySpendSeries, getWeeklySpendSeries } from '../trends';
import { Transaction } from '../types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function tx(createdAt: string, amount: number): Transaction {
  return { id: createdAt + amount, amount, category: 'food', createdAt };
}

function isoDateOnly(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

describe('getDailySpendSeries', () => {
  it('returns exactly `days` points ending on today, oldest first', () => {
    const series = getDailySpendSeries([], WEEKDAY_LABELS, 7);
    expect(series).toHaveLength(7);
    expect(series[6].date).toBe(isoDateOnly(new Date()));
  });

  it('defaults to 14 days when not specified', () => {
    expect(getDailySpendSeries([], WEEKDAY_LABELS)).toHaveLength(14);
  });

  it("sums today's transactions into today's point", () => {
    const now = new Date();
    const series = getDailySpendSeries([tx(now.toISOString(), 250), tx(now.toISOString(), 150)], WEEKDAY_LABELS, 3);
    expect(series[series.length - 1].total).toBe(400);
  });

  it('sums transactions from N days ago into the correct historical point, not today', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const series = getDailySpendSeries([tx(threeDaysAgo.toISOString(), 999)], WEEKDAY_LABELS, 7);
    const todayPoint = series[series.length - 1];
    const historicalPoint = series[series.length - 1 - 3];
    expect(todayPoint.total).toBe(0);
    expect(historicalPoint.total).toBe(999);
  });

  it('ignores transactions older than the requested window', () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 30);
    const series = getDailySpendSeries([tx(longAgo.toISOString(), 999)], WEEKDAY_LABELS, 7);
    const total = series.reduce((s, p) => s + p.total, 0);
    expect(total).toBe(0);
  });

  it('labels each point with the Monday-first weekday label and day-of-month', () => {
    const series = getDailySpendSeries([], WEEKDAY_LABELS, 1);
    const today = new Date();
    const expectedLabel = `${WEEKDAY_LABELS[(today.getDay() + 6) % 7]} ${today.getDate()}`;
    expect(series[0].label).toBe(expectedLabel);
  });
});

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  return monday;
}

describe('getWeeklySpendSeries', () => {
  it('returns exactly `weeks` points, most recent week last', () => {
    const series = getWeeklySpendSeries([], 26);
    expect(series).toHaveLength(26);
    expect(series[25].date).toBe(`${mondayOf(new Date()).getFullYear()}-${mondayOf(new Date()).getMonth() + 1}-${mondayOf(new Date()).getDate()}`);
  });

  it('defaults to 26 weeks when not specified', () => {
    expect(getWeeklySpendSeries([])).toHaveLength(26);
  });

  it('sums transactions from the same week into one bucket', () => {
    const monday = mondayOf(new Date());
    const wednesday = new Date(monday);
    wednesday.setDate(wednesday.getDate() + 2);
    const series = getWeeklySpendSeries(
      [tx(monday.toISOString(), 100), tx(wednesday.toISOString(), 50)],
      4
    );
    expect(series[series.length - 1].total).toBe(150);
  });

  it('sums transactions from N weeks ago into the correct historical bucket, not the current week', () => {
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const series = getWeeklySpendSeries([tx(threeWeeksAgo.toISOString(), 999)], 6);
    const currentWeekPoint = series[series.length - 1];
    const historicalPoint = series[series.length - 1 - 3];
    expect(currentWeekPoint.total).toBe(0);
    expect(historicalPoint.total).toBe(999);
  });

  it('ignores transactions older than the requested window', () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 365);
    const series = getWeeklySpendSeries([tx(longAgo.toISOString(), 999)], 6);
    const total = series.reduce((s, p) => s + p.total, 0);
    expect(total).toBe(0);
  });

  it('labels each point with the week-start date as day.month', () => {
    const series = getWeeklySpendSeries([], 1);
    const monday = mondayOf(new Date());
    expect(series[0].label).toBe(`${monday.getDate()}.${monday.getMonth() + 1}`);
  });
});

describe('getMonthlySpendSeries', () => {
  it('returns exactly `months` points, current month last', () => {
    const series = getMonthlySpendSeries([], 12);
    expect(series).toHaveLength(12);
    const now = new Date();
    expect(series[11].date).toBe(`${now.getFullYear()}-${now.getMonth() + 1}-1`);
  });

  it('defaults to 12 months when not specified', () => {
    expect(getMonthlySpendSeries([])).toHaveLength(12);
  });

  it('sums transactions from the same calendar month into one bucket', () => {
    const now = new Date();
    const early = new Date(now.getFullYear(), now.getMonth(), 1);
    const late = new Date(now.getFullYear(), now.getMonth(), 15);
    const series = getMonthlySpendSeries([tx(early.toISOString(), 100), tx(late.toISOString(), 50)], 3);
    expect(series[series.length - 1].total).toBe(150);
  });

  it('sums transactions from N months ago into the correct historical bucket, not the current month', () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 10);
    const series = getMonthlySpendSeries([tx(threeMonthsAgo.toISOString(), 999)], 6);
    const currentMonthPoint = series[series.length - 1];
    const historicalPoint = series[series.length - 1 - 3];
    expect(currentMonthPoint.total).toBe(0);
    expect(historicalPoint.total).toBe(999);
  });

  it('ignores transactions older than the requested window', () => {
    const now = new Date();
    const longAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    const series = getMonthlySpendSeries([tx(longAgo.toISOString(), 999)], 6);
    const total = series.reduce((s, p) => s + p.total, 0);
    expect(total).toBe(0);
  });

  it('labels each point with a non-empty short month name', () => {
    const series = getMonthlySpendSeries([], 1);
    expect(series[0].label.length).toBeGreaterThan(0);
  });
});
