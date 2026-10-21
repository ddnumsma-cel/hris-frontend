import { Ionicons } from '@expo/vector-icons';
import { addDays, DateKey, formatDate, formatMinutes, weekdayOf } from '@msma/shared';
import { useEffect, useRef, useState } from 'react';
import { parseTime } from '~/lib/timeText';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '~/lib/theme';
import { font, mono, T } from './ui';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A selectable pill (radio behaviour). */
export function Chip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          borderColor: selected ? c.accent : c.border,
          backgroundColor: selected ? c.accentSoft : c.fieldBg,
        },
      ]}
    >
      <T weight="600" size={14} style={selected ? { color: c.accent } : undefined}>
        {label}
      </T>
      {sub && (
        <T muted size={12}>
          {sub}
        </T>
      )}
    </Pressable>
  );
}

/** Every calendar day from `from` to `to` (inclusive). */
export function daysBetween(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A horizontal row of day chips, e.g. "28 Sep / Mon". `today` is labelled "Today". */
export function DayPicker({
  days,
  value,
  onChange,
  today,
}: {
  days: DateKey[];
  value: DateKey;
  onChange: (d: DateKey) => void;
  today: DateKey;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((d) => (
        <Chip
          key={d}
          label={formatDate(d).replace(/ \d{4}$/, '')}
          sub={d === today ? 'Today' : DAY[weekdayOf(d)]}
          selected={value === d}
          onPress={() => onChange(d)}
        />
      ))}
    </ScrollView>
  );
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

function Stepper({
  display,
  label,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  display: string;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  const { c } = useTheme();
  const button = (icon: 'remove' | 'add', onPress: () => void, disabled?: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'add' ? 'Later / more' : 'Earlier / less'}: ${label}`}
      style={[
        styles.stepButton,
        { borderColor: c.border, backgroundColor: c.fieldBg, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Ionicons name={icon} size={26} color={c.accent} />
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${display}`}>
      {button('remove', onMinus, minusDisabled)}
      <T size={30} weight="600" style={[mono, { minWidth: 140, textAlign: 'center' }]}>
        {display}
      </T>
      {button('add', onPlus, plusDisabled)}
    </View>
  );
}

/**
 * A time of day ("HH:mm", 24-hour), exact to the minute: − and + move it 1 minute a tap; holding one keeps going
 * (1 minute at a time, then 5 after a moment); tapping the time lets you type it.
 */
export function TimeStepper({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { c } = useTheme();
  const [typing, setTyping] = useState<string | null>(null);
  // The latest value and setter, for the repeat timer (it outlives a render).
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const step = (by: number) => latest.current.onChange(toHhmm(toMinutes(latest.current.value) + by));
  // Whether this press already moved the time (a very quick tap can skip the press-start on some devices).
  const moved = useRef(false);
  const start = (dir: 1 | -1) => {
    moved.current = true;
    step(dir);
    let count = 0;
    const tick = () => {
      count++;
      step(dir * (count > 20 ? 5 : 1));
      timer.current = setTimeout(tick, count > 20 ? 120 : 70);
    };
    timer.current = setTimeout(tick, 450);
  };

  const button = (dir: 1 | -1) => (
    <Pressable
      onPressIn={() => start(dir)}
      onPressOut={stop}
      onPress={() => {
        if (!moved.current) step(dir);
        moved.current = false;
      }}
      accessibilityRole="button"
      accessibilityLabel={`${dir > 0 ? 'One minute later' : 'One minute earlier'}: ${label}`}
      accessibilityHint="Hold to keep going"
      style={({ pressed }) => [styles.stepButton, { borderColor: c.border, backgroundColor: pressed ? c.accentSoft : c.fieldBg }]}
    >
      <Ionicons name={dir > 0 ? 'add' : 'remove'} size={26} color={c.accent} />
    </Pressable>
  );

  const commit = () => {
    const t = parseTime(typing ?? '');
    if (t) onChange(t);
    setTyping(null);
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.stepper}>
        {button(-1)}
        {typing === null ? (
          <Pressable onPress={() => setTyping(value)} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Tap to type a time`} style={{ minWidth: 140, alignItems: 'center' }}>
            <T size={30} weight="600" style={mono}>
              {value}
            </T>
          </Pressable>
        ) : (
          <TextInput
            value={typing}
            onChangeText={setTyping}
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            selectTextOnFocus
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            placeholder="HH:MM"
            placeholderTextColor={c.muted}
            accessibilityLabel={`${label}, as HH:MM`}
            style={[styles.timeInput, font('600'), mono, { color: c.text, borderColor: c.accent, backgroundColor: c.fieldBg }]}
          />
        )}
        {button(1)}
      </View>
      <T size={12} muted style={{ textAlign: 'center' }}>
        Tap the time to type it · hold − or + to move faster
      </T>
    </View>
  );
}

/** A duration in minutes, changed in `step` steps between `min` and `max`. */
export function DurationStepper({
  value,
  onChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
}) {
  return (
    <Stepper
      display={formatMinutes(value)}
      label={label}
      onMinus={() => onChange(Math.max(min, value - step))}
      onPlus={() => onChange(Math.min(max, value + step))}
      minusDisabled={value <= min}
      plusDisabled={value >= max}
    />
  );
}

export function ReasonInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { c } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      multiline
      maxLength={300}
      accessibilityLabel="Reason"
      style={[styles.input, font(), { borderColor: c.border, backgroundColor: c.fieldBg, color: c.text }]}
    />
  );
}

export { toMinutes, toHhmm };

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  timeInput: { minWidth: 140, fontSize: 30, textAlign: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 4 },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
