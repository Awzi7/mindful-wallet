import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text, useThemeColor } from './Themed';
import { buildCategoryBreakdown } from '@/lib/budget';
import { getAllCategoriesResolved } from '@/lib/categories';
import { formatMoney } from '@/lib/format';
import { CurrencyCode, CustomCategory } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const SIZE = 128;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_LEGEND_ROWS = 5;

export function CategoryBreakdownChart({
  spendByCategory,
  customCategories,
  currency,
}: {
  spendByCategory: Record<string, number>;
  customCategories: CustomCategory[];
  currency: CurrencyCode;
}) {
  const { t } = useI18n();
  const border = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtle');
  const textColor = useThemeColor({}, 'text');

  const slices = useMemo(() => buildCategoryBreakdown(spendByCategory), [spendByCategory]);
  const resolved = useMemo(() => getAllCategoriesResolved(customCategories, t), [customCategories, t]);
  const lookup = (id: string) => resolved.find((r) => r.id === id);

  if (slices.length === 0) return null;

  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = (slice.pct / 100) * CIRCUMFERENCE;
    const arc = { ...slice, length, dashOffset: -offset };
    offset += length;
    return arc;
  });

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('home.categoryBreakdownTitle')}</Text>
        <Text style={[styles.smallText, { color: subtle }]}>{formatMoney(total, currency)}</Text>
      </View>
      <View style={styles.row}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={border} strokeWidth={STROKE} fill="none" />
          {arcs.map((arc) => (
            <Circle
              key={arc.id}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={lookup(arc.id)?.color ?? subtle}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={arc.dashOffset}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          ))}
        </Svg>
        <View style={styles.legend}>
          {slices.slice(0, MAX_LEGEND_ROWS).map((slice) => {
            const meta = lookup(slice.id);
            return (
              <View key={slice.id} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: meta?.color ?? subtle }]} />
                <Text style={[styles.legendLabel, { color: textColor }]} numberOfLines={1}>
                  {meta?.label ?? slice.id}
                </Text>
                <Text style={[styles.legendPct, { color: subtle }]}>{slice.pct}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  smallText: {
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '600',
  },
});
