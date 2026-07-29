import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, useThemeColor } from './Themed';
import { resolveCategoryIcon, resolveCategoryLabel } from '@/lib/categories';
import { formatMoney } from '@/lib/format';
import { RecurringExpense } from '@/lib/recurring';
import { CurrencyCode, CustomCategory } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const MAX_ROWS = 3;

export function RecurringExpensesCard({
  items,
  customCategories,
  currency,
}: {
  items: RecurringExpense[];
  customCategories: CustomCategory[];
  currency: CurrencyCode;
}) {
  const { t } = useI18n();
  const subtle = useThemeColor({}, 'subtle');
  const tint = useThemeColor({}, 'tint');

  return (
    <View>
      <Text style={styles.title}>{t('home.recurringTitle')}</Text>
      {items.slice(0, MAX_ROWS).map((item) => {
        const label = resolveCategoryLabel(item.category, customCategories, t);
        const icon = resolveCategoryIcon(item.category, customCategories);
        const next = new Date(item.nextEstimate);
        const nextLabel = `${next.getDate()}.${next.getMonth() + 1}`;
        return (
          <View key={`${item.category}-${item.place ?? ''}`} style={styles.row}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={tint} />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.place ? `${item.place} · ${label}` : label} · {formatMoney(item.amount, currency)}
            </Text>
            <Text style={[styles.nextText, { color: subtle }]}>{t('home.recurringNext', { date: nextLabel })}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
  },
  nextText: {
    fontSize: 11,
  },
});
