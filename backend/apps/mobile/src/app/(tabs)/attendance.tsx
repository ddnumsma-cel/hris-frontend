import { formatDate, formatTime, LABELS, manilaToday, weekdayOf, type DtrRow } from '@msma/shared';
import { View } from 'react-native';
import { Badge, Card, ErrorText, Loading, mono, Screen, T } from '@/components/ui';
import { useMyAttendance } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatusBadge({ d }: { d: DtrRow }) {
  if (d.status === 'PRESENT' && d.lateMinutes > 0)
    return <Badge label={`Late ${d.lateMinutes} min`} tone="warning" icon="alert-circle-outline" />;
  const tone = {
    PRESENT: 'success',
    ABSENT: 'danger',
    LEAVE: 'accent',
    RESTDAY: 'neutral',
    HOLIDAY: 'neutral',
  } as const;
  return <Badge label={LABELS.dtrStatus[d.status]} tone={tone[d.status]} />;
}

export default function AttendanceScreen() {
  const { c } = useTheme();
  const q = useMyAttendance();
  const today = manilaToday();
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <T muted size={14}>
        Your daily time record for the last 14 days (Asia/Manila time).
      </T>
      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading && <Loading />}
      {(q.data ?? []).map((d) => (
        <Card key={d.date} style={{ paddingVertical: 12 }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <T weight="600">
              {DAY[weekdayOf(d.date)]}, {formatDate(d.date)}
              {d.date === today ? ' · today' : ''}
            </T>
            <StatusBadge d={d} />
          </View>
          {(d.timeIn || d.timeOut) && (
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
              <T size={14} muted>
                In <T style={mono}>{formatTime(d.timeIn)}</T>
              </T>
              <T size={14} muted>
                Out{' '}
                <T style={[mono, !d.timeOut && d.date !== today ? { color: c.warning } : {}]}>
                  {d.timeOut ? formatTime(d.timeOut) : d.date !== today ? 'missing' : '--:--'}
                </T>
              </T>
              {d.otMinutes > 0 && (
                <T size={14} muted>
                  OT <T style={mono}>{d.otMinutes} min</T>
                </T>
              )}
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
