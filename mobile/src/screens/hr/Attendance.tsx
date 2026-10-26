// Today's attendance (/admin/timekeeping for HR, /manager/attendance for approvers): a donut of the day, then everyone's
// attendance in one list, 10 per page: time-in, minutes late, absent, or the leave they're on. Data: the employee list's status and `today` details (the server
// limits a manager's list to their team). Tapping someone opens their record.

import { formatDate, formatTime, LABELS, manilaToday } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SelectField } from '~/components/form';
import { Badge, Card, ErrorText, Loading, Pager, Screen, T, font, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { useScope } from './scope';

const PER_PAGE = 10;

export default function AttendanceScreen() {
  const { c } = useTheme();
  const scope = useScope();
  const [site, setSite] = useState('ALL');
  const [text, setText] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [site, text]);
  // shortcut: one page of 200 (the server's limit) covers today's 180 people; page through it if headcount grows past 200.
  const people = useQuery({ queryKey: ['hr', 'attendance', 'people'], queryFn: () => unwrap(api.GET('/employees', { params: { query: { pageSize: 200 } } })), refetchInterval: 60_000 });

  const all = people.data?.items ?? [];
  const sites = [...new Set(all.map((p) => p.site.name))];
  const term = text.trim().toLowerCase();
  const inView = all.filter((p) => (site === 'ALL' || p.site.name === site) && (!term || p.fullName.toLowerCase().includes(term) || p.employeeNo.toLowerCase().includes(term)));
  const late = (p: (typeof all)[number]) => p.todayStatus === 'PRESENT' && (p.today?.lateMinutes ?? 0) > 0;
  const absent = inView.filter((p) => p.todayStatus === 'ABSENT');
  const lateList = inView.filter(late).sort((a, b) => (b.today?.lateMinutes ?? 0) - (a.today?.lateMinutes ?? 0));
  const onLeave = inView.filter((p) => p.todayStatus === 'LEAVE');
  const onTime = inView.filter((p) => p.todayStatus === 'PRESENT' && !late(p));
  const pages = Math.max(1, Math.ceil(inView.length / PER_PAGE));
  const onPage = inView.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // The donut: on time, late, absent, on leave, as shares of everyone in view.
  const parts = [
    { label: 'On time', n: onTime.length, color: c.success },
    { label: 'Late', n: lateList.length, color: c.warning },
    { label: 'Absent', n: absent.length, color: c.danger },
    { label: 'On leave', n: onLeave.length, color: c.accent },
  ];
  const total = Math.max(1, inView.length);
  const present = onTime.length + lateList.length;
  const R = 34;
  const C = 2 * Math.PI * R;
  let start = 0;

  const row = (p: (typeof all)[number]) => {
    const kind = p.todayStatus === 'ABSENT' ? 'absent' : late(p) ? 'late' : p.todayStatus === 'LEAVE' ? 'leave' : 'ok';
    const tone = { absent: [c.dangerSoft, c.danger], late: [c.warningSoft, c.warning], leave: [c.accentSoft, c.accent], ok: [c.accentSoft, c.accent] }[kind];
    const sub =
      kind === 'absent'
        ? `No time-in · ${p.site.name}`
        : kind === 'leave'
          ? `${p.today?.leaveType ?? 'Leave'}${p.today?.leaveUntil ? ` · until ${formatDate(p.today.leaveUntil)}` : ''}`
          : `${p.today?.timeIn ? `In ${formatTime(p.today.timeIn)}` : p.todayStatus === 'PRESENT' ? 'In' : 'No record'} · ${p.site.name}`;
    return (
      <Pressable key={p.id} onPress={() => router.push(scope.person(p.id) as never)} accessibilityRole="button" accessibilityLabel={`Open ${p.fullName}`} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.avatar, { backgroundColor: tone[0] }]}>
          <T size={12} weight="600" style={{ color: tone[1] }}>
            {p.firstName[0]}
            {p.lastName[0]}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14} weight="600" numberOfLines={1}>
            {p.fullName}
          </T>
          <T size={12} muted numberOfLines={1}>
            {sub}
          </T>
        </View>
        {kind === 'absent' && <Badge label="Absent" tone="danger" />}
        {kind === 'late' && <Badge label={`${p.today!.lateMinutes} min late`} tone="warning" />}
        {kind === 'leave' && <Badge label="On leave" tone="accent" />}
        {kind === 'ok' && (p.todayStatus === 'PRESENT' ? <Badge label="On time" tone="success" /> : <Badge label={p.todayStatus ? LABELS.dtrStatus[p.todayStatus] : 'No record'} />)}
      </Pressable>
    );
  };

  return (
    <Screen refreshing={people.isRefetching} onRefresh={() => void people.refetch()}>
      <T size={11} weight="500" muted style={styles.upper}>
        {formatDate(manilaToday())} · {site === 'ALL' ? scope.label : site}
      </T>
      <ErrorText error={people.error} onRetry={() => void people.refetch()} />
      {people.isLoading && <Loading />}

      {people.data && (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={styles.donut}>
              <Svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={42} cy={42} r={R} stroke={c.tint} strokeWidth={12} fill="none" />
                {parts.map((s) => {
                  const len = (s.n / total) * C;
                  const el = len > 0 ? <Circle key={s.label} cx={42} cy={42} r={R} stroke={s.color} strokeWidth={12} fill="none" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-start} /> : null;
                  start += len;
                  return el;
                })}
              </Svg>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={styles.donutLabel}>
                  <T size={16} weight="600" style={mono}>
                    {Math.round((present / total) * 100)}%
                  </T>
                </View>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }} accessibilityLabel={parts.map((s) => `${s.label} ${s.n}`).join(', ')}>
              {parts.map((s) => (
                <View key={s.label} style={styles.legend}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <T size={13} style={{ flex: 1 }}>
                    {s.label}
                  </T>
                  <T size={13} weight="600" style={mono}>
                    {s.n}
                  </T>
                </View>
              ))}
            </View>
          </Card>

          {sites.length > 1 && (
            <SelectField label="Branch" value={site === 'ALL' ? 'All branches' : site} options={['All branches', ...sites]} onChange={(v) => setSite(v === 'All branches' ? 'ALL' : v)} />
          )}
          <View style={[styles.search, { borderColor: c.border, backgroundColor: c.fieldBg }]}>
            <Ionicons name="search-outline" size={18} color={c.muted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search name or employee ID"
              placeholderTextColor={c.muted}
              autoCorrect={false}
              accessibilityLabel="Search name or employee ID"
              style={[styles.input, font(), { color: c.text }]}
            />
          </View>

          {inView.length === 0 ? (
            <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
              Nobody matches these filters.
            </T>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {onPage.map((p, i) => (
                <View key={p.id} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
                  {row(p)}
                </View>
              ))}
              {inView.length > PER_PAGE && (
                <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
                  <Pager page={page} pages={pages} onChange={setPage} />
                </View>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  donut: { width: 84, height: 84 },
  donutLabel: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
