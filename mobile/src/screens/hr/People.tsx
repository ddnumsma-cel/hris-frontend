// People (/admin/maintenance/people): the HR server's employee list, searchable by name or employee number, 10 per page.
// Tapping a name opens that person's record in a centred dialog.

import { LABELS } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, ErrorText, Loading, Pager, Screen, T, font } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { Sheet } from '~/components/sheets';
import { PersonDetails } from './Person';

const PAGE = 10;
const TODAY_TONE = { PRESENT: 'success', ABSENT: 'danger', LEAVE: 'accent', RESTDAY: 'neutral', HOLIDAY: 'neutral' } as const;

export default function PeopleScreen() {
  const { c } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  // Search once typing pauses, from page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const list = useQuery({
    queryKey: ['hr', 'people', q, page],
    queryFn: () => unwrap(api.GET('/employees', { params: { query: { q: q || undefined, page, pageSize: PAGE } } })),
    // Keep this page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
  const people = list.data?.items ?? [];
  const total = list.data?.total;
  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE));

  return (
    <Screen refreshing={list.isRefetching && !list.isPlaceholderData} onRefresh={() => void list.refetch()}>
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
      {total !== undefined && (
        <T size={12} muted>
          {total} {total === 1 ? 'person' : 'people'}
        </T>
      )}

      <ErrorText error={list.error} onRetry={() => void list.refetch()} />
      {list.isLoading && <Loading />}
      {list.data && people.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          {`Nobody matches "${q}"`}
        </T>
      )}

      {people.map((p) => (
            <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
                <T size={14} weight="600" style={{ color: c.accent }}>
                  {p.firstName[0]}
                  {p.lastName[0]}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {/* Only the name opens the record, underlined while pressed. */}
                <Pressable onPress={() => setOpenId(p.id)} accessibilityRole="link" accessibilityLabel={`View ${p.fullName}'s details`} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                  {({ pressed }) => (
                    <T weight="600" numberOfLines={1} style={{ textDecorationLine: pressed ? 'underline' : 'none' }}>
                      {p.fullName}
                    </T>
                  )}
                </Pressable>
                <T size={12} muted numberOfLines={1}>
                  {p.position} · {p.department.name}
                </T>
                <T size={12} muted numberOfLines={1}>
                  {p.employeeNo} · {p.site.name}
                </T>
              </View>
              {p.todayStatus && <Badge label={LABELS.dtrStatus[p.todayStatus]} tone={TODAY_TONE[p.todayStatus]} />}
            </Card>
      ))}

      <Sheet open={!!openId} onClose={() => setOpenId(null)} title="Employee" from="center">
        {openId && <PersonDetails id={openId} />}
      </Sheet>

      {(total ?? 0) > PAGE && <Pager page={page - 1} pages={pages} onChange={(p) => setPage(p + 1)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
