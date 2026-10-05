import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { updateEmployeeProfile } from "@/lib/api";
import type { CoreEmployee } from "@/lib/corehr/types";
import { myContact, updateMyContact } from "@/lib/ess/api";
import type { Employee } from "@/lib/types";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field } from "../admin/corehr/ui";

type Contact = CoreEmployee["contact"];

function EditProfileForm({ employee, contact, onClose, onSubmitted }: { employee: Employee; contact: Contact; onClose: () => void; onSubmitted: () => void }) {
  const queryClient = useQueryClient();
  const [c, setC] = useState(contact);
  const set = (patch: Partial<Contact>) => setC({ ...c, ...patch });

  const mutation = useMutation({
    mutationFn: async () => {
      // Saved to the HR record (and its history); the 201 File summary follows.
      await updateMyContact(c);
      await updateEmployeeProfile({ email: employee.email ?? c.workEmail, phone: c.mobile, emergencyContact: `${c.emergencyName} (${c.emergencyRelationship}) · ${c.emergencyPhone}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      onClose();
      onSubmitted();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-ink-2">Keep how HR can reach you up to date. Your name, ID numbers and job details can only be changed by HR.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="p-mobile" label="Mobile number" required>
          <input id="p-mobile" className={inputClass} value={c.mobile} placeholder="+63 9XX XXX XXXX" onChange={(e) => set({ mobile: e.target.value })} />
        </Field>
        <Field id="p-email" label="Personal email">
          <input id="p-email" type="email" className={inputClass} value={c.personalEmail} onChange={(e) => set({ personalEmail: e.target.value })} />
        </Field>
        <Field id="p-addr" label="Home address" className="sm:col-span-2">
          <input id="p-addr" className={inputClass} value={c.address} placeholder="House no., street, barangay" onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field id="p-city" label="City / municipality">
          <input id="p-city" className={inputClass} value={c.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field id="p-prov" label="Province">
          <input id="p-prov" className={inputClass} value={c.province} onChange={(e) => set({ province: e.target.value })} />
        </Field>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Emergency contact</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="p-en" label="Name" required>
            <input id="p-en" className={inputClass} value={c.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} />
          </Field>
          <Field id="p-er" label="Relationship" required>
            <input id="p-er" className={inputClass} value={c.emergencyRelationship} placeholder="e.g. Mother" onChange={(e) => set({ emergencyRelationship: e.target.value })} />
          </Field>
          <Field id="p-ep" label="Phone" required>
            <input id="p-ep" className={inputClass} value={c.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} />
          </Field>
        </div>
      </div>
      <ErrorNote error={mutation.error} />
      <div className="flex justify-end gap-2">
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

export function EditProfileDialog({ open, employee, onClose, onSubmitted }: { open: boolean; employee: Employee | null; onClose: () => void; onSubmitted: () => void }) {
  const contact = useQuery({ queryKey: ["ess", "contact"], queryFn: myContact, enabled: open, staleTime: 0 });
  return (
    <Dialog open={open} onClose={onClose} title="Update my contact details" size="lg" dismissOnBackdrop={false}>
      {open && employee && (contact.data ? <EditProfileForm key={employee.id} employee={employee} contact={contact.data} onClose={onClose} onSubmitted={onSubmitted} /> : contact.isLoading ? <Skeleton className="h-64 w-full" /> : <p className="text-sm text-ink-2">Your HR record wasn't found. Please contact HR.</p>)}
    </Dialog>
  );
}
