'use client';

import { unwrap } from '@msma/api-client';
import type {
  ApprovalType,
  CreateLeaveRequest,
  CreateOvertimeRequest,
  CreateTimeAdjustment,
  CreateUndertimeRequest,
  EmployeeListQuery,
  RecordsListQuery,
  RequestStatus,
  UpdateDocument,
  UpdatePersonalInfo,
  UpdatePreferences,
  UploadDocumentFields,
} from '@msma/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export const LIVE_REFRESH_MS = 10_000;

export function useDashboard(siteId?: string) {
  return useQuery({
    queryKey: ['dashboard', siteId ?? 'all'],
    queryFn: () => unwrap(api.GET('/dashboard/summary', { params: { query: { siteId } } })),
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

export function useOrgFilters() {
  return useQuery({
    queryKey: ['org-filters'],
    queryFn: () => unwrap(api.GET('/employees/filters')),
    staleTime: 5 * 60_000,
  });
}

export function useEmployees(query: Partial<EmployeeListQuery>) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: () => unwrap(api.GET('/employees', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => unwrap(api.GET('/employees/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export function useApprovals(
  status?: RequestStatus,
  type?: ApprovalType,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: ['approvals', status ?? 'ALL', type ?? 'ALL'],
    queryFn: () =>
      unwrap(api.GET('/approvals', { params: { query: { status, type, limit: 200 } } })),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'approve' | 'reject';
      reason?: string;
    }) =>
      decision === 'approve'
        ? unwrap(
            api.POST('/approvals/{id}/approve', { params: { path: { id } }, body: { reason } }),
          )
        : unwrap(
            api.POST('/approvals/{id}/reject', {
              params: { path: { id } },
              body: { reason: reason ?? '' },
            }),
          ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['employee'] });
    },
  });
}

export function usePayrollPreview(cutoff: string, siteId?: string) {
  return useQuery({
    queryKey: ['payroll-preview', cutoff, siteId ?? 'all'],
    queryFn: () => unwrap(api.POST('/payroll/preview', { params: { query: { cutoff, siteId } } })),
    placeholderData: keepPreviousData,
  });
}

export function useUpdatePreferences() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (prefs: UpdatePreferences) => unwrap(api.PATCH('/me/preferences', { body: prefs })),
    onSuccess: (user) => setUser(user),
  });
}

// ---------- 201 file ----------

export function use201File(employeeId: string | null) {
  return useQuery({
    queryKey: ['201-file', employeeId],
    queryFn: () =>
      unwrap(api.GET('/employees/{id}/201-file', { params: { path: { id: employeeId! } } })),
    enabled: !!employeeId,
  });
}

export function useRecordsSummary(siteId?: string, enabled = true) {
  return useQuery({
    queryKey: ['records-summary', siteId ?? 'all'],
    queryFn: () => unwrap(api.GET('/records/summary', { params: { query: { siteId } } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecords(query: Partial<RecordsListQuery>) {
  return useQuery({
    queryKey: ['records', query],
    queryFn: () => unwrap(api.GET('/records', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

/** After any 201 change, refresh everything that shows 201 status. */
function useInvalidate201() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['201-file', 'records', 'records-summary', 'employees', 'employee'])
      void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useUploadDocument() {
  const invalidate = useInvalidate201();
  return useMutation({
    mutationFn: ({
      employeeId,
      file,
      ...fields
    }: { employeeId: string; file: File } & UploadDocumentFields) => {
      const form = new FormData();
      form.set('file', file);
      for (const [k, v] of Object.entries(fields)) if (v) form.set(k, String(v));
      return unwrap(
        api.POST('/employees/{id}/documents', {
          params: { path: { id: employeeId } },
          body: form as never,
          bodySerializer: (b) => b as unknown as FormData,
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useUpdateDocument() {
  const invalidate = useInvalidate201();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateDocument) =>
      unwrap(api.PATCH('/documents/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useArchiveDocument() {
  const invalidate = useInvalidate201();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(api.POST('/documents/{id}/archive', { params: { path: { id } }, body: { reason } })),
    onSuccess: invalidate,
  });
}

export function useDocumentViews(id: string | null) {
  return useQuery({
    queryKey: ['document-views', id],
    queryFn: () => unwrap(api.GET('/documents/{id}/views', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

/** Open a document in a new tab (the API needs the sign-in token, so it is fetched first). */
export async function openDocument(id: string) {
  // Open the tab synchronously (inside the click) so pop-up blockers allow it.
  const tab = window.open('', '_blank');
  try {
    const { data, response } = await api.GET('/documents/{id}/file', {
      params: { path: { id } },
      parseAs: 'blob',
    });
    if (!response.ok || !data) {
      const body = await response.json().catch(() => null);
      throw new Error(
        (body as { message?: string } | null)?.message ?? 'Could not open the document',
      );
    }
    const url = URL.createObjectURL(data as Blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export function useUpdatePersonal() {
  const invalidate = useInvalidate201();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdatePersonalInfo) =>
      unwrap(api.PATCH('/employees/{id}/personal', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useEnrollBiometrics() {
  const invalidate = useInvalidate201();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/employees/{id}/biometric-enrollment', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

// ---------- Leave page (HR / managers) ----------

export function useLeaveOverview(siteId?: string) {
  return useQuery({
    queryKey: ['leave-overview', siteId ?? 'all'],
    queryFn: () => unwrap(api.GET('/leave/overview', { params: { query: { siteId } } })),
    placeholderData: keepPreviousData,
  });
}

// ---------- My requests (web users who are also employees) ----------

export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: ['me', 'requests'],
    queryFn: () => unwrap(api.GET('/me/requests')),
    enabled,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useMyToday(enabled = true) {
  return useQuery({
    queryKey: ['me', 'today'],
    queryFn: () => unwrap(api.GET('/me/today')),
    enabled,
  });
}

export function useMyLeaveBalances(enabled = true) {
  return useQuery({
    queryKey: ['me', 'leave-balances'],
    queryFn: () => unwrap(api.GET('/me/leave-balances')),
    enabled,
  });
}

export type FileRequest =
  | { kind: 'LEAVE'; body: CreateLeaveRequest }
  | { kind: 'OT'; body: CreateOvertimeRequest }
  | { kind: 'UNDERTIME'; body: CreateUndertimeRequest }
  | { kind: 'DTR_FIX'; body: CreateTimeAdjustment };

/** File leave, overtime, undertime or a time adjustment. It goes to the manager / HR for approval. */
export function useFileRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (r: FileRequest) => {
      switch (r.kind) {
        case 'LEAVE':
          return unwrap(api.POST('/me/leave-requests', { body: r.body }));
        case 'OT':
          return unwrap(api.POST('/me/overtime-requests', { body: r.body }));
        case 'UNDERTIME':
          return unwrap(api.POST('/me/undertime-requests', { body: r.body }));
        case 'DTR_FIX':
          return unwrap(api.POST('/me/time-adjustments', { body: r.body }));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['leave-overview'] });
    },
  });
}
