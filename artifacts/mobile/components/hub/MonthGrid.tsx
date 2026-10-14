import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** How many dots a day cell shows before it stops adding more. */
const MAX_DOTS = 3;

export interface DayMarkers {
  /** Events starting (or running) that day. */
  events: number;
  /** Reminders due that day. */
  reminders: number;
}

interface Props {
  month: Date;
  selected: Date;
  /** Keyed by `yyyy-MM-dd`, so a day's markers can be looked up without scanning. */
  markers: Record<string, DayMarkers>;
  onMonthChange: (month: Date) => void;
  onSelect: (day: Date) => void;
}

export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A plain month grid, built here rather than pulled in as a package so it can follow the app's
 * own theme and show both kinds of marker.
 */
export function MonthGrid({ month, selected, markers, onMonthChange, onSelect }: Props) {
  const { colors } = useTheme();

  const weeks = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: first, end: last });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.bar}>
        <TouchableOpacity
          onPress={() => onMonthChange(addMonths(month, -1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Icon name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: colors.foreground }]}>{format(month, 'MMMM yyyy')}</Text>
        <TouchableOpacity
          onPress={() => onMonthChange(addMonths(month, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Icon name="chevron-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={s.row}>
        {WEEKDAYS.map((label, i) => (
          <Text key={i} style={[s.weekday, { color: colors.mutedForeground }]}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.row}>
          {week.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const today = isToday(day);
            const mark = markers[dayKey(day)];
            const dots: string[] = [];
            for (let i = 0; i < Math.min(mark?.events ?? 0, MAX_DOTS); i++) dots.push(colors.primary);
            for (let i = 0; i < Math.min(mark?.reminders ?? 0, MAX_DOTS - dots.length); i++) {
              dots.push(colors.secondary);
            }

            return (
              <TouchableOpacity
                key={day.toISOString()}
                onPress={() => onSelect(day)}
                style={s.cell}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={
                  `${format(day, 'EEEE d MMMM')}` +
                  (mark ? `, ${mark.events} events, ${mark.reminders} reminders` : ', nothing planned')
                }
              >
                <View
                  style={[
                    s.cellInner,
                    isSelected && { backgroundColor: colors.primary },
                    !isSelected && today && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      s.dayNumber,
                      {
                        color: isSelected
                          ? '#fff'
                          : inMonth
                            ? colors.foreground
                            : colors.mutedForeground,
                        fontFamily: today || isSelected ? 'Inter_700Bold' : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
                <View style={s.dots}>
                  {dots.map((colour, i) => (
                    <View
                      key={i}
                      style={[s.dot, { backgroundColor: isSelected ? '#fff' : colour }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: colors.primary }]} />
          <Text style={[s.legendText, { color: colors.mutedForeground }]}>Events</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: colors.secondary }]} />
          <Text style={[s.legendText, { color: colors.mutedForeground }]}>Reminders</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  monthLabel: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_600SemiBold', paddingBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  cellInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 13.5 },
  dots: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
