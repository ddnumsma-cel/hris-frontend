import { unwrap } from '@msma/api-client';
import type {
  CreateLeaveRequest,
  CreateOvertimeRequest,
  CreateTimeAdjustment,
  CreateUndertimeRequest,
  UpdatePreferences,
} from '@msma/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import type { PhoneCheckMethod } from './phone-check';

/** Poll so a decision made on the web shows up on the phone within ~10 seconds. */
const LIVE_MS = 10_000;

export const useToday = () =>
  useQuery({
    queryKey: ['me', 'today'],
    queryFn: () => unwrap(api.GET('/me/today')),
    refetchInterval: 30_000,
  });

export const useLeaveBalances = () =>
  useQuery({
    queryKey: ['me', 'leave-balances'],
    queryFn: () => unwrap(api.GET('/me/leave-balances')),
    refetchInterval: LIVE_MS,
  });

export const useMyRequests = () =>
  useQuery({
    queryKey: ['me', 'requests'],
    queryFn: () => unwrap(api.GET('/me/requests')),
    refetchInterval: LIVE_MS,
  });

export const useMyAttendance = () =>
  useQuery({ queryKey: ['me', 'attendance'], queryFn: () => unwrap(api.GET('/me/attendance')) });

export const useLatestPayslip = () =>
  useQuery({
    queryKey: ['me', 'payslip'],
    queryFn: () => unwrap(api.GET('/me/payslips/latest')),
    retry: false,
  });

export function useClock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phoneCheck: PhoneCheckMethod) =>
      unwrap(api.POST('/me/clock', { body: { phoneCheck } })),
    onSuccess: (res) => {
      queryClient.setQueryData(['me', 'today'], res.today);
      void queryClient.invalidateQueries({ queryKey: ['me', 'attendance'] });
    },
  });
}

export function useFileLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLeaveRequest) => unwrap(api.POST('/me/leave-requests', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

/** Overtime, undertime and time adjustment requests: filed, then shown under Requests. */
export function useFileOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOvertimeRequest) =>
      unwrap(api.POST('/me/overtime-requests', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useFileUndertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUndertimeRequest) =>
      unwrap(api.POST('/me/undertime-requests', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useFileTimeAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTimeAdjustment) => unwrap(api.POST('/me/time-adjustments', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUpdatePreferences() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (prefs: UpdatePreferences) => unwrap(api.PATCH('/me/preferences', { body: prefs })),
    onSuccess: setUser,
  });
}

export const useMy201File = () =>
  useQuery({ queryKey: ['me', '201-file'], queryFn: () => unwrap(api.GET('/me/201-file')) });
