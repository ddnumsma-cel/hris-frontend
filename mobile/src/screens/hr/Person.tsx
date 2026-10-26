// One employee's record (/admin/maintenance/people/:id) from the HR server: job, contact, emergency contact, government
// numbers (as the server returns them for the signed-in role), 201 file progress and this year's leave balances.
// PersonDetails is the record itself; People shows it in a centred dialog, Attendance opens this page.

import { LABELS, formatDate } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Badge, Card, ErrorText, Loading, Screen, SectionTitle, T } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';

export default function PersonScreen() {
  const id = usePathname().split('/').pop() ?? '';
  const q = usePerson(id);
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PersonDetails id={id} />
    </Screen>
  );
}

const usePerson = (id: string) =>
  useQuery({ queryKey: ['hr', 'person', id], queryFn: () => unwrap(api.GET('/employees/{id}', { params: { path: { id } } })) });

/** One employee's record (no page around it). */
export function PersonDetails({ id }: { id: string }) {
  const { c } = useTheme();
  const q = usePerson(id);
  const e = q.data;

  const rows = (list: [string, string | null | undefined][]) => (
    <Card style={{ paddingVertical: 4 }}>
      {list.map(([label, value], i) => (
        <View key={label} style={[styles.row, { borderTopWidth: i ? 1 : 0, borderTopColor: c.border }]}>
          <T muted size={14}>
            {label}
          </T>
          <T weight="500" style={{ flexShrink: 1, textAlign: 'right' }}>
            {value || '—'}
          </T>
        </View>
      ))}
    </Card>
  );

  return (
    <>
      <ErrorText error={q.error} onRetry={() => void q.refetch()} />
      {q.isLoading && <Loading />}
      {e && (
        <>
          <View style={styles.hero}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <T size={20} weight="600" style={{ color: c.accent }}>
                {e.firstName[0]}
                {e.lastName[0]}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={20} weight="600">
                {e.fullName}
              </T>
              <T size={13} muted>
                {e.position} · {e.department.name}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <Badge label={LABELS.employmentStatus[e.status]} tone="accent" />
                {e.todayStatus && <Badge label={`Today: ${LABELS.dtrStatus[e.todayStatus]}`} tone={e.todayStatus === 'PRESENT' ? 'success' : e.todayStatus === 'ABSENT' ? 'danger' : 'neutral'} />}
              </View>
            </View>
          </View>

          <SectionTitle>Job</SectionTitle>
          {rows([
            ['Employee ID', e.employeeNo],
            ['Branch', e.site.name],
            ['Department', e.department.name],
            ['Manager', e.manager?.fullName],
            ['Shift', e.shift?.name],
            ['Hired', formatDate(e.hireDate)],
            ['Regular since', e.personal?.regularizationDate ? formatDate(e.personal.regularizationDate) : null],
          ])}

          <SectionTitle>Contact</SectionTitle>
          {rows([
            ['Work email', e.email],
            ['Mobile', e.personal?.mobileNo ?? e.mobileNo],
            ['Personal email', e.personal?.personalEmail],
            ['Address', e.personal?.address],
            ['Emergency contact', e.personal?.emergencyContact ? `${e.personal.emergencyContact.name} (${e.personal.emergencyContact.relationship})` : null],
            ['Emergency number', e.personal?.emergencyContact?.phone],
          ])}

          <SectionTitle>Government numbers</SectionTitle>
          {rows([
            ['TIN', e.govIds?.tin],
            ['SSS', e.govIds?.sss],
            ['PhilHealth', e.govIds?.philhealth],
            ['Pag-IBIG', e.govIds?.pagibig],
          ])}

          {e.record201 && (
            <>
          <SectionTitle>201 file</SectionTitle>
          <Card style={{ gap: 8 }}>
            <T size={20} weight="600">
              {e.record201!.percent}% complete
            </T>
            <View style={[styles.bar, { backgroundColor: c.tint }]}>
              <View style={[styles.bar, { width: `${e.record201!.percent}%`, backgroundColor: e.record201!.percent === 100 ? c.success : c.accent }]} />
            </View>
            <T size={12} muted>
              {e.record201!.missing} missing · {e.record201!.expiring} expiring soon · {e.record201!.expired} expired
            </T>
          </Card>
            </>
          )}

          <SectionTitle>Leave balances · {new Date().getFullYear()}</SectionTitle>
          {rows(e.leaveBalances.map((b) => [b.leaveTypeName, `${b.remaining} left of ${b.entitled}`]))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12 },
  bar: { height: 6, borderRadius: 3 },
});
