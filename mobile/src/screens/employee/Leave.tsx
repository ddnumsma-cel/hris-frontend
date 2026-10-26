// Leave (the website's /employee/leave): this year's balances and the leave I've filed, from the backend.

import { formatDate } from '@msma/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, ErrorText, Loading, RequestStatusBadge, Screen, SectionTitle, T, mono } from '~/components/ui';
import { useLeaveBalances, useMyRequests } from '~/lib/queries';

export default function LeaveScreen() {
  const balances = useLeaveBalances();
  const requests = useMyRequests();
  const leave = (requests.data ?? []).filter((r) => r.type === 'LEAVE');
  return (
    <Screen refreshing={balances.isRefetching || requests.isRefetching} onRefresh={() => void (balances.refetch(), requests.refetch())}>
      <Button label="File leave" icon="calendar-outline" onPress={() => router.push('/employee/leave/new')} />

      <SectionTitle>Leave balances · {new Date().getFullYear()}</SectionTitle>
      <ErrorText error={balances.error} onRetry={() => void balances.refetch()} />
      {balances.isLoading && <Loading />}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {balances.data?.map((b) => (
          <Card key={b.leaveTypeCode} style={{ flex: 1, padding: 12 }}>
            <T size={24} weight="600" style={mono}>
              {b.remaining}{' '}
              <T size={12} weight="500" muted>
                left
              </T>
            </T>
            {/* Short names keep the three cards even: "Vacation", "Sick", and the code for long ones ("SIL"). */}
            <T size={13} weight="500" numberOfLines={1} accessibilityLabel={b.leaveTypeName}>
              {b.leaveTypeName.split(' ').length > 2 ? b.leaveTypeCode : b.leaveTypeName.replace(/ leave$/i, '')}
            </T>
            <T size={11} muted style={{ marginTop: 4 }}>
              {b.used} of {b.entitled} used
            </T>
          </Card>
        ))}
      </View>

      <SectionTitle>My leave requests</SectionTitle>
      <ErrorText error={requests.error} onRetry={() => void requests.refetch()} />
      {requests.isLoading && <Loading />}
      {requests.data && leave.length === 0 && (
        <T muted size={14}>
          No leave filed yet.
        </T>
      )}
      {leave.map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T size={14} weight="600" style={{ flex: 1 }}>
              {r.detail}
            </T>
            <RequestStatusBadge status={r.status} />
          </View>
          <T size={12} muted>
            Filed {formatDate(r.createdAt)}
            {r.reason ? ` · ${r.reason}` : ''}
          </T>
        </Card>
      ))}
    </Screen>
  );
}
