import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrandName } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BriefcaseIcon, CheckCircleIcon, FileIcon, MapPinIcon, UploadIcon, XIcon } from "@/components/icons";
import { fetchOpenRequisitions, submitApplication } from "@/lib/api";
import { isValidPhMobile } from "@/lib/govIds";
import { fetchCities, fetchProvinces } from "@/lib/psgc";
import { isAccountingRole, PROFESSIONS } from "@/lib/recruitment";
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
      .min(1, "Enter your years of experience (0 if none)")
      .refine((v) => /^\d{1,2}$/.test(v), "Use a whole number, e.g. 2"),
    prcLicenseNumber: z.string().trim(),
    message: z.string().trim().max(500, "Keep it under 500 characters"),
    consent: z.boolean().refine((v) => v, "Tick this so HR can use your details for this application"),
  })
  .refine((v) => v.profession !== "CPA" || v.prcLicenseNumber.length > 0, { path: ["prcLicenseNumber"], message: "Enter your PRC license number" });

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
    if (file.size > 10 * 1024 * 1024) return setResumeError("That file is over 10 MB. Try a smaller PDF or photo.");
    setResume(file);
    setResumeError(null);
  }

  const accountingRoles = roles.filter(isAccountingRole);
  const otherRoles = roles.filter((r) => !isAccountingRole(r));

  return (
    <form
      noValidate
      onSubmit={handleSubmit(
        (v) => {
          if (!resume) return setResumeError("Upload your resume (PDF or photo)");
          mutation.mutate(v);
        },
        () => {
          if (!resume) setResumeError("Upload your resume (PDF or photo)");
        },
      )}
      className="flex flex-col gap-7 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7"
    >
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
            <Label htmlFor="ap-first" required>
              First name
            </Label>
            <input id="ap-first" className={inputClass} placeholder="Juan" autoComplete="given-name" {...describe("ap-first", errors.firstName?.message)} {...register("firstName")} />
            <FieldError id="ap-first-error" message={errors.firstName?.message} />
          </div>
          <div>
            <Label htmlFor="ap-last" required>
              Last name
            </Label>
            <input id="ap-last" className={inputClass} placeholder="Dela Cruz" autoComplete="family-name" {...describe("ap-last", errors.lastName?.message)} {...register("lastName")} />
            <FieldError id="ap-last-error" message={errors.lastName?.message} />
          </div>
          <div>
            <Label htmlFor="ap-email" required>
              Email
            </Label>
            <input id="ap-email" type="email" className={inputClass} placeholder="juan.delacruz@gmail.com" autoComplete="email" {...describe("ap-email", errors.email?.message)} {...register("email")} />
            <FieldError id="ap-email-error" message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="ap-phone" required>
              Mobile number
            </Label>
            <input id="ap-phone" type="tel" inputMode="tel" className={inputClass} placeholder="0917 552 0184" autoComplete="tel" {...describe("ap-phone", errors.phone?.message)} {...register("phone")} />
            <FieldError id="ap-phone-error" message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="ap-province" required>
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
            <Label htmlFor="ap-city" required>
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
        <fieldset>
          <legend className="mb-2 text-[0.82rem] font-semibold text-ink-2">
            Which describes you best?<span className="ml-0.5 text-critical" aria-hidden="true">*</span>
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
            <Label htmlFor="ap-years" required>
              Years of work experience
            </Label>
            <input id="ap-years" inputMode="numeric" className={inputClass} placeholder="2" {...describe("ap-years", errors.yearsExperience?.message)} {...register("yearsExperience")} />
            <FieldError id="ap-years-error" message={errors.yearsExperience?.message} />
          </div>
          {profession === "CPA" && (
            <div className="item-enter">
              <Label htmlFor="ap-prc" required>
                PRC license number
              </Label>
              <input id="ap-prc" inputMode="numeric" className={inputClass} placeholder="0123456" {...describe("ap-prc", errors.prcLicenseNumber?.message)} {...register("prcLicenseNumber")} />
              <FieldError id="ap-prc-error" message={errors.prcLicenseNumber?.message} />
            </div>
          )}
        </div>
      </FieldGroup>

      <FieldGroup title="Resume">
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
            <FileIcon className="h-5 w-5 flex-none text-good" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{resume.name}</span>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2">
              Replace
            </button>
            <button type="button" aria-label="Remove resume" onClick={() => setResume(null)} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-describedby={resumeError ? "ap-resume-error" : undefined}
            className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
          >
            <UploadIcon className="h-5 w-5 text-ink-2" />
            <span className="text-sm font-semibold">Upload your resume</span>
            <span className="text-xs text-ink-3">PDF or a clear photo, up to 10 MB</span>
          </button>
        )}
        <FieldError id="ap-resume-error" message={resumeError ?? undefined} />
        <div>
          <Label htmlFor="ap-message">Anything you'd like HR to know?</Label>
          <textarea id="ap-message" rows={3} className={`${inputClass} resize-y`} placeholder="Availability, preferred office, a link to your portfolio…" {...describe("ap-message", errors.message?.message, true)} {...register("message")} />
          <FieldError id="ap-message-error" message={errors.message?.message} />
          {!errors.message && <FieldHint id="ap-message-hint">Optional</FieldHint>}
        </div>
      </FieldGroup>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
          <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-brand)]" {...describe("ap-consent", errors.consent?.message)} {...register("consent")} />
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

      <Button type="submit" className="min-h-11 justify-center" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Submit application"}
      </Button>
    </form>
  );
}
