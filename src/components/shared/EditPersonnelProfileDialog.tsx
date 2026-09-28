import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { PlusIcon, XIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import { updatePersonnelProfile } from "@/lib/api";
import type { CivilStatus, Dependent, PersonnelProfile } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

const CIVIL_STATUSES: CivilStatus[] = ["Single", "Married", "Widowed", "Separated"];

let dependentIdSeq = 0;
function newDependentId() {
  dependentIdSeq += 1;
  return `new-dep-${Date.now()}-${dependentIdSeq}`;
}

export function EditPersonnelProfileDialog({
  employeeId,
  profile,
  onClose,
  onSubmitted,
}: {
  employeeId: string;
  profile: PersonnelProfile | undefined;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? "");
  const [civilStatus, setCivilStatus] = useState<CivilStatus | "">(profile?.civilStatus ?? "");
  const [dependents, setDependents] = useState<Dependent[]>(profile?.dependents ?? []);

  const mutation = useMutation({
    mutationFn: () =>
      updatePersonnelProfile(
        employeeId,
        {
          birthDate: birthDate || undefined,
          civilStatus: civilStatus || undefined,
          dependents,
        },
        user && (user.role === "manager" || user.role === "admin") ? { name: user.name, role: user.role } : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel", "profile", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  function addDependent() {
    setDependents((prev) => [...prev, { id: newDependentId(), name: "", relationship: "Child" }]);
  }

  function updateDependent(id: string, patch: Partial<Dependent>) {
    setDependents((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDependent(id: string) {
    setDependents((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <Dialog open onClose={onClose} title="Edit personal profile">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile-birthdate" className={labelClass}>
              Birth date
            </label>
            <input
              id="profile-birthdate"
              type="date"
              className={inputClass}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="profile-civil-status" className={labelClass}>
              Civil status
            </label>
            <select
              id="profile-civil-status"
              className={inputClass}
              value={civilStatus}
              onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
            >
              <option value="">—</option>
              {CIVIL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={labelClass}>Dependents</span>
            <button
              type="button"
              onClick={addDependent}
              className="flex items-center gap-1 text-xs font-bold text-brand-ink"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {dependents.length === 0 && <p className="text-xs text-ink-3">No dependents on file.</p>}
            {dependents.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder="Full name"
                  value={d.name}
                  onChange={(e) => updateDependent(d.id, { name: e.target.value })}
                />
                <select
                  className={inputClass + " max-w-28"}
                  value={d.relationship}
                  onChange={(e) => updateDependent(d.id, { relationship: e.target.value as Dependent["relationship"] })}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                </select>
                <button
                  type="button"
                  aria-label="Remove dependent"
                  onClick={() => removeDependent(d.id)}
                  className="flex-none text-critical"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
