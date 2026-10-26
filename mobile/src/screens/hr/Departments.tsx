// Departments (/admin/maintenance/departments) from the HR server: each department with its headcount, who's present
// today and how its people are spread across the branches. Counts come from the employee list.

import { unwrap } from '@msma/api-client';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { Card, ErrorText, Loading, Screen, T, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';

export default function DepartmentsScreen() {
  const { c } = useTheme();
  const filters = useQuery({ queryKey: ['hr', 'filters'], queryFn: () => unwrap(api.GET('/employees/filters')) });
  // shortcut: one page of 200 (the server's limit) covers today's 180 people; page through it if headcount grows past 200.
  const people = useQuery({ queryKey: ['hr', 'attendance', 'people'], queryFn: () => unwrap(api.GET('/employees', { params: { query: { pageSize: 200 } } })) });
  const all = people.data?.items ?? [];
  const depts = (filters.data?.departments ?? [])
    .map((d) => {
      const members = all.filter((p) => p.department.id === d.id);
      const bySite = new Map<string, number>();
      for (const p of members) bySite.set(p.site.name, (bySite.get(p.site.name) ?? 0) + 1);
      return { ...d, total: members.length, present: members.filter((p) => p.todayStatus === 'PRESENT').length, bySite: [...bySite] };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <Screen refreshing={filters.isRefetching || people.isRefetching} onRefresh={() => void (filters.refetch(), people.refetch())}>
      <ErrorText error={filters.error ?? people.error} onRetry={() => void (filters.refetch(), people.refetch())} />
      {(filters.isLoading || people.isLoading) && <Loading />}
      {people.data && filters.data && (
        <>
          <T size={12} muted>
            {depts.length} departments · {all.length} people
          </T>
          {depts.map((d) => (
            <Card key={d.id} style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                  <T size={13} weight="600" style={{ color: c.accent }}>
                    {d.name
                      .split(/[\s&]+/)
                      .filter(Boolean)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="600">{d.name}</T>
                  <T size={12} muted>
                    {d.total} {d.total === 1 ? 'person' : 'people'} · {d.present} present today
                  </T>
                </View>
                <T size={20} weight="600" style={mono}>
                  {d.total}
                </T>
              </View>
              {d.bySite.length > 0 && (
                <View style={[styles.sites, { borderTopColor: c.border }]}>
                  {d.bySite.map(([site, n]) => (
                    <T key={site} size={12} muted>
                      {site} <T size={12} weight="600">{n}</T>
                    </T>
                  ))}
                </View>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sites: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, borderTopWidth: 1, paddingTop: 8 },
});
