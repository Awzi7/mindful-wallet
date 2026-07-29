import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGoal, addToGoalSavings, getGoals, removeGoal, updateGoal } from '../storage';

describe('getGoals', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('seeds a single default goal when nothing has ever been stored', async () => {
    const goals = await getGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe('default');
  });

  it('migrates a legacy single-goal object (pre-multi-goal versions) into an array', async () => {
    await AsyncStorage.setItem('@mw/goal', JSON.stringify({ name: 'Vacation', targetAmount: 1000, savedAmount: 250 }));

    const goals = await getGoals();

    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ id: 'default', name: 'Vacation', targetAmount: 1000, savedAmount: 250 });
  });

  it('persists the migrated goal so a later read no longer depends on the legacy key', async () => {
    await AsyncStorage.setItem('@mw/goal', JSON.stringify({ name: 'Vacation', targetAmount: 1000, savedAmount: 250 }));
    await getGoals(); // triggers migration + write to the new key

    await AsyncStorage.removeItem('@mw/goal'); // legacy key gone, as if already migrated earlier
    const goals = await getGoals();

    expect(goals).toHaveLength(1);
    expect(goals[0].name).toBe('Vacation');
  });

  it('does not touch the legacy key once the new array key already has data', async () => {
    await AsyncStorage.setItem('@mw/goal', JSON.stringify({ name: 'Old', targetAmount: 1, savedAmount: 0 }));
    await AsyncStorage.setItem('@mw/goals', JSON.stringify([{ id: 'x', name: 'Current', targetAmount: 500, savedAmount: 50 }]));

    const goals = await getGoals();

    expect(goals).toHaveLength(1);
    expect(goals[0].name).toBe('Current');
  });
});

describe('goal CRUD', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('addGoal appends a new goal with a generated id', async () => {
    const initial = await getGoals();
    const next = await addGoal({ name: 'New laptop', targetAmount: 1200, savedAmount: 0 });

    expect(next).toHaveLength(initial.length + 1);
    const added = next[next.length - 1];
    expect(added.name).toBe('New laptop');
    expect(added.id).toBeTruthy();
  });

  it('updateGoal patches only the matching goal', async () => {
    const afterAdd = await addGoal({ name: 'Laptop', targetAmount: 1200, savedAmount: 0 });
    const target = afterAdd[afterAdd.length - 1];

    const next = await updateGoal(target.id, { name: 'Gaming laptop' });

    const updated = next.find((g) => g.id === target.id)!;
    expect(updated.name).toBe('Gaming laptop');
    expect(updated.targetAmount).toBe(1200); // untouched field survives the patch
  });

  it('removeGoal removes only the matching goal, leaving the rest untouched', async () => {
    const afterFirst = await addGoal({ name: 'A', targetAmount: 100, savedAmount: 0 });
    const firstId = afterFirst[afterFirst.length - 1].id;
    const afterSecond = await addGoal({ name: 'B', targetAmount: 200, savedAmount: 0 });
    const secondId = afterSecond[afterSecond.length - 1].id;

    const next = await removeGoal(firstId);

    expect(next.find((g) => g.id === firstId)).toBeUndefined();
    expect(next.find((g) => g.id === secondId)).toBeDefined();
  });

  it('addToGoalSavings only credits the targeted goal and never goes negative', async () => {
    const afterFirst = await addGoal({ name: 'A', targetAmount: 100, savedAmount: 10 });
    const firstId = afterFirst[afterFirst.length - 1].id;
    const afterSecond = await addGoal({ name: 'B', targetAmount: 100, savedAmount: 10 });
    const secondId = afterSecond[afterSecond.length - 1].id;

    const next = await addToGoalSavings(firstId, 5);

    expect(next.find((g) => g.id === firstId)?.savedAmount).toBe(15);
    expect(next.find((g) => g.id === secondId)?.savedAmount).toBe(10); // untouched

    const afterWithdraw = await addToGoalSavings(firstId, -999);
    expect(afterWithdraw.find((g) => g.id === firstId)?.savedAmount).toBe(0); // clamped, not negative
  });
});
