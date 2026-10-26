// Certificates (the website's /employee/certificates): request one and follow it. Phone-only demo for now: the
// website's in-browser certificate store, kept on this phone, so HR on the website doesn't see these yet.

import { formatDate } from '@msma/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { cancelCertificateRequest, createCertificateRequest, fetchCertificateRequests } from '@/lib/api';
import { certificateTypes } from '@/lib/schemas';
import type { CertificateRequestStatus } from '@/lib/types';
import { Chip, ReasonInput } from '~/components/form';
import { Badge, Button, Card, ErrorText, Loading, Screen, SectionTitle, T } from '~/components/ui';
import { useTheme } from '~/lib/theme';
import { useSession } from '~/session';

const KEY = ['ess', 'certificates'];

const TONE: Record<CertificateRequestStatus, 'warning' | 'accent' | 'success' | 'danger'> = {
  Pending: 'warning',
  'Ready for pickup': 'accent',
  Released: 'success',
  Declined: 'danger',
};

/** The signed-in person, as the website's demo data knows them (their employee number). */
function useMe() {
  const { user } = useSession();
  return { id: user?.account.employeeId ?? '', name: user?.name ?? '' };
}

export default function CertificatesScreen() {
  const me = useMe();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: fetchCertificateRequests });
  const cancel = useMutation({ mutationFn: cancelCertificateRequest, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const mine = (list.data ?? []).filter((r) => r.employeeId === me.id);
  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Button label="Request certificate" icon="document-text-outline" onPress={() => router.push('/employee/certificates/new')} />
      <SectionTitle>My requests</SectionTitle>
      <ErrorText error={list.error} onRetry={() => void list.refetch()} />
      {list.isLoading && <Loading />}
      {list.data && mine.length === 0 && (
        <T muted size={14}>
          No certificate requests yet.
        </T>
      )}
      {mine.map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <T weight="600" style={{ flex: 1 }}>
              {r.type}
            </T>
            <Badge label={r.status} tone={TONE[r.status]} />
          </View>
          <T size={14}>For: {r.purpose}</T>
          <T size={12} muted>
            Requested {formatDate(r.requestedOn)}
          </T>
          {r.note && (
            <T size={13} muted>
              HR: {r.note}
            </T>
          )}
          {r.status === 'Pending' && (
            <View style={{ marginTop: 8 }}>
              <Button label="Cancel request" variant="outline" onPress={() => cancel.mutate(r.id)} loading={cancel.isPending && cancel.variables === r.id} />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

export function CertificateNewScreen() {
  const { c } = useTheme();
  const me = useMe();
  const qc = useQueryClient();
  const [type, setType] = useState<string>(certificateTypes[0]);
  const [purpose, setPurpose] = useState('');
  const send = useMutation({
    mutationFn: () => createCertificateRequest({ type, purpose: purpose.trim(), employee: me }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      router.replace('/employee/certificates');
    },
  });
  return (
    <Screen>
      <SectionTitle>Certificate</SectionTitle>
      <View style={{ gap: 8 }}>
        {certificateTypes.map((t) => (
          <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      <SectionTitle>What is it for?</SectionTitle>
      <ReasonInput value={purpose} onChange={setPurpose} placeholder="e.g. Bank loan application" />
      {send.error && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{send.error.message}</T>
        </Card>
      )}
      <Button label="Send to HR" icon="send" onPress={() => send.mutate()} loading={send.isPending} disabled={purpose.trim().length < 3} />
    </Screen>
  );
}
