import { Ionicons } from '@expo/vector-icons';
import { formatDate, formatLongDate, formatPHP, formatTime, type MeToday } from '@msma/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Loading,
  mono,
  Screen,
  SectionTitle,
  T,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLatestPayslip, useLeaveBalances, useMy201File, useToday } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const STATUS: Record<
  MeToday['status'],
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'accent' }
> = {
  NOT_CLOCKED_IN: { label: 'Not clocked in', tone: 'warning' },
  CLOCKED_IN: { label: 'On shift', tone: 'success' },
  CLOCKED_OUT: { label: 'Clocked out', tone: 'neutral' },
  ON_LEAVE: { label: 'On leave', tone: 'accent' },
  REST_DAY: { label: 'Rest day', tone: 'neutral' },
  HOLIDAY: { label: 'Holiday', tone: 'neutral' },
};

const SHORT_LEAVE: Record<string, string> = {
  VL: 'Vacation',
  SL: 'Sick',
  SIL: 'Service incentive',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { c } = useTheme();
  const today = useToday();
  const balances = useLeaveBalances();
  const payslip = useLatestPayslip();
  const file201 = useMy201File();
  const t = today.data;
  const refreshing = today.isRefetching || balances.isRefetching;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        void today.refetch();
        void balances.refetch();
        void payslip.refetch();
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T muted size={14}>
          {formatLongDate(t?.date ?? new Date())}
        </T>
        <Badge label="Sample data" tone="warning" />
      </View>
      <View>
        <T size={26} weight="700">
          Hi, {user?.displayName.split(' ')[0]}
        </T>
        {t && (
          <T muted size={14} style={{ marginTop: 2 }}>
            Shift {t.shift.startTime}–{t.shift.endTime} · {t.siteName.replace(' branch', '')}
          </T>
        )}
      </View>

      <ErrorText error={today.error} onRetry={() => today.refetch()} />
      {today.isLoading && <Loading />}

      {t && (
        <Card tone="accent">
          <View style={styles.row}>
            <T weight="600">Today</T>
            <Badge label={STATUS[t.status].label} tone={STATUS[t.status].tone} />
          </View>
          <View style={[styles.row, { marginTop: 12, justifyContent: 'flex-start', gap: 32 }]}>
            <View>
              <T muted size={13}>
                Time in
              </T>
              <T
                size={30}
                weight="600"
                style={[mono, t.lateMinutes > 0 ? { color: c.warning } : {}]}
              >
                {formatTime(t.timeIn)}
              </T>
            </View>
            <View>
              <T muted size={13}>
                Time out
              </T>
              <T size={30} weight="600" style={mono}>
                {formatTime(t.timeOut)}
              </T>
            </View>
          </View>
          {t.lateMinutes > 0 && (
            <T size={13} style={{ color: c.warning, marginTop: 4 }}>
              Late by {t.lateMinutes} min
            </T>
          )}
          {t.holiday && (
            <T size={13} muted style={{ marginTop: 4 }}>
              {t.holiday.name}
            </T>
          )}
          <View style={{ marginTop: 14 }}>
            <Button
              label={t.nextAction === 'CLOCK_IN' ? 'Clock in' : 'Clock out'}
              icon="finger-print"
              onPress={() => router.push('/clock')}
            />
          </View>
          <T muted size={12} style={{ marginTop: 8, textAlign: 'center' }}>
            Your phone confirms it's you with its fingerprint, face or PIN.
          </T>
        </Card>
      )}

      <SectionTitle>Leave balances</SectionTitle>
      <View style={styles.tiles}>
        {(balances.data ?? []).map((b) => (
          <Card key={b.leaveTypeCode} style={styles.tile}>
            <T size={22} weight="600" style={mono}>
              {b.remaining}
            </T>
            <T muted size={12}>
              {SHORT_LEAVE[b.leaveTypeCode] ?? b.leaveTypeName}
            </T>
          </Card>
        ))}
      </View>

      <Card style={{ paddingVertical: 4 }}>
        {[
          {
            label: 'File leave',
            icon: 'calendar-outline' as const,
            onPress: () => router.push('/leave-new'),
          },
          {
            label: 'My requests',
            icon: 'list-outline' as const,
            onPress: () => router.push('/requests'),
          },
          {
            label: 'Attendance history',
            icon: 'time-outline' as const,
            onPress: () => router.push('/attendance'),
          },
          {
            label: file201.data
              ? `My 201 file · ${file201.data.summary.percent}% complete`
              : 'My 201 file',
            icon: 'folder-open-outline' as const,
            onPress: () => router.push('/my-201'),
            alert:
              !!file201.data &&
              file201.data.summary.missing +
                file201.data.summary.expiring +
                file201.data.summary.expired >
                0,
          },
        ].map((a, i) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            style={[styles.action, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
          >
            <Ionicons name={a.icon} size={20} color={c.text} />
            <T style={{ flex: 1 }}>{a.label}</T>
            {'alert' in a && a.alert && (
              <Ionicons
                name="alert-circle"
                size={18}
                color={c.warning}
                accessibilityLabel="Needs attention"
              />
            )}
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ))}
      </Card>

      <SectionTitle
        action={
          <Pressable onPress={() => router.push('/payslips')} accessibilityRole="link">
            <T style={{ color: c.accent }} size={14} weight="600">
              View
            </T>
          </Pressable>
        }
      >
        Latest payslip
      </SectionTitle>
      <Card>
        {payslip.data ? (
          <View style={styles.row}>
            <View>
              <T weight="600">{payslip.data.label}</T>
              <T muted size={13}>
                Released {formatDate(payslip.data.payDate)}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T muted size={12}>
                Net pay
              </T>
              <T size={20} weight="700" style={mono}>
                {formatPHP(payslip.data.netPay)}
              </T>
            </View>
          </View>
        ) : (
          <T muted>{payslip.isLoading ? 'Loading…' : 'No payslip yet.'}</T>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
