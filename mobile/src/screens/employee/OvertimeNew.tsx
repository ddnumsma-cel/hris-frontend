import { addDays, formatDate, formatMinutes, manilaToday } from '@msma/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Screen, SectionTitle, T } from '~/components/ui';
import { DayPicker, daysBetween, DurationStepper, ReasonInput } from '~/components/form';
import { useFileOvertime } from '~/lib/queries';
import { useTheme } from '~/lib/theme';

/** File overtime: for a day already worked (last 2 weeks) or planned (next 2 weeks). */
export default function FileOvertimeScreen() {
  const { c } = useTheme();
  const file = useFileOvertime();
  const today = manilaToday();
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState(60);
  const [reason, setReason] = useState('');

  const submit = () =>
    file.mutate(
      { date, minutes, reason: reason.trim() },
      { onSuccess: () => router.replace('/employee/requests') },
    );

  return (
    <Screen>
      <SectionTitle>Day</SectionTitle>
      <DayPicker
        days={daysBetween(today, addDays(today, 14))}
        value={date}
        onChange={setDate}
        today={today}
      />

      <SectionTitle>How long</SectionTitle>
      <DurationStepper
        value={minutes}
        onChange={setMinutes}
        min={30}
        max={720}
        step={30}
        label="Overtime"
      />

      <Card tone="accent">
        <T weight="600">
          {formatMinutes(minutes)} of overtime on {formatDate(date)}
        </T>
        <T muted size={13} style={{ marginTop: 2 }}>
          Overtime is paid only after your manager approves it, and only for time the clock shows
          you worked.
        </T>
      </Card>

      <SectionTitle>Reason</SectionTitle>
      <ReasonInput value={reason} onChange={setReason} placeholder="e.g. Month-end closing" />

      {file.error && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{file.error.message}</T>
        </Card>
      )}
      <Button
        label="Send to my manager"
        icon="send"
        onPress={submit}
        loading={file.isPending}
        disabled={reason.trim().length < 3}
      />
    </Screen>
  );
}
