// Approvals (/admin/approvals for HR, /manager/approvals for approvers) from the HR server's approval inbox: HR decides
// leave and attendance fixes, approvers everything from their team (see scope.ts).
// The list is grouped by type, each row with quick ✓ (approve now) and ✕ (decline, asks for a reason); tapping a row
// opens a centred panel with the whole request (and, for leave, the balance left after it) and Decline / Approve.
// Decided shows the same groups with the outcome.

import { LABELS, formatDate } from '@msma/shared';
import { unwrap } from '@msma/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Segmented, Sheet } from '~/components/sheets';
import { Badge, Button, Card, ErrorText, Loading, RequestStatusBadge, Screen, T, font } from '~/components/ui';
import { api } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { useScope } from './scope';

type Approval = NonNullable<Awaited<ReturnType<typeof listApprovals>>>['items'][number];
const listApprovals = () => unwrap(api.GET('/approvals'));

/** The server's one-line summary: "Vacation · 22–23 Oct 2026 · 2 days · Family event in Bohol". */
const parts = (detail: string) => {
  const [label = '', when = '', what = '', ...rest] = detail.split(' · ');
  return { label, when, what, reason: rest.join(' · ') };
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const ago = (iso: string) => {
  const d = daysSince(iso);
  return d < 1 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
};

export default function ApprovalsScreen() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { kinds } = useScope();
  const [view, setView] = useState<'pending' | 'decided'>('pending');
  // The request open in the panel; `declining` shows the reason box.
  const [open, setOpen] = useState<Approval | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [approveAll, setApproveAll] = useState<Approval[] | null>(null);

  const list = useQuery({ queryKey: ['hr', 'approvals', 'all'], queryFn: listApprovals, refetchInterval: 10_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hr'] });
  const approve = useMutation({ mutationFn: (id: string) => unwrap(api.POST('/approvals/{id}/approve', { params: { path: { id } }, body: {} })), onSuccess: refresh });
  const decline = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/approvals/{id}/reject', { params: { path: { id } }, body: { reason: reason.trim() } })),
    onSuccess: () => {
      close();
      void refresh();
    },
  });
  const all = useMutation({
    // One after another, so each decision is logged like a single one.
    mutationFn: async (items: Approval[]) => {
      for (const a of items) await unwrap(api.POST('/approvals/{id}/approve', { params: { path: { id: a.id } }, body: {} }));
    },
    onSettled: () => {
      setApproveAll(null);
      void refresh();
    },
  });

  const show = (a: Approval, decline = false) => {
    setOpen(a);
    setDeclining(decline);
    setReason('');
  };
  const close = () => {
    setOpen(null);
    setDeclining(false);
    setReason('');
  };

  const mine = (list.data?.items ?? []).filter((a) => kinds.includes(a.type));
  const items = mine.filter((a) => (view === 'pending' ? a.status === 'PENDING' : a.status !== 'PENDING'));
  const pendingCount = mine.filter((a) => a.status === 'PENDING').length;
  const groups = kinds.map((k) => ({ kind: k, items: items.filter((a) => a.type === k) })).filter((g) => g.items.length);
  const busy = (id: string) => approve.isPending && approve.variables === id;

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Segmented
        label="Show"
        value={view}
        onChange={setView}
        options={[
          { value: 'pending', label: `Pending · ${pendingCount}` },
          { value: 'decided', label: 'Decided' },
        ]}
      />

      <ErrorText error={list.error} onRetry={() => void list.refetch()} />
      {list.isLoading && <Loading />}
      {list.data && items.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          {view === 'pending' ? 'Nothing waiting for a decision.' : 'No decided requests yet.'}
        </T>
      )}
      {(approve.error || all.error) && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{(approve.error ?? all.error)!.message}</T>
        </Card>
      )}

      {groups.map((g) => (
        <View key={g.kind} style={{ gap: 8 }}>
          <View style={styles.groupHead}>
            <T size={11} weight="600" muted style={styles.label}>
              {LABELS.approvalType[g.kind].toUpperCase()} · {g.items.length}
            </T>
            {view === 'pending' && g.items.length > 1 && (
              <Pressable onPress={() => setApproveAll(g.items)} accessibilityRole="button" hitSlop={8}>
                <T size={12} weight="600" style={{ color: c.accent }}>
                  Approve all
                </T>
              </Pressable>
            )}
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map((a, i) => {
              const p = parts(a.detail);
              return (
                <View key={a.id} style={[styles.row, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
                  <View style={styles.rowMain}>
                    <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
                      <T size={12} weight="600" style={{ color: c.accent }}>
                        {a.employee.fullName
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      {/* Only the name opens the request, underlined while pressed. */}
                      <Pressable onPress={() => show(a)} accessibilityRole="link" accessibilityLabel={`View ${a.employee.fullName}'s request`} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                        {({ pressed }) => (
                          <T size={14} weight="600" numberOfLines={1} style={{ textDecorationLine: pressed ? 'underline' : 'none' }}>
                            {a.employee.fullName}
                          </T>
                        )}
                      </Pressable>
                      <T size={12} muted numberOfLines={2}>
                        {[p.label, p.when, p.what].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                  </View>
                  {view === 'pending' ? (
                    <View style={styles.quick}>
                      <Pressable onPress={() => show(a, true)} accessibilityRole="button" accessibilityLabel={`Decline ${a.employee.fullName}'s request`} hitSlop={4} style={[styles.round, { backgroundColor: c.dangerSoft }]}>
                        <Ionicons name="close" size={18} color={c.danger} />
                      </Pressable>
                      <Pressable onPress={() => approve.mutate(a.id)} disabled={busy(a.id)} accessibilityRole="button" accessibilityLabel={`Approve ${a.employee.fullName}'s request`} hitSlop={4} style={[styles.round, { backgroundColor: c.successSoft, opacity: busy(a.id) ? 0.5 : 1 }]}>
                        <Ionicons name="checkmark" size={18} color={c.success} />
                      </Pressable>
                    </View>
                  ) : (
                    <RequestStatusBadge status={a.status} />
                  )}
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      {open && <RequestSheet a={open} declining={declining} setDeclining={setDeclining} reason={reason} setReason={setReason} onClose={close} approve={approve} decline={decline} />}

      <Sheet open={!!approveAll} onClose={() => setApproveAll(null)} title="Approve all?" from="center">
        {approveAll && (
          <>
            <T size={14}>
              Approve all {approveAll.length} {LABELS.approvalType[approveAll[0]!.type].toLowerCase()} requests? Each person is told right away.
            </T>
            <T size={13} muted>
              {approveAll.map((a) => a.employee.fullName).join(', ')}
            </T>
            <Button label={`Approve ${approveAll.length}`} icon="checkmark" onPress={() => all.mutate(approveAll)} loading={all.isPending} />
            <Button label="Cancel" variant="outline" onPress={() => setApproveAll(null)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

/** The whole request, with Decline / Approve while it's pending. */
function RequestSheet({
  a,
  declining,
  setDeclining,
  reason,
  setReason,
  onClose,
  approve,
  decline,
}: {
  a: Approval;
  declining: boolean;
  setDeclining: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  onClose: () => void;
  approve: { mutate: (id: string, o?: { onSuccess?: () => void }) => void; isPending: boolean };
  decline: { mutate: (id: string) => void; isPending: boolean; error: Error | null };
}) {
  const { c } = useTheme();
  const p = parts(a.detail);
  const pending = a.status === 'PENDING';
  // For leave: what the person has left of that type, and after these days.
  const person = useQuery({
    queryKey: ['hr', 'person', a.employee.id],
    queryFn: () => unwrap(api.GET('/employees/{id}', { params: { path: { id: a.employee.id } } })),
    enabled: a.type === 'LEAVE',
  });
  const balance = person.data?.leaveBalances.find((b) => b.leaveTypeName.toLowerCase().startsWith(p.label.toLowerCase()));
  const days = Number(p.what.match(/^([\d.]+) day/)?.[1] ?? 0);
  const left = balance ? Number(balance.remaining) - (pending ? days : 0) : null;

  const rows: [string, string][] = [
    ['Type', a.type === 'LEAVE' ? `${p.label} leave` : LABELS.approvalType[a.type]],
    ['Date', p.when],
    ['Details', p.what],
    ['Reason', p.reason],
    ['Filed', `${formatDate(a.createdAt.slice(0, 10))} · ${ago(a.createdAt)}`],
  ];
  if (!pending) rows.push(['Decision', `${LABELS.requestStatus[a.status]}${a.decidedAt ? ` · ${formatDate(a.decidedAt.slice(0, 10))}` : ''}${a.decidedBy ? ` by ${a.decidedBy}` : ''}`]);
  if (!pending && a.reason) rows.push(['Note', a.reason]);

  return (
    <Sheet open onClose={onClose} title={`${LABELS.approvalType[a.type]} request`} from="center">
      <View style={styles.head}>
        <View style={[styles.avatar, styles.avatarBig, { backgroundColor: c.accentSoft }]}>
          <T size={14} weight="600" style={{ color: c.accent }}>
            {a.employee.fullName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={16} weight="600">
            {a.employee.fullName}
          </T>
          <T size={12} muted>
            {a.employee.employeeNo} · {a.employee.siteName}
          </T>
        </View>
        {pending ? <Badge label={LABELS.approvalType[a.type]} tone="accent" /> : <RequestStatusBadge status={a.status} />}
      </View>

      <Card style={{ paddingVertical: 4 }}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v], i) => (
            <View key={k} style={[styles.kv, i ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
              <T size={13} muted>
                {k}
              </T>
              <T size={13} weight="600" style={{ flexShrink: 1, textAlign: 'right' }}>
                {v}
              </T>
            </View>
          ))}
      </Card>

      {balance && left !== null && (
        <View style={{ gap: 4 }}>
          <View style={styles.kvPlain}>
            <T size={12} muted>
              {p.label} left{pending ? ' after this' : ''}
            </T>
            <T size={12} weight="600" style={{ color: left < 0 ? c.danger : c.text }}>
              {left.toFixed(1)} of {balance.entitled}
            </T>
          </View>
          <View style={[styles.meter, { backgroundColor: c.tint }]}>
            <View style={[styles.meter, { width: `${Math.max(0, Math.min(100, (left / Math.max(1, Number(balance.entitled))) * 100))}%`, backgroundColor: left < 0 ? c.danger : c.accent }]} />
          </View>
        </View>
      )}

      {pending &&
        (declining ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why is it declined?"
              placeholderTextColor={c.muted}
              multiline
              maxLength={300}
              autoFocus
              accessibilityLabel="Reason for declining"
              style={[styles.input, font(), { borderColor: c.border, backgroundColor: c.fieldBg, color: c.text }]}
            />
            {decline.error && <T style={{ color: c.danger }}>{decline.error.message}</T>}
            <View style={styles.buttons}>
              <View style={{ flex: 1 }}>
                <Button label="Back" variant="outline" onPress={() => setDeclining(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Decline" icon="close" onPress={() => decline.mutate(a.id)} loading={decline.isPending} disabled={reason.trim().length < 3} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.buttons}>
            <View style={{ flex: 1 }}>
              <Button label="Decline" variant="outline" onPress={() => setDeclining(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Approve" icon="checkmark" onPress={() => approve.mutate(a.id, { onSuccess: onClose })} loading={approve.isPending} />
            </View>
          </View>
        ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { letterSpacing: 1 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarBig: { width: 44, height: 44, borderRadius: 22 },
  quick: { flexDirection: 'row', gap: 8 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  kvPlain: { flexDirection: 'row', justifyContent: 'space-between' },
  meter: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { minHeight: 72, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 16, textAlignVertical: 'top' },
});
