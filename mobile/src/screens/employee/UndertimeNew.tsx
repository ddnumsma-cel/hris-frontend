import { addDays, formatDate, formatMinutes, manilaToday } from '@msma/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Card, Loading, Screen, SectionTitle, T } from '~/components/ui';
import {
  DayPicker,
  daysBetween,
  ReasonInput,
  TimeStepper,
  toHhmm,
  toMinutes,
} from '~/components/form';
import { useFileUndertime, useToday } from '~/lib/queries';
import { useTheme } from '~/lib/theme';

/** Ask to leave before the shift ends (a doctor's appointment, an errand). */
export default function FileUndertimeScreen() {
  const { c } = useTheme();
  const today = useToday();
  const file = useFileUndertime();
  const todayKey = manilaToday();
  const [date, setDate] = useState(todayKey);
  const [leaveTime, setLeaveTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const shift = today.data?.shift;

  // Start two hours before the shift ends.
  useEffect(() => {
    if (shift && !leaveTime) setLeaveTime(toHhmm(toMinutes(shift.endTime) - 120));
  }, [shift, leaveTime]);

  if (!shift || !leaveTime) return <Loading />;

  const overnight = shift.endTime <= shift.startTime;
  const endM = toMinutes(shift.endTime) + (overnight ? 1440 : 0);
  const leaveM = toMinutes(leaveTime) + (overnight && leaveTime < shift.startTime ? 1440 : 0);
  const early = endM - leaveM;
  const valid = early > 0 && leaveM > toMinutes(shift.startTime);

  const submit = () =>
    file.mutate(
      { date, leaveTime, reason: reason.trim() },
      { onSuccess: () => router.replace('/employee/requests') },
    );

  return (
    <Screen>
      <SectionTitle>Day</SectionTitle>
      <DayPicker
        days={daysBetween(addDays(todayKey, -7), addDays(todayKey, 14))}
        value={date}
        onChange={setDate}
        today={todayKey}
      />

      <SectionTitle>I will leave at</SectionTitle>
      <TimeStepper value={leaveTime} onChange={setLeaveTime} label="Leave time" />

      <Card tone="accent">
        {valid ? (
          <>
            <T weight="600">
              Leave {formatMinutes(early)} early on {formatDate(date)}
            </T>
            <T muted size={13} style={{ marginTop: 2 }}>
              Your shift is {shift.startTime} to {shift.endTime}. The early minutes are not paid;
              approval means it is allowed.
            </T>
          </>
        ) : (
          <T style={{ color: c.warning }}>
            Pick a time during your shift ({shift.startTime} to {shift.endTime}).
          </T>
        )}
      </Card>

      <SectionTitle>Reason</SectionTitle>
      <ReasonInput value={reason} onChange={setReason} placeholder="e.g. Dental appointment" />

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
        disabled={!valid || reason.trim().length < 3}
      />
    </Screen>
  );
}
