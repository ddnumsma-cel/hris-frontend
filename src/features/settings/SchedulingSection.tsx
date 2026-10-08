import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveBar } from "@/components/ui/SaveBar";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { useToast } from "@/components/ui/ToastContext";
import { useActor } from "@/features/admin/corehr/format";
import { SchedulesPage } from "@/features/admin/timekeeping/SchedulesPage";
import { ShiftsPage } from "@/features/admin/timekeeping/ShiftsPage";
import { getSchedulingRules, saveSchedulingRules } from "@/lib/settings/workspace";
import type { SchedulingRules } from "@/lib/timekeeping/store";
import { SectionSkeleton } from "./AccountSection";
import { Embedded } from "./SettingsLayout";
import { useDraft, useUnsavedGuard } from "./useSettings";

const inputClass = "field w-full px-3 py-2 text-sm";

export function SchedulingSection() {
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["settings", "scheduling"], queryFn: getSchedulingRules });
  const { draft, setDraft, dirty, discard } = useDraft<SchedulingRules>(rules.data);
  const guard = useUnsavedGuard(dirty);
  const save = useMutation({
    mutationFn: (r: SchedulingRules) => saveSchedulingRules(r, actor),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings", "scheduling"], next);
      // Overtime is recomputed from the new threshold.
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Scheduling rules saved.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });

  if (!draft) return <SectionSkeleton title="Scheduling" />;
  const errors = {
    overtimeThresholdMinutes: draft.overtimeThresholdMinutes >= 0 && draft.overtimeThresholdMinutes <= 240 ? undefined : "0 to 240 minutes.",
    defaultBreakMinutes: draft.defaultBreakMinutes >= 0 && draft.defaultBreakMinutes <= 120 ? undefined : "0 to 120 minutes.",
    publishLeadDays: draft.publishLeadDays >= 0 && draft.publishLeadDays <= 60 ? undefined : "0 to 60 days.",
  };
  const invalid = Object.values(errors).some(Boolean);
  const num = (k: keyof SchedulingRules, max: number, step = 1) => ({
    id: `sch-${k}`,
    type: "number",
    min: 0,
    max,
    step,
    className: inputClass,
    value: draft[k],
    "aria-invalid": !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: e.target.valueAsNumber }),
  });

  return (
    <>
      <SettingsHeader title="Scheduling" description="Overtime and break rules, shift types, and who works which shift." />

      <SettingsCard title="Rules">
        <SettingsRow label="Overtime threshold (minutes)" htmlFor="sch-overtimeThresholdMinutes" help="Extra time after a shift shorter than this isn't counted as overtime. 0 counts every minute." error={errors.overtimeThresholdMinutes}>
          <input {...num("overtimeThresholdMinutes", 240, 5)} />
        </SettingsRow>
        <SettingsRow label="Default break (minutes)" htmlFor="sch-defaultBreakMinutes" help="Unpaid lunch break pre-filled for new shifts; each shift can set its own." error={errors.defaultBreakMinutes}>
          <input {...num("defaultBreakMinutes", 120, 15)} />
        </SettingsRow>
        <SettingsRow label="Publish schedules (days ahead)" htmlFor="sch-publishLeadDays" help="How far in advance schedules should be ready. Reminders for this are coming." error={errors.publishLeadDays}>
          {/* TODO: there's no schedule publishing step yet; stored for when there is. */}
          <input {...num("publishLeadDays", 60)} />
        </SettingsRow>
      </SettingsCard>

      <SaveBar visible={dirty} saving={save.isPending} invalid={invalid} onDiscard={discard} onSave={() => save.mutate(draft)} />

      <Embedded>
        <ShiftsPage />
      </Embedded>
      <Embedded>
        <SchedulesPage />
      </Embedded>
      {guard}
    </>
  );
}
