import {
  CATEGORIES,
  CATEGORY_META,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_META,
  CustomCategory,
  customCategoriesOfKind,
} from './types';
import { translateAsync } from './i18n';

export interface ResolvedCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

/**
 * Built-in metadata for a category id, spending or income. Income ids are checked too so that
 * history rows, recent lists, and coach text render an income entry's real label and icon
 * instead of falling back to the raw id.
 */
function builtinMeta(categoryId: string): { labelKey: string; icon: string; color: string } | undefined {
  return CATEGORY_META[categoryId] ?? INCOME_CATEGORY_META[categoryId];
}

export function getIncomeCategoriesResolved(
  t: (path: string) => string,
  customCategories: CustomCategory[] = []
): ResolvedCategory[] {
  const builtins = INCOME_CATEGORIES.map((id) => ({
    id,
    label: t(INCOME_CATEGORY_META[id].labelKey),
    icon: INCOME_CATEGORY_META[id].icon,
    color: INCOME_CATEGORY_META[id].color,
  }));
  const customs = customCategoriesOfKind(customCategories, 'income').map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
  }));
  return [...builtins, ...customs];
}

/** Spending categories only - a custom income source must never be offered as a place to spend. */
export function getAllCategoriesResolved(
  customCategories: CustomCategory[],
  t: (path: string) => string
): ResolvedCategory[] {
  const builtins = CATEGORIES.map((id) => ({
    id,
    label: t(CATEGORY_META[id].labelKey),
    icon: CATEGORY_META[id].icon,
    color: CATEGORY_META[id].color,
  }));
  const customs = customCategoriesOfKind(customCategories, 'expense').map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
  }));
  return [...builtins, ...customs];
}

export function resolveCategoryLabel(
  categoryId: string,
  customCategories: CustomCategory[],
  t: (path: string) => string
): string {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.label;
  const meta = builtinMeta(categoryId);
  return meta ? t(meta.labelKey) : categoryId;
}

export function resolveCategoryIcon(categoryId: string, customCategories: CustomCategory[]): string {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.icon;
  return builtinMeta(categoryId)?.icon ?? 'ellipse-outline';
}

/** Non-component variant for use outside React (AI prompt building). */
export async function resolveCategoryLabelAsync(categoryId: string, customCategories: CustomCategory[]): Promise<string> {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.label;
  const meta = builtinMeta(categoryId);
  return meta ? translateAsync(meta.labelKey) : categoryId;
}
