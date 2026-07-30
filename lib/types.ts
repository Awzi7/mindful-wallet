export type Category = string;

export const CATEGORIES: Category[] = [
  'food',
  'cafe',
  'transport',
  'clothes',
  'entertainment',
  'other',
];

export const CATEGORY_META: Record<string, { labelKey: string; icon: string; color: string }> = {
  food: { labelKey: 'categories.food', icon: 'restaurant-outline', color: '#4CAF93' },
  cafe: { labelKey: 'categories.cafe', icon: 'cafe-outline', color: '#E8985E' },
  transport: { labelKey: 'categories.transport', icon: 'car-outline', color: '#5B8DEF' },
  clothes: { labelKey: 'categories.clothes', icon: 'shirt-outline', color: '#B98CE0' },
  entertainment: { labelKey: 'categories.entertainment', icon: 'film-outline', color: '#E86E9E' },
  other: { labelKey: 'categories.other', icon: 'card-outline', color: '#9AA5B1' },
};

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const CUSTOM_CATEGORY_ICON_CHOICES = [
  'pricetag-outline',
  'gift-outline',
  'paw-outline',
  'medkit-outline',
  'school-outline',
  'barbell-outline',
  'airplane-outline',
  'home-outline',
  'game-controller-outline',
  'book-outline',
  'flower-outline',
  'construct-outline',
];

export const CUSTOM_CATEGORY_COLOR_CHOICES = [
  '#7C6CF2',
  '#E8577D',
  '#4CC9BA',
  '#F2994A',
  '#5B8DEF',
  '#B98CE0',
];

export type CurrencyCode = 'USD' | 'EUR' | 'KZT' | 'UAH' | 'GBP';

export const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'KZT', 'UAH', 'GBP'];

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; labelKey: string; symbolBefore: boolean }> = {
  USD: { symbol: '$', labelKey: 'currencies.USD', symbolBefore: true },
  EUR: { symbol: '€', labelKey: 'currencies.EUR', symbolBefore: true },
  KZT: { symbol: '₸', labelKey: 'currencies.KZT', symbolBefore: false },
  UAH: { symbol: '₴', labelKey: 'currencies.UAH', symbolBefore: false },
  GBP: { symbol: '£', labelKey: 'currencies.GBP', symbolBefore: true },
};

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: number;
  category: Category;
  /**
   * Absent means 'expense'. Kept optional so transactions saved before income
   * tracking existed keep counting as spending without a data migration.
   */
  type?: TransactionType;
  place?: string;
  note?: string;
  createdAt: string; // ISO timestamp
}

/** Income categories are separate from spending categories - a salary isn't a "food" entry. */
export const INCOME_CATEGORIES: Category[] = ['salary', 'freelance', 'gift', 'otherIncome'];

export const INCOME_CATEGORY_META: Record<string, { labelKey: string; icon: string; color: string }> = {
  salary: { labelKey: 'incomeCategories.salary', icon: 'briefcase-outline', color: '#4CAF93' },
  freelance: { labelKey: 'incomeCategories.freelance', icon: 'laptop-outline', color: '#5B8DEF' },
  gift: { labelKey: 'incomeCategories.gift', icon: 'gift-outline', color: '#E86E9E' },
  otherIncome: { labelKey: 'incomeCategories.otherIncome', icon: 'wallet-outline', color: '#9AA5B1' },
};

export function isIncome(tx: Transaction): boolean {
  return tx.type === 'income';
}

export function isExpense(tx: Transaction): boolean {
  return tx.type !== 'income';
}

/**
 * Strips income out of a transaction list. Every spend calculation (budgets, heat map,
 * trends, recurring detection, coach) must go through this - income leaking into a
 * spending total silently corrupts budgets and coach advice.
 */
export function expensesOnly(list: Transaction[]): Transaction[] {
  return list.filter(isExpense);
}

export function incomeOnly(list: Transaction[]): Transaction[] {
  return list.filter(isIncome);
}

export function sumAmount(list: Transaction[]): number {
  return list.reduce((sum, t) => sum + t.amount, 0);
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
}

/**
 * Category limits. The numbers are "per budget period" - the same stored values mean per-week
 * or per-month depending on BudgetPeriod, so switching period does not rewrite anyone's limits.
 */
export type WeeklyBudget = Record<string, number>;

export type BudgetPeriod = 'week' | 'month';

export const BUDGET_PERIODS: BudgetPeriod[] = ['week', 'month'];

export interface Achievement {
  id: string;
  earnedAt: string;
  params?: Record<string, string | number>;
}

export interface DailyCheckIn {
  date: string; // yyyy-mm-dd
  foodLimit: number | null;
  bigPurchaseNote: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO timestamp
  read: boolean;
}

export type Provider = 'anthropic' | 'openai' | 'google';

export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google'];

export const PROVIDER_META: Record<
  Provider,
  { labelKey: string; shortLabel: string; defaultModel: string; placeholder: string; helpUrl: string }
> = {
  anthropic: {
    labelKey: 'providers.anthropic',
    shortLabel: 'Claude',
    defaultModel: 'claude-sonnet-5',
    placeholder: 'sk-ant-...',
    helpUrl: 'console.anthropic.com',
  },
  openai: {
    labelKey: 'providers.openai',
    shortLabel: 'GPT',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
    helpUrl: 'platform.openai.com',
  },
  google: {
    labelKey: 'providers.google',
    shortLabel: 'Gemini',
    defaultModel: 'gemini-2.0-flash',
    placeholder: 'AIza...',
    helpUrl: 'aistudio.google.com',
  },
};

export interface ProviderConfig {
  apiKey: string;
  model: string;
}

export type ProviderSettings = Record<Provider, ProviderConfig>;

/** A 4th, keyless coaching option alongside the 3 real (BYOK) providers: a deterministic,
 * rule-based coach that runs entirely on-device from local data, at no cost and with no server. */
export const LOCAL_COACH_ID = 'local' as const;
export type ActiveAIOption = Provider | typeof LOCAL_COACH_ID;

export interface CoachHistoryItem {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface HotspotPlace {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: string;
}

export interface GamificationState {
  points: number;
  streak: number;
  lastActivityDate: string | null;
  achievements: Achievement[];
}
