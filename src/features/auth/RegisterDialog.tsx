import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { isGoogleConfigured, signInWithGoogle } from "@/lib/googleAuth";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, EyeIcon, XIcon } from "@/components/icons";
import { MorphAnnouncement, MorphLayers, useMorph } from "@/components/ui/Button";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { CausticsBackground } from "./CausticsBackground";
import { registerSelf } from "@/lib/corehr/api";
import { admin } from "@/lib/admin/store";
import { clusterOptions, officeOptions, POSITION_TITLES, registerSchema } from "@/lib/schemas";

const inputClass = "field w-full px-3 py-2.5 text-sm";
const labelClass = "mb-1.5 block text-xs font-medium text-ink";
const errorClass = "mt-1 text-xs font-medium text-critical";

// "Continue with Google" uses the real Google account chooser when a Client ID is set up
// (lib/googleAuth.ts). Without one, these demo accounts stand in so the form still works.
const demoGoogleAccounts = [
  { name: "Miguel Torres", email: "miguel.torres@gmail.com" },
  { name: "Sofia Reyes", email: "sofia.reyes@gmail.com" },
];

/** The form (no name: it comes from Google or the email), plus a password whenever they won't sign in with Google. */
function formSchema(needsPassword: boolean) {
  return registerSchema
    .omit({ name: true })
    .extend({ password: z.string() })
    .superRefine((v, ctx) => {
      // Only the company's minimum length is enforced; the strength meter is a guide.
      const min = admin.settings.minPasswordLength;
      if (needsPassword && v.password.length < min) ctx.addIssue({ code: "custom", path: ["password"], message: `Use at least ${min} characters` });
    });
}

/** "juan.dela_cruz@…" → "Juan Dela Cruz"; they can correct it in their 201 file. */
export function nameFromEmail(email: string) {
  return email
    .split("@")[0]!
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
type FormValues = z.infer<ReturnType<typeof formSchema>>;

/** What the sign-in page needs to sign a new registrant straight in. */
export interface Registered {
  username: string;
  /** Absent when they registered with Google (they sign in with Google). */
  password?: string;
}

export function RegisterDialog({ open, onClose, onSignIn }: { open: boolean; onClose: () => void; onSignIn?: (r: Registered) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [registered, setRegistered] = useState<(Registered & { name: string }) | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{ name: string; email: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // A real Google account signs them in later; the demo stand-ins don't, so those still need a password.
  const withGoogle = googleAccount !== null && isGoogleConfigured();
  const needsPassword = useRef(true);
  needsPassword.current = !withGoogle;
  const resolver: Resolver<FormValues> = (values, context, options) => zodResolver(formSchema(needsPassword.current))(values, context, options);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: { position: "", email: "", phone: "", cluster: "RPM", office: "Cebu HQ", password: "" },
  });
  const selectedCluster = watch("cluster");
  const password = watch("password");

  const mutation = useMutation({
    mutationFn: (v: FormValues) => registerSelf({ name: googleAccount?.name || nameFromEmail(v.email), email: v.email, password: withGoogle ? undefined : v.password, position: v.position, cluster: v.cluster, phone: v.phone }),
    onSuccess: (r, v) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setRegistered({ name: googleAccount?.name || nameFromEmail(v.email), username: r.username, password: withGoogle ? undefined : v.password });
    },
  });

  // Only while the account is being created, not while the form checks itself.
  const pending = mutation.isPending;
  const submitRef = useRef<HTMLButtonElement>(null);
  const submitPhase = useMorph(pending, mutation.isSuccess, submitRef);

  function close() {
    reset();
    setRegistered(null);
    setGoogleAccount(null);
    setGooglePickerOpen(false);
    mutation.reset();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  async function connectGoogle() {
    if (!isGoogleConfigured()) {
      setGooglePickerOpen(true);
      return;
    }
    setGoogleConnecting(true);
    try {
      chooseGoogleAccount(await signInWithGoogle());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Google sign-in didn't finish", "critical");
    } finally {
      setGoogleConnecting(false);
    }
  }

  function chooseGoogleAccount(account: { name: string; email: string }) {
    setValue("email", account.email, { shouldValidate: true });
    setGoogleAccount(account);
    setGooglePickerOpen(false);
  }

  function disconnectGoogle() {
    setGoogleAccount(null);
    setValue("email", "");
  }

  if (!open) return null;

  return (
    <div className="overlay-backdrop overlay-enter fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
        className="glass-surface panel-enter my-auto grid w-full max-w-4xl overflow-hidden rounded-[var(--radius-modal)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <BrandPanel />

        <div className="relative flex flex-col px-5 py-6 sm:px-8 sm:py-8">
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:bg-surface-2"
          >
            <XIcon className="h-4 w-4" />
          </button>

          <div className="mb-6 pr-10">
            <h2 id="reg-title" className="font-display text-2xl font-bold tracking-[-0.02em]">
              Create your account
            </h2>
            <p className="mt-1 text-sm text-ink-2">New to MSMA? Register here, then sign in with Google or your email and password.</p>
          </div>

          {registered ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
                <CheckIcon className="h-7 w-7" />
              </span>
              <div>
                <div className="font-display text-lg font-semibold">You're all set, {registered.name.split(" ")[0]}</div>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
                  {registered.password ? (
                    <>
                      Sign in with <span className="font-semibold text-ink">{registered.username}</span> and the password you chose.
                    </>
                  ) : (
                    <>
                      Sign in with Google as <span className="font-semibold text-ink">{registered.username}</span>.
                    </>
                  )}{" "}
                  HR will complete your job details.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {onSignIn && (
                  <Button
                    type="button"
                    icon={<ArrowRightIcon className="h-4 w-4" />}
                    onClick={() => {
                      const r = { username: registered.username, password: registered.password };
                      close();
                      onSignIn(r);
                    }}
                  >
                    Sign in now
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={close}>
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-6" noValidate>
              {googleAccount ? (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand/40 bg-brand-tint px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-2">Connected with Google</div>
                    <div className="truncate text-sm font-semibold">{googleAccount.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectGoogle}
                    aria-label="Disconnect Google account"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <GoogleButton onClick={connectGoogle} loading={googleConnecting} />
                  {googlePickerOpen && (
                    <div className="panel-enter rounded-[var(--radius-card)] border border-border bg-surface-2 p-2">
                      <div className="px-2 py-1 text-xs font-semibold text-ink-2">Choose an account (demo: Google sign-in isn't set up yet)</div>
                      {demoGoogleAccounts.map((acc) => (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => chooseGoogleAccount(acc)}
                          className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors hover:bg-surface"
                        >
                          <span className="accent-fill flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold">{acc.name[0]}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{acc.name}</span>
                            <span className="block truncate text-xs text-ink-2">{acc.email}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-ink-3">
                    <span className="h-px flex-1 bg-border" />
                    No Google account? Use your email and a password
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}

              <Section n={1} title="About you">
                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-email" className={labelClass}>
                      Email <span className="font-normal text-ink-3">(you'll sign in with it)</span>
                    </label>
                    <input id="reg-email" type="email" className={inputClass} placeholder="juan.delacruz@email.com" autoComplete="email" readOnly={googleAccount !== null} aria-invalid={errors.email ? true : undefined} {...register("email")} />
                    {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className={labelClass}>
                      Mobile number <span className="font-normal text-ink-3">(optional)</span>
                    </label>
                    <div className="field flex items-center !p-0">
                      <span className="flex flex-none items-center gap-2 border-r border-border px-3 py-2.5 text-sm text-ink-2">
                        <PhFlag />
                        +63
                      </span>
                      <input
                        id="reg-phone"
                        type="tel"
                        inputMode="numeric"
                        className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-3"
                        placeholder="917 123 4567"
                        autoComplete="tel-national"
                        aria-invalid={errors.phone ? true : undefined}
                        {...register("phone", { setValueAs: (v: string) => v.replace(/\D/g, "").replace(/^0/, "") })}
                      />
                    </div>
                    {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                  </div>
                </div>
              </Section>

              <Section n={2} title="Your job">
                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-position" className={labelClass}>
                      Position you're joining as
                    </label>
                    <div className="relative">
                      <select id="reg-position" className={clsx(inputClass, "appearance-none pr-9")} aria-invalid={errors.position ? true : undefined} {...register("position")}>
                        <option value="">Choose your position</option>
                        {POSITION_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    </div>
                    {errors.position && <p className={errorClass}>{errors.position.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="reg-office" className={labelClass}>
                      Office
                    </label>
                    <div className="relative">
                      <select id="reg-office" className={clsx(inputClass, "appearance-none pr-9")} {...register("office")}>
                        {officeOptions.map((office) => (
                          <option key={office} value={office}>
                            {office}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    </div>
                  </div>
                  <fieldset className="sm:col-span-2">
                    <legend className={labelClass}>Cluster</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {clusterOptions.map((cluster) => {
                        const active = selectedCluster === cluster;
                        return (
                          <label
                            key={cluster}
                            className={clsx(
                              "flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
                              active ? "border-brand bg-brand-tint text-ink" : "border-border text-ink-2 hover:border-brand/50",
                            )}
                          >
                            <input type="radio" value={cluster} className="sr-only" {...register("cluster")} />
                            {active && <CheckIcon className="h-4 w-4 text-brand" />}
                            {cluster}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </Section>

              {withGoogle ? (
                <p className="rounded-[var(--radius-card)] bg-surface-2 px-4 py-3 text-xs text-ink-2">No password needed: you'll sign in with Google as {googleAccount?.email}.</p>
              ) : (
                <Section n={3} title="Your password">
                  <PasswordField id="reg-password" label="Password" autoComplete="new-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} error={errors.password?.message} help={`At least ${admin.settings.minPasswordLength} characters. Mix upper and lower case, numbers and symbols to make it stronger.`} {...register("password")}>
                    <PasswordStrength password={password} id="reg-password-strength" />
                  </PasswordField>
                </Section>
              )}

              <div className="flex flex-col gap-3">
                {mutation.error && (
                  <p role="alert" className="rounded-[var(--radius-control)] bg-critical-tint px-3 py-2 text-xs font-medium text-critical">
                    {mutation.error.message}
                  </p>
                )}
                <span className="btn-morph w-full">
                  <button
                    ref={submitRef}
                    type="submit"
                    disabled={pending}
                    data-phase={submitPhase}
                    aria-busy={submitPhase === "loading" || undefined}
                    className="btn btn-primary relative flex w-full items-center justify-center px-5 py-3 text-sm font-semibold"
                  >
                    <span className="btn-label">
                      {pending ? "Creating your account…" : "Create account"}
                      <ArrowRightIcon className="absolute right-5 h-4 w-4" />
                    </span>
                    <MorphLayers />
                  </button>
                  <MorphAnnouncement phase={submitPhase} />
                </span>
                <p className="text-center text-xs text-ink-2">
                  Already have an account?{" "}
                  <button type="button" onClick={close} className="font-semibold text-brand-ink underline-offset-2 hover:underline">
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** A numbered group of fields. */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`reg-sec-${n}`} className="flex flex-col gap-3">
      <h3 id={`reg-sec-${n}`} className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true" className="accent-fill flex h-6 w-6 items-center justify-center rounded-full text-xs">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A password input with a show/hide toggle; `children` (the strength meter) sits under it and describes it. */
function PasswordField({
  id,
  label,
  show,
  onToggle,
  error,
  help,
  children,
  ...input
}: { id: string; label: string; show: boolean; onToggle?: () => void; error?: string; help?: string; children?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={clsx(inputClass, onToggle && "pr-11")} aria-invalid={error ? true : undefined} aria-describedby={[children ? `${id}-strength` : "", help ? `${id}-help` : ""].filter(Boolean).join(" ") || undefined} {...input} />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-ink-3 hover:text-ink"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
      {error ? (
        <p className={errorClass}>{error}</p>
      ) : (
        help && (
          <p id={`${id}-help`} className="mt-1 text-xs text-ink-3">
            {help}
          </p>
        )
      )}
    </div>
  );
}

function PhFlag() {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] flex-none overflow-hidden rounded-[2px]" aria-hidden="true">
      <rect width="18" height="6" fill="#0038a8" />
      <rect y="6" width="18" height="6" fill="#ce1126" />
      <path d="M0 0 L10.4 6 L0 12 Z" fill="#fff" />
      <circle cx="3.6" cy="6" r="1.3" fill="#fcd116" />
    </svg>
  );
}

const STEPS = [
  { title: "Create your account", text: "With Google, or your email and a password." },
  { title: "HR completes your record", text: "Your job details, schedule and pay." },
  { title: "You're in", text: "Clock in, file leave and see your payslips." },
];

/** The brand side: MSMA's navy water with lime caustics, and what happens after registering. On phones, a short banner. */
function BrandPanel() {
  return (
    <div className="relative overflow-hidden bg-brand-dark px-5 py-5 text-[var(--mark-ink)] md:flex md:flex-col md:p-8">
      <CausticsBackground className="pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-3">
        <img src="/brand/msma-mark.png" alt="MSMA" className="h-7 w-auto md:h-8" />
        <span className="font-display text-base font-semibold">MSMA</span>
      </div>
      <p className="relative mt-4 font-display text-xl font-bold leading-tight tracking-[-0.02em] md:mt-auto md:text-2xl">Let's get you set up.</p>
      <ol className="relative mt-6 hidden flex-col gap-4 md:flex">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--brand-lime)] text-xs font-bold text-brand-dark">
              {i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold">{s.title}</span>
              <span className="block text-xs opacity-75">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
