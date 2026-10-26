// HR Home (/admin) and the approver's Home (/manager): today across all branches (or the manager's team) from the HR server's dashboard, what's waiting for a decision, attendance
// by branch and the latest time-ins. Same cards as the employee Home.

import { formatTime, LABELS, manilaToday, formatDate } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, ErrorText, Loading, mono, Screen, T } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { useSession } from '~/session';
import { DashCard, Kpi, KpiPair } from '../employee/Home';
import { useScope } from './scope';

export default function HrHomeScreen() {
  const { c } = useTheme();
  const { user } = useSession();
  const summary = useQuery({ queryKey: ['hr', 'dashboard'], queryFn: () => unwrap(api.GET('/dashboard/summary')), refetchInterval: 60_000 });
  const pending = useQuery({ queryKey: ['hr', 'approvals', 'PENDING'], queryFn: () => unwrap(api.GET('/approvals', { params: { query: { status: 'PENDING' } } })) });
  const scope = useScope();
  const k = summary.data?.kpis;
  // Only what this person decides (HR: leave and attendance fixes); the dashboard's own count includes every type.
  const waiting = (pending.data?.items ?? []).filter((a) => scope.kinds.includes(a.type));

  return (
    <Screen refreshing={summary.isRefetching} onRefresh={() => void (summary.refetch(), pending.refetch())}>
      <View>
        <T size={24} weight="600">
          Hello, {user?.name.split(' ')[0]}
        </T>
        <T size={11} weight="500" muted style={[styles.upper, { marginTop: 4 }]}>
          {formatDate(manilaToday())} · {scope.label}
        </T>
      </View>

      <ErrorText error={summary.error} onRetry={() => void summary.refetch()} />
      {summary.isLoading && <Loading />}

      {k && (
        <>
          <KpiPair>
            <Kpi bare label="Present today" value={`${k.present} / ${k.headcount}`} delta={`${k.late} late`} tone="good" />
            <Kpi bare label="Absent today" value={String(k.absent)} delta={`${k.onLeave} on leave`} />
          </KpiPair>

          <DashCard
            title="Waiting on you"
            action={
              <Pressable onPress={() => router.push(scope.approvals as never)} accessibilityRole="button" style={[styles.smallBtn, { borderColor: c.border }]}>
                <T size={12} weight="500">
                  View all
                </T>
              </Pressable>
            }
          >
            <T size={28} weight="600" style={mono}>
              {pending.data ? waiting.length : '…'}{' '}
              <T size={14} weight="600" muted>
                pending approval{waiting.length === 1 ? '' : 's'}
              </T>
            </T>
            {waiting.slice(0, 3).map((a) => (
              <View key={a.id} style={[styles.line, { borderTopColor: c.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14} weight="600" numberOfLines={1}>
                    {a.employee.fullName}
                  </T>
                  <T size={12} muted numberOfLines={1}>
                    {a.detail}
                  </T>
                </View>
                <Badge label={LABELS.approvalType[a.type]} tone="warning" />
              </View>
            ))}
          </DashCard>

          <DashCard title="Attendance by branch">
            {summary.data!.presentBySite.map((s) => (
              <View key={s.siteId} style={{ gap: 6, marginBottom: 12 }}>
                <View style={styles.row}>
                  <T size={14}>{s.siteName}</T>
                  <T size={14} weight="600" style={mono}>
                    {s.present} / {s.scheduled}
                  </T>
                </View>
                <View style={[styles.bar, { backgroundColor: c.tint }]}>
                  <View style={[styles.bar, { width: `${s.scheduled ? Math.round((s.present / s.scheduled) * 100) : 0}%`, backgroundColor: c.accent }]} />
                </View>
              </View>
            ))}
          </DashCard>

          <DashCard title="Latest time-ins">
            {summary.data!.latestPunches.slice(0, 5).map((p, i) => (
              <View key={p.id} style={[styles.line, i === 0 ? { borderTopWidth: 0, marginTop: 0, paddingTop: 0 } : { borderTopColor: c.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14} weight="600" numberOfLines={1}>
                    {p.employeeName}
                  </T>
                  <T size={12} muted numberOfLines={1}>
                    {p.kind === 'IN' ? 'In' : 'Out'} {formatTime(p.punchedAt)} · {p.siteName}
                  </T>
                </View>
                {p.lateMinutes > 0 && <Badge label={`Late ${p.lateMinutes} min`} tone="warning" />}
              </View>
            ))}
          </DashCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  bar: { height: 6, borderRadius: 3 },
});
