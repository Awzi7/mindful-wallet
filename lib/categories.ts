import { CATEGORIES, CATEGORY_META, CustomCategory } from './types';
import { translateAsync } from './i18n';

export interface ResolvedCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

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
  const customs = customCategories.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color }));
  return [...builtins, ...customs];
}

export function resolveCategoryLabel(
  categoryId: string,
  customCategories: CustomCategory[],
  t: (path: string) => string
): string {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.label;
  const meta = CATEGORY_META[categoryId];
  return meta ? t(meta.labelKey) : categoryId;
}

export function resolveCategoryIcon(categoryId: string, customCategories: CustomCategory[]): string {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.icon;
  return CATEGORY_META[categoryId]?.icon ?? 'ellipse-outline';
}

/** Non-component variant for use outside React (AI prompt building). */
export async function resolveCategoryLabelAsync(categoryId: string, customCategories: CustomCategory[]): Promise<string> {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.label;
  const meta = CATEGORY_META[categoryId];
  return meta ? translateAsync(meta.labelKey) : categoryId;
}
