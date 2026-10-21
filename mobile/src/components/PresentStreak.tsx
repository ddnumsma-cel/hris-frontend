// The employee's present streak on Home: consecutive work days they clocked in (late still counts as present),
// with a five-week heatmap of their attendance. An absence breaks the streak; rest days, holidays and leave are
// skipped (they neither count nor break it). The HR server shares the last 14 days, so older cells show as
// "no record" and the streak counts back at most that far.
//
// Pieces: SummaryCard (PresentStreak) · OdometerNumber · Heatmap. Motion follows the phone's reduce-motion setting.

import { addDays, radius, weekdayOf, type DateKey } from '@msma/shared';
import { presentStreak, WORKDAY_OFF, type AttendanceDay } from '~/lib/streak';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '~/lib/theme';
import { mono, T } from './ui';

const INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** A number that rolls like an odometer when it changes: old and new stacked in a 1.25em box, sliding up (down when counting down) with a small overshoot. */
export function OdometerNumber({ value, size, color, weight = '700' }: { value: number; size: number; color: string; weight?: '600' | '700' }) {
  const reduced = useReducedMotion();
  const [pair, setPair] = useState<[number, number]>([value, value]);
  const y = useRef(new Animated.Value(0)).current;
  const last = useRef(value);
  const h = Math.round(size * 1.25);

  useEffect(() => {
    if (value === last.current) return;
    const up = value > last.current;
    setPair(up ? [last.current, value] : [value, last.current]);
    last.current = value;
    if (reduced) {
      y.setValue(up ? -h : 0);
      return;
    }
    y.setValue(up ? 0 : -h);
    Animated.spring(y, { toValue: up ? -h : 0, useNativeDriver: true, damping: 11, stiffness: 140, mass: 0.8 }).start();
  }, [value, reduced, h, y]);

  const text = (n: number) => (
    <T size={size} weight={weight} style={[mono, { color, height: h, lineHeight: h }]}>
      {n}
    </T>
  );
  return (
    <View style={{ height: h, overflow: 'hidden' }} accessible accessibilityLabel={String(value)}>
      <Animated.View style={{ transform: [{ translateY: y }] }} importantForAccessibility="no-hide-descendants">
        {text(pair[0])}
        {text(pair[1])}
      </Animated.View>
    </View>
  );
}

type Cell = { date: DateKey; kind: 'future' | 'none' | 'off' | 'absent' | 'present'; level: number; today: boolean };

function cellsFor(days: AttendanceDay[], today: DateKey): Cell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  // Weeks start on Monday; the last row is this week.
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const first = addDays(monday, -28);
  const rows: Cell[][] = [];
  for (let w = 0; w < 5; w++) {
    const row: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(first, w * 7 + i);
      const day = byDate.get(date);
      const isToday = date === today;
      if (date > today) row.push({ date, kind: 'future', level: 0, today: false });
      else if (!day) row.push({ date, kind: 'none', level: 0, today: isToday });
      else if (day.timeIn) row.push({ date, kind: 'present', level: day.lateMinutes > 0 ? 2 : 4, today: isToday });
      else if (WORKDAY_OFF.has(day.status) || isToday) row.push({ date, kind: 'off', level: 0, today: isToday });
      else row.push({ date, kind: 'absent', level: 0, today: isToday });
    }
    rows.push(row);
  }
  return rows;
}

function HeatCell({ cell }: { cell: Cell }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(cell.level);
  // Today's cell pops when it changes (e.g. after clocking in).
  useEffect(() => {
    if (!cell.today || prev.current === cell.level) return;
    prev.current = cell.level;
    if (reduced) return;
    scale.setValue(0.7);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [cell.level, cell.today, reduced, scale]);

  // Levels 0–4 from the pale tint to the full accent (the website's accent tint mixed up to --accent).
  const LEVELS = [c.tint, c.accentSoft, c.accent + '80', c.accent + 'BF', c.accent];
  const style =
    cell.kind === 'future'
      ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: c.border, backgroundColor: 'transparent' }
      : cell.kind === 'none'
        ? { borderWidth: 1, borderColor: c.line, backgroundColor: 'transparent' }
        : cell.kind === 'absent'
          ? { backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger + '55' }
          : { backgroundColor: LEVELS[cell.level] };
  return (
    <Animated.View
      style={[
        styles.cell,
        style,
        cell.today && { borderWidth: 2, borderColor: c.text, borderStyle: 'solid' },
        { transform: [{ scale }] },
      ]}
    />
  );
}

export function Heatmap({ days, today }: { days: AttendanceDay[]; today: DateKey }) {
  const { c } = useTheme();
  const rows = cellsFor(days, today);
  const flat = rows.flat();
  const present = flat.filter((x) => x.kind === 'present').length;
  const absent = flat.filter((x) => x.kind === 'absent').length;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Attendance, last five weeks: ${present} days present, ${absent} absent. The HR server shares the last two weeks.`} style={{ gap: 4 }}>
      <View style={styles.week}>
        {INITIALS.map((d, i) => (
          <T key={i} size={10} weight="500" muted style={{ width: 17, textAlign: 'center' }}>
            {d}
          </T>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.week}>
          {row.map((cell) => (
            <HeatCell key={cell.date} cell={cell} />
          ))}
        </View>
      ))}
      <View style={[styles.week, { justifyContent: 'flex-start', gap: 4, marginTop: 2, alignItems: 'center' }]}>
        <T size={9} muted>
          Less
        </T>
        {[c.tint, c.accentSoft, c.accent + '80', c.accent + 'BF', c.accent].map((bg) => (
          <View key={bg} style={[styles.key, { backgroundColor: bg }]} />
        ))}
        <T size={9} muted>
          More
        </T>
      </View>
    </View>
  );
}

export function PresentStreak({ days, today }: { days: AttendanceDay[]; today: DateKey }) {
  const { c, dark, look } = useTheme();
  const streak = presentStreak(days, today);
  const todayRow = days.find((d) => d.date === today);
  const inToday = !!todayRow?.timeIn;
  const offToday = !!todayRow && WORKDAY_OFF.has(todayRow.status);

  // This week so far: work days that have happened (today once clocked in) and how many had a time-in.
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const week = days.filter((d) => d.date >= monday && d.date <= today && !WORKDAY_OFF.has(d.status) && (d.date !== today || d.timeIn));
  const weekPresent = week.filter((d) => d.timeIn).length;

  const caption = inToday ? 'Present today' : offToday ? 'Day off today' : 'Clock in to keep it going';
  return (
    <View style={[styles.card, look.card(c, dark), { borderRadius: look.cardRadius + 8 }]}>
      <View style={styles.head}>
        <T size={11} weight="500" muted style={styles.upper}>
          Attendance
        </T>
        <View accessibilityLiveRegion="polite" style={[styles.pill, { backgroundColor: c.accentSoft }]}>
          <T size={12} weight="600" style={{ color: c.accent }}>
            {weekPresent} of {week.length} days this week
          </T>
        </View>
      </View>
      <View style={styles.body}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <T size={13} weight="500" muted>
            Present streak
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <OdometerNumber value={streak} size={46} color={c.text} />
            <T size={14} weight="600" muted style={{ marginBottom: 10 }}>
              {streak === 1 ? 'day' : 'days'}
            </T>
          </View>
          <T size={12} weight="600" style={{ color: inToday ? c.success : c.muted }}>
            {caption}
          </T>
          <T size={11} muted style={{ marginTop: 4 }}>
            Last 2 weeks shown
          </T>
        </View>
        <Heatmap days={days} today={today} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.panel, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  body: { flexDirection: 'row', gap: 12 },
  week: { flexDirection: 'row', gap: 4 },
  cell: { width: 17, height: 17, borderRadius: 5 },
  key: { width: 9, height: 9, borderRadius: 3 },
});

