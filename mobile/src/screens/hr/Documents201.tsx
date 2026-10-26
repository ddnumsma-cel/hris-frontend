// 201 documents (/admin/maintenance/documents) from the HR server: a ring with how complete everyone's 201 file is, status
// chips (Needs work, Expired, Expiring, Done, Everyone), search and office pills, then people as two-column cards with their
// own ring, 10 per page. Tapping a card opens that person's file in a centred dialog: what needs attention first, then
// what's on file.

import { CHECKLIST_STATUS_LABELS, documentType, formatDate, type DocumentType } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Sheet } from '~/components/sheets';
import { Badge, Card, ErrorText, Loading, Pager, Screen, T, font, mono } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';

const PAGE = 10;
const FILTERS = [
  { value: 'INCOMPLETE', label: 'Needs work' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'EXPIRING', label: 'Expiring' },
  { value: 'COMPLETE', label: 'Done' },
  { value: 'ALL', label: 'Everyone' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];
const docLabel = (t: string) => documentType(t as DocumentType)?.label ?? t;

/** A progress ring with the percent in the middle. */
function Ring({ percent, size = 40, color }: { percent: number; size?: number; color?: string }) {
  const { c } = useTheme();
  const stroke = size >= 64 ? 7 : 4;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.tint} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? (percent === 100 ? c.success : c.accent)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(len * percent) / 100} ${len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <T size={size >= 64 ? 17 : 11} weight="600" style={mono}>
        {percent}%
      </T>
    </View>
  );
}

export default function Documents201Screen() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [site, setSite] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('INCOMPLETE');
  const [page, setPage] = useState(1);
  const [person, setPerson] = useState<string | null>(null);
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
  const list = useQuery({
    queryKey: ['hr', '201', 'list', q, site, filter, page],
    queryFn: () => unwrap(api.GET('/records', { params: { query: { q: q || undefined, siteId: site, filter, page, pageSize: PAGE } } })),
    placeholderData: keepPreviousData,
  });
  const total = list.data?.total ?? 0;
  const s = summary.data;
  const items = list.data?.items ?? [];
  // Two cards per row; an odd last card keeps its half width.
  const rows = Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2));
  const sites = filters.data?.sites ?? [];

  return (
    <Screen refreshing={summary.isRefetching || (list.isRefetching && !list.isPlaceholderData)} onRefresh={() => void (summary.refetch(), list.refetch())}>
      <ErrorText error={summary.error ?? list.error} onRetry={() => void (summary.refetch(), list.refetch())} />
      {summary.isLoading && <Loading />}

      {s && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring percent={s.employees ? Math.round((s.complete / s.employees) * 100) : 0} size={76} color={c.success} />
          <View style={{ flex: 1, gap: 4 }}>
            <T size={14} weight="600">
              {s.complete} of {s.employees} complete
            </T>
            {[
              { label: 'Incomplete', n: s.incomplete, color: c.warning },
              { label: 'Expired', n: s.withExpired, color: c.danger },
              { label: 'Expiring', n: s.expiringSoon, color: c.accent },
            ].map((x) => (
              <View key={x.label} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: x.color }]} />
                <T size={12} muted style={{ flex: 1 }}>
                  {x.label}
                </T>
                <T size={12} weight="600" style={mono}>
                  {x.n}
                </T>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Chips value={filter} options={FILTERS} onChange={setFilter} label="Show" />

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
      {sites.length > 1 && (
        <Chips value={site} options={[{ value: undefined, label: 'All offices' }, ...sites.map((x) => ({ value: x.id as string | undefined, label: x.name }))]} onChange={setSite} label="Office" />
      )}

      {list.isLoading && <Loading />}
      {list.data && items.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          Nobody matches these filters.
        </T>
      )}
      {rows.map((pair) => (
        <View key={pair[0].employeeId} style={styles.pair}>
          {pair.map((r) => {
            const expired = r.summary.expired;
            const missing = r.summary.missing;
            return (
              <Pressable
                key={r.employeeId}
                onPress={() => setPerson(r.employeeId)}
                accessibilityRole="button"
                accessibilityLabel={`View ${r.fullName}'s 201 file, ${r.summary.percent}% complete`}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.75 : 1 }]}
              >
                <Card style={{ gap: 8, flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Ring percent={r.summary.percent} />
                    {expired > 0 ? <Badge label={`${expired} expired`} tone="danger" /> : missing > 0 ? <Badge label={`${missing} missing`} tone="warning" /> : <Badge label="Complete" tone="success" />}
                  </View>
                  <T size={14} weight="600" numberOfLines={1}>
                    {r.fullName}
                  </T>
                  <T size={12} muted numberOfLines={1}>
                    {r.siteName}
                    {expired > 0 && missing > 0 ? ` · ${missing} missing` : ''}
                  </T>
                </Card>
              </Pressable>
            );
          })}
          {pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
      {total > PAGE && <Pager page={page - 1} pages={Math.ceil(total / PAGE)} onChange={(p) => setPage(p + 1)} />}

      <Sheet open={!!person} onClose={() => setPerson(null)} title="201 file" from="center">
        {person && <File201Details id={person} />}
      </Sheet>
    </Screen>
  );
}

/** One row of pill chips; the selected one is filled. */
function Chips<V>({ value, options, onChange, label }: { value: V; options: readonly { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.chip, on ? { backgroundColor: c.text, borderColor: c.text } : { borderColor: c.border, backgroundColor: c.fieldBg }]}
          >
            <T size={13} weight={on ? '600' : '400'} style={{ color: on ? c.bg : c.muted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type Icon = ComponentProps<typeof Ionicons>['name'];
const ATTENTION: Record<string, { icon: Icon; tone: 'danger' | 'warning'; order: number }> = {
  EXPIRED: { icon: 'alert-circle-outline', tone: 'danger', order: 0 },
  MISSING: { icon: 'add', tone: 'warning', order: 1 },
  EXPIRING: { icon: 'time-outline', tone: 'warning', order: 2 },
};

/** One person's 201 file: the ring, then what needs attention, then what's on file. */
function File201Details({ id }: { id: string }) {
  const { c } = useTheme();
  const file = useQuery({ queryKey: ['hr', '201', 'file', id], queryFn: () => unwrap(api.GET('/employees/{id}/201-file', { params: { path: { id } } })) });
  const f = file.data;
  const attention = (f?.items ?? []).filter((it) => it.status in ATTENTION).sort((a, b) => ATTENTION[a.status].order - ATTENTION[b.status].order);
  const onFile = (f?.items ?? []).filter((it) => it.status === 'ON_FILE' || it.status === 'AUTOMATIC');
  const other = (f?.items ?? []).filter((it) => it.status === 'NOT_NEEDED' || it.status === 'NONE_YET');
  const soft = { danger: c.dangerSoft, warning: c.warningSoft };
  const strong = { danger: c.danger, warning: c.warning };

  return (
    <>
      <ErrorText error={file.error} onRetry={() => void file.refetch()} />
      {file.isLoading && <Loading />}
      {f && (
        <>
          <View style={styles.head}>
            <Ring percent={f.summary.percent} size={76} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={17} weight="600">
                {f.employee.fullName}
              </T>
              <T size={12} muted>
                {f.employee.employeeNo}
              </T>
              <T size={12} muted>
                {f.summary.complete} of {f.summary.required} on file
              </T>
            </View>
          </View>

          {attention.length > 0 && (
            <>
              <T size={11} weight="600" muted style={[styles.label, { marginTop: 4 }]}>
                NEEDS ATTENTION · {attention.length}
              </T>
              <Card style={{ paddingVertical: 4 }}>
                {attention.map((it, i) => {
                  const a = ATTENTION[it.status];
                  return (
                    <View key={it.type} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                      <View style={[styles.docIcon, { backgroundColor: soft[a.tone] }]}>
                        <Ionicons name={a.icon} size={18} color={strong[a.tone]} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T size={13} weight="600">
                          {docLabel(it.type)}
                        </T>
                        <T size={12} muted>
                          {it.status === 'MISSING' ? 'Not submitted' : it.expiresOn ? `${it.status === 'EXPIRED' ? 'Expired' : 'Expires'} ${formatDate(it.expiresOn)}` : ''}
                        </T>
                      </View>
                      <Badge label={CHECKLIST_STATUS_LABELS[it.status as keyof typeof CHECKLIST_STATUS_LABELS] ?? it.status} tone={a.tone} />
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          {onFile.length > 0 && (
            <>
              <T size={11} weight="600" muted style={[styles.label, { marginTop: 4 }]}>
                ON FILE · {onFile.length}
              </T>
              <Card style={{ paddingVertical: 4 }}>
                {onFile.map((it, i) => (
                  <View key={it.type} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                    <View style={[styles.docIcon, { backgroundColor: c.successSoft }]}>
                      <Ionicons name="checkmark" size={18} color={c.success} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={13}>{docLabel(it.type)}</T>
                      {(it.expiresOn || it.status === 'AUTOMATIC') && (
                        <T size={12} muted>
                          {it.status === 'AUTOMATIC' ? CHECKLIST_STATUS_LABELS.AUTOMATIC : `Expires ${formatDate(it.expiresOn!)}`}
                        </T>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {other.length > 0 && (
            <>
              <T size={11} weight="600" muted style={[styles.label, { marginTop: 4 }]}>
                NOT REQUIRED · {other.length}
              </T>
              <Card style={{ paddingVertical: 4 }}>
                {other.map((it, i) => (
                  <View key={it.type} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                    <T size={13} muted style={{ flex: 1 }}>
                      {docLabel(it.type)}
                    </T>
                    <T size={12} muted>
                      {CHECKLIST_STATUS_LABELS[it.status as keyof typeof CHECKLIST_STATUS_LABELS]}
                    </T>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  pair: { flexDirection: 'row', gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  label: { letterSpacing: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  docIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
