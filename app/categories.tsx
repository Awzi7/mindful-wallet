import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import {
  DEFAULT_WEEKLY_BUDGET,
  addCustomCategory,
  getAverageWeeklyIncome,
  getCurrency,
  getCustomCategories,
  getTransactions,
  getWeeklyBudget,
  removeCustomCategory,
  setWeeklyBudget,
} from '@/lib/storage';
import { getAllCategoriesResolved } from '@/lib/categories';
import { suggestBudget } from '@/lib/budget';
import { getAveragePeriodIncome, getBudgetPeriod, setBudgetPeriod } from '@/lib/storage';
import { BUDGET_PERIODS, BudgetPeriod } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import {
  CURRENCY_META,
  CUSTOM_CATEGORY_COLOR_CHOICES,
  CUSTOM_CATEGORY_ICON_CHOICES,
  CurrencyCode,
  CustomCategory,
  WeeklyBudget,
} from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { usePremium, FREE_CUSTOM_CATEGORY_LIMIT, hasReachedFreeLimit } from '@/lib/premium';

export default function CategoriesScreen() {
  const { t } = useI18n();
  const { isPremium } = usePremium();
  const [budget, setBudget] = useState<WeeklyBudget>(DEFAULT_WEEKLY_BUDGET);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState(CUSTOM_CATEGORY_ICON_CHOICES[0]);
  const [newCategoryColor, setNewCategoryColor] = useState(CUSTOM_CATEGORY_COLOR_CHOICES[0]);
  const [categoryLimitNotice, setCategoryLimitNotice] = useState(false);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [budgetPeriod, setBudgetPeriodState] = useState<BudgetPeriod>('week');

  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const textColor = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getWeeklyBudget().then(setBudget);
      getCurrency().then(setCurrency);
      getCustomCategories().then(setCustomCategories);
      getBudgetPeriod().then(setBudgetPeriodState);
    }, [])
  );

  /**
   * Switching period keeps the stored limits as they are - they simply now mean "per month"
   * instead of "per week". Rescaling them behind the user's back would quietly change what
   * they had deliberately set.
   */
  const handleChangePeriod = async (period: BudgetPeriod) => {
    setBudgetPeriodState(period);
    setSuggestNotice(null);
    await setBudgetPeriod(period);
  };

  const allCategories = getAllCategoriesResolved(customCategories, t);

  const updateBudgetValue = (cat: string, value: string) => {
    const num = Number(value.replace(/[^0-9]/g, '')) || 0;
    const next = { ...budget, [cat]: num };
    setBudget(next);
    setWeeklyBudget(next);
  };

  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim()) return;
    if (hasReachedFreeLimit(isPremium, customCategories.length, FREE_CUSTOM_CATEGORY_LIMIT)) {
      setAddingCategory(false);
      setCategoryLimitNotice(true);
      return;
    }
    const nextCats = await addCustomCategory({
      label: newCategoryLabel.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
    });
    setCustomCategories(nextCats);
    setBudget(await getWeeklyBudget());
    setNewCategoryLabel('');
    setNewCategoryIcon(CUSTOM_CATEGORY_ICON_CHOICES[0]);
    setNewCategoryColor(CUSTOM_CATEGORY_COLOR_CHOICES[0]);
    setAddingCategory(false);
  };

  const handleRemoveCategory = async (id: string) => {
    const nextCats = await removeCustomCategory(id);
    setCustomCategories(nextCats);
    setBudget(await getWeeklyBudget());
  };

  const handleSuggestBudget = async () => {
    setSuggesting(true);
    setSuggestNotice(null);
    try {
      const transactions = await getTransactions();
      const suggestion = suggestBudget(transactions, allCategories.map((c) => c.id), budgetPeriod);
      if (Object.values(suggestion).every((v) => v === 0)) {
        setSuggestNotice(t('settings.suggestBudgetNoData'));
        return;
      }
      const next = { ...budget, ...suggestion };
      setBudget(next);
      await setWeeklyBudget(next);

      // If income has been logged, say what share of it this budget represents. Purely
      // informational - the app deliberately does not tell anyone what they should spend.
      // Must be income per the *same* period as the budget, or the share is off by ~4x.
      const avgIncome = await getAveragePeriodIncome(budgetPeriod);
      const budgetTotal = Object.values(next).reduce((s: number, v: number) => s + v, 0);
      const share =
        avgIncome > 0
          ? ' ' +
            t('settings.suggestBudgetIncomeShare', {
              pct: Math.round((budgetTotal / avgIncome) * 100),
              income: formatMoney(Math.round(avgIncome), currency),
              period: t(`budget.periodPer.${budgetPeriod}`),
            })
          : '';
      setSuggestNotice(t('settings.suggestBudgetApplied') + share);
    } finally {
      setSuggesting(false);
    }
  };

  const close = () => router.back();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8, backgroundColor: accentSoft }]}
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={18} color={accent} />
        </Pressable>

        <Text style={[styles.title, { marginTop: insets.top + 36 }]}>{t('budget.limitsTitle')}</Text>
        <Text style={[styles.subtitle, { color: subtle }]}>{t('settings.categoriesLinkSubtitle')}</Text>

        <View style={[styles.periodTrack, { borderColor: border }]}>
          {BUDGET_PERIODS.map((period) => {
            const active = budgetPeriod === period;
            return (
              <Pressable
                key={period}
                style={[styles.periodSegment, active && { backgroundColor: accentSoft }]}
                onPress={() => handleChangePeriod(period)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}>
                <Text style={[styles.periodSegmentText, { color: active ? accent : subtle }]} numberOfLines={1}>
                  {t(`budget.period.${period}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.subtitle, { color: subtle, marginTop: 8 }]}>{t('budget.periodHint')}</Text>

        <Pressable style={styles.suggestRow} onPress={handleSuggestBudget} disabled={suggesting}>
          {suggesting ? (
            <ActivityIndicator size="small" color={tint} />
          ) : (
            <Ionicons name="sparkles-outline" size={15} color={tint} />
          )}
          <Text style={{ color: tint, fontWeight: '600', fontSize: 13 }}>{t('settings.suggestBudget')}</Text>
        </Pressable>
        {suggestNotice && (
          <Text style={[styles.suggestNotice, { color: subtle }]}>{suggestNotice}</Text>
        )}

        <Card>
          {allCategories.map((cat) => (
            <View key={cat.id} style={styles.budgetRow}>
              <View style={styles.budgetLabelRow}>
                <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={16} color={cat.color} />
                <Text style={styles.budgetLabel}>{cat.label}</Text>
                {customCategories.some((c) => c.id === cat.id) && (
                  <Pressable
                    onPress={() => handleRemoveCategory(cat.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('common.remove')} ${cat.label}`}>
                    <Ionicons name="close" size={15} color={subtle} />
                  </Pressable>
                )}
              </View>
              <View style={styles.budgetInputRow}>
                <TextInput
                  style={[styles.budgetInput, { borderColor: border, color: textColor }]}
                  keyboardType="number-pad"
                  value={String(budget[cat.id] ?? 0)}
                  onChangeText={(v) => updateBudgetValue(cat.id, v)}
                />
                <Text style={[styles.smallText, { color: subtle }]}>{CURRENCY_META[currency].symbol}</Text>
              </View>
            </View>
          ))}

          {categoryLimitNotice && (
            <View style={[styles.infoBanner, { borderColor: accent, backgroundColor: accentSoft }]}>
              <View style={styles.infoBannerContent}>
                <Text style={[styles.infoBannerTitle, { color: accent }]}>{t('premium.limitCategoriesTitle')}</Text>
                <Text style={[styles.infoBannerBody, { color: subtle }]}>
                  {t('premium.limitCategoriesBody', { limit: FREE_CUSTOM_CATEGORY_LIMIT })}
                </Text>
                <Pressable
                  onPress={() => {
                    setCategoryLimitNotice(false);
                    router.push('/paywall');
                  }}>
                  <Text style={[styles.infoBannerLink, { color: accent }]}>{t('premium.upgradeLink')}</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setCategoryLimitNotice(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={16} color={subtle} />
              </Pressable>
            </View>
          )}

          {!addingCategory ? (
            <Pressable
              style={styles.addCategoryRow}
              onPress={() => {
                if (hasReachedFreeLimit(isPremium, customCategories.length, FREE_CUSTOM_CATEGORY_LIMIT)) {
                  setCategoryLimitNotice(true);
                  return;
                }
                setAddingCategory(true);
              }}>
              <Text style={{ color: tint, fontWeight: '600', fontSize: 13 }}>{t('settings.addCategory')}</Text>
            </Pressable>
          ) : (
            <View style={styles.newCategoryBox}>
              <TextInput
                style={[styles.input, { borderColor: border, color: textColor }]}
                placeholder={t('settings.newCategoryPlaceholder')}
                placeholderTextColor={subtle}
                value={newCategoryLabel}
                onChangeText={setNewCategoryLabel}
              />
              <View style={styles.pickerRow}>
                {CUSTOM_CATEGORY_ICON_CHOICES.map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => setNewCategoryIcon(icon)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: newCategoryIcon === icon }}
                    accessibilityLabel={icon.replace('-outline', '').replace(/-/g, ' ')}
                    style={[
                      styles.iconChoice,
                      {
                        borderColor: newCategoryIcon === icon ? newCategoryColor : border,
                        backgroundColor: newCategoryIcon === icon ? newCategoryColor + '22' : 'transparent',
                      },
                    ]}>
                    <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={newCategoryIcon === icon ? newCategoryColor : subtle} />
                  </Pressable>
                ))}
              </View>
              <View style={styles.pickerRow}>
                {CUSTOM_CATEGORY_COLOR_CHOICES.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setNewCategoryColor(color)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: newCategoryColor === color }}
                    accessibilityLabel={color}
                    style={[
                      styles.colorChoice,
                      { backgroundColor: color, borderColor: newCategoryColor === color ? textColor : 'transparent' },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.editRow}>
                <Pressable
                  style={[styles.smallButton, { backgroundColor: newCategoryLabel.trim() ? tint : border }]}
                  onPress={handleAddCategory}
                  disabled={!newCategoryLabel.trim()}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>{t('settings.newCategorySave')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallButton, { borderColor: border, borderWidth: 1 }]}
                  onPress={() => setAddingCategory(false)}>
                  <Text style={{ color: subtle }}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 36,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  periodTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    marginTop: 14,
  },
  periodSegment: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  periodSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  suggestNotice: {
    fontSize: 12,
    marginBottom: 12,
  },
  smallText: {
    fontSize: 11,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  budgetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetLabel: {
    fontSize: 14,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetInput: {
    width: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'right',
  },
  addCategoryRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 4,
  },
  newCategoryBox: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  iconChoice: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChoice: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  infoBannerBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  infoBannerLink: {
    fontWeight: '700',
    fontSize: 12,
    marginTop: 8,
  },
});
