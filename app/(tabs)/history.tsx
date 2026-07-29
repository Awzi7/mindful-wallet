import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from '@/components/Themed';
import { Card } from '@/components/Card';
import { MonthCalendar, dateKey } from '@/components/MonthCalendar';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { getCurrency, getCustomCategories, getTransactions } from '@/lib/storage';
import { resolveCategoryIcon, resolveCategoryLabel } from '@/lib/categories';
import { CurrencyCode, CustomCategory, Transaction } from '@/lib/types';
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

  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

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

  const monthTotal = monthTransactions.reduce((s, tx) => s + tx.amount, 0);

  const dayTransactions = useMemo(
    () =>
      monthTransactions
        .filter((tx) => dateKey(new Date(tx.createdAt)) === selectedKey)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [monthTransactions, selectedKey]
  );

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

      <Card>
        {dayTransactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: subtle }]}>{t('history.noTransactionsForDay')}</Text>
        ) : (
          dayTransactions.map((tx, i) => {
            const label = resolveCategoryLabel(tx.category, customCategories, t);
            const icon = resolveCategoryIcon(tx.category, customCategories);
            const time = new Date(tx.createdAt).toLocaleTimeString(LOCALE_MAP[language] ?? 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
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
                    {time}
                    {tx.place ? ` · ${tx.place}` : ''}
                  </Text>
                </View>
                <Text style={styles.txAmount}>{formatMoney(tx.amount, currency)}</Text>
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
