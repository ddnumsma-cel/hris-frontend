// Locations (/admin/maintenance/locations) from the HR server: each branch with its headcount and today's attendance
// (present of scheduled). Its View button opens a centred dialog with today's breakdown (on time, late, absent, on
// leave) and its departments; a department opens to its people there, and a name opens that person's record.

import { LABELS, formatDate, manilaToday } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '~/components/sheets';
import { Badge, Card, ErrorText, Loading, Screen, T, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { PersonDetails } from './Person';

const TODAY_TONE = { PRESENT: 'success', ABSENT: 'danger', LEAVE: 'accent', RESTDAY: 'neutral', HOLIDAY: 'neutral' } as const;

export default function LocationsScreen() {
  const { c } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const filters = useQuery({ queryKey: ['hr', 'filters'], queryFn: () => unwrap(api.GET('/employees/filters')) });
  const summary = useQuery({ queryKey: ['hr', 'dashboard'], queryFn: () => unwrap(api.GET('/dashboard/summary')) });
  // shortcut: one page of 200 (the server's limit) covers today's 180 people; page through it if headcount grows past 200.
  const people = useQuery({ queryKey: ['hr', 'attendance', 'people'], queryFn: () => unwrap(api.GET('/employees', { params: { query: { pageSize: 200 } } })) });
  const ready = filters.data && summary.data && people.data;
  const refetch = () => void (filters.refetch(), summary.refetch(), people.refetch());
  const site = filters.data?.sites.find((s) => s.id === openId);
  const close = () => {
    setOpenId(null);
    setPersonId(null);
  };

  return (
    <Screen refreshing={filters.isRefetching || summary.isRefetching || people.isRefetching} onRefresh={refetch}>
      <ErrorText error={filters.error ?? summary.error ?? people.error} onRetry={refetch} />
      {!ready && <Loading />}
      {ready &&
        filters.data!.sites.map((s) => {
          const headcount = people.data!.items.filter((p) => p.site.id === s.id).length;
          const today = summary.data!.presentBySite.find((x) => x.siteId === s.id);
          const pct = today?.scheduled ? Math.round((today.present / today.scheduled) * 100) : 0;
          return (
            <Card key={s.id} style={{ gap: 12 }}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name="location-outline" size={20} color={c.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="600">{s.name}</T>
                  <T size={12} muted>
                    {headcount} {headcount === 1 ? 'person' : 'people'}
                  </T>
                </View>
                <Pressable
                  onPress={() => setOpenId(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${s.name}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.view, { borderColor: c.border, backgroundColor: pressed ? c.tint : 'transparent' }]}
                >
                  <T size={13} weight="600" style={{ color: c.accent }}>
                    View
                  </T>
                  <Ionicons name="chevron-forward" size={14} color={c.accent} />
                </Pressable>
              </View>

              {today && (
                <View style={{ gap: 6 }}>
                  <View style={styles.between}>
                    <T size={13} muted>
                      Present today
                    </T>
                    <T size={13} weight="600" style={mono}>
                      {today.present} / {today.scheduled}
                    </T>
                  </View>
                  <View style={[styles.bar, { backgroundColor: c.tint }]}>
                    <View style={[styles.bar, { width: `${pct}%`, backgroundColor: c.accent }]} />
                  </View>
                </View>
              )}
            </Card>
          );
        })}

      <Sheet open={!!site} onClose={close} title={personId ? 'Employee' : (site?.name ?? 'Location')} from="center">
        {site && personId && (
          <>
            <Pressable onPress={() => setPersonId(null)} accessibilityRole="button" hitSlop={6} style={[styles.legend, { alignSelf: 'flex-start' }]}>
              <Ionicons name="chevron-back" size={14} color={c.accent} />
              <T size={13} weight="600" style={{ color: c.accent }}>
                Back to {site.name}
              </T>
            </Pressable>
            <PersonDetails id={personId} />
          </>
        )}
        {site && ready && !personId && (
          <LocationDetails
            people={people.data!.items.filter((p) => p.site.id === site.id)}
            today={summary.data!.presentBySite.find((x) => x.siteId === site.id)}
            onPerson={setPersonId}
          />
        )}
      </Sheet>
    </Screen>
  );
}

type Person = {
  id: string;
  fullName: string;
  position: string | null;
  department: { id: string; name: string };
  todayStatus: keyof typeof TODAY_TONE | null;
  today?: { lateMinutes: number } | null;
};

/** One branch: today's breakdown and its departments, each opening to its people here. */
function LocationDetails({ people, today, onPerson }: { people: Person[]; today?: { present: number; scheduled: number }; onPerson: (id: string) => void }) {
  const { c } = useTheme();
  const [openDept, setOpenDept] = useState<string | null>(null);
  const late = people.filter((p) => p.todayStatus === 'PRESENT' && (p.today?.lateMinutes ?? 0) > 0).length;
  const counts = [
    { label: 'On time', n: people.filter((p) => p.todayStatus === 'PRESENT').length - late, color: c.success },
    { label: 'Late', n: late, color: c.warning },
    { label: 'Absent', n: people.filter((p) => p.todayStatus === 'ABSENT').length, color: c.danger },
    { label: 'On leave', n: people.filter((p) => p.todayStatus === 'LEAVE').length, color: c.accent },
  ];
  const byDept = new Map<string, { name: string; members: Person[] }>();
  for (const p of people) {
    const d = byDept.get(p.department.id) ?? { name: p.department.name, members: [] };
    d.members.push(p);
    byDept.set(p.department.id, d);
  }
  const depts = [...byDept].sort((a, b) => b[1].members.length - a[1].members.length);
  const pct = today?.scheduled ? Math.round((today.present / today.scheduled) * 100) : 0;

  return (
    <>
      <T size={13} muted>
        {people.length} {people.length === 1 ? 'person' : 'people'} · {formatDate(manilaToday())}
      </T>

      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <T size={13} muted>
            Present today
          </T>
          <T size={13} weight="600" style={mono}>
            {today ? `${today.present} / ${today.scheduled}` : '—'}
          </T>
        </View>
        <View style={[styles.bar, { backgroundColor: c.tint }]}>
          <View style={[styles.bar, { width: `${pct}%`, backgroundColor: c.accent }]} />
        </View>
        <View style={styles.grid}>
          {counts.map((x) => (
            <View key={x.label} style={[styles.cell, { backgroundColor: c.tint }]}>
              <View style={styles.legend}>
                <View style={[styles.dot, { backgroundColor: x.color }]} />
                <T size={12} muted>
                  {x.label}
                </T>
              </View>
              <T size={18} weight="600" style={mono}>
                {x.n}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <T size={11} weight="600" muted style={[styles.label, { marginTop: 4 }]}>
        DEPARTMENTS HERE · {depts.length}
      </T>
      <Card style={{ paddingVertical: 4 }}>
        {depts.map(([id, d], i) => {
          const open = openDept === id;
          const present = d.members.filter((p) => p.todayStatus === 'PRESENT').length;
          return (
            <View key={id} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : null}>
              <Pressable
                onPress={() => setOpenDept(open ? null : id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${d.name}, ${d.members.length} people, ${present} present today`}
                style={[styles.between, styles.deptRow]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={13} weight="600">
                    {d.name}
                  </T>
                  <T size={12} muted>
                    {d.members.length} {d.members.length === 1 ? 'person' : 'people'} · {present} present today
                  </T>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
              </Pressable>
              {open &&
                d.members.map((p) => (
                  <View key={p.id} style={[styles.between, styles.personRow, { borderTopColor: c.border }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      {/* Only the name opens the record, underlined while pressed. */}
                      <Pressable onPress={() => onPerson(p.id)} accessibilityRole="link" accessibilityLabel={`View ${p.fullName}'s details`} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                        {({ pressed }) => (
                          <T size={13} numberOfLines={1} style={{ textDecorationLine: pressed ? 'underline' : 'none' }}>
                            {p.fullName}
                          </T>
                        )}
                      </Pressable>
                      <T size={12} muted numberOfLines={1}>
                        {p.position ?? 'No position yet'}
                      </T>
                    </View>
                    {p.todayStatus && <Badge label={LABELS.dtrStatus[p.todayStatus]} tone={TODAY_TONE[p.todayStatus]} />}
                  </View>
                ))}
            </View>
          );
        })}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  view: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderRadius: 9 },
  label: { letterSpacing: 1 },
  bar: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '45%', flexGrow: 1, borderRadius: 10, padding: 10, gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deptRow: { paddingVertical: 10 },
  personRow: { paddingVertical: 8, paddingLeft: 12, borderTopWidth: 1 },
});
