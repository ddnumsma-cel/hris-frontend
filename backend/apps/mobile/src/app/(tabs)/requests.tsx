import { formatAgo, formatDate, LABELS } from '@msma/shared';
import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Card, ErrorText, Loading, RequestStatusBadge, Screen, T } from '@/components/ui';
import { useMyRequests } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const FILE: {
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint: string;
}[] = [
  { href: '/leave-new', icon: 'calendar-outline', label: 'Leave', hint: 'Vacation, sick, SIL' },
  {
    href: '/overtime-new',
    icon: 'time-outline',
    label: 'Overtime',
    hint: 'Worked or will work extra',
  },
  {
    href: '/undertime-new',
    icon: 'exit-outline',
    label: 'Undertime',
    hint: 'Leave before my shift ends',
  },
  {
    href: '/time-adjustment-new',
    icon: 'create-outline',
    label: 'Time adjustment',
    hint: 'Missing or wrong time in / out',
  },
];

function FileRequestCard() {
  const { c } = useTheme();
  return (
    <Card>
      <T weight="600" style={{ marginBottom: 4 }}>
        File a request
      </T>
      {FILE.map((f) => (
        <Pressable
          key={f.label}
          onPress={() => router.push(f.href)}
          accessibilityRole="button"
          accessibilityLabel={`File ${f.label.toLowerCase()}: ${f.hint}`}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name={f.icon} size={24} color={c.accent} />
          <View style={{ flex: 1 }}>
            <T weight="600">{f.label}</T>
            <T muted size={13}>
              {f.hint}
            </T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      ))}
    </Card>
  );
}

export default function RequestsScreen() {
  const q = useMyRequests();
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <FileRequestCard />
      <T muted size={13}>
        Updates automatically when your manager or HR decides.
      </T>
      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading && <Loading />}
      {q.data?.length === 0 && <T muted>No requests yet.</T>}
      {(q.data ?? []).map((r) => (
        <Card key={r.id}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Badge label={LABELS.approvalType[r.type]} />
            <RequestStatusBadge status={r.status} />
          </View>
          <T style={{ marginTop: 8 }}>{r.detail}</T>
          <T muted size={12} style={{ marginTop: 6 }}>
            Filed {formatAgo(r.createdAt)}
            {r.decidedAt
              ? ` · ${LABELS.requestStatus[r.status].toLowerCase()} ${formatDate(r.decidedAt)}`
              : ''}
          </T>
          {r.reason && (
            <T size={13} style={{ marginTop: 6 }}>
              Reason: {r.reason}
            </T>
          )}
        </Card>
      ))}
    </Screen>
  );
}
