import { askAI } from './ai';
import { buildHeatGrid, topHotSpots, describeHotSpot, currentWeekdayIndex, dominantCategory, DAYPART_KEYS } from './heatmap';
import { resolveCategoryLabelAsync } from './categories';
import {
  EMPTY_DIALOGUE_STATE,
  getLocalDailyPrediction,
  getLocalGeoArrival,
  getLocalHotspotIntervention,
  getLocalPurchaseAdvice,
  getLocalSpendingNudge,
  type CoachDialogueState,
} from './localCoach';
export type { CoachDialogueState } from './localCoach';
import { CurrencyCode, Transaction, Category } from './types';
import {
  getActiveProvider,
  getTransactions,
  getBudgetPeriod,
  getWeeklyBudget,
  getPeriodSpendByCategory,
  getGoals,
  getUserName,
  getCurrency,
  getCustomCategories,
} from './storage';
import { formatMoney } from './format';
import { translateAsync, translateArrayAsync } from './i18n';

type Translator = (path: string, vars?: Record<string, string | number>) => Promise<string>;

async function buildProfileContext(): Promise<{ text: string; currency: CurrencyCode; t: Translator }> {
  const [name, goals, budget, weekSpend, currency, customCategories] = await Promise.all([
    getUserName(),
    getGoals(),
    getWeeklyBudget(),
    getPeriodSpendByCategory(),
    getCurrency(),
    getCustomCategories(),
  ]);
  const fmt = (n: number) => formatMoney(n, currency);
  const t: Translator = (path, vars) => translateAsync(path, vars);
  const friendFallback = await t('common.friend');

  const lines: string[] = [];
  lines.push(await t('ai.userNameLine', { name: name || friendFallback }));
  for (const goal of goals) {
    const goalProgress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
    lines.push(
      await t('ai.goalLine', {
        goalName: goal.name,
        target: fmt(goal.targetAmount),
        saved: fmt(goal.savedAmount),
        pct: goalProgress,
      })
    );
  }
  // The period must reach the model: telling it "weekly limit" while the user budgets monthly
  // would have it reason about the wrong horizon and give advice that is simply wrong.
  const budgetPeriod = await getBudgetPeriod();
  lines.push(await t('ai.budgetIntro', { period: await t(`budget.periodPer.${budgetPeriod}`) }));
  for (const cat of Object.keys(budget) as Category[]) {
    const spent = weekSpend[cat] ?? 0;
    const limit = budget[cat];
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const label = await resolveCategoryLabelAsync(cat, customCategories);
    lines.push(await t('ai.budgetLine', { category: label, spent: fmt(spent), limit: fmt(limit), pct }));
  }
  return { text: lines.join('\n'), currency, t };
}

async function weekdayLabels(): Promise<string[]> {
  return translateArrayAsync('heatmap.weekdays');
}

async function daypartLabels(): Promise<string[]> {
  return Promise.all(DAYPART_KEYS.map((k) => translateAsync(`heatmap.${k}`)));
}

// Premium subscribers get the "advanced" coach (their own real AI provider key); free users
// always get the local rule-based coach, regardless of what provider is technically saved as
// active, so a lapsed/reset subscription can never leave a free user on a real-provider path.
export async function getDailyPrediction(isPremium: boolean): Promise<string> {
  if (!isPremium || (await getActiveProvider()) === 'local') return getLocalDailyPrediction();

  const all = await getTransactions();
  const grid = buildHeatGrid(all);
  const spots = topHotSpots(grid, 3);
  const todayIdx = currentWeekdayIndex();
  const [weekdays, dayparts] = await Promise.all([weekdayLabels(), daypartLabels()]);
  const todayLabel = weekdays[todayIdx];

  const { text: profile, currency, t } = await buildProfileContext();

  let spotLines: string;
  if (spots.length > 0) {
    const lines = await Promise.all(
      spots.map((s) => t('ai.hotspotLine', { spot: describeHotSpot(s, weekdays, dayparts), amount: formatMoney(s.amount, currency) }))
    );
    spotLines = lines.join('\n');
  } else {
    spotLines = await t('ai.notEnoughData');
  }

  const persona = await t('ai.persona');
  const prompt = await t('ai.dailyPrediction', { weekday: todayLabel, spotLines, profile });

  return askAI(persona, prompt, 260);
}

export async function getPurchaseAdvice(
  question: string,
  isPremium: boolean,
  priorState: CoachDialogueState = EMPTY_DIALOGUE_STATE
): Promise<{ reply: string; state: CoachDialogueState }> {
  if (!isPremium || (await getActiveProvider()) === 'local') return getLocalPurchaseAdvice(question, priorState);

  const { text: profile, t } = await buildProfileContext();
  const persona = await t('ai.persona');
  const prompt = await t('ai.purchaseAdvice', { question, profile });
  const reply = await askAI(persona, prompt, 300);
  return { reply, state: EMPTY_DIALOGUE_STATE };
}

export async function getSpendingNudge(tx: Transaction, isPremium: boolean): Promise<string> {
  if (!isPremium || (await getActiveProvider()) === 'local') return getLocalSpendingNudge(tx);

  const { text: profile, currency, t } = await buildProfileContext();
  const customCategories = await getCustomCategories();
  const category = await resolveCategoryLabelAsync(tx.category, customCategories);
  const placePart = tx.place ? await t('ai.spendingNudgePlacePart', { place: tx.place }) : '';
  const persona = await t('ai.persona');
  const prompt = await t('ai.spendingNudge', { amount: formatMoney(tx.amount, currency), category, placePart, profile });
  return askAI(persona, prompt, 220);
}

export async function getHotspotIntervention(isPremium: boolean): Promise<string> {
  if (!isPremium || (await getActiveProvider()) === 'local') return getLocalHotspotIntervention();

  const all = await getTransactions();
  const grid = buildHeatGrid(all);
  const [topSpot] = topHotSpots(grid, 1);
  const { text: profile, t } = await buildProfileContext();
  const customCategories = await getCustomCategories();
  const [weekdays, dayparts] = await Promise.all([weekdayLabels(), daypartLabels()]);

  let spotDesc: string;
  if (topSpot) {
    const catId = dominantCategory(topSpot);
    const category = catId ? await resolveCategoryLabelAsync(catId, customCategories) : '';
    spotDesc = await t('ai.hotspotSpotDesc', { spot: describeHotSpot(topSpot, weekdays, dayparts), category });
  } else {
    spotDesc = await t('ai.hotspotFallbackDesc');
  }

  const persona = await t('ai.persona');
  const prompt = await t('ai.hotspotIntervention', { spotDesc, profile });
  return askAI(persona, prompt, 220);
}

export async function getGeoHotspotArrival(placeLabel: string, isPremium: boolean): Promise<string> {
  if (!isPremium || (await getActiveProvider()) === 'local') return getLocalGeoArrival(placeLabel);

  const { text: profile, t } = await buildProfileContext();
  const persona = await t('ai.persona');
  const prompt = await t('ai.geoArrival', { placeLabel, profile });
  return askAI(persona, prompt, 220);
}
