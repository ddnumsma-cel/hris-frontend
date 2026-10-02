import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { listEmployees, saveUnit, type UnitInput, type UnitSummary } from "@/lib/corehr/api";
import type { UnitType } from "@/lib/corehr/types";
import { inputClass, keys } from "./format";
import { ErrorNote, Field } from "./ui";

const LABEL: Record<UnitType, string> = { company: "Company", branch: "Branch", department: "Department", team: "Team" };
const PARENT: Record<UnitType, UnitType | null> = { company: null, branch: "company", department: "branch", team: "department" };

/** Add or edit a branch, department or team. */
export function UnitDialog({ input, units, onClose, onSaved }: { input: UnitInput; units: UnitSummary[]; onClose: () => void; onSaved: (name: string, id: string) => void }) {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const [v, setV] = useState(input);
  const label = LABEL[v.type].toLowerCase();
  const parentType = PARENT[v.type];
  const parents = units.filter((u) => u.type === parentType && u.active);
  const parentLabel = (u: UnitSummary) => (u.type === "department" ? `${u.name} · ${units.find((b) => b.id === u.parentId)?.name}` : u.name);
  const mutation = useMutation({
    mutationFn: () => saveUnit(v),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      onSaved(u.name, u.id);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={input.id ? `Edit ${input.name}` : `Add a ${label}`}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : input.id ? "Save changes" : `Add ${label}`}
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
        <Field id="u-name" label={`${LABEL[v.type]} name`} required>
          <input id="u-name" autoFocus className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={v.type === "branch" ? "e.g. Iloilo" : v.type === "department" ? "e.g. Finance" : "e.g. Payroll team"} />
        </Field>
        {parentType && parentType !== "company" && (
          <Field id="u-parent" label={`Which ${parentType} is it in?`} required hint={input.id ? `Changing this moves the ${label} and everyone in it.` : undefined}>
            <select id="u-parent" className={inputClass} value={v.parentId ?? ""} onChange={(e) => setV({ ...v, parentId: e.target.value })}>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {parentLabel(p)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="u-head" label={v.type === "team" ? "Team lead" : `${LABEL[v.type]} head`} hint="Optional. Who's in charge here.">
          <select id="u-head" className={inputClass} value={v.headEmployeeId ?? ""} onChange={(e) => setV({ ...v, headEmployeeId: e.target.value || undefined })}>
            <option value="">No one yet</option>
            {(employeesQuery.data ?? [])
              .filter((e) => e.status !== "Separated")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.positionTitle}
                </option>
              ))}
          </select>
        </Field>
        {v.type === "branch" && (
          <Field id="u-address" label="Office address">
            <textarea id="u-address" rows={2} className={clsx(inputClass, "resize-y")} value={v.address ?? ""} onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="Building, street, city" />
          </Field>
        )}
        <ErrorNote error={mutation.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
