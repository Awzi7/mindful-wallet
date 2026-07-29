import { StyleSheet, View } from 'react-native';
import { Text } from './Themed';
import { useThemeColor } from './Themed';
import { DAYPART_KEYS, HeatCell, currentDaypartIndex, currentWeekdayIndex } from '@/lib/heatmap';
import { useI18n } from '@/lib/i18n';

function cellColor(intensity: number, tint: string): string {
  if (intensity <= 0) return 'transparent';
  const alpha = Math.round(24 + intensity * 200)
    .toString(16)
    .padStart(2, '0');
  return `${tint}${alpha}`;
}

export function HeatMapGrid({ grid, maxAmount }: { grid: HeatCell[][]; maxAmount: number }) {
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const { t, tArray } = useI18n();
  const todayW = currentWeekdayIndex();
  const nowP = currentDaypartIndex();
  const weekdayLabels = tArray('heatmap.weekdays');
  const daypartLabels = DAYPART_KEYS.map((k) => t(`heatmap.${k}`));

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.cornerCell} />
        {weekdayLabels.map((label, i) => (
          <Text
            key={label}
            style={[styles.weekdayLabel, { color: i === todayW ? tint : subtle, fontWeight: i === todayW ? '700' : '400' }]}>
            {label}
          </Text>
        ))}
      </View>
      {daypartLabels.map((label, pIdx) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.daypartLabel, { color: subtle }]}>{label}</Text>
          {grid.map((col, wIdx) => {
            const cell = col[pIdx];
            const intensity = maxAmount > 0 ? cell.amount / maxAmount : 0;
            const isNow = wIdx === todayW && pIdx === nowP;
            return (
              <View
                key={wIdx}
                style={[
                  styles.cell,
                  {
                    backgroundColor: cellColor(intensity, tint),
                    borderColor: isNow ? tint : border,
                    borderWidth: isNow ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL_SIZE = 32;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cornerCell: {
    width: 44,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    marginHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  daypartLabel: {
    width: 44,
    fontSize: 11,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    marginHorizontal: 2,
  },
});
