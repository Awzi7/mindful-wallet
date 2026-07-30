import { buildHeatGrid, topHotSpots, describeHotSpot, currentWeekdayIndex, DAYPART_KEYS } from './heatmap';
import { resolveCategoryLabelAsync } from './categories';
import { Transaction, expensesOnly } from './types';
import {
  getTransactions,
  getBudgetPeriod,
  getWeeklyBudget,
  getPeriodSpendByCategory,
  getWeekWindow,
  getGoals,
  getCurrency,
  getCustomCategories,
} from './storage';
import { formatMoney } from './format';
import { translateAsync, translateArrayAsync } from './i18n';
import { getSyncLanguage } from './i18n/current';
import { classifyIntent, parsePurchaseQuestion } from './nlu';

async function weekdayLabels(): Promise<string[]> {
  return translateArrayAsync('heatmap.weekdays');
}

/** The word for the user's budget period, for sentences like "limit for the month". */
async function periodLabel(): Promise<string> {
  const period = await getBudgetPeriod();
  return translateAsync(`budget.periodPer.${period}`);
}

async function daypartLabels(): Promise<string[]> {
  return Promise.all(DAYPART_KEYS.map((k) => translateAsync(`heatmap.${k}`)));
}

interface TopCategory {
  id: string;
  label: string;
  spent: number;
  limit: number;
  pct: number;
}

/** The budget category closest to (or over) its weekly limit, if any limits are set. */
async function getMostUsedCategory(): Promise<TopCategory | null> {
  const [budget, weekSpend, customCategories] = await Promise.all([
    getWeeklyBudget(),
    getPeriodSpendByCategory(),
    getCustomCategories(),
  ]);

  let top: TopCategory | null = null;
  for (const id of Object.keys(budget)) {
    const limit = budget[id];
    if (limit <= 0) continue;
    const spent = weekSpend[id] ?? 0;
    const pct = Math.round((spent / limit) * 100);
    if (!top || pct > top.pct) {
      top = { id, label: await resolveCategoryLabelAsync(id, customCategories), spent, limit, pct };
    }
  }
  return top;
}

async function getPrimaryGoalFacts(): Promise<{ name: string; pct: number; remaining: number } | null> {
  const goals = await getGoals();
  const goal = goals[0];
  if (!goal) return null;
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  return { name: goal.name, pct, remaining };
}

export async function getLocalDailyPrediction(): Promise<string> {
  const [all, weekdays, dayparts, topCategory, goal] = await Promise.all([
    getTransactions(),
    weekdayLabels(),
    daypartLabels(),
    getMostUsedCategory(),
    getPrimaryGoalFacts(),
  ]);
  const [spot] = topHotSpots(buildHeatGrid(all), 1);

  const parts: string[] = [];
  if (spot) parts.push(await translateAsync('local.hotspotLine', { spot: describeHotSpot(spot, weekdays, dayparts) }));
  if (topCategory && topCategory.pct >= 70) {
    parts.push(await translateAsync('local.budgetWarnLine', { category: topCategory.label, pct: topCategory.pct }));
  }
  if (goal) parts.push(await translateAsync('local.goalLine', { goalName: goal.name, pct: goal.pct }));
  if (parts.length === 0) return translateAsync('local.notEnoughData');
  return parts.join(' ');
}

export interface CoachDialogueState {
  amount: number | null;
  categoryId: string | null;
}

export const EMPTY_DIALOGUE_STATE: CoachDialogueState = { amount: null, categoryId: null };

async function buildPurchaseReply(amount: number, categoryId: string | null): Promise<string> {
  const [currency, budget, weekSpend, customCategories, goal, periodWord] = await Promise.all([
    getCurrency(),
    getWeeklyBudget(),
    getPeriodSpendByCategory(),
    getCustomCategories(),
    getPrimaryGoalFacts(),
    periodLabel(),
  ]);
  const fmt = (n: number) => formatMoney(n, currency);
  const parts: string[] = [];

  if (categoryId && budget[categoryId] > 0) {
    const limit = budget[categoryId];
    const spent = weekSpend[categoryId] ?? 0;
    const label = await resolveCategoryLabelAsync(categoryId, customCategories);
    const pctAfter = Math.round(((spent + amount) / limit) * 100);
    parts.push(
      await translateAsync('local.purchaseAdviceSpecific', { amount: fmt(amount), category: label, pct: pctAfter, limit: fmt(limit) })
    );
  } else {
    const periodTotal = Object.values(budget).reduce((s: number, v: number) => s + v, 0);
    const pct = periodTotal > 0 ? Math.round((amount / periodTotal) * 100) : 0;
    parts.push(await translateAsync('local.purchaseAdviceAmountOnly', { amount: fmt(amount), pct, period: periodWord }));
  }

  if (goal) {
    const pct = goal.remaining > 0 ? Math.round((amount / goal.remaining) * 100) : 0;
    parts.push(await translateAsync('local.purchaseAdviceGoalImpact', { goalName: goal.name, pct }));
  }

  parts.push(await translateAsync('local.purchaseAdviceRule', { period: periodWord }));
  return parts.join(' ');
}

async function buildStatusReply(): Promise<string> {
  const [currency, topCategory, periodWord] = await Promise.all([getCurrency(), getMostUsedCategory(), periodLabel()]);
  const fmt = (n: number) => formatMoney(n, currency);
  const parts = [await translateAsync('local.statusIntro', { period: periodWord })];
  if (topCategory) {
    parts.push(
      await translateAsync('local.purchaseAdviceBudget', {
        category: topCategory.label,
        pct: topCategory.pct,
        spent: fmt(topCategory.spent),
        limit: fmt(topCategory.limit),
      })
    );
  } else {
    parts.push(await translateAsync('local.purchaseAdviceNoBudget'));
  }
  return parts.join(' ');
}

async function buildGoalReply(): Promise<string> {
  const [currency, goal] = await Promise.all([getCurrency(), getPrimaryGoalFacts()]);
  if (!goal) return translateAsync('local.goalReplyNoGoal');
  return translateAsync('local.goalReplyWithGoal', {
    goalName: goal.name,
    pct: goal.pct,
    remaining: formatMoney(goal.remaining, currency),
  });
}

/** Spend only - the week-over-week comparison is about how much went out, not net cash flow. */
function sumInWindow(transactions: Transaction[], start: Date, end: Date): number {
  return expensesOnly(transactions).reduce((sum, t) => {
    const d = new Date(t.createdAt);
    return d >= start && d < end ? sum + t.amount : sum;
  }, 0);
}

async function buildCompareReply(): Promise<string> {
  const [currency, allTx] = await Promise.all([getCurrency(), getTransactions()]);
  const fmt = (n: number) => formatMoney(n, currency);

  const thisWeek = getWeekWindow();
  const lastWeekRef = new Date();
  lastWeekRef.setDate(lastWeekRef.getDate() - 7);
  const lastWeek = getWeekWindow(lastWeekRef);

  const thisTotal = sumInWindow(allTx, thisWeek.start, thisWeek.end);
  const lastTotal = sumInWindow(allTx, lastWeek.start, lastWeek.end);

  if (thisTotal === 0 && lastTotal === 0) return translateAsync('local.compareNoData');
  if (lastTotal === 0) return translateAsync('local.compareNoLastWeek', { thisWeek: fmt(thisTotal) });

  const diffPct = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
  if (diffPct > 0) {
    return translateAsync('local.compareMore', { thisWeek: fmt(thisTotal), lastWeek: fmt(lastTotal), pct: diffPct });
  }
  if (diffPct < 0) {
    return translateAsync('local.compareLess', { thisWeek: fmt(thisTotal), lastWeek: fmt(lastTotal), pct: Math.abs(diffPct) });
  }
  return translateAsync('local.compareSame', { thisWeek: fmt(thisTotal) });
}

async function buildTipsReply(): Promise<string> {
  const tips = await translateArrayAsync('local.tips');
  const tip = tips[currentWeekdayIndex() % tips.length];
  return translateAsync('local.tipsIntro', { tip });
}

/**
 * A slot-filling dialogue manager, not a language model: it classifies the message into one of
 * a few known intents by keyword, and for purchase questions it fills in amount/category slots
 * across turns (asking a follow-up when the category is known but the amount isn't) using
 * `priorState` from the previous turn in this conversation.
 */
export async function getLocalPurchaseAdvice(
  question: string,
  priorState: CoachDialogueState = EMPTY_DIALOGUE_STATE
): Promise<{ reply: string; state: CoachDialogueState }> {
  const language = getSyncLanguage();
  const intent = classifyIntent(question, language);

  if (intent === 'greeting') return { reply: await translateAsync('local.greetingReply'), state: EMPTY_DIALOGUE_STATE };
  if (intent === 'thanks') return { reply: await translateAsync('local.thanksReply'), state: EMPTY_DIALOGUE_STATE };
  if (intent === 'status') return { reply: await buildStatusReply(), state: EMPTY_DIALOGUE_STATE };
  if (intent === 'goal') return { reply: await buildGoalReply(), state: EMPTY_DIALOGUE_STATE };
  if (intent === 'compare') return { reply: await buildCompareReply(), state: EMPTY_DIALOGUE_STATE };
  if (intent === 'tips') return { reply: await buildTipsReply(), state: EMPTY_DIALOGUE_STATE };

  const customCategories = await getCustomCategories();
  const parsed = parsePurchaseQuestion(question, language, customCategories);
  const amount = parsed.amount ?? priorState.amount;
  const categoryId = parsed.categoryId ?? priorState.categoryId;

  if (categoryId && amount == null) {
    const label = await resolveCategoryLabelAsync(categoryId, customCategories);
    return { reply: await translateAsync('local.askAmount', { category: label }), state: { amount: null, categoryId } };
  }

  if (amount == null) {
    return { reply: await translateAsync('local.needMoreInfo'), state: EMPTY_DIALOGUE_STATE };
  }

  return { reply: await buildPurchaseReply(amount, categoryId), state: EMPTY_DIALOGUE_STATE };
}

export async function getLocalSpendingNudge(tx: Transaction): Promise<string> {
  const [currency, budget, weekSpend, customCategories] = await Promise.all([
    getCurrency(),
    getWeeklyBudget(),
    getPeriodSpendByCategory(),
    getCustomCategories(),
  ]);
  const fmt = (n: number) => formatMoney(n, currency);
  const label = await resolveCategoryLabelAsync(tx.category, customCategories);
  const limit = budget[tx.category];
  const amount = fmt(tx.amount);

  if (!limit || limit <= 0) {
    return translateAsync('local.nudgeNoLimit', { amount, category: label });
  }
  const spent = weekSpend[tx.category] ?? 0;
  const pct = Math.round((spent / limit) * 100);
  const periodWord = await periodLabel();
  if (spent >= limit) {
    return translateAsync('local.nudgeOverBudget', { amount, pct, category: label, period: periodWord });
  }
  return translateAsync('local.nudgeWithinBudget', {
    amount,
    pct,
    category: label,
    period: periodWord,
    remaining: fmt(limit - spent),
  });
}

export async function getLocalHotspotIntervention(): Promise<string> {
  const [all, weekdays, dayparts] = await Promise.all([getTransactions(), weekdayLabels(), daypartLabels()]);
  const [spot] = topHotSpots(buildHeatGrid(all), 1);
  if (!spot) return translateAsync('local.hotspotInterventionFallback');

  const tips = await translateArrayAsync('local.tips');
  const tip = tips[currentWeekdayIndex() % tips.length];
  const line = await translateAsync('local.hotspotInterventionLine', { spot: describeHotSpot(spot, weekdays, dayparts) });
  return `${line} ${tip}`;
}

export async function getLocalGeoArrival(placeLabel: string): Promise<string> {
  return translateAsync('local.geoArrival', { placeLabel });
}
