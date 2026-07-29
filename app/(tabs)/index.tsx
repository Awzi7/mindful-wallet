import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { HeroCard } from '@/components/HeroCard';
import { SectionHeader } from '@/components/SectionHeader';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { Confetti } from '@/components/Confetti';
import { HeatMapGrid } from '@/components/HeatMapGrid';
import { SpendingTrendChart } from '@/components/SpendingTrendChart';
import { CategoryBreakdownChart } from '@/components/CategoryBreakdownChart';
import { RecurringExpensesCard } from '@/components/RecurringExpensesCard';
import { detectRecurringExpenses } from '@/lib/recurring';
import { DailyCheckInModal } from '@/components/DailyCheckInModal';
import { HotspotPlacesCard } from '@/components/HotspotPlacesCard';
import {
  addPoints,
  addToGoalSavings,
  checkAchievements,
  getCachedDailyPrediction,
  getCurrency,
  getCustomCategories,
  getGamification,
  getPrimaryGoal,
  getHotspotPlaces,
  getTodayCheckIn,
  getTodayTransactions,
  getTransactions,
  getUnreadNotificationCount,
  getUserAvatar,
  getUserName,
  getWeeklyBudget,
  getWeeklySpendByCategory,
  loadDemoData,
  setCachedDailyPrediction,
  unlockAchievement,
} from '@/lib/storage';
import { buildHeatGrid, maxCellAmount, topHotSpots, describeHotSpot, dominantCategory, DAYPART_KEYS, HeatCell } from '@/lib/heatmap';
import { resolveCategoryIcon, resolveCategoryLabel } from '@/lib/categories';
import { sumOverKeys } from '@/lib/budget';
import { getDailyPrediction, getGeoHotspotArrival, getHotspotIntervention } from '@/lib/coach';
import { scheduleProactiveNudge, scheduleWeeklyRecap } from '@/lib/notifications';
import { distanceMeters, getCurrentCoords, hasLocationPermission } from '@/lib/location';
import { formatMoney } from '@/lib/format';
import { AIError } from '@/lib/ai';
import { useI18n } from '@/lib/i18n';
import { usePremium } from '@/lib/premium';
import { CurrencyCode, CustomCategory, Goal, Transaction, expensesOnly, sumAmount } from '@/lib/types';

export default function HomeScreen() {
  const { t, tArray } = useI18n();
  const { isPremium } = usePremium();
  const [userName, setUserNameState] = useState('');
  const [userAvatar, setUserAvatarState] = useState('');
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekBudgetTotal, setWeekBudgetTotal] = useState(0);
  const [weekSpentTotal, setWeekSpentTotal] = useState(0);
  const [topCategoryId, setTopCategoryId] = useState<string | null>(null);
  const [topCategoryAmount, setTopCategoryAmount] = useState(0);
  const [weekSpendByCategory, setWeekSpendByCategory] = useState<Record<string, number>>({});
  const [grid, setGrid] = useState<HeatCell[][] | null>(null);
  const [maxAmount, setMaxAmount] = useState(0);
  const [topSpot, setTopSpot] = useState<HeatCell | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  const [prediction, setPrediction] = useState<string | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [predictionIsKeyError, setPredictionIsKeyError] = useState(false);

  const [interventionText, setInterventionText] = useState<string | null>(null);
  const [interventionLoading, setInterventionLoading] = useState(false);
  const [interventionResolved, setInterventionResolved] = useState(false);

  const [checkInVisible, setCheckInVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasHistory, setHasHistory] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [autoDetected, setAutoDetected] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const didInit = useRef(false);
  const notifiedPlaceIds = useRef<Set<string>>(new Set());
  const geoCheckInFlight = useRef(false);
  const achievementCount = useRef<number | null>(null);

  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const screenBg = useThemeColor({}, 'background');
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    await checkAchievements();
    const [name, avatar, gam, g, todayTx, allTx, budget, weekSpend, checkIn, curr, customCats] = await Promise.all([
      getUserName(),
      getUserAvatar(),
      getGamification(),
      getPrimaryGoal(),
      getTodayTransactions(),
      getTransactions(),
      getWeeklyBudget(),
      getWeeklySpendByCategory(),
      getTodayCheckIn(),
      getCurrency(),
      getCustomCategories(),
    ]);
    setUserNameState(name);
    setUserAvatarState(avatar);
    setCurrencyState(curr);
    setCustomCategories(customCats);
    setPoints(gam.points);
    setStreak(gam.streak);
    setGoalState(g);

    if (achievementCount.current !== null && gam.achievements.length > achievementCount.current) {
      setConfettiKey(Date.now());
    }
    achievementCount.current = gam.achievements.length;
    setTodayTotal(sumAmount(expensesOnly(todayTx)));

    const budgetKeys = Object.keys(budget);
    const weekBudgetSum = sumOverKeys(budget, budgetKeys);
    const weekSpentSum = sumOverKeys(weekSpend, budgetKeys);
    setWeekBudgetTotal(weekBudgetSum);
    setWeekSpentTotal(weekSpentSum);
    setWeekSpendByCategory(weekSpend);

    if (weekBudgetSum > 0 || weekSpentSum > 0) {
      const recapPct = weekBudgetSum > 0 ? Math.round((weekSpentSum / weekBudgetSum) * 100) : 0;
      scheduleWeeklyRecap(
        t('notifications.weeklyRecapTitle'),
        t('notifications.weeklyRecapBody', {
          spent: formatMoney(weekSpentSum, curr),
          budget: formatMoney(weekBudgetSum, curr),
          pct: recapPct,
        })
      ).catch(() => {});
    }

    const [topEntry] = Object.entries(weekSpend).sort((a, b) => b[1] - a[1]);
    setTopCategoryId(topEntry && topEntry[1] > 0 ? topEntry[0] : null);
    setTopCategoryAmount(topEntry ? topEntry[1] : 0);

    const g2 = buildHeatGrid(allTx);
    setGrid(g2);
    setMaxAmount(maxCellAmount(g2));
    const [spot] = topHotSpots(g2, 1);
    setTopSpot(spot ?? null);
    setHasHistory(allTx.length > 0);
    setAllTransactions(allTx);

    if (!checkIn) setCheckInVisible(true);
  }, []);

  const handleLoadDemoData = async () => {
    setLoadingDemo(true);
    await loadDemoData({
      transport: t('demo.transport'),
      lunch: t('demo.lunch'),
      barWithFriends: t('demo.barWithFriends'),
      cinema: t('demo.cinema'),
      coffeeToGo: t('demo.coffeeToGo'),
      clothesPurchase: t('demo.clothesPurchase'),
      misc: t('demo.misc'),
    });
    await loadData();
    setLoadingDemo(false);
  };

  const loadPrediction = useCallback(async (force = false) => {
    if (!force) {
      const cached = await getCachedDailyPrediction();
      if (cached) {
        setPrediction(cached);
        return;
      }
    }
    setPredictionLoading(true);
    setPredictionError(null);
    setPredictionIsKeyError(false);
    try {
      const text = await getDailyPrediction(isPremium);
      setPrediction(text);
      await setCachedDailyPrediction(text);
    } catch (e) {
      if (e instanceof AIError) {
        setPredictionError(e.message);
        setPredictionIsKeyError(e.code === 'NO_API_KEY');
      } else {
        setPredictionError(t('errors.network'));
      }
    } finally {
      setPredictionLoading(false);
    }
  }, [t, isPremium]);

  const checkGeoProximity = useCallback(async () => {
    if (geoCheckInFlight.current) return;
    geoCheckInFlight.current = true;
    try {
      const places = await getHotspotPlaces();
      if (places.length === 0) return;
      const granted = await hasLocationPermission();
      if (!granted) return;
      const coords = await getCurrentCoords();
      if (!coords) return;

      const nearby = places.find(
        (p) => !notifiedPlaceIds.current.has(p.id) && distanceMeters(coords, { lat: p.lat, lng: p.lng }) <= p.radiusMeters
      );
      if (!nearby) return;

      notifiedPlaceIds.current.add(nearby.id);
      setAutoDetected(true);
      setInterventionLoading(true);
      setInterventionResolved(false);
      setInterventionText(null);
      try {
        const text = await getGeoHotspotArrival(nearby.label, isPremium);
        setInterventionText(text);
        await scheduleProactiveNudge(t('tabs.todayHeader'), text, 3);
      } catch {
        // Fail quietly — this is a background-ish check, manual button remains available.
      } finally {
        setInterventionLoading(false);
      }
    } finally {
      geoCheckInFlight.current = false;
    }
  }, [t, isPremium]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkGeoProximity();
      getUnreadNotificationCount().then(setUnreadNotifications);
      if (!didInit.current) {
        didInit.current = true;
        loadPrediction();
      }
    }, [loadData, loadPrediction, checkGeoProximity])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadPrediction(true);
    setRefreshing(false);
  };

  const handleSimulateHotspot = async () => {
    setAutoDetected(false);
    setInterventionLoading(true);
    setInterventionResolved(false);
    setInterventionText(null);
    try {
      const text = await getHotspotIntervention(isPremium);
      setInterventionText(text);
      await scheduleProactiveNudge(t('home.predictionTitle'), text, 5);
    } catch (e) {
      setInterventionText(e instanceof AIError ? e.message : t('errors.network'));
    } finally {
      setInterventionLoading(false);
    }
  };

  const handleFollowAdvice = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const state = await addPoints(15);
    if (goal) await addToGoalSavings(goal.id, 5);
    if (!state.achievements.some((a) => a.id === 'first-skip')) {
      await unlockAchievement('first-skip', { amount: formatMoney(5, currency) });
    }
    setInterventionResolved(true);
    await loadData();
  };

  const weekPct = weekBudgetTotal > 0 ? Math.min(100, (weekSpentTotal / weekBudgetTotal) * 100) : 0;
  const goalPct = goal ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
  const weekdayLabels = tArray('heatmap.weekdays');
  const recurringItems = useMemo(() => detectRecurringExpenses(allTransactions), [allTransactions]);
  const daypartLabels = DAYPART_KEYS.map((k) => t(`heatmap.${k}`));

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={[styles.headerIconButton, { backgroundColor: accentSoft }]}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.title')}>
          <Ionicons name="notifications-outline" size={20} color={accent} />
          {unreadNotifications > 0 && (
            <View style={[styles.notifBadge, { backgroundColor: '#E8577D', borderColor: screenBg }]}>
              <Text style={styles.notifBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => router.push('/settings')}
            style={[styles.headerIconButton, { backgroundColor: accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.settings')}>
            <Ionicons name="settings-outline" size={20} color={accent} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/add')}
            style={[styles.headerIconButton, { backgroundColor: tint }]}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.add')}>
            <Ionicons name="add" size={22} color="white" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <HeroCard
          gradient={isPremium ? 'gold' : 'sunset'}
          badge={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.badgeText}>⭐ {points}</Text>
              <Text style={[styles.badgeTextSubtle, { color: '#8C8074' }]}>· {streak}</Text>
            </View>
          }>
          <Text style={styles.greeting}>{t('home.greeting', { name: userName || t('common.friend'), avatar: userAvatar || '👋' })}</Text>
          <Text style={styles.today}>{t('home.spentToday', { amount: formatMoney(todayTotal, currency) })}</Text>
        </HeroCard>

        <View style={styles.quickLinksRow}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push('/how-it-works')}
            accessibilityRole="button"
            accessibilityLabel={t('howItWorks.homeLink')}>
            <Card style={styles.quickLinkTile}>
              <View style={[styles.tourIcon, { backgroundColor: accentSoft }]}>
                <Ionicons name="compass-outline" size={18} color={accent} />
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                {t('howItWorks.homeLink')}
              </Text>
            </Card>
          </Pressable>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push('/categories')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.categoriesLinkTitle')}>
            <Card style={styles.quickLinkTile}>
              <View style={[styles.tourIcon, { backgroundColor: accentSoft }]}>
                <Ionicons name="pricetags-outline" size={18} color={accent} />
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                {t('settings.categoriesLinkTitle')}
              </Text>
            </Card>
          </Pressable>
        </View>

        {!hasHistory && (
          <Card style={{ borderColor: accent, borderWidth: 1 }}>
            <Text style={styles.cardTitle}>{t('home.noHistoryTitle')}</Text>
            <Text style={[styles.bodyText, { color: subtle, marginBottom: 12 }]}>{t('home.noHistoryBody')}</Text>
            <Pressable
              style={[styles.secondaryButton, { borderColor: accent }]}
              onPress={handleLoadDemoData}
              disabled={loadingDemo}>
              {loadingDemo ? (
                <ActivityIndicator color={accent} />
              ) : (
                <Text style={{ color: accent, fontWeight: '700' }}>{t('home.loadDemoData')}</Text>
              )}
            </Pressable>
          </Card>
        )}

        <Card>
          <SectionHeader icon="bulb-outline" title={t('home.predictionTitle')} />
          {predictionLoading ? (
            <ActivityIndicator style={{ marginVertical: 8 }} />
          ) : predictionError ? (
            <View style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.errorText, { color: subtle }]}>{predictionError}</Text>
              {predictionIsKeyError && (
                <Link href="/settings" asChild>
                  <Pressable style={styles.linkButton}>
                    <Text style={{ color: tint, fontWeight: '600' }}>{t('home.openSettings')}</Text>
                  </Pressable>
                </Link>
              )}
            </View>
          ) : (
            <Text style={styles.bodyText}>{prediction}</Text>
          )}
        </Card>

        <Pressable onPress={() => router.push('/categories')} accessibilityRole="button" accessibilityLabel={t('home.weeklyBudget')}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{t('home.weeklyBudget')}</Text>
              <View style={styles.rowInline}>
                <Text style={[styles.smallText, { color: subtle }]}>
                  {formatMoney(weekSpentTotal, currency)} / {formatMoney(weekBudgetTotal, currency)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={subtle} />
              </View>
            </View>
            <AnimatedProgressBar progress={weekPct} trackColor={border} fillColor={weekPct > 90 ? '#E86E6E' : tint} />
            <View style={styles.rowBetween}>
              <Text style={[styles.smallText, { color: subtle, marginTop: 6 }]}>{t('home.percentOfLimit', { pct: Math.round(weekPct) })}</Text>
              {topCategoryId && (
                <View style={[styles.topCategoryPill, { backgroundColor: accentSoft, marginTop: 6 }]}>
                  <Ionicons name={resolveCategoryIcon(topCategoryId, customCategories) as keyof typeof Ionicons.glyphMap} size={11} color={accent} />
                  <Text style={[styles.topCategoryText, { color: accent }]}>
                    {resolveCategoryLabel(topCategoryId, customCategories, t)} · {formatMoney(topCategoryAmount, currency)}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </Pressable>

        {Object.values(weekSpendByCategory).some((v) => v > 0) && (
          <Card>
            <CategoryBreakdownChart
              spendByCategory={weekSpendByCategory}
              customCategories={customCategories}
              currency={currency}
            />
          </Card>
        )}

        {recurringItems.length > 0 && (
          <Card>
            <RecurringExpensesCard items={recurringItems} customCategories={customCategories} currency={currency} />
          </Card>
        )}

        {goal && (
          <Pressable onPress={() => router.push('/(tabs)/goals')} accessibilityRole="button" accessibilityLabel={goal.name}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{goal.name}</Text>
                <View style={styles.rowInline}>
                  <Text style={[styles.goalPctText, { color: tint }]}>{Math.round(goalPct)}%</Text>
                  <Ionicons name="chevron-forward" size={14} color={subtle} />
                </View>
              </View>
              <AnimatedProgressBar progress={goalPct} trackColor={border} fillColor={tint} />
              <Text style={[styles.smallText, { color: subtle, marginTop: 6 }]}>
                {t('home.goalOutOf', { saved: formatMoney(goal.savedAmount, currency), target: formatMoney(goal.targetAmount, currency) })}
              </Text>
            </Card>
          </Pressable>
        )}

        {allTransactions.length > 0 && (
          <Card>
            <SpendingTrendChart transactions={allTransactions} currency={currency} />
          </Card>
        )}

        <Card>
          <SectionHeader icon="map-outline" title={t('home.heatmapTitle')} subtitle={t('home.heatmapSubtitle')} />
          {grid && <HeatMapGrid grid={grid} maxAmount={maxAmount} />}
          {topSpot && (
            <View style={[styles.riskPill, { backgroundColor: accentSoft, marginTop: 12 }]}>
              <Text style={[styles.riskPillText, { color: accent }]}>
                {t('home.mainRiskSpot', {
                  spot: describeHotSpot(topSpot, weekdayLabels, daypartLabels),
                  category: (() => {
                    const catId = dominantCategory(topSpot);
                    return catId ? resolveCategoryLabel(catId, customCategories, t) : '';
                  })(),
                })}
              </Text>
            </View>
          )}
        </Card>

        <HotspotPlacesCard />

        <Card>
          <SectionHeader icon="pulse-outline" title={t('home.realtimeCheckTitle')} subtitle={t('home.realtimeCheckSubtitle')} />
          <Pressable
            style={[styles.secondaryButton, { borderColor: tint, marginTop: 4 }]}
            onPress={handleSimulateHotspot}
            disabled={interventionLoading}>
            {interventionLoading ? (
              <ActivityIndicator color={tint} />
            ) : (
              <Text style={{ color: tint, fontWeight: '700' }}>{t('home.checkManually')}</Text>
            )}
          </Pressable>
          {interventionText && (
            <View style={{ backgroundColor: 'transparent', marginTop: 12 }}>
              {autoDetected && (
                <View style={[styles.riskPill, { backgroundColor: accentSoft, marginBottom: 8 }]}>
                  <Text style={[styles.riskPillText, { color: accent }]}>{t('home.geoDetectedBadge')}</Text>
                </View>
              )}
              <Text style={styles.bodyText}>{interventionText}</Text>
              {!interventionResolved ? (
                <View style={styles.choiceRow}>
                  <Pressable style={[styles.choiceButton, { backgroundColor: tint }]} onPress={handleFollowAdvice}>
                    <Text style={styles.choiceButtonTextPrimary}>{t('home.followAdvice')}</Text>
                  </Pressable>
                  <Pressable style={[styles.choiceButton, { borderColor: border, borderWidth: 1 }]} onPress={() => setInterventionResolved(true)}>
                    <Text style={{ color: subtle }}>{t('common.skip')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.smallText, { color: tint, marginTop: 8 }]}>
                  {t('home.adviceSuccess', { amount: formatMoney(5, currency) })}
                </Text>
              )}
            </View>
          )}
        </Card>

        <DailyCheckInModal
          visible={checkInVisible}
          onDone={() => {
            setCheckInVisible(false);
            loadData();
          }}
        />
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  notifBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontSize: 21,
    fontWeight: '700',
    color: 'white',
  },
  today: {
    fontSize: 13,
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#241C16',
  },
  badgeTextSubtle: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickLinkTile: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  quickLinkTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tourIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPctText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  linkButton: {
    marginTop: 8,
  },
  smallText: {
    fontSize: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  choiceButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choiceButtonTextPrimary: {
    color: 'white',
    fontWeight: '700',
  },
  riskPill: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  riskPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
