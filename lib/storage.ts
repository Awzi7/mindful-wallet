import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  Achievement,
  ActiveAIOption,
  AppNotification,
  Category,
  CoachHistoryItem,
  CURRENCIES,
  CurrencyCode,
  CustomCategory,
  DailyCheckIn,
  GamificationState,
  Goal,
  HotspotPlace,
  LOCAL_COACH_ID,
  PROVIDER_META,
  PROVIDERS,
  Provider,
  ProviderConfig,
  ProviderSettings,
  Transaction,
  WeeklyBudget,
  BudgetPeriod,
  expensesOnly,
  incomeOnly,
  sumAmount,
} from './types';

const KEYS = {
  providers: '@mw/providers',
  activeProvider: '@mw/activeProvider',
  currency: '@mw/currency',
  userName: '@mw/userName',
  userAvatar: '@mw/userAvatar',
  transactions: '@mw/transactions',
  goal: '@mw/goal',
  goals: '@mw/goals',
  budget: '@mw/weeklyBudget',
  gamification: '@mw/gamification',
  checkIn: '@mw/checkIn',
  coachHistory: '@mw/coachHistory',
  dailyPrediction: '@mw/dailyPrediction',
  hotspotPlaces: '@mw/hotspotPlaces',
  hasOnboarded: '@mw/hasOnboarded',
  themePreference: '@mw/themePreference',
  language: '@mw/language',
  customCategories: '@mw/customCategories',
  isPremium: '@mw/isPremium',
  notifications: '@mw/notifications',
  appLockEnabled: '@mw/appLockEnabled',
  weeklyRecapNotificationId: '@mw/weeklyRecapNotificationId',
  budgetPeriod: '@mw/budgetPeriod',
} as const;

// expo-secure-store has no web implementation, so API keys fall back to AsyncStorage there.
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function secureApiKeyKey(provider: Provider): string {
  return `mw_secure_apikey_${provider}`;
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Shape-checked reads. Plain getJSON only survives *unparseable* JSON - valid JSON of the wrong
 * shape (an object where a list is expected, say) sails through and blows up later at the first
 * .filter/.map or property access, taking the screen with it. A hand-edited or truncated backup
 * file is the realistic way that happens, since importAllData writes whatever the file contains.
 */
async function getJSONArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getJSONObject<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key: string, value: unknown): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---------- AI providers ----------

function defaultProviderSettings(): ProviderSettings {
  return PROVIDERS.reduce((acc, p) => {
    acc[p] = { apiKey: '', model: PROVIDER_META[p].defaultModel };
    return acc;
  }, {} as ProviderSettings);
}

// Model choice is non-sensitive and lives in this plain AsyncStorage blob; API keys live in
// secure storage (see below) and are never written here.
type StoredModels = Partial<Record<Provider, { model: string }>>;

export async function getProviderSettings(): Promise<ProviderSettings> {
  const stored = await getJSONObject<Partial<Record<Provider, Partial<ProviderConfig>>>>(KEYS.providers, {});
  const defaults = defaultProviderSettings();
  let needsStrip = false;

  for (const p of PROVIDERS) {
    defaults[p].model = stored[p]?.model ?? defaults[p].model;

    let apiKey = await secureGet(secureApiKeyKey(p));
    if (!apiKey && stored[p]?.apiKey) {
      // Migrate a plaintext key left over from before secure storage was introduced.
      apiKey = stored[p]!.apiKey!;
      await secureSet(secureApiKeyKey(p), apiKey);
      needsStrip = true;
    }
    defaults[p].apiKey = apiKey ?? '';
  }

  if (needsStrip) {
    const models: StoredModels = {};
    for (const p of PROVIDERS) models[p] = { model: defaults[p].model };
    await setJSON(KEYS.providers, models);
  }

  return defaults;
}

export async function setProviderConfig(provider: Provider, config: Partial<ProviderSettings[Provider]>): Promise<void> {
  if (config.apiKey !== undefined) {
    if (config.apiKey) {
      await secureSet(secureApiKeyKey(provider), config.apiKey);
    } else {
      await secureDelete(secureApiKeyKey(provider));
    }
  }
  if (config.model !== undefined) {
    const models = await getJSONObject<StoredModels>(KEYS.providers, {});
    models[provider] = { model: config.model };
    await setJSON(KEYS.providers, models);
  }
}

// Defaults to the free local coach so a fresh install (or one where the user skipped API key
// setup) has a working coach immediately, with no key and no cost.
export async function getActiveProvider(): Promise<ActiveAIOption> {
  const raw = await AsyncStorage.getItem(KEYS.activeProvider);
  return (raw as ActiveAIOption) || LOCAL_COACH_ID;
}

export function setActiveProvider(provider: ActiveAIOption): Promise<void> {
  return AsyncStorage.setItem(KEYS.activeProvider, provider);
}

// ---------- currency ----------

export async function getCurrency(): Promise<CurrencyCode> {
  const raw = await AsyncStorage.getItem(KEYS.currency);
  // Falls back to USD for a never-set value, or a currency removed since the value was stored (e.g. the old RUB option).
  return CURRENCIES.includes(raw as CurrencyCode) ? (raw as CurrencyCode) : 'USD';
}

export function setCurrency(currency: CurrencyCode): Promise<void> {
  return AsyncStorage.setItem(KEYS.currency, currency);
}

// ---------- theme preference ----------

export type ThemePreference = 'system' | 'light' | 'dark';

export async function getThemePreference(): Promise<ThemePreference> {
  const raw = await AsyncStorage.getItem(KEYS.themePreference);
  return (raw as ThemePreference) || 'system';
}

export function setThemePreference(pref: ThemePreference): Promise<void> {
  return AsyncStorage.setItem(KEYS.themePreference, pref);
}

// ---------- language ----------

export async function getStoredLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.language);
}

export function setStoredLanguage(lang: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.language, lang);
}

// ---------- premium ----------

export async function getIsPremium(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.isPremium)) === '1';
}

export function setIsPremium(value: boolean): Promise<void> {
  return AsyncStorage.setItem(KEYS.isPremium, value ? '1' : '0');
}

export async function getAppLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.appLockEnabled)) === '1';
}

export function setAppLockEnabled(value: boolean): Promise<void> {
  return AsyncStorage.setItem(KEYS.appLockEnabled, value ? '1' : '0');
}

// ---------- onboarding ----------

export async function getHasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.hasOnboarded)) === '1';
}

export function setHasOnboarded(): Promise<void> {
  return AsyncStorage.setItem(KEYS.hasOnboarded, '1');
}

// ---------- user name ----------

export async function getUserName(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.userName)) || '';
}

export function setUserName(name: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.userName, name.trim());
}

export async function getUserAvatar(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.userAvatar)) || '';
}

export function setUserAvatar(avatar: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.userAvatar, avatar);
}

// ---------- transactions ----------

export async function getTransactions(): Promise<Transaction[]> {
  return getJSONArray<Transaction>(KEYS.transactions);
}

export async function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'> & { createdAt?: string }): Promise<Transaction> {
  const list = await getTransactions();
  const full: Transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: tx.createdAt ?? new Date().toISOString(),
    amount: tx.amount,
    category: tx.category,
    type: tx.type,
    place: tx.place,
    note: tx.note,
  };
  const next = [full, ...list];
  await setJSON(KEYS.transactions, next);
  return full;
}

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, 'amount' | 'category' | 'type' | 'place' | 'note'>>
): Promise<Transaction[]> {
  const list = await getTransactions();
  const next = list.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await setJSON(KEYS.transactions, next);
  return next;
}

export async function removeTransaction(id: string): Promise<Transaction[]> {
  const list = await getTransactions();
  const next = list.filter((t) => t.id !== id);
  await setJSON(KEYS.transactions, next);
  return next;
}

export function getWeekWindow(reference = new Date()): { start: Date; end: Date } {
  const day = reference.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function getMonthWindow(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

/** The window a budget is measured over, per the user's chosen period. */
export function getPeriodWindow(period: BudgetPeriod, reference = new Date()): { start: Date; end: Date } {
  return period === 'month' ? getMonthWindow(reference) : getWeekWindow(reference);
}

export async function getBudgetPeriod(): Promise<BudgetPeriod> {
  const stored = await AsyncStorage.getItem(KEYS.budgetPeriod);
  return stored === 'month' ? 'month' : 'week'; // week stays the default for existing users
}

export function setBudgetPeriod(period: BudgetPeriod): Promise<void> {
  return AsyncStorage.setItem(KEYS.budgetPeriod, period);
}

export async function getThisWeekTransactions(): Promise<Transaction[]> {
  const all = await getTransactions();
  const { start, end } = getWeekWindow();
  return all.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= start && d < end;
  });
}

/** Transactions inside the current budget period (week or month, per the setting). */
export async function getCurrentPeriodTransactions(): Promise<Transaction[]> {
  const [all, period] = await Promise.all([getTransactions(), getBudgetPeriod()]);
  const { start, end } = getPeriodWindow(period);
  return all.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= start && d < end;
  });
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  const all = await getTransactions();
  const now = new Date();
  return all.filter((t) => {
    const d = new Date(t.createdAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
}

// ---------- goals ----------

const DEFAULT_GOAL: Goal = {
  id: 'default',
  name: 'Goal',
  targetAmount: 800,
  savedAmount: 120,
};

function makeGoalId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function getGoals(): Promise<Goal[]> {
  const raw = await AsyncStorage.getItem(KEYS.goals);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      // Only a real array counts as "already migrated". A wrong-shaped value must fall through
      // to the migration below rather than being handed back and crashing the Goals screen.
      // An empty array is legitimate - the user deleted every goal - so it is returned as is.
      if (Array.isArray(parsed)) return parsed as Goal[];
    } catch {
      // fall through to migration / default
    }
  }

  // Migrate from the pre-multi-goal single-object shape, if present; otherwise seed one default.
  const legacy = await getJSONObject<Omit<Goal, 'id'> | null>(KEYS.goal, null);
  const migrated = legacy ? [{ id: 'default', ...legacy }] : [DEFAULT_GOAL];
  await setJSON(KEYS.goals, migrated);
  return migrated;
}

export function setGoals(goals: Goal[]): Promise<void> {
  return setJSON(KEYS.goals, goals);
}

/** The featured goal shown on Home and used for achievement/reward bookkeeping. */
export async function getPrimaryGoal(): Promise<Goal | null> {
  const goals = await getGoals();
  return goals[0] ?? null;
}

export async function addGoal(goal: Omit<Goal, 'id'>): Promise<Goal[]> {
  const goals = await getGoals();
  const next = [...goals, { id: makeGoalId(), ...goal }];
  await setGoals(next);
  return next;
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, 'id'>>): Promise<Goal[]> {
  const goals = await getGoals();
  const next = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
  await setGoals(next);
  return next;
}

export async function removeGoal(id: string): Promise<Goal[]> {
  const goals = await getGoals();
  const next = goals.filter((g) => g.id !== id);
  await setGoals(next);
  return next;
}

export async function addToGoalSavings(id: string, amount: number): Promise<Goal[]> {
  const goals = await getGoals();
  const next = goals.map((g) => (g.id === id ? { ...g, savedAmount: Math.max(0, g.savedAmount + amount) } : g));
  await setGoals(next);
  return next;
}

// ---------- budget ----------

export const DEFAULT_WEEKLY_BUDGET: WeeklyBudget = {
  food: 50,
  cafe: 40,
  transport: 20,
  clothes: 30,
  entertainment: 30,
  other: 20,
};

export async function getWeeklyBudget(): Promise<WeeklyBudget> {
  return getJSONObject<WeeklyBudget>(KEYS.budget, DEFAULT_WEEKLY_BUDGET);
}

export function setWeeklyBudget(budget: WeeklyBudget): Promise<void> {
  return setJSON(KEYS.budget, budget);
}

/** Spend per category inside the current budget period (week or month, per the setting). */
export async function getPeriodSpendByCategory(): Promise<Record<string, number>> {
  const [txs, budget] = await Promise.all([getCurrentPeriodTransactions(), getWeeklyBudget()]);
  const totals: Record<string, number> = {};
  for (const cat of Object.keys(budget)) totals[cat] = 0;
  for (const t of expensesOnly(txs)) {
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }
  return totals;
}

/** Income minus expenses over the given window. Positive means you took in more than you spent. */
export async function getBalanceBetween(start: Date, end: Date): Promise<{ income: number; spent: number; net: number }> {
  const all = await getTransactions();
  const inWindow = all.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= start && d < end;
  });
  const income = sumAmount(incomeOnly(inWindow));
  const spent = sumAmount(expensesOnly(inWindow));
  return { income, spent, net: income - spent };
}

export async function getThisWeekBalance(): Promise<{ income: number; spent: number; net: number }> {
  const { start, end } = getWeekWindow();
  return getBalanceBetween(start, end);
}

/**
 * Average weekly income over the trailing `weeks` window, used to show what share of income a
 * suggested budget represents. Averages over the window length, so a single paycheque in an
 * 8-week window reads as a low weekly average rather than a spike.
 */
export async function getAverageWeeklyIncome(weeks = 8): Promise<number> {
  return getAveragePeriodIncome('week', weeks);
}

/**
 * Average income per budget period. Comparing a monthly budget against average *weekly* income
 * would overstate the share roughly fourfold, so the averaging window has to match the budget's
 * period.
 */
export async function getAveragePeriodIncome(period: BudgetPeriod, periods = 8): Promise<number> {
  const periodDays = period === 'month' ? 30 : 7;
  const start = new Date();
  start.setDate(start.getDate() - periods * periodDays);
  // Deliberately open-ended rather than reusing getBalanceBetween: that helper's end bound is
  // exclusive (correct for calendar windows), which would drop income logged this very moment.
  const all = await getTransactions();
  const income = sumAmount(incomeOnly(all).filter((t) => new Date(t.createdAt) >= start));
  return income / periods;
}

// ---------- custom categories ----------

const DEFAULT_CUSTOM_CATEGORY_BUDGET = 20;

export async function getCustomCategories(): Promise<CustomCategory[]> {
  return getJSONArray<CustomCategory>(KEYS.customCategories);
}

export async function addCustomCategory(cat: Omit<CustomCategory, 'id'>): Promise<CustomCategory[]> {
  const list = await getCustomCategories();
  const item: CustomCategory = { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...cat };
  const next = [...list, item];
  await setJSON(KEYS.customCategories, next);

  const budget = await getWeeklyBudget();
  if (!(item.id in budget)) {
    await setWeeklyBudget({ ...budget, [item.id]: DEFAULT_CUSTOM_CATEGORY_BUDGET });
  }
  return next;
}

export async function removeCustomCategory(id: string): Promise<CustomCategory[]> {
  const list = await getCustomCategories();
  const next = list.filter((c) => c.id !== id);
  await setJSON(KEYS.customCategories, next);

  const budget = await getWeeklyBudget();
  if (id in budget) {
    const { [id]: _removed, ...rest } = budget;
    await setWeeklyBudget(rest);
  }
  return next;
}

// ---------- gamification ----------

const DEFAULT_GAMIFICATION: GamificationState = {
  points: 0,
  streak: 0,
  lastActivityDate: null,
  achievements: [],
};

export async function getGamification(): Promise<GamificationState> {
  const stored = await getJSONObject<Partial<GamificationState>>(KEYS.gamification, {});
  // Field-level defaults: callers read gam.achievements.length and gam.points arithmetic
  // directly, so a partially-written blob must not hand back undefined for either.
  return {
    points: typeof stored.points === 'number' ? stored.points : 0,
    streak: typeof stored.streak === 'number' ? stored.streak : 0,
    lastActivityDate: typeof stored.lastActivityDate === 'string' ? stored.lastActivityDate : null,
    achievements: Array.isArray(stored.achievements) ? stored.achievements : [],
  };
}

function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function addPoints(amount: number): Promise<GamificationState> {
  const state = await getGamification();
  const today = todayStr();
  let streak = state.streak;
  if (state.lastActivityDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = state.lastActivityDate === todayStr(yesterday);
    streak = wasYesterday ? state.streak + 1 : 1;
  }
  const next: GamificationState = {
    ...state,
    points: state.points + amount,
    streak,
    lastActivityDate: today,
  };
  await setJSON(KEYS.gamification, next);
  return next;
}

export async function unlockAchievement(id: string, params?: Record<string, string | number>): Promise<GamificationState> {
  const state = await getGamification();
  if (state.achievements.some((a) => a.id === id)) return state;
  const achievement: Achievement = { id, params, earnedAt: new Date().toISOString() };
  const next: GamificationState = { ...state, achievements: [...state.achievements, achievement] };
  await setJSON(KEYS.gamification, next);
  return next;
}

// ---------- daily check-in ----------

export async function getTodayCheckIn(): Promise<DailyCheckIn | null> {
  const stored = await getJSONObject<DailyCheckIn | null>(KEYS.checkIn, null);
  if (stored && stored.date === todayStr()) return stored;
  return null;
}

export function saveTodayCheckIn(data: Omit<DailyCheckIn, 'date'>): Promise<void> {
  return setJSON(KEYS.checkIn, { ...data, date: todayStr() });
}

// ---------- coach history ----------

export async function getCoachHistory(): Promise<CoachHistoryItem[]> {
  return getJSONArray<CoachHistoryItem>(KEYS.coachHistory);
}

export async function addCoachHistory(question: string, answer: string): Promise<CoachHistoryItem[]> {
  const list = await getCoachHistory();
  const item: CoachHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    answer,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...list].slice(0, 50);
  await setJSON(KEYS.coachHistory, next);
  return next;
}

// ---------- hotspot places (real geolocation) ----------

export async function getHotspotPlaces(): Promise<HotspotPlace[]> {
  return getJSONArray<HotspotPlace>(KEYS.hotspotPlaces);
}

export async function addHotspotPlace(place: Omit<HotspotPlace, 'id' | 'createdAt'>): Promise<HotspotPlace[]> {
  const list = await getHotspotPlaces();
  const item: HotspotPlace = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...place,
  };
  const next = [item, ...list];
  await setJSON(KEYS.hotspotPlaces, next);
  return next;
}

export async function removeHotspotPlace(id: string): Promise<HotspotPlace[]> {
  const list = await getHotspotPlaces();
  const next = list.filter((p) => p.id !== id);
  await setJSON(KEYS.hotspotPlaces, next);
  return next;
}

// ---------- in-app notifications ----------

export async function getNotifications(): Promise<AppNotification[]> {
  return getJSONArray<AppNotification>(KEYS.notifications);
}

export async function addNotification(title: string, body: string): Promise<AppNotification[]> {
  const list = await getNotifications();
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const next = [item, ...list].slice(0, 50);
  await setJSON(KEYS.notifications, next);
  return next;
}

export async function markAllNotificationsRead(): Promise<AppNotification[]> {
  const list = await getNotifications();
  const next = list.map((n) => (n.read ? n : { ...n, read: true }));
  await setJSON(KEYS.notifications, next);
  return next;
}

export async function getWeeklyRecapNotificationId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.weeklyRecapNotificationId);
}

export function setWeeklyRecapNotificationId(id: string | null): Promise<void> {
  return id ? AsyncStorage.setItem(KEYS.weeklyRecapNotificationId, id) : AsyncStorage.removeItem(KEYS.weeklyRecapNotificationId);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const list = await getNotifications();
  return list.filter((n) => !n.read).length;
}

// ---------- backup (export / import) ----------

const BACKUP_FORMAT_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  data: Record<string, string | null>;
  secureKeys: Partial<Record<Provider, string>>;
}

export async function exportAllData(): Promise<string> {
  const allKeys = await AsyncStorage.getAllKeys();
  const relevantKeys = allKeys.filter((k) => k.startsWith('@mw/'));
  const pairs = await AsyncStorage.multiGet(relevantKeys);
  const data: Record<string, string | null> = {};
  for (const [key, value] of pairs) data[key] = value;

  const secureKeys: Partial<Record<Provider, string>> = {};
  for (const p of PROVIDERS) {
    const apiKey = await secureGet(secureApiKeyKey(p));
    if (apiKey) secureKeys[p] = apiKey;
  }

  const payload: BackupPayload = {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    secureKeys,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Keys whose stored value must be a JSON array, and those that must be a JSON object. A backup
 * entry that parses but has the wrong shape is dropped rather than written: importing it would
 * put a landmine in storage that only goes off later, on whichever screen reads that key.
 */
const ARRAY_BACKUP_KEYS: readonly string[] = [
  KEYS.transactions,
  KEYS.goals,
  KEYS.customCategories,
  KEYS.coachHistory,
  KEYS.hotspotPlaces,
  KEYS.notifications,
];

const OBJECT_BACKUP_KEYS: readonly string[] = [
  KEYS.providers,
  KEYS.budget,
  KEYS.gamification,
  KEYS.checkIn,
  KEYS.dailyPrediction,
  KEYS.goal,
];

/** True when `raw` is JSON of the shape this key is expected to hold. */
function backupValueHasValidShape(key: string, raw: string): boolean {
  const expectsArray = ARRAY_BACKUP_KEYS.includes(key);
  const expectsObject = OBJECT_BACKUP_KEYS.includes(key);
  if (!expectsArray && !expectsObject) return true; // plain scalars (currency, name, flags)

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  return expectsArray ? Array.isArray(parsed) : isPlainObject(parsed);
}

export interface ImportResult {
  /** Keys written to storage. */
  imported: number;
  /** Keys present in the file but skipped because their value had the wrong shape. */
  skipped: string[];
}

export async function importAllData(json: string): Promise<ImportResult> {
  let payload: BackupPayload;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error('invalid-json');
  }
  if (!isPlainObject(payload) || !isPlainObject(payload.data)) {
    throw new Error('invalid-format');
  }

  const candidates = Object.entries(payload.data).filter(
    (entry): entry is [string, string] => entry[0].startsWith('@mw/') && typeof entry[1] === 'string'
  );

  const entries: [string, string][] = [];
  const skipped: string[] = [];
  for (const [key, value] of candidates) {
    if (backupValueHasValidShape(key, value)) entries.push([key, value]);
    else skipped.push(key);
  }

  // A file whose recognised entries are all malformed is a broken file, not a partial restore.
  if (entries.length === 0 && skipped.length > 0) {
    throw new Error('invalid-format');
  }

  if (entries.length > 0) {
    await AsyncStorage.multiSet(entries);
  }

  if (isPlainObject(payload.secureKeys)) {
    for (const p of PROVIDERS) {
      const apiKey = payload.secureKeys[p];
      if (typeof apiKey === 'string' && apiKey) await secureSet(secureApiKeyKey(p), apiKey);
    }
  }

  return { imported: entries.length, skipped };
}

/** Wipes every locally stored value (transactions, goals, settings, API keys) as if the app were freshly installed. */
export async function resetAllData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const relevantKeys = allKeys.filter((k) => k.startsWith('@mw/'));
  if (relevantKeys.length > 0) await AsyncStorage.multiRemove(relevantKeys);

  for (const p of PROVIDERS) {
    await secureDelete(secureApiKeyKey(p));
  }
}

// ---------- achievement checks ----------

export async function checkAchievements(): Promise<void> {
  const [gam, goals, txs] = await Promise.all([getGamification(), getGoals(), getTransactions()]);

  // The achievement copy promises "10 expenses logged", so income must not count toward it.
  if (expensesOnly(txs).length >= 10) {
    await unlockAchievement('tracker-10');
  }
  if (gam.streak >= 3) {
    await unlockAchievement('streak-3');
  }
  if (gam.streak >= 7) {
    await unlockAchievement('streak-7');
  }
  for (const goal of goals) {
    const progress = goal.targetAmount > 0 ? goal.savedAmount / goal.targetAmount : 0;
    if (progress >= 0.25) {
      await unlockAchievement('goal-25', { goalName: goal.name });
    }
    if (progress >= 0.5) {
      await unlockAchievement('goal-50', { goalName: goal.name });
    }
    if (progress >= 1) {
      await unlockAchievement('goal-100', { goalName: goal.name });
    }
  }
}

// ---------- cached daily prediction ----------

interface CachedPrediction {
  date: string;
  text: string;
}

export async function getCachedDailyPrediction(): Promise<string | null> {
  const cached = await getJSONObject<CachedPrediction | null>(KEYS.dailyPrediction, null);
  if (cached && cached.date === todayStr()) return cached.text;
  return null;
}

export function setCachedDailyPrediction(text: string): Promise<void> {
  return setJSON(KEYS.dailyPrediction, { date: todayStr(), text });
}

// ---------- demo data seeding ----------

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export interface DemoNotes {
  transport: string;
  lunch: string;
  barWithFriends: string;
  cinema: string;
  coffeeToGo: string;
  clothesPurchase: string;
  misc: string;
}

export async function loadDemoData(notes: DemoNotes): Promise<void> {
  const now = new Date();
  const generated: Transaction[] = [];

  // Build 21 days of history with a clear "Friday evening cafe/entertainment" hot spot,
  // plus routine food/transport spending, so the heat map has real signal on first launch.
  for (let daysAgo = 21; daysAgo >= 1; daysAgo--) {
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    const weekday = day.getDay(); // 0 Sun .. 6 Sat

    // Morning transport
    if (Math.random() < 0.8) {
      generated.push(makeTx(day, 8, 'transport', randomBetween(2, 4), notes.transport));
    }
    // Lunch
    if (Math.random() < 0.9) {
      generated.push(makeTx(day, 13, 'food', randomBetween(4, 7), notes.lunch));
    }
    // Evening: Friday/Saturday = impulsive cafe & entertainment hot spot
    if (weekday === 5 || weekday === 6) {
      generated.push(makeTx(day, 19, 'cafe', randomBetween(12, 35), notes.barWithFriends));
      if (Math.random() < 0.5) {
        generated.push(makeTx(day, 21, 'entertainment', randomBetween(8, 20), notes.cinema));
      }
    } else if (Math.random() < 0.4) {
      generated.push(makeTx(day, 18, 'cafe', randomBetween(3, 9), notes.coffeeToGo));
    }
    // Occasional clothes / other
    if (Math.random() < 0.15) {
      generated.push(makeTx(day, 15, 'clothes', randomBetween(15, 60), notes.clothesPurchase));
    }
    if (Math.random() < 0.1) {
      generated.push(makeTx(day, 20, 'other', randomBetween(3, 15), notes.misc));
    }
  }

  await setJSON(KEYS.transactions, generated);
}

function makeTx(day: Date, hour: number, category: Category, amount: number, note: string): Transaction {
  const d = new Date(day);
  d.setHours(hour, randomBetween(0, 59), 0, 0);
  return {
    id: `${d.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    amount,
    category,
    note,
    createdAt: d.toISOString(),
  };
}
