import { getAllCategoriesResolved, resolveCategoryLabel, resolveCategoryIcon } from '../categories';
import { CATEGORIES, CATEGORY_META, CustomCategory } from '../types';

// Fake translator: prefixes the key so we can assert it was actually called,
// without depending on the real i18n dictionaries.
const t = (path: string) => `[${path}]`;

const customCategories: CustomCategory[] = [{ id: 'custom-1', label: 'Pets', icon: 'paw-outline', color: '#7C6CF2' }];

describe('getAllCategoriesResolved', () => {
  it('includes every built-in category plus every custom category', () => {
    const resolved = getAllCategoriesResolved(customCategories, t);
    expect(resolved).toHaveLength(CATEGORIES.length + customCategories.length);
    expect(resolved.map((c) => c.id)).toEqual([...CATEGORIES, 'custom-1']);
  });

  it('translates built-in labels via the labelKey but uses the literal label for custom categories', () => {
    const resolved = getAllCategoriesResolved(customCategories, t);
    const food = resolved.find((c) => c.id === 'food')!;
    expect(food.label).toBe(`[${CATEGORY_META.food.labelKey}]`);
    const pets = resolved.find((c) => c.id === 'custom-1')!;
    expect(pets.label).toBe('Pets'); // not run through t(), never translated
  });
});

describe('resolveCategoryLabel', () => {
  it('resolves a custom category by literal label, ignoring the translator', () => {
    expect(resolveCategoryLabel('custom-1', customCategories, t)).toBe('Pets');
  });

  it('resolves a built-in category through the translator', () => {
    expect(resolveCategoryLabel('food', customCategories, t)).toBe(`[${CATEGORY_META.food.labelKey}]`);
  });

  it('falls back to the raw id for an unknown category (e.g. one whose custom category was deleted)', () => {
    expect(resolveCategoryLabel('long-deleted-id', customCategories, t)).toBe('long-deleted-id');
  });
});

describe('resolveCategoryIcon', () => {
  it("returns a custom category's own icon", () => {
    expect(resolveCategoryIcon('custom-1', customCategories)).toBe('paw-outline');
  });

  it("returns a built-in category's icon", () => {
    expect(resolveCategoryIcon('food', customCategories)).toBe(CATEGORY_META.food.icon);
  });

  it('falls back to a generic icon for an unknown category', () => {
    expect(resolveCategoryIcon('long-deleted-id', customCategories)).toBe('ellipse-outline');
  });
});
