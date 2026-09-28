import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import type { Employee, PartnerProfile } from "@/lib/types";

export const settingsInputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
export const settingsLabelClass = "mb-1 block text-xs font-semibold text-ink-2";

const officeOptions: Employee["office"][] = ["Cebu HQ", "Manila", "Davao"];

export type ProfileSettingsInput = Omit<PartnerProfile, "initials">;

/** Name, title, office and contact details for the signed-in Partner or HR user. */
export function ProfileSettingsForm({
  profile,
  save,
  queryKey,
  personalMeta,
  aboutPlaceholder,
}: {
  profile: PartnerProfile;
  save: (input: ProfileSettingsInput) => Promise<PartnerProfile>;
  queryKey: QueryKey;
  personalMeta: string;
  aboutPlaceholder: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileSettingsInput>({
    name: profile.name,
    title: profile.title,
    email: profile.email,
    phone: profile.phone,
    office: profile.office,
    emergencyContact: profile.emergencyContact,
    about: profile.about,
  });

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      refreshUser();
      toast.show("Your profile was saved.");
    },
  });

  function field<K extends keyof ProfileSettingsInput>(key: K) {
    return {
      value: form[key],
      onChange: (e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [key]: e.target.value as ProfileSettingsInput[K] })),
    };
  }

  const initials = form.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ ...form, name: form.name.trim(), title: form.title.trim() });
      }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader title="Personal information" meta={personalMeta} />
        <CardBody className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-gold text-base font-bold text-[#2B1C05]">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{form.name || "Your name"}</div>
              <div className="truncate text-xs text-ink-2">{form.title || "Your title"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className={settingsLabelClass}>
                Full name
              </label>
              <input id="settings-name" required className={settingsInputClass} {...field("name")} />
            </div>
            <div>
              <label htmlFor="settings-title" className={settingsLabelClass}>
                Position / title
              </label>
              <input id="settings-title" required className={settingsInputClass} {...field("title")} />
            </div>
            <div>
              <label htmlFor="settings-office" className={settingsLabelClass}>
                Office
              </label>
              <select id="settings-office" className={settingsInputClass} {...field("office")}>
                {officeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="settings-about" className={settingsLabelClass}>
              About
            </label>
            <textarea
              id="settings-about"
              rows={3}
              placeholder={aboutPlaceholder}
              className={settingsInputClass}
              {...field("about")}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact details" />
        <CardBody className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-email" className={settingsLabelClass}>
              Work email
            </label>
            <input id="settings-email" type="email" required className={settingsInputClass} {...field("email")} />
          </div>
          <div>
            <label htmlFor="settings-phone" className={settingsLabelClass}>
              Mobile number
            </label>
            <input id="settings-phone" type="tel" className={settingsInputClass} {...field("phone")} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="settings-emergency" className={settingsLabelClass}>
              Emergency contact
            </label>
            <input
              id="settings-emergency"
              placeholder="Name (Relationship) · Phone"
              className={settingsInputClass}
              {...field("emergencyContact")}
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
