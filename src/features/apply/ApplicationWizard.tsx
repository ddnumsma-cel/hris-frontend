import { useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, CheckCircleIcon, EditIcon, FileIcon, LoaderIcon, PlusIcon, UploadIcon, XIcon } from "@/components/icons";
import { submitApplication } from "@/lib/api";
import { formatPhMobile, isValidPhMobile } from "@/lib/govIds";
import { fetchCities, fetchProvinces } from "@/lib/psgc";
import { fieldOfRole, ROLE_FIELDS } from "@/lib/roleCatalog";
import { searchSkills } from "@/lib/skillCatalog";
import { addressFirst, findCity, findProvince, parseResume, readResumeText } from "@/lib/resumeRead";
import type { Applicant, ApplicantEducation, ApplicantProfession, ApplicantRole, JobRequisition } from "@/lib/types";
import { FieldError, inputClass, Label } from "@/features/employee/onboarding/fields";

const STEPS = ["Documents", "Employer questions", "Profile", "Review"] as const;
const YEARS = ["None yet (fresh graduate)", "Less than 1 year", ...Array.from({ length: 10 }, (_, i) => `${i + 1} year${i ? "s" : ""}`), "More than 10 years"];
// Skills useful in any role; the applicant can add their own.
const GENERAL_SKILLS = ["Interpersonal skills", "Communication", "Problem solving", "Teamwork", "Time management", "Adaptability", "Critical thinking", "Attention to detail", "Leadership", "Customer service", "Microsoft Office", "Willingness to learn"];
const MAX_FILE = 5 * 1024 * 1024;
const RESUME_TYPES = /\.(pdf|doc|docx|txt|rtf|png|jpe?g)$/i;

type Errors = Partial<Record<string, string>>;

interface Data {
  resumeChoice: "upload" | "none";
  coverChoice: "upload" | "write" | "none";
  coverText: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  requisitionId: string;
  /** From the role catalog, e.g. "Web Developer". */
  role: string;
  /** Their own words. */
  workExperience: string;
  years: string;
  /** A label from the role's field, e.g. "Certified Public Accountant (CPA)". */
  background: string;
  prcLicenseNumber: string;
  languages: string[];
  careerHistory: ApplicantRole[];
  education: ApplicantEducation[];
  skills: string[];
  consent: boolean;
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-5 w-5 flex-none accent-[var(--color-brand)]" />
      {children}
    </label>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{children}</h2>;
}

const monthLabel = (ym: string) => (ym ? new Date(ym + "-01T00:00:00").toLocaleDateString("en-PH", { month: "short", year: "numeric" }) : "Present");
function duration(start: string, end: string) {
  if (!start) return "";
  const a = new Date(start + "-01");
  const b = end ? new Date(end + "-01") : new Date();
  const m = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
  return m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} yr${m >= 24 ? "s" : ""}${m % 12 ? ` ${m % 12} mo` : ""}`;
}

/**
 * The public application, in four steps like the job boards people already know: documents, the
 * employer's questions, their profile, then a review. The resume fills in what it can.
 */
export function ApplicationWizard({
  roles,
  fixedRoleId,
  onSent,
}: {
  roles: JobRequisition[];
  fixedRoleId?: string;
  onSent: (v: { applicant: Applicant; role: JobRequisition }) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [d, setD] = useState<Data>({
    resumeChoice: "upload",
    coverChoice: "none",
    coverText: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    province: "",
    city: "",
    requisitionId: fixedRoleId ?? "",
    role: roles.find((r) => r.id === fixedRoleId)?.title ?? "",
    workExperience: "",
    years: "",
    background: "",
    prcLicenseNumber: "",
    languages: [],
    careerHistory: [],
    education: [],
    skills: [],
    consent: false,
  });
  const set = <K extends keyof Data>(k: K, v: Data[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFromResume((s) => (s.has(k) ? new Set([...s].filter((n) => n !== k)) : s));
  };

  const [resume, setResume] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<{ filled: number; failed?: boolean } | null>(null);
  const [fromResume, setFromResume] = useState<Set<string>>(new Set());
  const tag = (k: keyof Data) => (fromResume.has(k) ? "resume" : undefined);

  const provincesQuery = useQuery({ queryKey: ["psgc", "provinces"], queryFn: fetchProvinces, staleTime: Infinity });
  const provinceCode = provincesQuery.data?.find((p) => p.name === d.province)?.code;
  const citiesQuery = useQuery({ queryKey: ["psgc", "cities", provinceCode], queryFn: () => fetchCities(provinceCode!), enabled: Boolean(provinceCode), staleTime: Infinity });

  const role = roles.find((r) => r.id === d.requisitionId);
  // The field decides the background options and skill suggestions; unknown roles get a generic set.
  const field = fieldOfRole(d.role) ?? (role && /audit|tax|book|account/i.test(role.title) ? ROLE_FIELDS[0] : undefined);
  const backgroundOption = field?.backgrounds.find((b) => b.label === d.background);

  // ---- Resume ----
  function pickResume(file: File | undefined) {
    if (!file) return;
    if (!RESUME_TYPES.test(file.name)) return setErrors((e) => ({ ...e, resume: "Use a .pdf, .doc, .docx, .txt, .rtf or a photo (JPG/PNG)." }));
    if (file.size > MAX_FILE) return setErrors((e) => ({ ...e, resume: "That file is over 5 MB. Try a smaller one." }));
    setResume(file);
    setErrors((e) => ({ ...e, resume: undefined }));
    set("resumeChoice", "upload");
    if (/\.(pdf|png|jpe?g)$/i.test(file.name)) void fillFromResume(file);
    else setReadNote(null);
  }

  async function fillFromResume(file: File) {
    setReadNote(null);
    setReading("Opening your resume");
    try {
      const text = await readResumeText(file, (p) => setReading(p.progress ? `${p.stage} · ${Math.round(p.progress * 100)}%` : p.stage));
      const f = parseResume(text);
      const filled = new Set<string>();
      const next: Partial<Data> = {};
      const fill = <K extends keyof Data>(k: K, v: Data[K] | undefined) => {
        if (v === undefined || v === "" || String(d[k] ?? "").trim()) return;
        next[k] = v;
        filled.add(k);
      };
      fill("firstName", f.firstName);
      fill("lastName", f.lastName);
      fill("email", f.email);
      fill("phone", f.phone);
      const acct = ROLE_FIELDS[0].backgrounds.find((b) => b.profession === f.profession);
      if (acct && (!d.role || fieldOfRole(d.role)?.key === "accounting")) fill("background", acct.label);
      fill("prcLicenseNumber", f.prcLicenseNumber);
      if (f.yearsExperience !== undefined && !d.years) {
        next.years = f.yearsExperience > 10 ? YEARS[12] : f.yearsExperience === 0 ? YEARS[0] : YEARS[f.yearsExperience + 1];
        filled.add("years");
      }
      if (!d.province) {
        const lines = addressFirst(text);
        const provinces = await queryClient.fetchQuery({ queryKey: ["psgc", "provinces"], queryFn: fetchProvinces, staleTime: Infinity });
        const ncr = provinces.find((p) => p.name === "Metro Manila");
        const ncrCities = ncr ? await queryClient.fetchQuery({ queryKey: ["psgc", "cities", ncr.code], queryFn: () => fetchCities(ncr.code), staleTime: Infinity }) : [];
        const prov = findCity(lines, ncrCities) ? "Metro Manila" : findProvince(lines, provinces);
        if (prov) {
          const code = provinces.find((p) => p.name === prov)!.code;
          const cities = await queryClient.fetchQuery({ queryKey: ["psgc", "cities", code], queryFn: () => fetchCities(code), staleTime: Infinity });
          next.province = prov;
          filled.add("province");
          const city = findCity(lines, cities);
          if (city) {
            next.city = city;
            filled.add("city");
          }
        }
      }
      setD((p) => ({ ...p, ...next }));
      // Filled fields are no longer missing.
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !filled.has(k))));
      setFromResume(filled);
      setReadNote({ filled: filled.size });
    } catch {
      setReadNote({ filled: 0, failed: true });
    } finally {
      setReading(null);
    }
  }

  // ---- Validation per step ----
  function check(s: number): Errors {
    const e: Errors = {};
    if (s === 0) {
      if (d.resumeChoice === "upload" && !resume) e.resume = "Upload your resume, or choose “Don't include a resumé”";
      if (d.coverChoice === "upload" && !cover) e.cover = "Upload your cover letter, or pick another option";
      if (d.coverChoice === "write" && !d.coverText.trim()) e.coverText = "Write your cover letter, or pick another option";
      if (!d.firstName.trim()) e.firstName = "Enter your first name";
      if (!d.lastName.trim()) e.lastName = "Enter your last name";
      if (!d.email.trim()) e.email = "Enter your email";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Check your email, e.g. juan.delacruz@gmail.com";
      if (!d.phone.trim()) e.phone = "Enter your mobile number";
      else if (!isValidPhMobile(d.phone)) e.phone = "Use a PH mobile number, e.g. 0917 552 0184";
      if (!d.province) e.province = "Choose your province";
      if (!d.city) e.city = "Choose your city or municipality";
    }
    if (s === 1) {
      if (!d.role) e.role = "Choose the role you're applying for";
      if (!d.workExperience.trim()) e.workExperience = "Tell us about your work experience, or write “Fresh graduate”";
      if (!d.years) e.years = "Choose how many years";
      if (!d.background) e.background = "Choose the option closest to you";
      if (backgroundOption?.licensed && !d.prcLicenseNumber.trim()) e.prcLicenseNumber = "Enter your license number";
    }
    if (s === 3 && !d.consent) e.consent = "Tick this so HR can use your details for this application";
    return e;
  }

  function goNext() {
    const e = check(step);
    setErrors(e);
    if (Object.keys(e).length) {
      // Put them on the first problem.
      window.setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true], [data-error=true]")?.focus(), 30);
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTo(s: number) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mutation = useMutation({
    mutationFn: () =>
      submitApplication({
        requisitionId: d.requisitionId || undefined,
        appliedRole: d.role,
        field: field?.label ?? "Other",
        background: d.background,
        workExperience: d.workExperience,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        province: d.province,
        city: d.city,
        profession: (backgroundOption?.profession ?? "Other") as ApplicantProfession,
        experienceLevel: d.years === YEARS[0] ? "Fresh graduate" : "Has work experience",
        yearsExperience: Math.max(0, YEARS.indexOf(d.years) - 1),
        prcLicenseNumber: backgroundOption?.licensed ? d.prcLicenseNumber : undefined,
        resumeFileName: d.resumeChoice === "upload" ? resume?.name : undefined,
        coverLetter: d.coverChoice === "upload" && cover ? { kind: "upload", fileName: cover.name } : d.coverChoice === "write" ? { kind: "write", text: d.coverText.trim() } : undefined,
        languages: d.languages,
        careerHistory: d.careerHistory,
        education: d.education,
        skills: d.skills,
      }),
    // A catalog role may have no opening on the list yet; the thank-you screen only needs its title.
    onSuccess: (applicant) =>
      onSent({ applicant, role: roles.find((r) => r.id === applicant.requisitionId) ?? ({ id: applicant.requisitionId, title: d.role, office: "Cebu HQ" } as JobRequisition) }),
  });

  function submit() {
    const e = check(3);
    setErrors(e);
    if (Object.keys(e).length || mutation.isPending) return;
    mutation.mutate();
  }

  const err = (k: string) => errors[k];
  const fieldProps = (k: keyof Data) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `ap-${k}-error` : undefined });

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <ol aria-label="Application steps" className="grid grid-cols-4 gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-col gap-1.5">
            <span className={clsx("h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-brand" : "bg-surface-2")} />
            <span className={clsx("hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-ink-3")} aria-current={i === step ? "step" : undefined}>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="-mt-2 text-xs text-ink-2 sm:hidden">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      <div key={step} className="tab-enter flex flex-col gap-8 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
        {step === 0 && (
          <>
            <section className="flex flex-col gap-3">
              <Heading>Resumé</Heading>
              <input
                ref={resumeRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf,image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  pickResume(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {resume && (
                <label
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                    d.resumeChoice === "upload" ? "border-brand" : "border-border",
                  )}
                >
                  <input type="radio" name="resume" checked={d.resumeChoice === "upload"} onChange={() => set("resumeChoice", "upload")} className="mt-1 h-5 w-5 flex-none accent-[var(--color-brand)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {reading ? <LoaderIcon className="h-4 w-4 animate-spin text-brand-ink" /> : <FileIcon className="h-4 w-4 text-ink-3" />}
                      <span className="truncate">{resume.name}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-2" aria-live="polite">
                      {reading ? `${reading}…` : "Added just now"}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Remove resume"
                    disabled={Boolean(reading)}
                    onClick={(e) => {
                      e.preventDefault();
                      setResume(null);
                      setReadNote(null);
                    }}
                    className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-40"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </label>
              )}
              <label className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl border p-4", d.resumeChoice === "none" ? "border-brand" : "border-border")}>
                <input type="radio" name="resume" checked={d.resumeChoice === "none"} onChange={() => set("resumeChoice", "none")} className="h-5 w-5 flex-none accent-[var(--color-brand)]" />
                <span className="text-sm">Don't include a resumé</span>
              </label>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<UploadIcon className="h-4 w-4" />}
                  onClick={() => resumeRef.current?.click()}
                  disabled={Boolean(reading)}
                  data-error={err("resume") ? true : undefined}
                  className="min-h-11 border-brand text-brand-ink"
                >
                  {resume ? "Upload a different file" : "Upload"}
                </Button>
                <p className="mt-2 text-xs text-ink-2">Accepted file types: .pdf, .doc, .docx, .txt, .rtf or a photo (5 MB limit). PDFs and photos fill in your details for you.</p>
                <FieldError id="ap-resume-error" message={err("resume")} />
              </div>
              {readNote && !reading && (
                <p role="status" className={clsx("item-enter flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm", readNote.filled ? "bg-brand-tint" : "bg-surface-2 text-ink-2")}>
                  {readNote.filled ? <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-brand-ink" /> : <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-warning" />}
                  {readNote.failed
                    ? "We couldn't read this file. It's still attached; fill in your details below."
                    : readNote.filled
                      ? `We filled in ${readNote.filled} detail${readNote.filled === 1 ? "" : "s"} from your resume. Check the ones tagged "From resume".`
                      : "We couldn't find your details in this resume. It's still attached; fill them in below."}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-1">
              <Heading>Cover letter</Heading>
              <input
                ref={coverRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > MAX_FILE) return setErrors((x) => ({ ...x, cover: "That file is over 5 MB." }));
                  setCover(f);
                  setErrors((x) => ({ ...x, cover: undefined }));
                }}
              />
              <div className="mt-2 flex flex-col">
                <Radio name="cover" checked={d.coverChoice === "upload"} onChange={() => set("coverChoice", "upload")}>
                  Upload a cover letter
                </Radio>
                {d.coverChoice === "upload" && (
                  <div className="item-enter mb-2 ml-8 flex items-center gap-3">
                    <Button type="button" variant="ghost" size="sm" icon={<UploadIcon className="h-3.5 w-3.5" />} onClick={() => coverRef.current?.click()} data-error={err("cover") ? true : undefined}>
                      {cover ? "Replace" : "Choose file"}
                    </Button>
                    {cover && <span className="truncate text-sm">{cover.name}</span>}
                  </div>
                )}
                <FieldError id="ap-cover-error" message={err("cover")} />
                <Radio name="cover" checked={d.coverChoice === "write"} onChange={() => set("coverChoice", "write")}>
                  Write a cover letter
                </Radio>
                {d.coverChoice === "write" && (
                  <div className="item-enter mb-2 ml-8">
                    <textarea
                      rows={6}
                      value={d.coverText}
                      onChange={(e) => set("coverText", e.target.value)}
                      placeholder="Dear Hiring Team, …"
                      aria-label="Cover letter"
                      {...fieldProps("coverText")}
                      className={clsx(inputClass, "resize-y")}
                    />
                    <FieldError id="ap-coverText-error" message={err("coverText")} />
                  </div>
                )}
                <Radio name="cover" checked={d.coverChoice === "none"} onChange={() => set("coverChoice", "none")}>
                  Don't include a cover letter
                </Radio>
              </div>
              <p className="mt-2 text-xs text-ink-3">Stay safe. Don't include sensitive information, such as your TIN or bank details, in your documents.</p>
            </section>

            <section className="flex flex-col gap-4">
              <Heading>Your details</Heading>
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["firstName", "First name", "Juan", "given-name", "text"],
                    ["lastName", "Last name", "Dela Cruz", "family-name", "text"],
                    ["email", "Email", "juan.delacruz@gmail.com", "email", "email"],
                    ["phone", "Mobile number", "0917 552 0184", "tel", "tel"],
                  ] as const
                ).map(([k, label, ph, ac, type]) => (
                  <div key={k}>
                    <Label htmlFor={`ap-${k}`} required from={tag(k)}>
                      {label}
                    </Label>
                    <input
                      id={`ap-${k}`}
                      type={type}
                      autoComplete={ac}
                      className={inputClass}
                      placeholder={ph}
                      value={d[k]}
                      onChange={(e) => set(k, e.target.value)}
                      onBlur={k === "phone" ? () => isValidPhMobile(d.phone) && set("phone", formatPhMobile(d.phone)) : undefined}
                      {...fieldProps(k)}
                    />
                    <FieldError id={`ap-${k}-error`} message={err(k)} />
                  </div>
                ))}
                <div>
                  <Label htmlFor="ap-province" required from={tag("province")}>
                    Province
                  </Label>
                  <select
                    id="ap-province"
                    className={inputClass}
                    value={d.province}
                    onChange={(e) => {
                      set("province", e.target.value);
                      set("city", "");
                    }}
                    {...fieldProps("province")}
                  >
                    <option value="">{provincesQuery.isLoading ? "Loading…" : "Select province…"}</option>
                    {(provincesQuery.data ?? []).map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="ap-province-error" message={err("province")} />
                </div>
                <div>
                  <Label htmlFor="ap-city" required from={tag("city")}>
                    City / municipality
                  </Label>
                  <select id="ap-city" className={inputClass} value={d.city} disabled={!d.province} onChange={(e) => set("city", e.target.value)} {...fieldProps("city")}>
                    <option value="">{!d.province ? "Choose a province first" : citiesQuery.isLoading ? "Loading…" : "Select city / municipality…"}</option>
                    {d.city && !(citiesQuery.data ?? []).some((c) => c.name === d.city) && <option value={d.city}>{d.city}</option>}
                    {(citiesQuery.data ?? []).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="ap-city-error" message={err("city")} />
                </div>
              </div>
            </section>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <Heading>Answer employer questions</Heading>
              <p className="mt-1 text-sm text-ink-2">Tell the employer about the role you want and your experience.</p>
            </div>
            <div>
              <Label htmlFor="ap-role" required>
                Which role are you applying for?
              </Label>
              {fixedRoleId && role ? (
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm font-medium">
                  {role.title} · {role.office}
                </p>
              ) : (
                <select
                  id="ap-role"
                  className={inputClass}
                  value={d.role}
                  onChange={(e) => {
                    const next = e.target.value;
                    set("role", next);
                    // An open requisition with the same title takes the application directly.
                    set("requisitionId", roles.find((r) => r.title === next)?.id ?? "");
                    // A different field has different background options.
                    if (fieldOfRole(next)?.key !== field?.key) set("background", "");
                  }}
                  {...fieldProps("role")}
                >
                  <option value="">Choose a role…</option>
                  {ROLE_FIELDS.map((f) => (
                    <optgroup key={f.key} label={f.label}>
                      {f.roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                          {roles.some((o) => o.title === r) ? " · Hiring now" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <FieldError id="ap-role-error" message={err("role")} />
            </div>
            <div>
              <Label htmlFor="ap-workExperience" required>
                Tell us about your work experience
              </Label>
              <textarea
                id="ap-workExperience"
                rows={3}
                className={clsx(inputClass, "resize-y")}
                placeholder="e.g. Fresh graduate with a 3-month internship in audit, or 4 years as a web developer at a BPO"
                value={d.workExperience}
                onChange={(e) => set("workExperience", e.target.value)}
                {...fieldProps("workExperience")}
              />
              <FieldError id="ap-workExperience-error" message={err("workExperience")} />
            </div>
            <div>
              <Label htmlFor="ap-years" required from={tag("years")}>
                How many years' experience do you have as {d.role ? `${/^[aeiou]/i.test(d.role) ? "an" : "a"} ${d.role}` : "this role"}?
              </Label>
              <select id="ap-years" className={inputClass} value={d.years} onChange={(e) => set("years", e.target.value)} {...fieldProps("years")}>
                <option value="" disabled>Select years of experience…</option>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <FieldError id="ap-years-error" message={err("years")} />
            </div>
            <div>
              <Label htmlFor="ap-background" required from={tag("background")}>
                Which describes your {field ? field.label.toLowerCase() : "professional"} background?
              </Label>
              <select
                id="ap-background"
                className={inputClass}
                value={d.background}
                disabled={!d.role}
                onChange={(e) => set("background", e.target.value)}
                {...fieldProps("background")}
              >
                <option value="" disabled>{d.role ? "Select your background…" : "Choose a role first"}</option>
                {(field?.backgrounds ?? [{ label: "Graduate of a related course" }, { label: "Student or undergraduate" }, { label: "Other field" }]).map((b) => (
                  <option key={b.label}>{b.label}</option>
                ))}
              </select>
              <FieldError id="ap-background-error" message={err("background")} />
            </div>
            {backgroundOption?.licensed && (
              <div className="item-enter md:max-w-xs">
                <Label htmlFor="ap-prcLicenseNumber" required from={tag("prcLicenseNumber")}>
                  License number
                </Label>
                <input id="ap-prcLicenseNumber" className={inputClass} placeholder="0123456" value={d.prcLicenseNumber} onChange={(e) => set("prcLicenseNumber", e.target.value)} {...fieldProps("prcLicenseNumber")} />
                <FieldError id="ap-prcLicenseNumber-error" message={err("prcLicenseNumber")} />
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <CareerHistory items={d.careerHistory} onChange={(v) => set("careerHistory", v)} />
            <EducationList items={d.education} onChange={(v) => set("education", v)} />
            <Skills items={d.skills} suggested={GENERAL_SKILLS} onChange={(v) => set("skills", v)} />

          </>
        )}

        {step === 3 && (
          <>
            <div>
              <Heading>Review and submit</Heading>
              <p className="mt-1 text-sm text-ink-2">Check everything before sending it to HR.</p>
            </div>
            <ReviewBlock title="Documents" onEdit={() => goTo(0)}>
              <Row label="Resumé">{d.resumeChoice === "upload" ? resume?.name : "Not included"}</Row>
              <Row label="Cover letter">{d.coverChoice === "upload" ? cover?.name : d.coverChoice === "write" ? "Written" : "Not included"}</Row>
              <Row label="Name">{`${d.firstName} ${d.lastName}`}</Row>
              <Row label="Email">{d.email}</Row>
              <Row label="Mobile">{isValidPhMobile(d.phone) ? formatPhMobile(d.phone) : d.phone}</Row>
              <Row label="Location">{[d.city, d.province].filter(Boolean).join(", ")}</Row>
            </ReviewBlock>
            <ReviewBlock title="Employer questions" onEdit={() => goTo(1)}>
              <Row label="Role">{role ? `${role.title} · ${role.office}` : d.role}</Row>
              <Row label="Experience">{d.workExperience}</Row>
              <Row label="Years">{d.years}</Row>
              <Row label="Background">{d.background}</Row>
              {backgroundOption?.licensed && <Row label="License no.">{d.prcLicenseNumber}</Row>}
            </ReviewBlock>
            <ReviewBlock title="Profile" onEdit={() => goTo(2)}>
              <Row label="Career history">{d.careerHistory.map((r) => `${r.title}, ${r.company}`).join("; ")}</Row>
              <Row label="Education">{d.education.map((e) => `${e.degree}, ${e.school}`).join("; ")}</Row>
              <Row label="Skills">{d.skills.join(", ")}</Row>
            </ReviewBlock>
            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
                <input
                  id="ap-consent"
                  type="checkbox"
                  checked={d.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  {...fieldProps("consent")}
                  className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-brand)]"
                />
                <span>I agree that MSMA Group may collect and use my details to review this application, as allowed by the Data Privacy Act of 2012 (RA 10173).</span>
              </label>
              <FieldError id="ap-consent-error" message={err("consent")} />
            </div>
            {mutation.isError && (
              <p role="alert" className="rounded-lg bg-critical-tint px-4 py-2.5 text-sm text-critical">
                {(mutation.error as Error).message}
              </p>
            )}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" className="min-h-11 justify-center" onClick={() => goTo(step - 1)} disabled={mutation.isPending}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button type="button" className="min-h-11 justify-center sm:min-w-36" onClick={goNext} disabled={Boolean(reading)}>
              {reading ? "Reading resume…" : "Continue"}
            </Button>
          ) : (
            <Button type="button" className="min-h-11 justify-center sm:min-w-44" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Submit application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-surface-2" aria-label={`Edit ${title.toLowerCase()}`}>
          <EditIcon className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className={empty ? "text-ink-3" : "font-medium break-words"}>{empty ? "Not added" : children}</dd>
    </div>
  );
}

function Card({ title, lines, onEdit, onRemove }: { title: string; lines: string[]; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="item-enter flex items-start gap-3 rounded-2xl border border-border p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className={clsx("text-sm", i === 0 ? "text-ink" : "text-ink-2")}>
            {l}
          </p>
        ))}
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${title}`} className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2">
        <EditIcon className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" icon={<PlusIcon className="h-4 w-4" />} onClick={onClick} className="min-h-11 self-start border-brand text-brand-ink">
      {children}
    </Button>
  );
}

function CareerHistory({ items, onChange }: { items: ApplicantRole[]; onChange: (v: ApplicantRole[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ApplicantRole>({ title: "", company: "", start: "", end: "", description: "" });
  const [current, setCurrent] = useState(false);
  const [error, setError] = useState("");
  const open = (i: number | null) => {
    const r = i === null ? { title: "", company: "", start: "", end: "", description: "" } : items[i];
    setDraft(r);
    setCurrent(i !== null && !r.end);
    setError("");
    setEditing(i === null ? -1 : i);
  };
  function save() {
    if (!draft.title.trim() || !draft.company.trim() || !draft.start) return setError("Add the job title, company and start month");
    const r = { ...draft, end: current ? "" : draft.end };
    if (!current && !r.end) return setError("Add the end month, or tick “I still work here”");
    onChange(editing === -1 ? [...items, r] : items.map((x, i) => (i === editing ? r : x)));
    setEditing(null);
  }
  return (
    <section className="flex flex-col gap-3">
      <Heading>Career history</Heading>
      {items.length === 0 && editing === null && <p className="text-sm text-ink-2">No roles added. Fresh graduates can skip this, or add an internship.</p>}
      {items.map((r, i) =>
        editing === i ? null : (
          <Card
            key={i}
            title={r.title}
            lines={[r.company, `${monthLabel(r.start)} – ${monthLabel(r.end)} (${duration(r.start, r.end)})`, r.description ?? ""]}
            onEdit={() => open(i)}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
        ),
      )}
      {editing !== null ? (
        <div className="item-enter flex flex-col gap-3 rounded-2xl border border-brand p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input className={inputClass} placeholder="Job title, e.g. Audit Associate" aria-label="Job title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <input className={inputClass} placeholder="Company, e.g. SGV & Co." aria-label="Company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            <label className="text-xs font-semibold text-ink-2">
              Started
              <input type="month" className={clsx(inputClass, "mt-1")} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-ink-2">
              Ended
              <input type="month" className={clsx(inputClass, "mt-1")} value={current ? "" : draft.end} disabled={current} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />I still work here
          </label>
          <textarea rows={2} className={clsx(inputClass, "resize-y")} placeholder="What you did (optional)" aria-label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          {error && <p className="text-xs font-medium text-critical">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save}>
              Save role
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => open(null)}>Add role</AddButton>
      )}
    </section>
  );
}

function EducationList({ items, onChange }: { items: ApplicantEducation[]; onChange: (v: ApplicantEducation[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ApplicantEducation>({ degree: "", school: "", finished: "" });
  const [error, setError] = useState("");
  const open = (i: number | null) => {
    setDraft(i === null ? { degree: "", school: "", finished: "" } : items[i]);
    setError("");
    setEditing(i === null ? -1 : i);
  };
  function save() {
    if (!draft.degree.trim() || !draft.school.trim()) return setError("Add the course or degree and the school");
    if (draft.finished && !/^\d{4}$/.test(draft.finished)) return setError("Use a four-digit year, e.g. 2026");
    onChange(editing === -1 ? [...items, draft] : items.map((x, i) => (i === editing ? draft : x)));
    setEditing(null);
  }
  return (
    <section className="flex flex-col gap-3">
      <Heading>Education</Heading>
      {items.map((e, i) =>
        editing === i ? null : (
          <Card key={i} title={e.degree} lines={[e.school, e.finished ? `Finished ${e.finished}` : ""]} onEdit={() => open(i)} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        ),
      )}
      {editing !== null ? (
        <div className="item-enter flex flex-col gap-3 rounded-2xl border border-brand p-4">
          <input className={inputClass} placeholder="Course or degree, e.g. BS Accountancy" aria-label="Course or degree" value={draft.degree} onChange={(e) => setDraft({ ...draft, degree: e.target.value })} />
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <input className={inputClass} placeholder="School, e.g. University of Cebu" aria-label="School" value={draft.school} onChange={(e) => setDraft({ ...draft, school: e.target.value })} />
            <input className={inputClass} inputMode="numeric" placeholder="Year finished" aria-label="Year finished" value={draft.finished} onChange={(e) => setDraft({ ...draft, finished: e.target.value.trim() })} />
          </div>
          {error && <p className="text-xs font-medium text-critical">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save}>
              Save education
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => open(null)}>Add education</AddButton>
      )}
    </section>
  );
}

/** Shows the typed part plain and the rest bold, so the match is easy to see ("Collabo" + **ration**). */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || i < 0) return <span className="font-semibold">{text}</span>;
  const end = i + query.trim().length;
  return (
    <>
      {i > 0 && <span className="font-semibold">{text.slice(0, i)}</span>}
      <span className="font-normal">{text.slice(i, end)}</span>
      <span className="font-semibold">{text.slice(end)}</span>
    </>
  );
}

function Skills({ items, suggested, onChange }: { items: string[]; suggested: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = searchSkills(text, items);
  const showList = open && matches.length > 0;

  const add = (v: string) => {
    const t = v.trim();
    if (t && !items.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
    setText("");
    setActive(0);
    inputRef.current?.focus();
  };
  const chips = suggested.filter((x) => !items.includes(x));

  return (
    <section className="flex flex-col gap-3">
      <Heading>Skills</Heading>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((x) => (
            <li key={x} className="item-enter flex items-center gap-1 rounded-full bg-surface-2 py-1.5 pr-1.5 pl-3.5 text-sm">
              {x}
              <button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))} className="rounded-full p-1 text-ink-3 hover:bg-surface hover:text-ink">
                <XIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label htmlFor="ap-skill" className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">
          Add new skill
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="ap-skill"
              role="combobox"
              aria-expanded={showList}
              aria-controls="ap-skill-list"
              aria-autocomplete="list"
              aria-activedescendant={showList ? `ap-skill-opt-${active}` : undefined}
              autoComplete="off"
              className={clsx(inputClass, "pr-9")}
              placeholder="Type a skill, e.g. Collaboration"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              // Leave time for a click on a suggestion to land first.
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && matches.length) {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => (a + 1) % matches.length);
                } else if (e.key === "ArrowUp" && matches.length) {
                  e.preventDefault();
                  setActive((a) => (a - 1 + matches.length) % matches.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  add(showList ? matches[active] : text);
                } else if (e.key === "Escape") {
                  if (showList) setOpen(false);
                  else setText("");
                }
              }}
            />
            {text && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setText("");
                  inputRef.current?.focus();
                }}
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
            {showList && (
              <ul
                id="ap-skill-list"
                role="listbox"
                aria-label="Matching skills"
                className="panel-enter absolute top-full right-0 left-0 z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface py-1.5 shadow-[0_12px_32px_-8px_rgb(15_23_42/0.25)]"
              >
                {matches.map((m, i) => (
                  <li
                    key={m}
                    id={`ap-skill-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(m);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={clsx("cursor-pointer px-4 py-2.5 text-sm text-ink", i === active && "bg-surface-2")}
                  >
                    <Highlight text={m} query={text} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="button" onClick={() => add(text)} disabled={!text.trim()} className="min-h-11 flex-none justify-center">
            Add
          </Button>
        </div>
        {text.trim() && matches.length === 0 && <p className="mt-1.5 text-xs text-ink-2">No match. Press Add to use "{text.trim()}" as it is.</p>}
      </div>
      {chips.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-ink-3">Popular skills</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((x) => (
              <button key={x} type="button" onClick={() => add(x)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink-2 hover:border-brand hover:text-ink">
                + {x}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
