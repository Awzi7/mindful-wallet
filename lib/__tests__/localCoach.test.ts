import AsyncStorage from '@react-native-async-storage/async-storage';
import { addTransaction, setGoals, setWeeklyBudget } from '../storage';
import {
  EMPTY_DIALOGUE_STATE,
  getLocalDailyPrediction,
  getLocalGeoArrival,
  getLocalHotspotIntervention,
  getLocalPurchaseAdvice,
  getLocalSpendingNudge,
} from '../localCoach';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getLocalPurchaseAdvice', () => {
  it('replies to a greeting instead of treating it as a purchase question', async () => {
    const { reply, state } = await getLocalPurchaseAdvice('привет');
    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain('undefined');
    expect(state).toEqual(EMPTY_DIALOGUE_STATE);
  });

  it('replies to thanks instead of treating it as a purchase question', async () => {
    const { reply } = await getLocalPurchaseAdvice('спасибо');
    expect(reply.length).toBeGreaterThan(0);
  });

  it('answers an explicit spending/status question with the most-used budget category', async () => {
    await setWeeklyBudget({ food: 100, cafe: 50 });
    await addTransaction({ amount: 70, category: 'food' });

    const { reply } = await getLocalPurchaseAdvice('сколько я потратил?');

    expect(reply).toContain('70');
  });

  it('answers a status question gracefully when no budget is set', async () => {
    await setWeeklyBudget({});

    const { reply } = await getLocalPurchaseAdvice('сколько я потратил?');

    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain('undefined');
  });

  it('answers an explicit goal question with progress and remaining amount', async () => {
    await setGoals([{ id: 'g1', name: 'Vacation', targetAmount: 1000, savedAmount: 400 }]);

    const { reply } = await getLocalPurchaseAdvice('моя цель?');

    expect(reply).toContain('600');
    expect(reply).toContain('40');
  });

  it('answers a goal question gracefully when no goal is set', async () => {
    await setGoals([]);

    const { reply } = await getLocalPurchaseAdvice('моя цель?');

    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain('undefined');
  });

  it('asks a short clarifying question when nothing is parseable and there is no prior context', async () => {
    const { reply, state } = await getLocalPurchaseAdvice('just wondering about something');

    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain('undefined');
    expect(state).toEqual(EMPTY_DIALOGUE_STATE);
  });

  it('extracts an amount and matching category from free text and applies it to that budget', async () => {
    await setWeeklyBudget({ clothes: 500 });

    const { reply, state } = await getLocalPurchaseAdvice('Хочу купить кроссовки за 150');

    // 150 spent against a 500 limit with nothing else spent this week -> 30%.
    expect(reply).toContain('150');
    expect(reply).toContain('30');
    expect(state).toEqual(EMPTY_DIALOGUE_STATE); // fully resolved, context reset
  });

  it('extracts an amount with no matching category and weighs it against the total weekly budget', async () => {
    await setWeeklyBudget({ food: 100, cafe: 100 });

    const { reply } = await getLocalPurchaseAdvice('стоит ли потратить 50 на подарок?');

    // 50 against a 200 total weekly budget -> 25%.
    expect(reply).toContain('50');
    expect(reply).toContain('25');
  });

  it('weighs a parsed amount against the primary goal', async () => {
    await setGoals([{ id: 'g1', name: 'Vacation', targetAmount: 1000, savedAmount: 0 }]);

    const { reply } = await getLocalPurchaseAdvice('стоит ли потратить 250 на подарок?');

    // 250 out of 1000 remaining -> 25%.
    expect(reply).toContain('25');
  });

  it('asks for the amount when a category is recognized but no amount is given, remembering the category', async () => {
    await setWeeklyBudget({ clothes: 500 });

    const { reply, state } = await getLocalPurchaseAdvice('хочу купить кроссовки');

    expect(reply.length).toBeGreaterThan(0);
    expect(state.categoryId).toBe('clothes');
    expect(state.amount).toBeNull();
  });

  it('completes a purchase evaluation across two turns using the remembered category', async () => {
    await setWeeklyBudget({ clothes: 500 });

    const first = await getLocalPurchaseAdvice('хочу купить кроссовки');
    const second = await getLocalPurchaseAdvice('150', first.state);

    expect(second.reply).toContain('150');
    expect(second.reply).toContain('30');
    expect(second.state).toEqual(EMPTY_DIALOGUE_STATE);
  });

  it('reports higher spend this week compared to last week', async () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    await addTransaction({ amount: 50, category: 'food', createdAt: lastWeek.toISOString() });
    await addTransaction({ amount: 100, category: 'food' });

    const { reply } = await getLocalPurchaseAdvice('как эта неделя по сравнению с прошлой?');

    expect(reply).toContain('50');
    expect(reply).toContain('100');
  });

  it('gives a tip when asked for one', async () => {
    const { reply } = await getLocalPurchaseAdvice('дай совет, как экономить');
    expect(reply.length).toBeGreaterThan(0);
  });
});

describe('getLocalSpendingNudge', () => {
  it('flags the transaction as over budget once the category limit is exceeded', async () => {
    await setWeeklyBudget({ food: 100 });
    await addTransaction({ amount: 120, category: 'food' });

    const nudge = await getLocalSpendingNudge({ id: 'x', amount: 120, category: 'food', createdAt: new Date().toISOString() });

    expect(nudge).toContain('120');
  });

  it('reports remaining budget when still within the weekly limit', async () => {
    await setWeeklyBudget({ food: 100 });
    await addTransaction({ amount: 30, category: 'food' });

    const nudge = await getLocalSpendingNudge({ id: 'x', amount: 30, category: 'food', createdAt: new Date().toISOString() });

    expect(nudge).toContain('30');
  });

  it('handles a category with no configured limit without crashing', async () => {
    await setWeeklyBudget({ food: 100 });

    const nudge = await getLocalSpendingNudge({ id: 'x', amount: 25, category: 'unbudgeted', createdAt: new Date().toISOString() });

    expect(nudge.length).toBeGreaterThan(0);
    expect(nudge).not.toContain('undefined');
  });
});

describe('getLocalDailyPrediction', () => {
  it('mentions the primary goal progress when a goal exists', async () => {
    await setGoals([{ id: 'g1', name: 'Vacation', targetAmount: 1000, savedAmount: 500 }]);

    const prediction = await getLocalDailyPrediction();

    expect(prediction).toContain('50');
  });

  it('falls back to a generic message when there is nothing to report', async () => {
    await setGoals([]);
    await setWeeklyBudget({});

    const prediction = await getLocalDailyPrediction();

    expect(prediction.length).toBeGreaterThan(0);
  });
});

describe('getLocalHotspotIntervention', () => {
  it('falls back to a generic message with no transaction history', async () => {
    const text = await getLocalHotspotIntervention();
    expect(text.length).toBeGreaterThan(0);
  });

  it('describes the top hotspot when a clear pattern exists', async () => {
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7); // same weekday/time each week
      d.setHours(20, 0, 0, 0);
      await addTransaction({ amount: 40, category: 'cafe', createdAt: d.toISOString() });
    }

    const text = await getLocalHotspotIntervention();
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('getLocalGeoArrival', () => {
  it('includes the place label in the message', async () => {
    const text = await getLocalGeoArrival('Central Cafe');
    expect(text).toContain('Central Cafe');
  });
});