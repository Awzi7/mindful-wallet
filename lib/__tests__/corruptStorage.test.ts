import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCoachHistory,
  getCustomCategories,
  getGamification,
  getGoals,
  getHotspotPlaces,
  getNotifications,
  getTodayCheckIn,
  getTransactions,
  getWeeklyBudget,
  importAllData,
} from '../storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

/**
 * These guard the read boundary. Plain JSON.parse only rejects *unparseable* text; valid JSON of
 * the wrong shape used to reach callers and throw at the first .filter/.map or property access,
 * taking the screen down. A hand-edited or truncated backup file is how that happens in practice.
 */
describe('reads survive valid JSON of the wrong shape', () => {
  const wrongShapes = ['{"not":"an array"}', '"a bare string"', '42', 'null', 'true'];

  it.each(wrongShapes)('getTransactions returns [] for %s', async (raw) => {
    await AsyncStorage.setItem('@mw/transactions', raw);
    await expect(getTransactions()).resolves.toEqual([]);
  });

  it.each(wrongShapes)('getCustomCategories returns [] for %s', async (raw) => {
    await AsyncStorage.setItem('@mw/customCategories', raw);
    await expect(getCustomCategories()).resolves.toEqual([]);
  });

  it('getCoachHistory, getHotspotPlaces and getNotifications all degrade to []', async () => {
    await AsyncStorage.multiSet([
      ['@mw/coachHistory', '{"oops":1}'],
      ['@mw/hotspotPlaces', '"nope"'],
      ['@mw/notifications', '7'],
    ]);

    expect(await getCoachHistory()).toEqual([]);
    expect(await getHotspotPlaces()).toEqual([]);
    expect(await getNotifications()).toEqual([]);
  });

  it('getTransactions still survives outright malformed JSON', async () => {
    await AsyncStorage.setItem('@mw/transactions', '{broken');
    await expect(getTransactions()).resolves.toEqual([]);
  });

  it('getWeeklyBudget falls back to the default when the stored value is an array', async () => {
    await AsyncStorage.setItem('@mw/weeklyBudget', '[1,2,3]');
    const budget = await getWeeklyBudget();
    expect(Array.isArray(budget)).toBe(false);
    expect(Object.keys(budget).length).toBeGreaterThan(0);
  });

  it('getTodayCheckIn returns null rather than a bare string', async () => {
    await AsyncStorage.setItem('@mw/checkIn', '"today"');
    await expect(getTodayCheckIn()).resolves.toBeNull();
  });
});

describe('getGamification fills in missing fields', () => {
  it('supplies every field when the stored blob is partial', async () => {
    await AsyncStorage.setItem('@mw/gamification', JSON.stringify({ points: 12 }));

    const gam = await getGamification();

    expect(gam.points).toBe(12);
    expect(gam.streak).toBe(0);
    expect(gam.lastActivityDate).toBeNull();
    // Callers read achievements.length directly, so this must never come back undefined.
    expect(gam.achievements).toEqual([]);
  });

  it('replaces a non-array achievements field with an empty list', async () => {
    await AsyncStorage.setItem('@mw/gamification', JSON.stringify({ points: 1, achievements: 'nope' }));

    const gam = await getGamification();

    expect(gam.achievements).toEqual([]);
  });
});

describe('getGoals', () => {
  it('seeds a default goal when the stored value is the wrong shape', async () => {
    await AsyncStorage.setItem('@mw/goals', '{"not":"an array"}');

    const goals = await getGoals();

    expect(Array.isArray(goals)).toBe(true);
    expect(goals.length).toBeGreaterThan(0);
  });

  it('respects a deliberately empty goal list instead of re-seeding the default', async () => {
    await AsyncStorage.setItem('@mw/goals', '[]');

    await expect(getGoals()).resolves.toEqual([]);
  });
});

describe('importAllData shape validation', () => {
  it('skips an entry whose value has the wrong shape and reports it', async () => {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: {
        '@mw/transactions': '{"not":"an array"}',
        '@mw/currency': '"EUR"',
      },
      secureKeys: {},
    });

    const result = await importAllData(payload);

    expect(result.skipped).toEqual(['@mw/transactions']);
    expect(result.imported).toBe(1);
    // The malformed value must not have been written.
    expect(await AsyncStorage.getItem('@mw/transactions')).toBeNull();
    expect(await AsyncStorage.getItem('@mw/currency')).toBe('"EUR"');
  });

  it('rejects a file whose recognised entries are all malformed', async () => {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: { '@mw/transactions': 'not json at all', '@mw/goals': '{"nope":1}' },
      secureKeys: {},
    });

    await expect(importAllData(payload)).rejects.toThrow('invalid-format');
    expect(await AsyncStorage.getItem('@mw/transactions')).toBeNull();
  });

  it('imports a well-formed payload cleanly', async () => {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: {
        '@mw/transactions': JSON.stringify([{ id: 'a', amount: 10, category: 'food', createdAt: new Date(0).toISOString() }]),
        '@mw/goals': '[]',
      },
      secureKeys: {},
    });

    const result = await importAllData(payload);

    expect(result.skipped).toEqual([]);
    expect(result.imported).toBe(2);
    expect(await getTransactions()).toHaveLength(1);
  });

  it('still rejects a payload that is not an object at all', async () => {
    await expect(importAllData('"just a string"')).rejects.toThrow('invalid-format');
    await expect(importAllData('{oops')).rejects.toThrow('invalid-json');
  });

  it('ignores a non-object secureKeys field instead of throwing', async () => {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: { '@mw/currency': '"USD"' },
      secureKeys: 'nope',
    });

    await expect(importAllData(payload)).resolves.toMatchObject({ imported: 1 });
  });
});
