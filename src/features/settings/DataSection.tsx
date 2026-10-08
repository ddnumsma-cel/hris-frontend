import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SaveBar } from "@/components/ui/SaveBar";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { AuditTrailPage } from "@/features/admin/administration/AuditTrailPage";
import { useActor } from "@/features/admin/corehr/format";
import { getSettings, saveSettings } from "@/lib/admin/api";
import { downloadTextFile } from "@/lib/download";
import { DATASETS, exportDataset, type Dataset } from "@/lib/settings/workspace";
import { SectionSkeleton } from "./AccountSection";
import { Embedded } from "./SettingsLayout";
import { useDraft, useUnsavedGuard } from "./useSettings";

const RETENTION = [
  { value: 0, label: "Keep everything" },
  { value: 12, label: "1 year" },
  { value: 24, label: "2 years" },
  { value: 36, label: "3 years" },
  { value: 60, label: "5 years" },
  { value: 120, label: "10 years" },
];

export function DataSection() {
  const { user } = useAuth();
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });
  const { draft, setDraft, dirty, discard } = useDraft<number>(settings.data?.retentionMonths);
  const guard = useUnsavedGuard(dirty);
  const [confirmAll, setConfirmAll] = useState(false);

  const stamp = new Date().toISOString().slice(0, 10);
  const download = async (d: Dataset) => {
    const csv = await exportDataset(d, actor);
    downloadTextFile(`heyhr-${d}-${stamp}.csv`, csv, "text/csv");
  };
  const exportOne = useMutation({
    mutationFn: download,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      toast.show("Export downloaded.");
    },
    onError: () => toast.show("Couldn't export that data. Try again.", "critical"),
  });
  const exportAll = useMutation({
    mutationFn: async () => {
      for (const d of DATASETS) await download(d.key);
    },
    onSuccess: () => {
      setConfirmAll(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      toast.show(`${DATASETS.length} files downloaded.`);
    },
    onError: () => toast.show("Couldn't finish the export. Try again.", "critical"),
  });
  const saveRetention = useMutation({
    mutationFn: (months: number) => saveSettings({ ...settings.data!, retentionMonths: months }, actor, user?.accountId),
    onSuccess: (next) => {
      queryClient.setQueryData(["admin", "settings"], next);
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      toast.show("Data retention saved.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });

  if (draft === undefined || !settings.data) return <SectionSkeleton title="Data & privacy" />;

  return (
    <>
      <SettingsHeader title="Data & privacy" description="Export your company's data, decide how long it's kept, and see who changed what." />

      <SettingsCard title="Export data" description="Download as CSV files you can open in Excel or Google Sheets. Exports are recorded in the audit trail.">
        {DATASETS.map((d) => (
          <SettingsRow key={d.key} label={d.label} help={d.description}>
            <Button variant="ghost" size="sm" disabled={exportOne.isPending || exportAll.isPending} onClick={() => exportOne.mutate(d.key)}>
              Export CSV
            </Button>
          </SettingsRow>
        ))}
        <div className="flex justify-end px-5 py-4">
          <Button disabled={exportAll.isPending} onClick={() => setConfirmAll(true)}>
            Export all data
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Data retention">
        <SettingsRow label="Keep records for" htmlFor="data-retention" help="Older records will be removed automatically once this is switched on.">
          {/* TODO(backend): a scheduled job that removes records older than this. Nothing is deleted yet. */}
          <select id="data-retention" className="field w-full px-3 py-2 text-sm" value={draft} onChange={(e) => setDraft(Number(e.target.value))}>
            {RETENTION.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <SaveBar visible={dirty} saving={saveRetention.isPending} invalid={false} onDiscard={discard} onSave={() => saveRetention.mutate(draft)} />

      <Embedded>
        <AuditTrailPage />
      </Embedded>

      <ConfirmDialog
        open={confirmAll}
        title="Export all data?"
        message={`This downloads ${DATASETS.length} CSV files with employee and account details. Keep them somewhere safe.`}
        confirmLabel="Export all"
        pendingLabel="Exporting…"
        isPending={exportAll.isPending}
        onConfirm={() => exportAll.mutate()}
        onClose={() => setConfirmAll(false)}
      />
      {guard}
    </>
  );
}
