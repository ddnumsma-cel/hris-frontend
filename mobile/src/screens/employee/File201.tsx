import { Ionicons } from '@expo/vector-icons';
import {
  type ChecklistItem,
  CHECKLIST_STATUS_LABELS,
  documentType,
  formatDate,
} from '@msma/shared';
import { View } from 'react-native';
import { Badge, Card, ErrorText, Loading, Screen, SectionTitle, T } from '~/components/ui';
import { useMy201File } from '~/lib/queries';
import { useTheme } from '~/lib/theme';

function Row({ item, first }: { item: ChecklistItem; first: boolean }) {
  const { c } = useTheme();
  const def = documentType(item.type);
  const tone =
    item.status === 'ON_FILE'
      ? 'success'
      : item.status === 'EXPIRING'
        ? 'warning'
        : item.status === 'AUTOMATIC'
          ? 'accent'
          : 'danger';
  const label =
    item.status === 'EXPIRING' && item.expiresOn
      ? `Expires ${formatDate(item.expiresOn)}`
      : item.status === 'EXPIRED' && item.expiresOn
        ? `Expired ${formatDate(item.expiresOn)}`
        : CHECKLIST_STATUS_LABELS[item.status];
  const icon =
    item.status === 'ON_FILE'
      ? 'checkmark'
      : item.status === 'EXPIRING'
        ? 'time-outline'
        : item.status === 'AUTOMATIC'
          ? 'refresh'
          : 'alert-circle-outline';
  return (
    <View
      style={{
        paddingVertical: 12,
        gap: 6,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
      }}
    >
      <T weight="600">{def.label}</T>
      <Badge label={label} tone={tone} icon={icon} />
    </View>
  );
}

/**
 * The employee's own 201 file: what HR still needs from them and what to renew soon.
 * Read-only. Restricted records (IDs, medical) show their status only.
 */
export default function My201Screen() {
  const file = useMy201File();
  const { c } = useTheme();
  const f = file.data;
  const needed = f?.items.filter((i) => i.required && i.status === 'MISSING') ?? [];
  const renew = f?.items.filter((i) => i.status === 'EXPIRING' || i.status === 'EXPIRED') ?? [];
  const onFile = f?.items.filter((i) => i.status === 'ON_FILE' && i.required) ?? [];

  return (
    <Screen refreshing={file.isRefetching} onRefresh={() => void file.refetch()}>
      <ErrorText error={file.error} onRetry={() => void file.refetch()} />
      {file.isLoading && <Loading />}
      {f && (
        <>
          <Card>
            <T muted size={14}>
              Your 201 file (personnel record)
            </T>
            <T size={30} weight="700" style={{ marginTop: 2 }}>
              {f.summary.percent}% complete
            </T>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: c.border,
                marginTop: 8,
                overflow: 'hidden',
              }}
              accessibilityLabel={`${f.summary.percent} percent complete`}
            >
              <View
                style={{
                  width: `${f.summary.percent}%`,
                  height: '100%',
                  backgroundColor: needed.length || renew.length ? c.warning : c.success,
                }}
              />
            </View>
            <T muted size={14} style={{ marginTop: 8 }}>
              {needed.length === 0 && renew.length === 0
                ? 'Everything HR needs is on file. Thank you!'
                : 'Bring the originals to HR, or ask HR how to send a clear copy.'}
            </T>
          </Card>

          {needed.length > 0 && (
            <>
              <SectionTitle>HR still needs from you</SectionTitle>
              <Card style={{ paddingVertical: 4 }}>
                {needed.map((i, n) => (
                  <Row key={i.type} item={i} first={n === 0} />
                ))}
              </Card>
            </>
          )}

          {renew.length > 0 && (
            <>
              <SectionTitle>Renew soon</SectionTitle>
              <Card style={{ paddingVertical: 4 }}>
                {renew.map((i, n) => (
                  <Row key={i.type} item={i} first={n === 0} />
                ))}
              </Card>
            </>
          )}

          <SectionTitle>On file</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {onFile.map((i, n) => (
              <Row key={i.type} item={i} first={n === 0} />
            ))}
          </Card>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={c.muted}
              style={{ marginTop: 2 }}
            />
            <T muted size={12} style={{ flex: 1 }}>
              IDs, medical results and disciplinary records are restricted: only HR can open them.
              Every opening is recorded. Ask HR if you need a copy.
            </T>
          </View>
        </>
      )}
    </Screen>
  );
}
