import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { MonthCalendar, dateKey } from '@/components/MonthCalendar';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { getCurrency, getCustomCategories, getTransactions } from '@/lib/storage';
import { resolveCategoryIcon, resolveCategoryLabel } from '@/lib/categories';
import {
  CurrencyCode,
  CustomCategory,
  Transaction,
  expensesOnly,
  incomeOnly,
  isIncome,
  sumAmount,
} from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LOCALE_MAP } from '@/lib/i18n/dictionaries';
import { usePremium } from '@/lib/premium';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function HistoryScreen() {
  const { t, tArray, language } = useI18n();
  const { isPremium } = usePremium();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState<string>(() => dateKey(new Date()));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [monthLockedNotice, setMonthLockedNotice] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [wholeMonth, setWholeMonth] = useState(false);

  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const positive = useThemeColor({}, 'positive');

  const loadTransactions = useCallback(() => {
    getTransactions().then(setTransactions);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
      getCustomCategories().then(setCustomCategories);
      getCurrency().then(setCurrency);
    }, [loadTransactions])
  );

  const handleTxChanged = () => {
    setEditingTx(null);
    loadTransactions();
  };

  const isCurrentRealMonth = useMemo(() => {
    const now = startOfMonth(new Date());
    return monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
  }, [monthDate]);

  const monthLabel = useMemo(() => {
    let raw: string;
    try {
      raw = new Intl.DateTimeFormat(LOCALE_MAP[language] ?? 'en-US', { month: 'long', year: 'numeric' }).format(monthDate);
    } catch {
      raw = `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [monthDate, language]);

  const weekdayLabels = tArray('heatmap.weekdays');

  const monthTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const d = new Date(tx.createdAt);
        return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
      }),
    [transactions, monthDate]
  );

  const monthTotal = sumAmount(expensesOnly(monthTransactions));
  const monthIncome = sumAmount(incomeOnly(monthTransactions));
  const monthNet = monthIncome - monthTotal;

  /** Categories actually present this month, so the filter never offers an empty option. */
  const monthCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of monthTransactions) {
      if (!seen.has(tx.category)) seen.set(tx.category, resolveCategoryLabel(tx.category, customCategories, t));
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [monthTransactions, customCategories, t]);

  const trimmedQuery = query.trim().toLowerCase();

  /**
   * A search or category filter is inherently cross-day, so an active filter switches the list
   * to the whole month - otherwise a match on another day would look like "nothing found".
   */
  const showWholeMonth = wholeMonth || trimmedQuery !== '' || categoryFilter !== null;

  const matchesQuery = useCallback(
    (tx: Transaction) => {
      if (!trimmedQuery) return true;
      const label = resolveCategoryLabel(tx.category, customCategories, t).toLowerCase();
      return (
        label.includes(trimmedQuery) ||
        (tx.place ?? '').toLowerCase().includes(trimmedQuery) ||
        (tx.note ?? '').toLowerCase().includes(trimmedQuery)
      );
    },
    [trimmedQuery, customCategories, t]
  );

  const visibleTransactions = useMemo(
    () =>
      monthTransactions
        .filter((tx) => (showWholeMonth ? true : dateKey(new Date(tx.createdAt)) === selectedKey))
        .filter((tx) => (categoryFilter ? tx.category === categoryFilter : true))
        .filter(matchesQuery)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [monthTransactions, showWholeMonth, selectedKey, categoryFilter, matchesQuery]
  );

  const visibleSpend = sumAmount(expensesOnly(visibleTransactions));
  const hasFilters = trimmedQuery !== '' || categoryFilter !== null;

  const clearFilters = () => {
    setQuery('');
    setCategoryFilter(null);
  };

  const goPrevMonth = () => {
    if (!isPremium) {
      setMonthLockedNotice(true);
      return;
    }
    const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    setMonthDate(prev);
    setSelectedKey('');
  };

  const goNextMonth = () => {
    if (isCurrentRealMonth) return;
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    setMonthDate(next);
    setSelectedKey('');
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card>
        <View style={styles.monthNavRow}>
          <Pressable
            style={[styles.navButton, { backgroundColor: accentSoft }]}
            onPress={goPrevMonth}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('history.prevMonth')}>
            <Ionicons name="chevron-back" size={18} color={accent} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            style={[styles.navButton, { backgroundColor: accentSoft, opacity: isCurrentRealMonth ? 0.35 : 1 }]}
            onPress={goNextMonth}
            disabled={isCurrentRealMonth}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('history.nextMonth')}
            accessibilityState={{ disabled: isCurrentRealMonth }}>
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </Pressable>
        </View>
        <Text style={[styles.monthTotal, { color: subtle }]}>
          {t('history.monthTotal', { month: monthLabel, amount: formatMoney(monthTotal, currency) })}
        </Text>
        {monthIncome > 0 && (
          <Text style={[styles.monthTotal, { color: subtle, marginTop: -10 }]}>
            {t('history.monthIncome', { amount: formatMoney(monthIncome, currency) })}
            {'  ·  '}
            <Text style={{ color: monthNet >= 0 ? positive : accent, fontWeight: '700' }}>
              {t('history.monthNet', { amount: formatMoney(monthNet, currency) })}
            </Text>
          </Text>
        )}

        {monthLockedNotice && (
          <View style={[styles.infoBanner, { borderColor: accent, backgroundColor: accentSoft }]}>
            <View style={styles.infoBannerContent}>
              <Text style={[styles.infoBannerTitle, { color: accent }]}>{t('history.lockedMonthTitle')}</Text>
              <Text style={[styles.infoBannerBody, { color: subtle }]}>{t('history.lockedMonthBody')}</Text>
              <Pressable
                onPress={() => {
                  setMonthLockedNotice(false);
                  router.push('/paywall');
                }}>
                <Text style={[styles.infoBannerLink, { color: accent }]}>{t('premium.upgradeLink')}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setMonthLockedNotice(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={16} color={subtle} />
            </Pressable>
          </View>
        )}

        <MonthCalendar
          monthDate={monthDate}
          transactions={monthTransactions}
          selectedKey={selectedKey}
          onSelectDate={setSelectedKey}
          weekdayLabels={weekdayLabels}
        />
        <Text style={[styles.hint, { color: subtle }]}>{t('history.selectDayHint')}</Text>
      </Card>

      <Card variant="quiet">
        <View style={[styles.searchBox, { borderColor: border }]}>
          <Ionicons name="search" size={16} color={subtle} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={subtle}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {hasFilters && (
            <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('history.searchClear')}>
              <Ionicons name="close-circle" size={17} color={subtle} />
            </Pressable>
          )}
        </View>

        {monthCategories.length > 1 && (
          <View style={styles.filterRow}>
            <Pill label={t('history.filterAll')} active={categoryFilter === null} onPress={() => setCategoryFilter(null)} />
            {monthCategories.map((cat) => (
              <Pill
                key={cat.id}
                label={cat.label}
                icon={resolveCategoryIcon(cat.id, customCategories) as keyof typeof Ionicons.glyphMap}
                active={categoryFilter === cat.id}
                onPress={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
              />
            ))}
          </View>
        )}

        <View style={[styles.viewTrack, { borderColor: border }]}>
          {[
            { key: false, labelKey: 'history.viewByDay' },
            { key: true, labelKey: 'history.viewWholeMonth' },
          ].map((option) => {
            const active = showWholeMonth === option.key;
            return (
              <Pressable
                key={String(option.key)}
                style={[styles.viewSegment, active && { backgroundColor: accentSoft }]}
                onPress={() => {
                  setWholeMonth(option.key);
                  if (!option.key) clearFilters(); // going back to day view drops the cross-day filters
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}>
                <Text style={[styles.viewSegmentText, { color: active ? accent : subtle }]} numberOfLines={1}>
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {hasFilters && (
          <Text style={[styles.resultsLine, { color: subtle }]}>
            {t('history.resultsCount', { count: visibleTransactions.length, amount: formatMoney(visibleSpend, currency) })}
          </Text>
        )}
      </Card>

      <Card>
        {visibleTransactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: subtle }]}>
            {hasFilters ? t('history.noResults') : t('history.noTransactionsForDay')}
          </Text>
        ) : (
          visibleTransactions.map((tx, i) => {
            const label = resolveCategoryLabel(tx.category, customCategories, t);
            const icon = resolveCategoryIcon(tx.category, customCategories);
            const txDate = new Date(tx.createdAt);
            const time = txDate.toLocaleTimeString(LOCALE_MAP[language] ?? 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const dayMonth = `${txDate.getDate()}.${txDate.getMonth() + 1}`;
            return (
              <Pressable
                key={tx.id}
                onPress={() => setEditingTx(tx)}
                style={[styles.txRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <View style={[styles.txIcon, { backgroundColor: accentSoft }]}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  <Text style={[styles.txSub, { color: subtle }]}>
                    {showWholeMonth ? `${dayMonth} · ${time}` : time}
                    {tx.place ? ` · ${tx.place}` : ''}
                  </Text>
                  {tx.note ? (
                    <Text style={[styles.txNote, { color: subtle }]} numberOfLines={2}>
                      {tx.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.txAmount, isIncome(tx) && { color: positive }]}>
                  {isIncome(tx) ? '+' : ''}
                  {formatMoney(tx.amount, currency)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={subtle} style={{ marginLeft: 4 }} />
              </Pressable>
            );
          })
        )}
      </Card>

      <EditTransactionModal
        transaction={editingTx}
        currency={currency}
        onClose={() => setEditingTx(null)}
        onSaved={handleTxChanged}
        onDeleted={handleTxChanged}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthTotal: {
    fontSize: 12,
    marginBottom: 14,
  },
  hint: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  txSub: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  viewTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginTop: 12,
  },
  viewSegment: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultsLine: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
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
