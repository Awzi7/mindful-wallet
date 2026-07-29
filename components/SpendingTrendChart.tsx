import { useMemo, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Text, useThemeColor } from './Themed';
import { getDailySpendSeries, getMonthlySpendSeries, getWeeklySpendSeries } from '@/lib/trends';
import { formatMoney } from '@/lib/format';
import { CurrencyCode, Transaction } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const CHART_HEIGHT = 110;
const CHART_PADDING_TOP = 14;
const BUBBLE_WIDTH = 96;

type Range = '7d' | 'month' | '6m' | 'year';
const RANGES: { key: Range; labelKey: string }[] = [
  { key: '7d', labelKey: 'trend.range7d' },
  { key: 'month', labelKey: 'trend.rangeMonth' },
  { key: '6m', labelKey: 'trend.range6m' },
  { key: 'year', labelKey: 'trend.rangeYear' },
];

export function SpendingTrendChart({ transactions, currency }: { transactions: Transaction[]; currency: CurrencyCode }) {
  const { t, tArray } = useI18n();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [range, setRange] = useState<Range>('7d');
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const background = useThemeColor({}, 'background');

  const weekdayLabels = tArray('heatmap.weekdays');

  // Daily granularity reads fine for a week or a month (≤31 points); longer ranges would produce
  // too many points for a small chart, so 6 months aggregates into weeks and a year into months.
  const series = useMemo(() => {
    if (range === '7d') return getDailySpendSeries(transactions, weekdayLabels, 7);
    if (range === 'month') return getDailySpendSeries(transactions, weekdayLabels, 30);
    if (range === '6m') return getWeeklySpendSeries(transactions, 26);
    return getMonthlySpendSeries(transactions, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, transactions]);

  // When real history is much shorter than the requested range, plotting the full empty window
  // produces a long flat line with all the action crammed into the last few points. Trim leading
  // all-zero buckets (keeping one for a baseline) so the chart fills its space with real data.
  const plotSeries = useMemo(() => {
    const firstActive = series.findIndex((p) => p.total > 0);
    if (firstActive <= 1) return series;
    return series.slice(firstActive - 1);
  }, [series]);

  const maxValue = Math.max(...plotSeries.map((p) => p.total), 1);
  const stepX = plotSeries.length > 1 ? width / (plotSeries.length - 1) : 0;
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP;

  const points = plotSeries.map((p, i) => ({
    x: i * stepX,
    y: CHART_PADDING_TOP + usableHeight - (p.total / maxValue) * usableHeight,
    ...p,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`
      : '';

  const todayIndex = plotSeries.length - 1;
  const periodTotal = series.reduce((s, p) => s + p.total, 0);
  const activeIndex = selectedIndex ?? todayIndex;
  const activePoint = points[activeIndex] as (typeof points)[number] | undefined;
  const showDots = plotSeries.length <= 7;

  const handleTouch = (e: GestureResponderEvent) => {
    if (stepX <= 0 || points.length === 0) return;
    const x = e.nativeEvent.locationX;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(x / stepX)));
    setSelectedIndex(idx);
  };

  const selectRange = (next: Range) => {
    if (next === range) return;
    Haptics.selectionAsync();
    setRange(next);
    setSelectedIndex(null);
  };

  const bubbleLeft = activePoint ? Math.max(0, Math.min(width - BUBBLE_WIDTH, activePoint.x - BUBBLE_WIDTH / 2)) : 0;

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('trend.title')}</Text>
        <Text style={[styles.smallText, { color: subtle }]}>{t('trend.totalCaption', { amount: formatMoney(periodTotal, currency) })}</Text>
      </View>
      <View style={[styles.segmentTrack, { backgroundColor: background, borderColor: border }]} accessibilityRole="radiogroup">
        {RANGES.map(({ key, labelKey }) => {
          const active = range === key;
          return (
            <Pressable
              key={key}
              onPress={() => selectRange(key)}
              style={[styles.segment, active && { backgroundColor: card }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t(labelKey)}>
              <Text
                style={[styles.segmentLabel, { color: active ? tint : subtle, fontWeight: active ? '700' : '500' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View
        style={{ height: CHART_HEIGHT + 40 }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Pressable
            onPress={handleTouch}
            style={{ height: CHART_HEIGHT }}
            accessibilityRole="adjustable"
            accessibilityLabel={t('trend.title')}>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tint} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={tint} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {areaPath && <Path d={areaPath} fill="url(#fillGrad)" />}
              {linePath && <Path d={linePath} stroke={tint} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
              {activePoint && (
                <Line x1={activePoint.x} y1={0} x2={activePoint.x} y2={CHART_HEIGHT} stroke={border} strokeWidth={1} strokeDasharray="3,4" />
              )}
              {points.map((p, i) => (
                <Circle
                  key={p.date}
                  cx={p.x}
                  cy={p.y}
                  r={i === activeIndex ? 5 : showDots ? 2.5 : 0}
                  fill={i === activeIndex ? tint : 'white'}
                  stroke={tint}
                  strokeWidth={1.5}
                />
              ))}
            </Svg>
            {activePoint && (
              <View
                style={[
                  styles.bubble,
                  {
                    left: bubbleLeft,
                    top: Math.max(0, activePoint.y - 38),
                    backgroundColor: card,
                    borderColor: border,
                    pointerEvents: 'none',
                  },
                ]}>
                <Text style={styles.bubbleLabel}>{activePoint.label}</Text>
                <Text style={[styles.bubbleAmount, { color: tint }]}>{formatMoney(activePoint.total, currency)}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
      <View style={styles.axisRow}>
        <Text style={[styles.smallText, { color: subtle }]}>{plotSeries[0]?.label}</Text>
        <Text style={[styles.smallText, { color: subtle }]}>{t('trend.today', { label: plotSeries[plotSeries.length - 1]?.label ?? '' })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  smallText: {
    fontSize: 11,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentLabel: {
    fontSize: 12,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  bubbleLabel: {
    fontSize: 10,
    opacity: 0.7,
  },
  bubbleAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
