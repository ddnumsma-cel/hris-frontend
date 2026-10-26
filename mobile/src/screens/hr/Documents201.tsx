// 201 documents (/admin/maintenance/documents) from the HR server: how complete everyone's 201 file is, the documents due
// for renewal, and each person's file (% complete, what's missing, the next expiry), 10 per page with search, branch and
// status filters. Tapping a name opens that person's 201 checklist in a centred dialog.

import { CHECKLIST_STATUS_LABELS, documentType, formatDate, type DocumentType } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SelectField } from '~/components/form';
import { Sheet } from '~/components/sheets';
import { Badge, Card, ErrorText, Loading, Pager, Screen, T, font, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';

const PAGE = 10;
const FILTERS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'EXPIRING', label: 'Expiring soon' },
  { value: 'EXPIRED', label: 'Has expired documents' },
  { value: 'COMPLETE', label: 'Complete' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];
type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
const STATUS_TONE: Record<keyof typeof CHECKLIST_STATUS_LABELS, Tone> = {
  ON_FILE: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  MISSING: 'danger',
  NOT_NEEDED: 'neutral',
  NONE_YET: 'neutral',
  AUTOMATIC: 'neutral',
};
const docLabel = (t: string) => documentType(t as DocumentType)?.label ?? t;

export default function Documents201Screen() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [site, setSite] = useState('ALL');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [allRenewals, setAllRenewals] = useState(false);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [site, filter]);

  const summary = useQuery({ queryKey: ['hr', '201', 'summary'], queryFn: () => unwrap(api.GET('/records/summary')) });
  const filters = useQuery({ queryKey: ['hr', 'filters'], queryFn: () => unwrap(api.GET('/employees/filters')) });
  const siteId = filters.data?.sites.find((s) => s.name === site)?.id;
  const list = useQuery({
    queryKey: ['hr', '201', 'list', q, siteId, filter, page],
    queryFn: () => unwrap(api.GET('/records', { params: { query: { q: q || undefined, siteId, filter, page, pageSize: PAGE } } })),
    placeholderData: keepPreviousData,
  });
  const total = list.data?.total ?? 0;
  const s = summary.data;
  const renewals = s?.renewals ?? [];

  const nameLink = (id: string, name: string) => (
    <Pressable onPress={() => setPerson({ id, name })} accessibilityRole="link" accessibilityLabel={`View ${name}'s 201 file`} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
      {({ pressed }) => (
        <T size={14} weight="600" numberOfLines={1} style={{ textDecorationLine: pressed ? 'underline' : 'none' }}>
          {name}
        </T>
      )}
    </Pressable>
  );

  return (
    <Screen refreshing={summary.isRefetching || (list.isRefetching && !list.isPlaceholderData)} onRefresh={() => void (summary.refetch(), list.refetch())}>
      <ErrorText error={summary.error ?? list.error} onRetry={() => void (summary.refetch(), list.refetch())} />
      {summary.isLoading && <Loading />}

      {s && (
        <Card style={{ gap: 10 }}>
          <View style={styles.between}>
            <T size={13} muted>
              Complete 201 files
            </T>
            <T size={13} weight="600" style={mono}>
              {s.complete} / {s.employees}
            </T>
          </View>
          <View style={[styles.bar, { backgroundColor: c.tint }]}>
            <View style={[styles.bar, { width: `${s.employees ? Math.round((s.complete / s.employees) * 100) : 0}%`, backgroundColor: c.success }]} />
          </View>
          <View style={styles.grid}>
            {[
              { label: 'Incomplete', n: s.incomplete, color: c.warning },
              { label: 'Expired', n: s.withExpired, color: c.danger },
              { label: 'Expiring', n: s.expiringSoon, color: c.accent },
            ].map((x) => (
              <View key={x.label} style={[styles.cell, { backgroundColor: c.tint }]}>
                <View style={styles.legend}>
                  <View style={[styles.dot, { backgroundColor: x.color }]} />
                  <T size={11} muted numberOfLines={1}>
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
      )}

      {renewals.length > 0 && (
        <>
          <T size={11} weight="600" muted style={styles.label}>
            RENEWALS DUE · {renewals.length}
          </T>
          <Card style={{ paddingVertical: 4 }}>
            {(allRenewals ? renewals : renewals.slice(0, 5)).map((r, i) => (
              <View key={r.documentId} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                <View style={{ flex: 1, gap: 2 }}>
                  {nameLink(r.employeeId, r.employeeName)}
                  <T size={12} muted numberOfLines={1}>
                    {docLabel(r.type)} · {r.siteName}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Badge label={r.status === 'EXPIRED' ? 'Expired' : 'Expiring'} tone={r.status === 'EXPIRED' ? 'danger' : 'warning'} />
                  <T size={11} muted>
                    {formatDate(r.expiresOn)}
                  </T>
                </View>
              </View>
            ))}
            {renewals.length > 5 && (
              <Pressable onPress={() => setAllRenewals(!allRenewals)} accessibilityRole="button" style={[styles.more, { borderTopColor: c.border }]}>
                <T size={13} weight="600" style={{ color: c.accent }}>
                  {allRenewals ? 'Show fewer' : `Show all ${renewals.length}`}
                </T>
              </Pressable>
            )}
          </Card>
        </>
      )}

      <T size={11} weight="600" muted style={[styles.label, { marginTop: 4 }]}>
        EVERYONE'S 201 FILE
      </T>
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
      <SelectField label="Show" value={FILTERS.find((f) => f.value === filter)!.label} options={FILTERS.map((f) => f.label)} onChange={(v) => setFilter(FILTERS.find((f) => f.label === v)!.value)} />
      {(filters.data?.sites.length ?? 0) > 1 && (
        <SelectField label="Branch" value={site === 'ALL' ? 'All branches' : site} options={['All branches', ...filters.data!.sites.map((x) => x.name)]} onChange={(v) => setSite(v === 'All branches' ? 'ALL' : v)} />
      )}

      {list.isLoading && <Loading />}
      {list.data && list.data.items.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          Nobody matches these filters.
        </T>
      )}
      {list.data && list.data.items.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {list.data.items.map((r, i) => (
            <View key={r.employeeId} style={[styles.person, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
              <View style={styles.between}>
                <View style={{ flex: 1, gap: 2 }}>
                  {nameLink(r.employeeId, r.fullName)}
                  <T size={12} muted numberOfLines={1}>
                    {r.employeeNo} · {r.siteName}
                  </T>
                </View>
                <T size={15} weight="600" style={[mono, { color: r.summary.percent === 100 ? c.success : c.text }]}>
                  {r.summary.percent}%
                </T>
              </View>
              <View style={[styles.bar, { backgroundColor: c.tint }]}>
                <View style={[styles.bar, { width: `${r.summary.percent}%`, backgroundColor: r.summary.percent === 100 ? c.success : c.accent }]} />
              </View>
              <T size={12} muted numberOfLines={2}>
                {r.summary.missing ? `${r.summary.missing} missing` : 'Nothing missing'}
                {r.summary.expired ? ` · ${r.summary.expired} expired` : ''}
                {r.nextExpiry ? ` · ${docLabel(r.nextExpiry.type)} ${r.nextExpiry.expiresOn < new Date().toISOString().slice(0, 10) ? 'expired' : 'expires'} ${formatDate(r.nextExpiry.expiresOn)}` : ''}
              </T>
            </View>
          ))}
          {total > PAGE && (
            <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
              <Pager page={page - 1} pages={Math.ceil(total / PAGE)} onChange={(p) => setPage(p + 1)} />
            </View>
          )}
        </Card>
      )}

      <Sheet open={!!person} onClose={() => setPerson(null)} title={person ? `${person.name} · 201 file` : '201 file'} from="center">
        {person && <File201Details id={person.id} />}
      </Sheet>
    </Screen>
  );
}

/** One person's 201 checklist: % complete, then what needs attention first, then what's on file. */
function File201Details({ id }: { id: string }) {
  const { c } = useTheme();
  const file = useQuery({ queryKey: ['hr', '201', 'file', id], queryFn: () => unwrap(api.GET('/employees/{id}/201-file', { params: { path: { id } } })) });
  const f = file.data;
  const order: Record<string, number> = { MISSING: 0, EXPIRED: 1, EXPIRING: 2, ON_FILE: 3, AUTOMATIC: 4, NONE_YET: 5, NOT_NEEDED: 6 };
  const items = [...(f?.items ?? [])].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <>
      <ErrorText error={file.error} onRetry={() => void file.refetch()} />
      {file.isLoading && <Loading />}
      {f && (
        <>
          <Card style={{ gap: 8 }}>
            <View style={styles.between}>
              <T size={13} muted>
                {f.employee.employeeNo}
              </T>
              <T size={18} weight="600" style={mono}>
                {f.summary.percent}% complete
              </T>
            </View>
            <View style={[styles.bar, { backgroundColor: c.tint }]}>
              <View style={[styles.bar, { width: `${f.summary.percent}%`, backgroundColor: f.summary.percent === 100 ? c.success : c.accent }]} />
            </View>
            <T size={12} muted>
              {f.summary.missing} missing · {f.summary.expiring} expiring soon · {f.summary.expired} expired
            </T>
          </Card>
          <Card style={{ paddingVertical: 4 }}>
            {items.map((it, i) => (
              <View key={it.type} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={13} weight="500">
                    {docLabel(it.type)}
                  </T>
                  {it.expiresOn && (
                    <T size={11} muted>
                      Expires {formatDate(it.expiresOn)}
                    </T>
                  )}
                </View>
                <Badge label={CHECKLIST_STATUS_LABELS[it.status as keyof typeof CHECKLIST_STATUS_LABELS] ?? it.status} tone={STATUS_TONE[it.status as keyof typeof STATUS_TONE] ?? 'neutral'} />
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bar: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderRadius: 10, padding: 10, gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { letterSpacing: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  person: { gap: 6, paddingVertical: 12 },
  more: { borderTopWidth: 1, paddingVertical: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
});
