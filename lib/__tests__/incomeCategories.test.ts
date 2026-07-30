import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCustomCategory, getWeeklyBudget } from '../storage';
import { getAllCategoriesResolved, getIncomeCategoriesResolved } from '../categories';
import { CustomCategory, customCategoriesOfKind, isIncomeCategory } from '../types';

const t = (path: string) => path;

beforeEach(async () => {
  await AsyncStorage.clear();
});

function cat(id: string, label: string, kind?: 'expense' | 'income'): CustomCategory {
  return { id, label, icon: 'pricetag-outline', color: '#000000', kind };
}

describe('custom category kinds', () => {
  it('treats a category with no kind as a spending category, so pre-income data is unaffected', () => {
    expect(isIncomeCategory(cat('c1', 'Pets'))).toBe(false);
    expect(customCategoriesOfKind([cat('c1', 'Pets')], 'expense')).toHaveLength(1);
  });

  it('splits a mixed list by kind', () => {
    const list = [cat('c1', 'Pets'), cat('c2', 'Rent out', 'income'), cat('c3', 'Books', 'expense')];

    expect(customCategoriesOfKind(list, 'expense').map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(customCategoriesOfKind(list, 'income').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('category pickers stay separated', () => {
  const list = [cat('c1', 'Pets'), cat('c2', 'Rent out', 'income')];

  it('offers custom income sources in the income picker', () => {
    const ids = getIncomeCategoriesResolved(t, list).map((c) => c.id);

    expect(ids).toContain('c2');
    expect(ids).toContain('salary'); // built-ins still there
  });

  it('never offers an income source as a place to spend', () => {
    const ids = getAllCategoriesResolved(list, t).map((c) => c.id);

    expect(ids).toContain('c1');
    expect(ids).not.toContain('c2');
  });

  it('never offers a spending category as an income source', () => {
    const ids = getIncomeCategoriesResolved(t, list).map((c) => c.id);

    expect(ids).not.toContain('c1');
    expect(ids).not.toContain('food');
  });
});

describe('budget entries', () => {
  it('gives a new spending category a limit', async () => {
    await addCustomCategory({ label: 'Pets', icon: 'paw-outline', color: '#fff', kind: 'expense' });

    const budget = await getWeeklyBudget();
    const added = Object.keys(budget).find((k) => k.startsWith('custom-'));

    expect(added).toBeDefined();
    expect(budget[added!]).toBeGreaterThan(0);
  });

  it('does not give an income source a limit - there is nothing to cap', async () => {
    await addCustomCategory({ label: 'Rent out', icon: 'home-outline', color: '#fff', kind: 'income' });

    const budget = await getWeeklyBudget();

    expect(Object.keys(budget).some((k) => k.startsWith('custom-'))).toBe(false);
  });
});
