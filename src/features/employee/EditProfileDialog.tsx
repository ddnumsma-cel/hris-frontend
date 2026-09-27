import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateEmployeeProfile } from "@/lib/api";
import type { Employee } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function EditProfileForm({
  employee,
  onClose,
  onSubmitted,
}: {
  employee: Employee;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [emergencyContact, setEmergencyContact] = useState(employee.emergencyContact ?? "");

  const mutation = useMutation({
    mutationFn: updateEmployeeProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      onClose();
      onSubmitted();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ email, phone, emergencyContact });
      }}
      className="flex flex-col gap-3.5"
    >
      <div>
        <label htmlFor="profile-email" className={labelClass}>
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="profile-phone" className={labelClass}>
          Phone
        </label>
        <input
          id="profile-phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="profile-emergency" className={labelClass}>
          Emergency contact
        </label>
        <input
          id="profile-emergency"
          required
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          placeholder="Name (Relationship) · Phone"
          className={inputClass}
        />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function EditProfileDialog({
  open,
  employee,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Edit profile">
      {open && employee && (
        <EditProfileForm key={employee.id} employee={employee} onClose={onClose} onSubmitted={onSubmitted} />
      )}
    </Dialog>
  );
}
