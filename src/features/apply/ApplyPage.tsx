import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrandName } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AlertTriangleIcon, BriefcaseIcon, CheckCircleIcon, FileIcon, LoaderIcon, MapPinIcon, UploadIcon, XIcon } from "@/components/icons";
import { fetchOpenRequisitions, submitApplication } from "@/lib/api";
import { isValidPhMobile } from "@/lib/govIds";
import { fetchCities, fetchProvinces } from "@/lib/psgc";
import { isAccountingRole, PROFESSIONS } from "@/lib/recruitment";
import { addressFirst, findCity, findProvince, parseResume, readResumeText } from "@/lib/resumeRead";
import type { Applicant, ApplicantProfession, JobRequisition } from "@/lib/types";
import { describe } from "@/features/employee/onboarding/fieldProps";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "@/features/employee/onboarding/fields";

const schema = z
  .object({
    requisitionId: z.string().min(1, "Choose the role you're applying for"),
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().min(1, "Enter your last name"),
    email: z.string().trim().min(1, "Enter your email").email("Check your email, e.g. juan.delacruz@gmail.com"),
    phone: z.string().trim().min(1, "Enter your mobile number").refine(isValidPhMobile, "Use a PH mobile number, e.g. 0917 552 0184"),
    province: z.string().min(1, "Choose your province"),
    city: z.string().min(1, "Choose your city or municipality"),
    profession: z.string().min(1, "Choose the option closest to you"),
    yearsExperience: z
      .string()
      .trim()
      .min(1, "Enter your years of experience (0 if none)")
      .refine((v) => /^\d{1,2}$/.test(v), "Use a whole number, e.g. 2"),
    prcLicenseNumber: z.string().trim(),
    message: z.string().trim().max(500, "Keep it under 500 characters"),
    consent: z.boolean().refine((v) => v, "Tick this so HR can use your details for this application"),
  });
// The CPA → PRC license rule is checked on submit with the rest, not as a zod object refinement:
// zod skips those while any other field has an error, so it would only show up on a second try.

type Values = z.infer<typeof schema>;

const blank: Values = {
  requisitionId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  province: "",
  city: "",
  profession: "",
  yearsExperience: "",
  prcLicenseNumber: "",
  message: "",
  consent: false,
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pt-5 pb-12 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandName />
          <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-2">Careers</span>
        </div>
        <ThemeToggle />
      </header>
      {children}
      <p className="mt-8 text-center text-xs text-ink-3">MSMA Group · Cebu · Manila · Davao</p>
    </div>
  );
}

/**
 * Public application form behind the link HR shares on social media. No login. Accounting roles are
 * listed first, and HR reviews CPAs and accountancy graduates first.
 */
export function ApplyPage() {
  const { requisitionId } = useParams();
  const rolesQuery = useQuery({ queryKey: ["public", "open-roles"], queryFn: fetchOpenRequisitions });
  const [sent, setSent] = useState<{ applicant: Applicant; role: JobRequisition } | null>(null);

  // Accounting roles first, then the rest; alphabetical within each.
  const roles = useMemo(
    () =>
      [...(rolesQuery.data ?? [])].sort(
        (a, b) => Number(isAccountingRole(b)) - Number(isAccountingRole(a)) || a.title.localeCompare(b.title),
      ),
    [rolesQuery.data],
  );
  const role = requisitionId ? roles.find((r) => r.id === requisitionId) : undefined;

  if (rolesQuery.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-[28rem] w-full rounded-2xl" />
      </Shell>
    );
  }

  if (sent) {
    return (
      <Shell>
        <div className="success-enter rounded-2xl border border-border bg-surface p-7 text-center shadow-sm sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
            <CheckCircleIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em]">Thanks, {sent.applicant.firstName}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">
            Your application for <span className="font-semibold text-ink">{sent.role.title}</span> is in. HR will contact you at{" "}
            <span className="font-semibold text-ink">{sent.applicant.email}</span>.
          </p>
          <Link to="/apply" onClick={() => setSent(null)} className="mt-6 inline-block text-sm font-semibold text-brand-ink hover:underline">
            See other open roles
          </Link>
        </div>
      </Shell>
    );
  }

  if (requisitionId && !role) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <BriefcaseIcon className="h-6 w-6" />
          </span>
          <h1 className="font-display mt-4 text-xl font-semibold">This role is no longer open</h1>
          <p className="mt-1.5 text-sm text-ink-2">It may have been filled or closed. Other roles may still fit you.</p>
          <Link to="/apply" className="mt-5 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink">
            See all open roles
          </Link>
        </div>
      </Shell>
    );
  }

  if (rolesQuery.isError) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <h1 className="font-display text-xl font-semibold">We couldn't load the open roles</h1>
          <p className="mt-1.5 text-sm text-ink-2">Check your connection and try again.</p>
          <Button className="mt-5 justify-center" onClick={() => rolesQuery.refetch()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  if (roles.length === 0) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <h1 className="font-display text-xl font-semibold">No open roles right now</h1>
          <p className="mt-1.5 text-sm text-ink-2">Check back soon, or follow MSMA for new openings.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mb-5">
        <p className="text-xs font-semibold tracking-[0.06em] text-brand-ink uppercase">{role ? "Now hiring" : `${roles.length} open roles`}</p>
        <h1 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] sm:text-3xl">
          {role ? role.title : "Join MSMA Group"}
        </h1>
        {role ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">
              <MapPinIcon className="h-3.5 w-3.5" />
              {role.office}
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">{role.department}</span>
            {role.employmentType && <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">{role.employmentType}</span>}
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">
              {role.openings} {role.openings === 1 ? "opening" : "openings"}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-2">An accounting and professional-services firm. Pick a role below and apply in about 3 minutes.</p>
        )}
      </section>
      <ApplicationForm roles={roles} fixedRoleId={role?.id} onSent={setSent} />
    </Shell>
  );
}

function ApplicationForm({
  roles,
  fixedRoleId,
  onSent,
}: {
  roles: JobRequisition[];
  fixedRoleId?: string;
  onSent: (v: { applicant: Applicant; role: JobRequisition }) => void;
}) {
  const [resolver] = useState(() => zodResolver(schema));
  const form = useForm<Values>({ resolver, defaultValues: { ...blank, requisitionId: fixedRoleId ?? "" }, mode: "onTouched" });
  const { register, control, setValue, handleSubmit, formState } = form;
  const errors = formState.errors;
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [province, profession] = useWatch({ control, name: ["province", "profession"] });
  const queryClient = useQueryClient();
  // Reading the resume: what step it's on, then what it filled in (fields keep a "From resume" tag until edited).
  const [reading, setReading] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<{ filled: number; failed?: boolean } | null>(null);
  const [fromResume, setFromResume] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const tag = (name: keyof Values) => (fromResume.has(name) ? "resume" : undefined);

  const provincesQuery = useQuery({ queryKey: ["psgc", "provinces"], queryFn: fetchProvinces, staleTime: Infinity });
  const provinceCode = provincesQuery.data?.find((p) => p.name === province)?.code;
  const citiesQuery = useQuery({
    queryKey: ["psgc", "cities", provinceCode],
    queryFn: () => fetchCities(provinceCode!),
    enabled: Boolean(provinceCode),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      submitApplication({
        ...v,
        profession: v.profession as ApplicantProfession,
        yearsExperience: Number(v.yearsExperience),
        prcLicenseNumber: v.profession === "CPA" ? v.prcLicenseNumber : undefined,
        resumeFileName: resume!.name,
      }),
    onSuccess: (applicant) => {
      onSent({ applicant, role: roles.find((r) => r.id === applicant.requisitionId)! });
      window.scrollTo({ top: 0 });
    },
  });

  function pickResume(file: File | undefined) {
    if (!file) return;
    if (!/^(application\/pdf|image\/)/.test(file.type) && !/\.pdf$/i.test(file.name)) return setResumeError("Use a PDF or a photo (JPG or PNG) of your resume.");
    if (file.size > 10 * 1024 * 1024) return setResumeError("That file is over 10 MB. Try a smaller PDF or photo.");
    setResume(file);
    setResumeError(null);
    void fillFromResume(file);
  }

  /** Reads the resume on this device and fills in whatever the form is still missing. */
  async function fillFromResume(file: File) {
    setReadResult(null);
    setReading("Opening your resume");
    try {
      const text = await readResumeText(file, (p) => setReading(p.progress ? `${p.stage} · ${Math.round(p.progress * 100)}%` : p.stage));
      setReading("Finding your details");
      const found = parseResume(text);
      const current = form.getValues();
      const filled = new Set<string>();
      const fill = (name: keyof Values, value: string | undefined) => {
        if (!value || String(current[name] ?? "").trim()) return;
        setValue(name, value, { shouldDirty: true, shouldValidate: Boolean(formState.submitCount) });
        filled.add(name);
      };
      fill("firstName", found.firstName);
      fill("lastName", found.lastName);
      fill("email", found.email);
      fill("phone", found.phone);
      fill("profession", found.profession);
      fill("prcLicenseNumber", found.prcLicenseNumber);
      fill("yearsExperience", found.yearsExperience === undefined ? undefined : String(found.yearsExperience));

      // Place: Metro Manila cities first (so "Quezon City" isn't read as Quezon province), then provinces.
      if (!current.province) {
        const lines = addressFirst(text);
        const provinces = await queryClient.fetchQuery({ queryKey: ["psgc", "provinces"], queryFn: fetchProvinces, staleTime: Infinity });
        const ncr = provinces.find((p) => p.name === "Metro Manila");
        const ncrCities = ncr ? await queryClient.fetchQuery({ queryKey: ["psgc", "cities", ncr.code], queryFn: () => fetchCities(ncr.code), staleTime: Infinity }) : [];
        const provinceName = findCity(lines, ncrCities) ? "Metro Manila" : findProvince(lines, provinces);
        if (provinceName) {
          const code = provinces.find((p) => p.name === provinceName)!.code;
          const cities = await queryClient.fetchQuery({ queryKey: ["psgc", "cities", code], queryFn: () => fetchCities(code), staleTime: Infinity });
          const city = findCity(lines, cities);
          setValue("province", provinceName, { shouldDirty: true });
          filled.add("province");
          if (city) {
            // The city list renders its options a moment after the province is set; choose once they're there.
            for (let i = 0; i < 40 && !document.querySelector(`#ap-city option[value="${CSS.escape(city)}"]`); i++) {
              await new Promise((r) => setTimeout(r, 25));
            }
            setValue("city", city, { shouldDirty: true });
            filled.add("city");
          }
        }
      }
      setFromResume(filled);
      setReadResult({ filled: filled.size });
    } catch {
      setReadResult({ filled: 0, failed: true });
    } finally {
      setReading(null);
    }
  }

  const accountingRoles = roles.filter(isAccountingRole);
  const otherRoles = roles.filter((r) => !isAccountingRole(r));

  return (
    <form
      noValidate
      onChange={(e) => {
        // An old "couldn't send" message shouldn't linger once they change something.
        if (mutation.isError) mutation.reset();
        // Once they edit a field the resume filled, it's their answer, not ours.
        const name = (e.target as unknown as HTMLInputElement).name;
        if (fromResume.has(name)) setFromResume((s) => new Set([...s].filter((n) => n !== name)));
      }}
      onSubmit={handleSubmit(
        (v) => {
          const prcMissing = v.profession === "CPA" && !v.prcLicenseNumber.trim();
          if (prcMissing) form.setError("prcLicenseNumber", { type: "custom", message: "Enter your PRC license number" }, { shouldFocus: true });
          if (!resume) setResumeError("Upload your resume (PDF or photo)");
          if (prcMissing || !resume) return;
          // Returning the save keeps the form "submitting" (button disabled) until it finishes,
          // so a quick second click or Enter can't send the same application twice.
          return mutation.mutateAsync(v).catch(() => {});
        },
        () => {
          const v = form.getValues();
          if (v.profession === "CPA" && !v.prcLicenseNumber.trim()) form.setError("prcLicenseNumber", { type: "custom", message: "Enter your PRC license number" });
          if (!resume) setResumeError("Upload your resume (PDF or photo)");
        },
      )}
      className="flex flex-col gap-7 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7"
    >
      <section aria-labelledby="ap-resume-title" className="flex flex-col gap-3">
        <div>
          <h2 id="ap-resume-title" className="text-[0.9rem] font-semibold">
            Start with your resume<span className="ml-0.5 text-critical" aria-hidden="true">*</span>
          </h2>
          <p className="text-xs text-ink-2">We'll fill in the form from it, so you only check and add what's missing. It's read on this device.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            pickResume(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {resume ? (
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            {reading ? <LoaderIcon className="h-5 w-5 flex-none animate-spin text-brand-ink" /> : <FileIcon className="h-5 w-5 flex-none text-good" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{resume.name}</span>
              {reading && (
                <span className="block text-xs text-ink-2" aria-live="polite">
                  {reading}…
                </span>
              )}
            </span>
            <button type="button" disabled={Boolean(reading)} onClick={() => fileRef.current?.click()} className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2 disabled:opacity-50">
              Replace
            </button>
            <button
              type="button"
              aria-label="Remove resume"
              disabled={Boolean(reading)}
              onClick={() => {
                setResume(null);
                setReadResult(null);
              }}
              className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-50"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickResume(e.dataTransfer.files?.[0]);
            }}
            aria-describedby={resumeError ? "ap-resume-error" : undefined}
            className={`flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-tint/40 ${dragOver ? "border-brand bg-brand-tint/60" : "border-border"}`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <UploadIcon className="h-5 w-5" />
            </span>
            <span className="mt-1 text-sm font-semibold">Upload your resume</span>
            <span className="text-xs text-ink-3">Drop it here or tap to browse · PDF or a clear photo, up to 10 MB</span>
          </button>
        )}
        <FieldError id="ap-resume-error" message={resumeError ?? undefined} />
        {readResult && !reading && (
          <p
            role="status"
            className={`item-enter flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${readResult.filled ? "bg-brand-tint text-ink" : "bg-surface-2 text-ink-2"}`}
          >
            {readResult.filled ? <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-brand-ink" /> : <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-warning" />}
            {readResult.failed
              ? "We couldn't read this file. Your resume is still attached; fill in the form below."
              : readResult.filled
                ? `We filled in ${readResult.filled} ${readResult.filled === 1 ? "field" : "fields"} from your resume. Check the ones tagged "From resume" before you submit.`
                : "We couldn't find your details in this resume. It's still attached; fill in the form below."}
          </p>
        )}
      </section>

      {!fixedRoleId && (
        <FieldGroup title="Role">
          <div>
            <Label htmlFor="ap-role" required>
              Position you're applying for
            </Label>
            <select id="ap-role" className={inputClass} {...describe("ap-role", errors.requisitionId?.message)} {...register("requisitionId")}>
              <option value="">Choose a role…</option>
              {accountingRoles.length > 0 && (
                <optgroup label="Accounting roles">
                  {accountingRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} · {r.office}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherRoles.length > 0 && (
                <optgroup label="Other roles">
                  {otherRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} · {r.office}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <FieldError id="ap-role-error" message={errors.requisitionId?.message} />
          </div>
        </FieldGroup>
      )}

      <FieldGroup title="About you">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="ap-first" required from={tag("firstName")}>
              First name
            </Label>
            <input id="ap-first" className={inputClass} placeholder="Juan" autoComplete="given-name" {...describe("ap-first", errors.firstName?.message)} {...register("firstName")} />
            <FieldError id="ap-first-error" message={errors.firstName?.message} />
          </div>
          <div>
            <Label htmlFor="ap-last" required from={tag("lastName")}>
              Last name
            </Label>
            <input id="ap-last" className={inputClass} placeholder="Dela Cruz" autoComplete="family-name" {...describe("ap-last", errors.lastName?.message)} {...register("lastName")} />
            <FieldError id="ap-last-error" message={errors.lastName?.message} />
          </div>
          <div>
            <Label htmlFor="ap-email" required from={tag("email")}>
              Email
            </Label>
            <input id="ap-email" type="email" className={inputClass} placeholder="juan.delacruz@gmail.com" autoComplete="email" {...describe("ap-email", errors.email?.message)} {...register("email")} />
            <FieldError id="ap-email-error" message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="ap-phone" required from={tag("phone")}>
              Mobile number
            </Label>
            <input id="ap-phone" type="tel" inputMode="tel" className={inputClass} placeholder="0917 552 0184" autoComplete="tel" {...describe("ap-phone", errors.phone?.message)} {...register("phone")} />
            <FieldError id="ap-phone-error" message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="ap-province" required from={tag("province")}>
              Province
            </Label>
            <select
              id="ap-province"
              className={inputClass}
              disabled={provincesQuery.isLoading}
              {...describe("ap-province", errors.province?.message)}
              {...register("province", { onChange: () => setValue("city", "") })}
            >
              <option value="">{provincesQuery.isLoading ? "Loading…" : "Select province…"}</option>
              {(provincesQuery.data ?? []).map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <FieldError id="ap-province-error" message={errors.province?.message} />
          </div>
          <div>
            <Label htmlFor="ap-city" required from={tag("city")}>
              City / municipality
            </Label>
            <select id="ap-city" className={inputClass} disabled={!province || citiesQuery.isLoading} {...describe("ap-city", errors.city?.message)} {...register("city")}>
              <option value="">{!province ? "Choose a province first" : citiesQuery.isLoading ? "Loading…" : "Select city / municipality…"}</option>
              {(citiesQuery.data ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError id="ap-city-error" message={errors.city?.message} />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="Background">
        <fieldset aria-describedby={errors.profession ? "ap-profession-error" : undefined} aria-invalid={errors.profession ? true : undefined}>
          <legend className="mb-2 text-[0.82rem] font-semibold text-ink-2">
            Which describes you best?<span className="ml-0.5 text-critical" aria-hidden="true">*</span>
            {tag("profession") && <span className="ml-2 rounded-full bg-brand-tint px-2 py-px text-[0.68rem] font-semibold text-brand-ink">From resume · check this</span>}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROFESSIONS.map((p) => (
              <label
                key={p.value}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-cat-1)]"
              >
                <input type="radio" value={p.value} className="h-4 w-4 accent-[var(--color-brand)]" {...register("profession")} />
                {p.label}
              </label>
            ))}
          </div>
          <FieldError id="ap-profession-error" message={errors.profession?.message} />
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="ap-years" required from={tag("yearsExperience")}>
              Years of work experience
            </Label>
            <input id="ap-years" inputMode="numeric" className={inputClass} placeholder="2" {...describe("ap-years", errors.yearsExperience?.message)} {...register("yearsExperience")} />
            <FieldError id="ap-years-error" message={errors.yearsExperience?.message} />
          </div>
          {profession === "CPA" && (
            <div className="item-enter">
              <Label htmlFor="ap-prc" required from={tag("prcLicenseNumber")}>
                PRC license number
              </Label>
              <input id="ap-prc" inputMode="numeric" className={inputClass} placeholder="0123456" {...describe("ap-prc", errors.prcLicenseNumber?.message)} {...register("prcLicenseNumber")} />
              <FieldError id="ap-prc-error" message={errors.prcLicenseNumber?.message} />
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="ap-message">Anything you'd like HR to know?</Label>
          <textarea id="ap-message" rows={3} className={`${inputClass} resize-y`} placeholder="Availability, preferred office, a link to your portfolio…" {...describe("ap-message", errors.message?.message, !errors.message)} {...register("message")} />
          <FieldError id="ap-message-error" message={errors.message?.message} />
          {!errors.message && <FieldHint id="ap-message-hint">Optional</FieldHint>}
        </div>
      </FieldGroup>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
          <input id="ap-consent" type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-brand)]" {...describe("ap-consent", errors.consent?.message)} {...register("consent")} />
          <span>
            I agree that MSMA Group may collect and use my details to review this application, as allowed by the Data Privacy Act of 2012 (RA 10173).
          </span>
        </label>
        <FieldError id="ap-consent-error" message={errors.consent?.message} />
      </div>

      {mutation.isError && (
        <p role="alert" className="rounded-lg bg-critical-tint px-4 py-2.5 text-sm text-critical">
          {(mutation.error as Error).message}
        </p>
      )}

      <Button type="submit" className="min-h-11 justify-center" disabled={formState.isSubmitting || mutation.isPending || Boolean(reading)}>
        {formState.isSubmitting || mutation.isPending ? "Sending…" : "Submit application"}
      </Button>
    </form>
  );
}
