import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import { fetchAssignment, updateMasterData } from "@/lib/coreHr";
import type { Employee } from "@/lib/types";
import { Field, inputClass } from "./ui";

/** Name, contact details and hire date — the employee master record. */
export function MasterDataDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const toast = useToast();
  const actor = useAuditActor();
  const queryClient = useQueryClient();
  const assignmentQuery = useQuery({ queryKey: ["corehr", "assignment", employee.id], queryFn: () => fetchAssignment(employee.id) });
  const [v, setV] = useState({ name: employee.name, email: employee.email ?? "", phone: employee.phone ?? "", emergencyContact: employee.emergencyContact ?? "" });
  const [dateHired, setDateHired] = useState<string | undefined>(undefined);
  const hired = dateHired ?? assignmentQuery.data?.dateHired ?? "";

  const mutation = useMutation({
    mutationFn: () => updateMasterData({ employeeId: employee.id, ...v, dateHired: hired || undefined, actor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employee.id] });
      toast.show("Employee details saved.");
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit employee details"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save details"}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="text-xs text-ink-2">
          Position, department and salary change through <span className="font-semibold">History → Record change</span>, so every move stays on record.
        </p>
        <Field id="md-name" label="Full name" required>
          <input id="md-name" autoFocus className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="md-email" label="Work email">
            <input id="md-email" type="email" className={inputClass} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field id="md-phone" label="Mobile">
            <input id="md-phone" type="tel" className={inputClass} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="0917 000 0000" />
          </Field>
        </div>
        <Field id="md-emergency" label="Emergency contact" hint="Name, relationship and number">
          <input id="md-emergency" className={inputClass} value={v.emergencyContact} onChange={(e) => setV({ ...v, emergencyContact: e.target.value })} />
        </Field>
        <Field id="md-hired" label="Date hired" className="sm:max-w-[14rem]">
          <input id="md-hired" type="date" className={inputClass} value={hired} onChange={(e) => setDateHired(e.target.value)} />
        </Field>
        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-critical-tint px-3.5 py-2.5 text-sm text-critical">
            {(mutation.error as Error).message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
