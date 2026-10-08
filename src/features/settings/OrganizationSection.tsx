import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { SaveBar } from "@/components/ui/SaveBar";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useActor } from "@/features/admin/corehr/format";
import { getSettings, saveSettings } from "@/lib/admin/api";
import type { Settings } from "@/lib/admin/store";
import { timezoneOptions } from "@/lib/preferences";
import { SectionSkeleton } from "./AccountSection";
import { useDraft, useUnsavedGuard } from "./useSettings";

const inputClass = "field w-full px-3 py-2 text-sm";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENCIES = [
  { value: "PHP", label: "Philippine peso (₱)" },
  { value: "USD", label: "US dollar ($)" },
  { value: "SGD", label: "Singapore dollar (S$)" },
  { value: "EUR", label: "Euro (€)" },
];
const MAX_LOGO_BYTES = 1024 * 1024;

function errorsFor(s: Settings) {
  const e: Partial<Record<keyof Settings, string>> = {};
  if (!s.companyName.trim()) e.companyName = "Enter the company name.";
  if (s.tin && !/^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/.test(s.tin.trim())) e.tin = "TIN looks like 000-000-000-00000.";
  if (s.contactEmail && !/^\S+@\S+\.\S+$/.test(s.contactEmail.trim())) e.contactEmail = "Enter a valid email address.";
  if (!s.workWeek.length) e.workWeek = "Pick at least one working day.";
  if (!(s.workStart < s.workEnd)) e.workEnd = "Working hours must end after they start.";
  if (!(s.minPasswordLength >= 8 && s.minPasswordLength <= 64)) e.minPasswordLength = "8 to 64 characters.";
  if (!(s.idleMinutes >= 5 && s.idleMinutes <= 480)) e.idleMinutes = "5 to 480 minutes.";
  if (!(s.lockAfterFailed >= 3 && s.lockAfterFailed <= 10)) e.lockAfterFailed = "3 to 10 tries.";
  if (!(s.lockMinutes >= 5 && s.lockMinutes <= 1440)) e.lockMinutes = "5 to 1,440 minutes.";
  return e;
}

export function OrganizationSection() {
  const { user } = useAuth();
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });
  const { draft, setDraft, dirty, discard } = useDraft<Settings>(settings.data);
  const guard = useUnsavedGuard(dirty);
  const logoRef = useRef<HTMLInputElement>(null);
  const [tried, setTried] = useState(false);
  const save = useMutation({
    mutationFn: (s: Settings) => saveSettings(s, actor, user?.accountId),
    onSuccess: (next) => {
      queryClient.setQueryData(["admin", "settings"], next);
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      setTried(false);
      toast.show("Organization settings saved.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });

  if (!draft) return <SectionSkeleton title="Organization" />;
  const errors = errorsFor(draft);
  const invalid = Object.keys(errors).length > 0;
  const show = (k: keyof Settings) => (tried || dirty ? errors[k] : undefined);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const num = (k: keyof Settings, min: number, max: number) => ({
    id: `org-${k}`,
    type: "number",
    min,
    max,
    className: inputClass,
    value: draft[k] as number,
    "aria-invalid": !!show(k),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.valueAsNumber } as Partial<Settings>),
  });

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.show("Choose an image file (PNG, JPG or SVG).", "critical");
    if (file.size > MAX_LOGO_BYTES) return toast.show("Choose an image under 1 MB.", "critical");
    const reader = new FileReader();
    reader.onload = () => set({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const toggleDay = (d: number) => set({ workWeek: draft.workWeek.includes(d) ? draft.workWeek.filter((x) => x !== d) : [...draft.workWeek, d].sort() });

  return (
    <>
      <SettingsHeader title="Organization" description="Company details, working time, and sign-in rules for everyone." />

      <SettingsCard title="Company" description="Shown on printed reports and documents.">
        <SettingsRow label="Company name" htmlFor="org-companyName" error={show("companyName")}>
          <input id="org-companyName" className={inputClass} value={draft.companyName} aria-invalid={!!show("companyName")} onChange={(e) => set({ companyName: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Logo" help="PNG, JPG or SVG, up to 1 MB.">
          <div className="flex items-center justify-end gap-3">
            {draft.logo ? (
              <img src={draft.logo} alt="Company logo" className="h-10 max-w-28 flex-none rounded-[var(--radius-logo)] object-contain" />
            ) : (
              <span className="text-xs text-ink-2">No logo</span>
            )}
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" aria-label="Upload a company logo" onChange={(e) => pickLogo(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" onClick={() => logoRef.current?.click()}>
              Upload
            </Button>
            {draft.logo && (
              <Button variant="ghost" size="sm" onClick={() => set({ logo: "" })}>
                Remove
              </Button>
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Address" htmlFor="org-address">
          <input id="org-address" className={inputClass} value={draft.address} onChange={(e) => set({ address: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Company TIN" htmlFor="org-tin" error={show("tin")}>
          <input id="org-tin" className={inputClass} placeholder="000-000-000-00000" value={draft.tin} aria-invalid={!!show("tin")} onChange={(e) => set({ tin: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="HR email" htmlFor="org-mail" help="Where employees send questions." error={show("contactEmail")}>
          <input id="org-mail" type="email" className={inputClass} value={draft.contactEmail} aria-invalid={!!show("contactEmail")} onChange={(e) => set({ contactEmail: e.target.value })} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Region">
        <SettingsRow label="Default timezone" htmlFor="org-tz" help="For anyone who hasn't picked their own in Account settings.">
          <select id="org-tz" className={inputClass} value={draft.defaultTimezone} onChange={(e) => set({ defaultTimezone: e.target.value })}>
            {timezoneOptions().map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label="Currency" htmlFor="org-currency" help="Payroll is calculated in pesos; other currencies aren't converted yet.">
          {/* TODO: amounts aren't relabelled or converted; payroll stays in PHP. */}
          <select id="org-currency" className={inputClass} value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Working time" description="Leave filed in working days skips the days that aren't working days here.">
        <SettingsRow label="Work week" error={show("workWeek")} stacked>
          <div role="group" aria-label="Working days" className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const on = draft.workWeek.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[i]}
                  onClick={() => toggleDay(i)}
                  className={clsx(
                    "h-9 min-w-12 rounded-[var(--radius-control)] border px-3 text-[13px] font-medium transition-colors",
                    on ? "border-transparent bg-[image:var(--grad-primary)] text-[var(--on-accent)]" : "border-[var(--line-strong)] bg-[var(--field-bg)] text-ink-2 hover:text-ink",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </SettingsRow>
        <SettingsRow label="Standard hours" error={show("workEnd")}>
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="org-start" className="sr-only">
              Work starts
            </label>
            <input id="org-start" type="time" className={inputClass} value={draft.workStart} onChange={(e) => set({ workStart: e.target.value })} />
            <span aria-hidden="true" className="text-ink-2">
              –
            </span>
            <label htmlFor="org-end" className="sr-only">
              Work ends
            </label>
            <input id="org-end" type="time" className={inputClass} value={draft.workEnd} aria-invalid={!!show("workEnd")} onChange={(e) => set({ workEnd: e.target.value })} />
          </div>
        </SettingsRow>
        <SettingsRow label="Fiscal year starts" htmlFor="org-fy">
          <select id="org-fy" className={inputClass} value={draft.fiscalYearStartMonth} onChange={(e) => set({ fiscalYearStartMonth: Number(e.target.value) })}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Sign-in security" description="Applies to every account. Changes take effect at the next sign-in.">
        <SettingsRow label="Minimum password length" htmlFor="org-minPasswordLength" help="Used for new and reset passwords." error={show("minPasswordLength")}>
          <input {...num("minPasswordLength", 8, 64)} />
        </SettingsRow>
        <SettingsRow label="Sign out after inactivity (minutes)" htmlFor="org-idleMinutes" error={show("idleMinutes")}>
          <input {...num("idleMinutes", 5, 480)} />
        </SettingsRow>
        <SettingsRow label="Lock after this many wrong passwords" htmlFor="org-lockAfterFailed" error={show("lockAfterFailed")}>
          <input {...num("lockAfterFailed", 3, 10)} />
        </SettingsRow>
        <SettingsRow label="Keep it locked for (minutes)" htmlFor="org-lockMinutes" help="HR can unlock sooner from Users." error={show("lockMinutes")}>
          <input {...num("lockMinutes", 5, 1440)} />
        </SettingsRow>
      </SettingsCard>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        invalid={invalid}
        onDiscard={() => {
          discard();
          setTried(false);
        }}
        onSave={() => {
          setTried(true);
          if (!invalid) save.mutate(draft);
        }}
      />
      {guard}
    </>
  );
}
