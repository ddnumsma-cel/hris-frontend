import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SaveBar } from "@/components/ui/SaveBar";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { applyAccountPrefs, timezoneOptions } from "@/lib/preferences";
import { fetchMyProfile, saveMyProfile, saveMySettings, type MyProfile, type MyProfileInput } from "@/lib/settings/api";
import { settingsKeyFor, type AccountPrefs, type DateFormat, type WeekStart } from "@/lib/settings/store";
import type { Employee } from "@/lib/types";
import { settingsQueryKey, useDraft, useMySettings, useUnsavedGuard } from "./useSettings";

const OFFICES: Employee["office"][] = ["Cebu HQ", "Manila", "Davao"];
const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "MMM d, yyyy", label: "Oct 8, 2026" },
  { value: "dd/MM/yyyy", label: "08/10/2026 (day first)" },
  { value: "MM/dd/yyyy", label: "10/08/2026 (month first)" },
  { value: "yyyy-MM-dd", label: "2026-10-08 (ISO)" },
];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const inputClass = "field w-full px-3 py-2 text-sm";

type Draft = { profile: MyProfileInput; prefs: AccountPrefs };

function errorsFor(d: Draft) {
  const e: Partial<Record<"fullName" | "email" | "phone" | "displayName", string>> = {};
  if (!d.profile.fullName.trim()) e.fullName = "Enter your full name.";
  if (d.profile.email && !/^\S+@\S+\.\S+$/.test(d.profile.email)) e.email = "Enter a valid email address, like name@company.com.";
  if (d.profile.phone && !/^[+\d][\d\s()-]{6,}$/.test(d.profile.phone)) e.phone = "Use digits, spaces, dashes or a leading +.";
  if (d.prefs.displayName.length > 40) e.displayName = "Keep it to 40 characters or fewer.";
  return e;
}

export function AccountSection() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useMySettings();
  const profileKey = ["settings", "profile", user ? settingsKeyFor(user) : "none"] as const;
  const profile = useQuery({ queryKey: profileKey, queryFn: () => fetchMyProfile(user!), enabled: !!user });

  const saved: Draft | undefined =
    profile.data && settings.data ? { profile: toInput(profile.data), prefs: settings.data.account } : undefined;
  const { draft, setDraft, dirty, discard } = useDraft(saved);
  const guard = useUnsavedGuard(dirty);
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const nextProfile = await saveMyProfile(user!, d.profile);
      const nextSettings = await saveMySettings(user!, "account", d.prefs);
      return { nextProfile, nextSettings };
    },
    onSuccess: ({ nextProfile, nextSettings }) => {
      queryClient.setQueryData(profileKey, nextProfile);
      queryClient.setQueryData(settingsQueryKey(settingsKeyFor(user!)), nextSettings);
      queryClient.invalidateQueries({ queryKey: ["settings", "avatar"] });
      queryClient.invalidateQueries({ queryKey: ["employee", "my-photo"] });
      applyAccountPrefs(nextSettings.account);
      refreshUser();
      setTried(false);
      toast.show("Account saved.");
    },
    onError: (e: Error) => toast.show(e.message || "Couldn't save your account. Try again.", "critical"),
  });

  if (!draft || !profile.data) return <SectionSkeleton title="Account" />;

  const errors = errorsFor(draft);
  const invalid = Object.keys(errors).length > 0;
  const show = (k: keyof typeof errors) => (tried || dirty ? errors[k] : undefined);
  const setP = (patch: Partial<MyProfileInput>) => setDraft({ ...draft, profile: { ...draft.profile, ...patch } });
  const setA = (patch: Partial<AccountPrefs>) => setDraft({ ...draft, prefs: { ...draft.prefs, ...patch } });
  const isEmployee = profile.data.source === "employee";
  const hasWorkFields = profile.data.source === "partner" || profile.data.source === "hr";
  const initials = draft.profile.fullName.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.show("Choose an image file (JPG or PNG).", "critical");
    if (file.size > MAX_PHOTO_BYTES) return toast.show("Choose an image under 2 MB.", "critical");
    const reader = new FileReader();
    reader.onload = () => setP({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <SettingsHeader title="Account" description="Your profile and how dates and times are shown to you." />

      <SettingsCard title="Profile" description={isEmployee ? "HR keeps your name and job title; you can update your photo and contact details." : undefined}>
        <SettingsRow label="Profile photo" help="JPG or PNG, up to 2 MB. Without one, your initials are shown.">
          <div className="flex items-center justify-end gap-3">
            {draft.profile.photo ? (
              <img src={draft.profile.photo} alt="Your profile photo" className="h-12 w-12 flex-none rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="topbar-avatar flex h-12 w-12 flex-none items-center justify-center rounded-full text-sm">
                {initials || "?"}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload a profile photo" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
            {draft.profile.photo && !isEmployee && (
              <Button variant="ghost" size="sm" onClick={() => setP({ photo: null })}>
                Remove
              </Button>
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Full name" htmlFor="acc-name" error={show("fullName")} help={isEmployee ? "Kept by HR." : undefined}>
          <input id="acc-name" className={inputClass} value={draft.profile.fullName} disabled={!profile.data.canEditName} aria-invalid={!!show("fullName")} onChange={(e) => setP({ fullName: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Display name" htmlFor="acc-display" help="Shown in the top bar and menus. Leave blank to use your full name." error={show("displayName")}>
          <input id="acc-display" className={inputClass} value={draft.prefs.displayName} aria-invalid={!!show("displayName")} placeholder={draft.profile.fullName.split(" ")[0]} onChange={(e) => setA({ displayName: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Email" htmlFor="acc-email" error={show("email")}>
          <input id="acc-email" type="email" className={inputClass} value={draft.profile.email} aria-invalid={!!show("email")} onChange={(e) => setP({ email: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Phone" htmlFor="acc-phone" error={show("phone")}>
          <input id="acc-phone" type="tel" className={inputClass} value={draft.profile.phone} aria-invalid={!!show("phone")} onChange={(e) => setP({ phone: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="Job title" htmlFor="acc-title" help={isEmployee ? "Kept by HR." : undefined}>
          <input id="acc-title" className={inputClass} value={draft.profile.jobTitle} disabled={isEmployee} onChange={(e) => setP({ jobTitle: e.target.value })} />
        </SettingsRow>
        {hasWorkFields && (
          <SettingsRow label="Office" htmlFor="acc-office">
            <select id="acc-office" className={inputClass} value={draft.profile.office} onChange={(e) => setP({ office: e.target.value as Employee["office"] })}>
              {OFFICES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </SettingsRow>
        )}
        {(hasWorkFields || isEmployee) && (
          <SettingsRow label="Emergency contact" htmlFor="acc-emergency" help="Name and number of someone to call.">
            <input id="acc-emergency" className={inputClass} value={draft.profile.emergencyContact ?? ""} onChange={(e) => setP({ emergencyContact: e.target.value })} />
          </SettingsRow>
        )}
        {hasWorkFields && (
          <SettingsRow label="About" htmlFor="acc-about" stacked>
            <textarea id="acc-about" rows={3} className={inputClass} value={draft.profile.about ?? ""} onChange={(e) => setP({ about: e.target.value })} />
          </SettingsRow>
        )}
      </SettingsCard>

      <SettingsCard title="Language and region" description="Applied across the app as soon as you save.">
        <SettingsRow label="Language" htmlFor="acc-lang" help="More languages are coming.">
          {/* TODO(i18n): the app is English-only today; this preference is stored for later. */}
          <select id="acc-lang" className={inputClass} value={draft.prefs.language} onChange={() => setA({ language: "en" })}>
            <option value="en">English</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Timezone" htmlFor="acc-tz" help="Times like clock-ins are shown in this timezone.">
          <select id="acc-tz" className={inputClass} value={draft.prefs.timezone} onChange={(e) => setA({ timezone: e.target.value })}>
            {timezoneOptions().map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label="Date format" htmlFor="acc-date" help={`Today would show as ${previewDate(draft.prefs.dateFormat)}.`}>
          <select id="acc-date" className={inputClass} value={draft.prefs.dateFormat} onChange={(e) => setA({ dateFormat: e.target.value as DateFormat })}>
            {DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label="First day of week" htmlFor="acc-week" help="Used by calendars.">
          <select id="acc-week" className={inputClass} value={draft.prefs.weekStart} onChange={(e) => setA({ weekStart: Number(e.target.value) as WeekStart })}>
            {WEEK_STARTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
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

function toInput(p: MyProfile): MyProfileInput {
  const { source: _source, canEditName: _canEditName, ...rest } = p;
  return rest;
}

/** Today in a date format, without changing the app-wide one. */
function previewDate(f: DateFormat) {
  const iso = new Date().toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (f === "dd/MM/yyyy") return `${d}/${m}/${y}`;
  if (f === "MM/dd/yyyy") return `${m}/${d}/${y}`;
  if (f === "yyyy-MM-dd") return iso;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** Placeholder cards while a section's data loads. */
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <div role="status" aria-label={`Loading ${title} settings`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 rounded-[var(--radius-card)]" />
      <Skeleton className="h-44 rounded-[var(--radius-card)]" />
    </div>
  );
}
