import { addDays, formatDate, formatTime, manilaToday } from '@msma/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Screen, SectionTitle, T } from '@/components/ui';
import { DayPicker, daysBetween, ReasonInput, TimeStepper } from '@/components/form';
import { useFileTimeAdjustment, useMyAttendance, useToday } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

/** Fix a missing or wrong time in / time out, e.g. "Forgot to time out". Approval updates the DTR. */
export default function FileTimeAdjustmentScreen() {
  const { c } = useTheme();
  const file = useFileTimeAdjustment();
  const attendance = useMyAttendance();
  const today = useToday();
  const todayKey = manilaToday();
  const [date, setDate] = useState(addDays(todayKey, -1));
  const [fixIn, setFixIn] = useState(false);
  const [fixOut, setFixOut] = useState(true);
  const [timeIn, setTimeIn] = useState(today.data?.shift.startTime ?? '08:00');
  const [timeOut, setTimeOut] = useState(today.data?.shift.endTime ?? '17:00');
  const [reason, setReason] = useState('');
  const record = attendance.data?.find((d) => d.date === date);

  const submit = () =>
    file.mutate(
      {
        date,
        timeIn: fixIn ? timeIn : undefined,
        timeOut: fixOut ? timeOut : undefined,
        reason: reason.trim(),
      },
      { onSuccess: () => router.replace('/requests') },
    );

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T weight="600">{label}</T>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: c.accent }}
      />
    </View>
  );

  return (
    <Screen>
      <SectionTitle>Day</SectionTitle>
      <DayPicker
        days={daysBetween(addDays(todayKey, -14), todayKey)}
        value={date}
        onChange={setDate}
        today={todayKey}
      />

      <Card>
        <T muted size={13}>
          The time clock shows for {formatDate(date)}:
        </T>
        <T weight="600" style={{ marginTop: 2 }}>
          Time in {record ? formatTime(record.timeIn) : '--:--'} · Time out{' '}
          {record ? formatTime(record.timeOut) : '--:--'}
        </T>
      </Card>

      {toggle('Correct my time in', fixIn, setFixIn)}
      {fixIn && <TimeStepper value={timeIn} onChange={setTimeIn} label="Correct time in" />}
      {toggle('Correct my time out', fixOut, setFixOut)}
      {fixOut && <TimeStepper value={timeOut} onChange={setTimeOut} label="Correct time out" />}

      <SectionTitle>Reason</SectionTitle>
      <ReasonInput value={reason} onChange={setReason} placeholder="e.g. Forgot to time out" />

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
        disabled={(!fixIn && !fixOut) || reason.trim().length < 3}
      />
    </Screen>
  );
}
