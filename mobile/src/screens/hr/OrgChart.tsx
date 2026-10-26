// Org chart (/admin/maintenance/org-chart) from the HR server: each manager (people who report to no one) with their
// direct reports, from each person's managerId in the employee list. Tap a manager's card arrow to open their team;
// tapping a name opens that person's record in a centred dialog.

import { unwrap } from '@msma/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '~/components/sheets';
import { Card, ErrorText, Loading, Screen, T, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { PersonDetails } from './Person';

/** Reports shown before "Show all", so a big team doesn't turn into a long scroll. */
const PREVIEW = 6;

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

export default function OrgChartScreen() {
  const { c } = useTheme();
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  // shortcut: one page of 200 (the server's limit) covers today's 180 people; page through it if headcount grows past 200.
  const people = useQuery({ queryKey: ['hr', 'attendance', 'people'], queryFn: () => unwrap(api.GET('/employees', { params: { query: { pageSize: 200 } } })) });
  const all = people.data?.items ?? [];
  const ids = new Set(all.map((p) => p.id));
  const reportsOf = (id: string) => all.filter((p) => p.managerId === id);
  // Top of the chart: no manager, or a manager outside this list.
  const heads = all.filter((p) => !p.managerId || !ids.has(p.managerId)).sort((a, b) => reportsOf(b.id).length - reportsOf(a.id).length);

  const name = (id: string, fullName: string, size = 14) => (
    <Pressable onPress={() => setPerson(id)} accessibilityRole="link" accessibilityLabel={`View ${fullName}'s details`} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
      {({ pressed }) => (
        <T size={size} weight="600" numberOfLines={1} style={{ textDecorationLine: pressed ? 'underline' : 'none' }}>
          {fullName}
        </T>
      )}
    </Pressable>
  );

  return (
    <Screen refreshing={people.isRefetching} onRefresh={() => void people.refetch()}>
      <ErrorText error={people.error} onRetry={() => void people.refetch()} />
      {people.isLoading && <Loading />}
      {people.data && (
        <T size={12} muted>
          {heads.length} teams · {all.length} people
        </T>
      )}

      {heads.map((h) => {
        const team = reportsOf(h.id);
        const open = openTeam === h.id;
        const shown = open ? (showAll ? team : team.slice(0, PREVIEW)) : [];
        return (
          <Card key={h.id} style={{ gap: 10 }}>
            <View style={styles.row}>
              <View style={[styles.avatar, styles.big, { backgroundColor: c.accentSoft }]}>
                <T size={14} weight="600" style={{ color: c.accent }}>
                  {initials(h.fullName)}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {name(h.id, h.fullName, 15)}
                <T size={12} muted numberOfLines={1}>
                  {h.position} · {h.department.name}
                </T>
                <T size={12} muted>
                  {h.site.name}
                </T>
              </View>
              {team.length > 0 && (
                <Pressable
                  onPress={() => {
                    setOpenTeam(open ? null : h.id);
                    setShowAll(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${open ? 'Hide' : 'Show'} ${h.fullName}'s team`}
                  style={[styles.count, { borderColor: c.border, backgroundColor: c.fieldBg }]}
                >
                  <T size={13} weight="600" style={mono}>
                    {team.length}
                  </T>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
                </Pressable>
              )}
            </View>

            {open && (
              <View style={[styles.team, { borderLeftColor: c.border }]}>
                {shown.map((p) => (
                  <View key={p.id} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: c.tint }]}>
                      <T size={11} weight="600" muted>
                        {initials(p.fullName)}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      {name(p.id, p.fullName, 13)}
                      <T size={11} muted numberOfLines={1}>
                        {p.position} · {p.site.name}
                      </T>
                    </View>
                    {reportsOf(p.id).length > 0 && (
                      <T size={11} muted>
                        {reportsOf(p.id).length} reports
                      </T>
                    )}
                  </View>
                ))}
                {team.length > PREVIEW && (
                  <Pressable onPress={() => setShowAll(!showAll)} accessibilityRole="button" hitSlop={6}>
                    <T size={13} weight="600" style={{ color: c.accent }}>
                      {showAll ? 'Show fewer' : `Show all ${team.length}`}
                    </T>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        );
      })}

      <Sheet open={!!person} onClose={() => setPerson(null)} title="Employee" from="center">
        {person && <PersonDetails id={person} />}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  big: { width: 44, height: 44, borderRadius: 22 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  team: { gap: 12, marginLeft: 21, paddingLeft: 20, borderLeftWidth: 2 },
});
