import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, ShieldIcon } from "@/components/icons";
import { LogCpdUnitsDialog } from "@/components/shared/LogCpdUnitsDialog";
import { deleteComplianceItem, fetchComplianceCalendar, fetchProfessionalLicenses, updateComplianceStatus } from "@/lib/api";
import { getCpdStatus, getEffectiveCompliance } from "@/lib/automation";
import { formatToday } from "@/lib/format";
import type { ComplianceItem, CpdStatus, ProfessionalLicense } from "@/lib/types";
import { ComplianceItemDialog } from "./ComplianceItemDialog";

const complianceVariant: Record<string, ChipVariant> = {
  Filed: "good",
  "Due soon": "warn",
  Overdue: "crit",
};

const cpdVariant: Record<CpdStatus, ChipVariant> = {
  Compliant: "good",
  "In progress": "neutral",
  "Due soon": "warn",
  Overdue: "crit",
};

export function AdminCompliancePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ComplianceItem | null>(null);
  const [loggingLicense, setLoggingLicense] = useState<ProfessionalLicense | null>(null);
  const complianceQuery = useQuery({ queryKey: ["admin", "compliance-calendar"], queryFn: fetchComplianceCalendar });
  const licensesQuery = useQuery({
    queryKey: ["admin", "professional-licenses"],
    queryFn: fetchProfessionalLicenses,
  });
  const items = complianceQuery.data;

  const mutation = useMutation({
    mutationFn: (id: string) => updateComplianceStatus(id, "Filed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "compliance-calendar"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComplianceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "compliance-calendar"] });
      toast.show("Filing removed.");
      setDeletingItem(null);
    },
  });

  const effective = useMemo(() => (items ?? []).map((item) => ({ item, ...getEffectiveCompliance(item) })), [items]);
  const licenses = useMemo(
    () => (licensesQuery.data ?? []).map((license) => ({ license, ...getCpdStatus(license) })),
    [licensesQuery.data],
  );

  const counts = useMemo(
    () => ({
      filed: effective.filter((e) => e.status === "Filed").length,
      dueSoon: effective.filter((e) => e.status === "Due soon").length,
      overdue: effective.filter((e) => e.status === "Overdue").length,
    }),
    [effective],
  );

  function openAdd() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: ComplianceItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  return (
    <>
      <ContentHead
        title="Compliance"
        subtitle={formatToday()}
        actions={<Button icon={<ShieldIcon className="h-3.75 w-3.75" />} onClick={openAdd}>Add filing</Button>}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <StatTile label="Filed" value={counts.filed} tone="good" />
        <StatTile label="Due soon" value={counts.dueSoon} tone="warn" />
        <StatTile label="Overdue" value={counts.overdue} tone="crit" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Filing", "Agency", "Due", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effective.map(({ item, status, note }) => (
                <tr key={item.id}>
                  <td className="border-b border-border px-4 py-2.5">{item.filing}</td>
                  <td className="border-b border-border px-4 py-2.5">{item.agency}</td>
                  <td className="border-b border-border px-4 py-2.5">{item.due}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={complianceVariant[status]}>
                      {status}
                      {note ? ` · ${note}` : ""}
                    </Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {status !== "Filed" && (
                        <button
                          type="button"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate(item.id)}
                          className="text-xs font-bold text-brand-ink disabled:opacity-50"
                        >
                          Mark filed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex items-center gap-1 text-xs font-bold text-ink-2 hover:text-ink"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        className="text-xs font-bold text-critical"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Professional licenses" meta="CPA · CPD compliance" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Employee", "License No.", "CPD units", "Cycle ends", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {licenses.map(({ license, status, note }) => (
                <tr key={license.id}>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={license.employeeInitials} />
                      {license.employeeName}
                    </div>
                  </td>
                  <td className="font-num border-b border-border px-4 py-2.5">{license.licenseNumber}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">
                    {license.cpdUnitsEarned}/{license.cpdUnitsRequired}
                  </td>
                  <td className="border-b border-border px-4 py-2.5">{license.cycleEndDate}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={cpdVariant[status]}>
                      {status} · {note}
                    </Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setLoggingLicense(license)}
                      className="text-xs font-bold text-brand-ink"
                    >
                      Log units
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ComplianceItemDialog
        open={dialogOpen}
        existing={editingItem}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show(editingItem ? "Filing updated." : "Filing added.")}
      />

      <ConfirmDialog
        open={deletingItem !== null}
        title="Remove filing"
        message={`Remove "${deletingItem?.filing}"? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingItem!.id)}
        onClose={() => setDeletingItem(null)}
      />

      <LogCpdUnitsDialog
        license={loggingLicense}
        onClose={() => setLoggingLicense(null)}
        onSubmitted={() => toast.show("CPD units logged.")}
      />
    </>
  );
}
