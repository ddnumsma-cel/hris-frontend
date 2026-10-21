import { addDays, DateKey, formatDate, manilaToday, weekdayOf } from '@msma/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Screen, SectionTitle, T } from '@/components/ui';
import { useFileLeave, useLeaveBalances } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const TYPES = [
  { code: 'VL', label: 'Vacation' },
  { code: 'SL', label: 'Sick' },
  { code: 'SIL', label: 'Service incentive' },
] as const;
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Mon–Sat dates from `from` (inclusive) for the next `count` days. */
function workDates(from: DateKey, count: number): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; out.length < count; d = addDays(d, 1)) if (weekdayOf(d) !== 0) out.push(d);
  return out;
}

function Chip({
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
          backgroundColor: selected ? c.accentSoft : c.card,
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

export default function FileLeaveScreen() {
  const { c } = useTheme();
  const balances = useLeaveBalances();
  const fileLeave = useFileLeave();
  const [type, setType] = useState<'VL' | 'SL' | 'SIL'>('VL');
  const today = manilaToday();
  // Sick leave can be filed for recent past days; other leave from today onwards.
  const startOptions = useMemo(
    () => workDates(type === 'SL' ? addDays(today, -7) : today, 24),
    [type, today],
  );
  const [start, setStart] = useState<DateKey>(startOptions[0]);
  const [end, setEnd] = useState<DateKey>(startOptions[0]);
  const [reason, setReason] = useState('');
  const endOptions = useMemo(() => workDates(start, 10), [start]);
  const days = endOptions.indexOf(end) + 1;
  const remaining = balances.data?.find((b) => b.leaveTypeCode === type)?.remaining;

  const pickStart = (d: DateKey) => {
    setStart(d);
    if (end < d) setEnd(d);
    else if (!workDates(d, 10).includes(end)) setEnd(d);
  };

  const submit = () =>
    fileLeave.mutate(
      { leaveTypeCode: type, startDate: start, endDate: end, reason: reason.trim() },
      { onSuccess: () => router.replace('/requests') },
    );

  const label = (d: DateKey) => `${DAY[weekdayOf(d)]}`;
  const short = (d: DateKey) => formatDate(d).replace(/ \d{4}$/, '');

  return (
    <Screen>
      <SectionTitle>Type of leave</SectionTitle>
      <View style={styles.wrap}>
        {TYPES.map((t) => (
          <Chip
            key={t.code}
            label={t.label}
            sub={`${balances.data?.find((b) => b.leaveTypeCode === t.code)?.remaining ?? '…'} days left`}
            selected={type === t.code}
            onPress={() => setType(t.code)}
          />
        ))}
      </View>

      <SectionTitle>First day</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {startOptions.map((d) => (
          <Chip
            key={d}
            label={short(d)}
            sub={label(d)}
            selected={start === d}
            onPress={() => pickStart(d)}
          />
        ))}
      </ScrollView>

      <SectionTitle>Last day</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {endOptions.map((d) => (
          <Chip
            key={d}
            label={short(d)}
            sub={label(d)}
            selected={end === d}
            onPress={() => setEnd(d)}
          />
        ))}
      </ScrollView>

      <Card tone="accent">
        <T weight="600">
          {days} working day{days === 1 ? '' : 's'}: {formatDate(start)}
          {end !== start ? ` to ${formatDate(end)}` : ''}
        </T>
        {remaining !== undefined && (
          <T muted size={13} style={{ marginTop: 2 }}>
            You have {remaining} days of {TYPES.find((t) => t.code === type)!.label.toLowerCase()}{' '}
            leave left. Holidays are not counted.
          </T>
        )}
      </Card>

      <SectionTitle>Reason</SectionTitle>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. Family event in Bohol"
        placeholderTextColor={c.muted}
        multiline
        maxLength={300}
        accessibilityLabel="Reason"
        style={[styles.input, { borderColor: c.border, backgroundColor: c.card, color: c.text }]}
      />

      {fileLeave.error && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{fileLeave.error.message}</T>
        </Card>
      )}
      <Button
        label="Send to my manager"
        icon="send"
        onPress={submit}
        loading={fileLeave.isPending}
        disabled={reason.trim().length < 3}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
