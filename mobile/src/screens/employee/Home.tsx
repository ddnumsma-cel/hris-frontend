// Employee Home: the website's Home (features/employee/EmployeeOverview) for a phone, with the app's own clock-in
// card kept as it was. Same sections and wording: greeting, take-home pay with recent payslips, the KPI tiles,
// announcements and leave credits. Figures come from the HR server where it has them;
// announcements from the website's data, as on the website.

import { Ionicons } from '@expo/vector-icons';
import { formatPHP, radius } from '@msma/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fetchAnnouncements } from '@/lib/api';
import { backendMyLeave } from '@/lib/backend/requests';
import { formatToday } from '@/lib/format';
import { ClockCard } from '~/components/ClockCard';
import { Badge, ErrorText, Loading, mono, Screen, T } from '~/components/ui';
import { useAuth } from '~/lib/auth';
import { useLatestPayslip, useMyAttendance, useToday } from '~/lib/queries';
import { go } from '~/lib/go';
import { useTheme } from '~/lib/theme';

/** Good morning, afternoon or evening, in Filipino, by the clock (as on the website). */
const greeting = (h = new Date().getHours()) => (h < 12 ? 'Magandang umaga' : h < 18 ? 'Magandang hapon' : 'Magandang gabi');

/** The website's dashboard card (.dash [data-slot=card]): crisp fill, hairline border. */
function DashCard({ title, meta, action, children }: { title?: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  const { c, dark, look } = useTheme();
  return (
    <View style={[styles.card, look.card(c, dark), { borderRadius: look.cardRadius }]}>
      {title && (
        <View style={styles.cardHead}>
          <T size={15} weight="600" style={{ flex: 1 }}>
            {title}
          </T>
          {meta && (
            <T size={12} muted>
              {meta}
            </T>
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

/** A KPI tile: small uppercase label, 28px figure, a tinted status pill under it. */
function Kpi({ label, value, delta, tone }: { label: string; value: ReactNode; delta?: string; tone?: 'good' }) {
  const { c, dark, look } = useTheme();
  return (
    <View style={[styles.card, look.card(c, dark), { borderRadius: look.cardRadius, gap: 4 }]}>
      <T size={11} weight="500" muted style={styles.upper}>
        {label}
      </T>
      <View>{typeof value === 'string' ? <T size={28} weight="600" style={mono}>{value}</T> : value}</View>
      {delta && (
        <View style={[styles.delta, { backgroundColor: tone === 'good' ? c.successSoft : c.tint }]}>
          {tone === 'good' && <Ionicons name="checkmark" size={12} color={c.success} />}
          <T size={11} weight="500" style={{ color: tone === 'good' ? c.success : c.muted }}>
            {delta}
          </T>
        </View>
      )}
    </View>
  );
}

function ListRow({ icon, title, subtitle, value, status }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle?: string; value?: string; status?: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.listRow}>
      <View style={[styles.listIcon, { backgroundColor: c.tint }]}>
        <Ionicons name={icon} size={18} color={c.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={14} weight="500" numberOfLines={2}>
          {title}
        </T>
        {subtitle && (
          <T size={12} muted>
            {subtitle}
          </T>
        )}
      </View>
      {(value || status) && (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {value && (
            <T size={14} weight="600" style={[mono, { color: c.success }]}>
              {value}
            </T>
          )}
          {status && <Badge label={status} tone="success" />}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { c } = useTheme();
  const today = useToday();
  const payslip = useLatestPayslip();
  const attendance = useMyAttendance();
  // The yearly leave credit pool, same as the Leave page.
  const credits = useQuery({ queryKey: ['mobile', 'employee', 'credits'], queryFn: async () => (await backendMyLeave()).credits });
  const announcements = useQuery({ queryKey: ['mobile', 'employee', 'announcements'], queryFn: fetchAnnouncements });
  const [howOpen, setHowOpen] = useState(false);
  const t = today.data;
  const slip = payslip.data;

  // From the time clock, last 2 weeks (the website's on-time rate).
  const days = attendance.data ?? [];
  const worked = days.filter((d) => d.timeIn);
  const onTime = worked.length ? Math.round((worked.filter((d) => d.lateMinutes === 0).length / worked.length) * 100) : 100;
  const late = days.filter((d) => d.lateMinutes > 0).length;
  const absent = days.filter((d) => d.status === 'ABSENT').length;

  return (
    <Screen
      refreshing={today.isRefetching}
      onRefresh={() => {
        void today.refetch();
        void payslip.refetch();
        void attendance.refetch();
        void credits.refetch();
      }}
    >
      <View>
        <T size={24} weight="600">
          {user ? `${greeting()}, ${user.displayName.split(' ')[0]}` : greeting()}
        </T>
        <T size={11} weight="500" muted style={[styles.upper, { marginTop: 4 }]}>
          {formatToday()} · {user?.site?.name ?? ''} · ID {user?.employeeNo ?? ''}
        </T>
      </View>

      <ErrorText error={today.error} onRetry={() => today.refetch()} />
      {today.isLoading && <Loading />}

      {t && <ClockCard today={t} />}

      {/* Hero: this cut-off's net pay, with recent payslips as amount rows. */}
      <DashCard>
        <View style={styles.row}>
          <T size={11} weight="500" muted style={styles.upper}>
            Take-home pay · last cut-off
          </T>
          <Pressable onPress={() => go('/employee/payslips')} accessibilityRole="button" style={[styles.smallBtn, { borderColor: c.border }]}>
            <T size={12} weight="500">
              View all
            </T>
          </Pressable>
        </View>
        <T size={40} weight="600" style={[mono, { marginTop: 4 }]}>
          {slip ? formatPHP(slip.netPay) : payslip.isLoading ? '…' : '—'}
        </T>
        {slip && (
          <T size={13} weight="500" style={{ color: c.success }}>
            {slip.label}
          </T>
        )}
        <T size={15} weight="600" style={{ marginTop: 16, marginBottom: 4 }}>
          Recent payslips
        </T>
        {payslip.isLoading && <Loading />}
        {!payslip.isLoading && !slip && (
          <T size={13} muted>
            No payslips yet.
          </T>
        )}
        {slip && <ListRow icon="wallet-outline" title={slip.label} subtitle={`Gross ${formatPHP(slip.grossPay)} · Deductions ${formatPHP(slip.totalDeductions)}`} value={formatPHP(slip.netPay)} status={slip.status === 'RELEASED' ? 'Paid' : 'Processing'} />}
      </DashCard>

      <Kpi label="On-time rate, last 2 weeks" value={attendance.data ? `${onTime}%` : '…'} delta={attendance.data ? `${late} late, ${absent} absences` : undefined} tone="good" />
      <Kpi
        label="Leave credits left"
        value={
          credits.data ? (
            <T size={28} weight="600" style={mono}>
              {credits.data.available}{' '}
              <T size={14} weight="600" muted>
                / {credits.data.total} leaves
              </T>
            </T>
          ) : (
            '…'
          )
        }
        delta={credits.data ? `${credits.data.used + credits.data.pending} used or waiting` : undefined}
      />

      <DashCard title="Announcements" meta="Cebu HQ">
        {announcements.isLoading && <Loading />}
        {announcements.data?.length === 0 && (
          <T size={13} muted>
            No announcements right now.
          </T>
        )}
        {announcements.data?.map((a) => (
          <ListRow key={a.id} icon="notifications-outline" title={a.title} subtitle={a.postedOn} />
        ))}
      </DashCard>

      {/* Progress: leave used against the year's credits. */}
      <DashCard title="Leave credits" meta={`${new Date().getFullYear()}`}>
        {credits.isLoading && <Loading />}
        {credits.data && (
          <View style={{ gap: 8 }}>
            <View style={styles.row}>
              <T size={13} weight="500">
                Leaves left
              </T>
              <T size={13} muted style={mono}>
                {credits.data.used + credits.data.pending} / {credits.data.total}
              </T>
            </View>
            <View style={[styles.bar, { backgroundColor: c.tint }]}>
              <View style={[styles.barFill, { backgroundColor: c.accent, width: `${Math.min(100, ((credits.data.used + credits.data.pending) / Math.max(1, credits.data.total)) * 100)}%` }]} />
            </View>
            <T size={12} muted>
              {credits.data.used} used · {credits.data.pending} waiting for your manager. Each leave uses 1, however many days.
            </T>
            <Pressable onPress={() => setHowOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: howOpen }} style={styles.row}>
              <T size={12} weight="500">
                How credits are earned
              </T>
              <Ionicons name={howOpen ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
            </Pressable>
            {howOpen && (
              <View style={{ gap: 4, paddingLeft: 8 }}>
                <T size={12} muted>
                  • Everyone gets 6 leave credits on January 1. Unused credits don&apos;t carry over.
                </T>
                <T size={12} muted>
                  • One leave uses one credit, whether it&apos;s half a day or a full week.
                </T>
                <T size={12} muted>
                  • Leave without pay doesn&apos;t use a credit.
                </T>
              </View>
            )}
          </View>
        )}
        <View style={[styles.divider, { borderTopColor: c.line }]}>
          <T size={13} weight="600" style={{ marginBottom: 4 }}>
            Who&apos;s out today in your department
          </T>
          <T size={12} muted>
            The HR server doesn&apos;t share this with employees yet.
          </T>
        </View>
      </DashCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { borderWidth: 1, borderRadius: radius.card, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  smallBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  listIcon: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  divider: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
});
