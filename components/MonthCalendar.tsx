import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useThemeColor } from './Themed';
import { Transaction, isExpense } from '@/lib/types';

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  total: number;
  isToday: boolean;
}

function buildMonthGrid(monthDate: Date, totalsByDay: Map<string, number>): DayCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(year, month, 1 - mondayOffset);

  const now = new Date();
  const todayKey = dateKey(now);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = dateKey(d);
    cells.push({
      date: d,
      key,
      inMonth: d.getMonth() === month,
      total: totalsByDay.get(key) ?? 0,
      isToday: key === todayKey,
    });
  }
  return cells;
}

export function MonthCalendar({
  monthDate,
  transactions,
  selectedKey,
  onSelectDate,
  weekdayLabels,
}: {
  monthDate: Date;
  transactions: Transaction[];
  selectedKey: string | null;
  onSelectDate: (key: string) => void;
  weekdayLabels: string[];
}) {
  const tint = useThemeColor({}, 'tint');
  const subtle = useThemeColor({}, 'subtle');
  const border = useThemeColor({}, 'border');
  const ink = useThemeColor({}, 'text');

  // Spend only: the day cells are a spending heat map, so a payday must not paint itself as
  // the month's biggest "spending" day (and must not inflate maxTotal, which would wash out
  // every real spending day by comparison).
  const totalsByDay = new Map<string, number>();
  for (const tx of transactions) {
    if (!isExpense(tx)) continue;
    const d = new Date(tx.createdAt);
    if (d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()) {
      const key = dateKey(d);
      totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + tx.amount);
    }
  }
  const maxTotal = Math.max(...Array.from(totalsByDay.values()), 1);
  const cells = buildMonthGrid(monthDate, totalsByDay);

  return (
    <View>
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={[styles.weekdayLabel, { color: subtle }]}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell) => {
          const intensity = cell.total > 0 ? Math.min(1, cell.total / maxTotal) : 0;
          const isSelected = cell.key === selectedKey;
          const bg = intensity > 0 ? `${tint}${Math.round(28 + intensity * 180).toString(16).padStart(2, '0')}` : 'transparent';
          return (
            <Pressable
              key={cell.key}
              disabled={!cell.inMonth}
              onPress={() => onSelectDate(cell.key)}
              accessibilityRole="button"
              accessibilityLabel={cell.date.toDateString()}
              accessibilityState={{ selected: isSelected, disabled: !cell.inMonth }}
              style={[
                styles.cell,
                {
                  backgroundColor: bg,
                  borderColor: isSelected ? tint : cell.isToday ? tint : 'transparent',
                  borderWidth: isSelected ? 2 : cell.isToday ? 1.5 : 0,
                  opacity: cell.inMonth ? 1 : 0.25,
                },
              ]}>
              <Text style={[styles.cellText, { color: ink }]}>{cell.date.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
