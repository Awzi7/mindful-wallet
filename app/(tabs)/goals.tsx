import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { HeroCard } from '@/components/HeroCard';
import { SectionHeader } from '@/components/SectionHeader';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { Confetti } from '@/components/Confetti';
import {
  addGoal,
  addPoints,
  addToGoalSavings,
  checkAchievements,
  getCurrency,
  getGamification,
  getGoals,
  removeGoal,
  updateGoal,
} from '@/lib/storage';
import { Achievement, CURRENCY_META, CurrencyCode, Goal } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const QUICK_AMOUNTS = [10, 25, 50];

export default function GoalsScreen() {
  const { t } = useI18n();
  const [goals, setGoalsState] = useState<Goal[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [editingGoal, setEditingGoal] = useState<Goal | 'new' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [targetDraft, setTargetDraft] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [confettiKey, setConfettiKey] = useState(0);
  const achievementCount = useRef<number | null>(null);

  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const load = useCallback(async () => {
    await checkAchievements();
    const [g, gam, curr] = await Promise.all([getGoals(), getGamification(), getCurrency()]);
    setGoalsState(g);
    setPoints(gam.points);
    setStreak(gam.streak);
    setAchievements([...gam.achievements].reverse());
    setCurrency(curr);

    if (achievementCount.current !== null && gam.achievements.length > achievementCount.current) {
      setConfettiKey(Date.now());
    }
    achievementCount.current = gam.achievements.length;
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleQuickAdd = async (id: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addToGoalSavings(id, amount);
    await addPoints(10);
    await load();
  };

  const startEdit = (g: Goal) => {
    setNameDraft(g.name);
    setTargetDraft(String(g.targetAmount));
    setConfirmingDelete(false);
    setEditingGoal(g);
  };

  const startCreate = () => {
    setNameDraft('');
    setTargetDraft('');
    setConfirmingDelete(false);
    setEditingGoal('new');
  };

  const canSaveGoal = nameDraft.trim().length > 0 && Number(targetDraft.replace(/[^0-9]/g, '')) > 0;

  const saveEdit = async () => {
    if (!editingGoal || !canSaveGoal) return;
    const target = Number(targetDraft.replace(/[^0-9]/g, ''));
    const name = nameDraft.trim();
    if (editingGoal === 'new') {
      await addGoal({ name, targetAmount: target, savedAmount: 0 });
    } else {
      await updateGoal(editingGoal.id, { name, targetAmount: target });
    }
    setEditingGoal(null);
    await load();
  };

  const handleDelete = async () => {
    if (!editingGoal || editingGoal === 'new') return;
    await removeGoal(editingGoal.id);
    setEditingGoal(null);
    setConfirmingDelete(false);
    await load();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {editingGoal && (
          <Card>
            <Text style={styles.formTitle}>{editingGoal === 'new' ? t('goals.newGoalTitle') : t('goals.editGoalTitle')}</Text>
            <Text style={styles.label}>{t('goals.goalNameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: border, color: textColor }]}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
            />
            <Text style={styles.label}>{t('goals.goalAmountLabel', { symbol: CURRENCY_META[currency].symbol })}</Text>
            <TextInput
              style={[styles.input, { borderColor: border, color: textColor }]}
              keyboardType="number-pad"
              value={targetDraft}
              onChangeText={setTargetDraft}
            />
            <View style={styles.editRow}>
              <Pressable
                style={[styles.smallButton, { backgroundColor: canSaveGoal ? tint : border }]}
                onPress={saveEdit}
                disabled={!canSaveGoal}>
                <Text style={styles.smallButtonTextPrimary}>{t('common.save')}</Text>
              </Pressable>
              <Pressable style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]} onPress={() => setEditingGoal(null)}>
                <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
            {editingGoal !== 'new' &&
              (confirmingDelete ? (
                <View style={[styles.confirmBox, { borderColor: accent }]}>
                  <Text style={[styles.confirmText, { color: accent }]}>{t('goals.deleteGoalConfirmTitle')}</Text>
                  <View style={styles.confirmRow}>
                    <Pressable style={[styles.smallButton, { backgroundColor: accent }]} onPress={handleDelete}>
                      <Text style={styles.smallButtonTextPrimary}>{t('common.remove')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
                      onPress={() => setConfirmingDelete(false)}>
                      <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.deleteLink} onPress={() => setConfirmingDelete(true)}>
                  <Text style={{ color: accent, fontWeight: '600' }}>{t('goals.deleteGoal')}</Text>
                </Pressable>
              ))}
          </Card>
        )}

        {!editingGoal && goals.length === 0 && (
          <Card style={{ alignItems: 'center' }}>
            <Text style={[styles.smallText, { color: subtle, textAlign: 'center' }]}>{t('goals.emptyState')}</Text>
          </Card>
        )}

        {!editingGoal &&
          goals.map((g, index) => {
            const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;

            if (index === 0) {
              return (
                <HeroCard
                  key={g.id}
                  gradient="berry"
                  badgePosition="bottom-right"
                  badge={<Text style={styles.badgeText}>{Math.round(pct)}%</Text>}
                  style={{ marginBottom: goals.length > 1 ? 16 : 32 }}>
                  <View style={styles.rowBetween}>
                    <View style={styles.heroTitleRow}>
                      <Ionicons name="flag-outline" size={17} color="white" style={{ marginRight: 8 }} />
                      <Text style={[styles.heroCardTitle, { flexShrink: 1 }]}>{g.name}</Text>
                    </View>
                    <Pressable onPress={() => startEdit(g)}>
                      <Text style={styles.editLink}>{t('goals.changeLink')}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.heroCardSubtitle}>
                    {t('goals.goalOutOf', { saved: formatMoney(g.savedAmount, currency), target: formatMoney(g.targetAmount, currency) })}
                  </Text>
                  <AnimatedProgressBar progress={pct} trackColor="rgba(255,255,255,0.35)" fillColor="white" />
                  <Text style={[styles.label, { marginTop: 18, color: 'rgba(255,255,255,0.85)' }]}>
                    {t('goals.contributeManually')}
                  </Text>
                  <View style={styles.quickRow}>
                    {QUICK_AMOUNTS.map((amt) => (
                      <Pressable key={amt} style={styles.quickChip} onPress={() => handleQuickAdd(g.id, amt)}>
                        <Text style={styles.quickChipText}>+{formatMoney(amt, currency)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </HeroCard>
              );
            }

            return (
              <Card key={g.id}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{g.name}</Text>
                  <View style={styles.plainHeaderRight}>
                    <Text style={[styles.goalPctText, { color: tint }]}>{Math.round(pct)}%</Text>
                    <Pressable onPress={() => startEdit(g)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('goals.changeLink')}>
                      <Ionicons name="create-outline" size={16} color={subtle} />
                    </Pressable>
                  </View>
                </View>
                <AnimatedProgressBar progress={pct} trackColor={border} fillColor={tint} />
                <Text style={[styles.smallText, { color: subtle, marginTop: 6 }]}>
                  {t('goals.goalOutOf', { saved: formatMoney(g.savedAmount, currency), target: formatMoney(g.targetAmount, currency) })}
                </Text>
                <View style={[styles.quickRow, { marginTop: 12 }]}>
                  {QUICK_AMOUNTS.map((amt) => (
                    <Pressable key={amt} style={[styles.quickChipPlain, { borderColor: border }]} onPress={() => handleQuickAdd(g.id, amt)}>
                      <Text style={{ color: tint, fontWeight: '700', fontSize: 12 }}>+{formatMoney(amt, currency)}</Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            );
          })}

        {!editingGoal && (
          <Pressable style={styles.addGoalRow} onPress={startCreate}>
            <Ionicons name="add-circle-outline" size={18} color={tint} />
            <Text style={{ color: tint, fontWeight: '600', marginLeft: 6 }}>{t('goals.addGoal')}</Text>
          </Pressable>
        )}

        <Card>
          <SectionHeader icon="trending-up-outline" title={t('goals.progressTitle')} />
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{points}</Text>
              <Text style={[styles.smallText, { color: subtle }]}>{t('goals.points')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={[styles.smallText, { color: subtle }]}>{t('goals.streakDays')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{achievements.length}</Text>
              <Text style={[styles.smallText, { color: subtle }]}>{t('goals.achievementsCount')}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <SectionHeader icon="trophy-outline" title={t('goals.achievementsTitle')} />
            <Link href="/modal" asChild>
              <Pressable>
                <Text style={{ color: tint, fontSize: 13 }}>{t('goals.all')}</Text>
              </Pressable>
            </Link>
          </View>
          {achievements.length === 0 ? (
            <Text style={[styles.smallText, { color: subtle }]}>{t('goals.emptyAchievements')}</Text>
          ) : (
            achievements.slice(0, 3).map((a) => (
              <View key={a.id} style={styles.achievementRow}>
                <View style={[styles.achievementIcon, { backgroundColor: accentSoft }]}>
                  <Ionicons name="trophy" size={16} color={accent} />
                </View>
                <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                  <Text style={styles.achievementTitle}>{t(`achievements.${a.id}.title`)}</Text>
                  <Text style={[styles.smallText, { color: subtle }]}>{t(`achievements.${a.id}.description`, a.params)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
      <Confetti triggerKey={confettiKey} onDone={() => setConfettiKey(0)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  smallText: {
    fontSize: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  smallButtonTextPrimary: {
    color: 'white',
    fontWeight: '700',
  },
  deleteLink: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 6,
  },
  confirmBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    alignItems: 'center',
  },
  confirmText: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  plainHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  goalPctText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  heroCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    marginBottom: 14,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#241C16',
  },
  editLink: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickChip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: {
    color: 'white',
    fontWeight: '700',
  },
  quickChipPlain: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
  },
  achievementIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});
