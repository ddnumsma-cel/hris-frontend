import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, LoaderIcon, XIcon } from "@/components/icons";
import { registerEmployee } from "@/lib/api";
import { clusterDescriptions, clusterOptions, officeOptions, registerSchema, type RegisterFormValues } from "@/lib/schemas";

const inputClass =
  "field w-full px-3 py-2.5 text-sm";
const labelClass = "mb-1.5 block text-xs font-medium text-ink";
const errorClass = "mt-1 text-xs font-medium text-critical";

// Demo-only stand-ins for a Google account chooser — this prototype has no
// real OAuth client/backend to exchange tokens with, so "Continue with
// Google" simulates the identity handoff (picking a name/email) rather than
// performing a real sign-in.
const demoGoogleAccounts = [
  { name: "Miguel Torres", email: "miguel.torres@gmail.com" },
  { name: "Sofia Reyes", email: "sofia.reyes@gmail.com" },
];

const steps = ["Fill in your details", "HR reviews your registration", "Get your system access"];

export function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [registered, setRegistered] = useState<{ name: string; id: string } | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{ name: string; email: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", position: "", email: "", phone: "", cluster: "RPM", office: "Cebu HQ" },
  });

  const selectedCluster = watch("cluster");

  const mutation = useMutation({
    mutationFn: registerEmployee,
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      setRegistered({ name: employee.name, id: employee.id });
      toast.show("Registration submitted. HR will follow up with your access.");
    },
  });

  function close() {
    reset();
    setRegistered(null);
    setGoogleAccount(null);
    setGooglePickerOpen(false);
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

  function connectGoogle() {
    setGoogleConnecting(true);
    setTimeout(() => {
      setGoogleConnecting(false);
      setGooglePickerOpen(true);
    }, 700);
  }

  function chooseGoogleAccount(account: { name: string; email: string }) {
    setValue("name", account.name, { shouldValidate: true });
    setValue("email", account.email, { shouldValidate: true });
    setGoogleAccount(account);
    setGooglePickerOpen(false);
  }

  function disconnectGoogle() {
    setGoogleAccount(null);
    setValue("name", "");
    setValue("email", "");
  }

  if (!open) return null;

  const pending = isSubmitting || mutation.isPending;

  return (
    <div className="overlay-backdrop overlay-enter fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Register"
        className="glass-surface panel-enter my-auto grid w-full max-w-4xl overflow-hidden rounded-[var(--radius-modal)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <RegisterArt />
        <RegisterBanner />

        <div className="relative flex flex-col px-5 py-6 sm:px-9 sm:py-8">
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:bg-surface-2"
          >
            <XIcon className="h-4 w-4" />
          </button>

          <div className="mb-6 pr-10">
            <h2 className="font-display text-2xl font-bold tracking-[-0.02em]">Registration</h2>
            <span className="mt-2.5 block h-1 w-8 rounded-full bg-brand" />
          </div>

          {registered ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
                <CheckIcon className="h-7 w-7" />
              </span>
              <div>
                <div className="font-display text-lg font-semibold">You're registered, {registered.name}</div>
                <div className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
                  Reference ID <span className="font-num font-semibold">{registered.id}</span>. HR will review your
                  details and set up your system access.
                </div>
              </div>
              <Button type="button" onClick={close} className="mt-2">
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
              {googleAccount ? (
                <div className="flex items-center justify-between gap-2.5 rounded-lg border border-brand/40 bg-brand-tint px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-2">Connected via Google</div>
                    <div className="truncate text-sm font-semibold">{googleAccount.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectGoogle}
                    aria-label="Disconnect Google account"
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <GoogleButton onClick={connectGoogle} loading={googleConnecting} />

                  {googlePickerOpen && (
                    <div className="panel-enter rounded-lg border border-border bg-surface-2 p-1.5">
                      <div className="px-2 py-1 text-xs font-semibold text-ink-2">Choose an account</div>
                      {demoGoogleAccounts.map((acc) => (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => chooseGoogleAccount(acc)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
                        >
                          <span className="flex h-7 w-7 flex-none items-center justify-center accent-fill rounded-full text-xs font-semibold">
                            {acc.name[0]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{acc.name}</span>
                            <span className="block truncate text-xs text-ink-2">{acc.email}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-xs text-ink-3">
                    <span className="h-px flex-1 bg-border" />
                    or fill in manually
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-name" className={labelClass}>
                    Full name
                  </label>
                  <input
                    id="reg-name"
                    className={inputClass}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                    readOnly={googleAccount !== null}
                    {...register("name")}
                  />
                  {errors.name && <p className={errorClass}>{errors.name.message}</p>}
                </div>

                <div>
                  <label htmlFor="reg-position" className={labelClass}>
                    Position you're joining as
                  </label>
                  <input
                    id="reg-position"
                    className={inputClass}
                    placeholder="Audit Associate"
                    autoComplete="organization-title"
                    {...register("position")}
                  />
                  {errors.position && <p className={errorClass}>{errors.position.message}</p>}
                </div>

                <div>
                  <label htmlFor="reg-email" className={labelClass}>
                    Email <span className="font-normal text-ink-3">(optional)</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    className={inputClass}
                    placeholder="juan.delacruz@email.com"
                    autoComplete="email"
                    readOnly={googleAccount !== null}
                    {...register("email")}
                  />
                  {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="reg-phone" className={labelClass}>
                    Mobile number <span className="font-normal text-ink-3">(optional)</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-border bg-surface transition-colors focus-within:border-brand">
                    <span className="flex flex-none items-center gap-1.5 border-r border-border px-3 py-2.5 text-sm text-ink-2">
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
                      {...register("phone", { setValueAs: (v: string) => v.replace(/\D/g, "").replace(/^0/, "") })}
                    />
                  </div>
                  {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                </div>

                <div className="sm:col-span-2">
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
                  {errors.office && <p className={errorClass}>{errors.office.message}</p>}
                </div>
              </div>

              <fieldset>
                <legend className={labelClass}>Cluster</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {clusterOptions.map((cluster) => {
                    const active = selectedCluster === cluster;
                    return (
                      <label
                        key={cluster}
                        className={clsx(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                          active ? "border-brand bg-brand-tint" : "border-border hover:border-brand/50",
                        )}
                      >
                        <input type="radio" value={cluster} className="sr-only" {...register("cluster")} />
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition-colors",
                            active ? "border-brand" : "border-ink-3",
                          )}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{cluster}</span>
                          <span className="block text-xs leading-snug text-ink-2">{clusterDescriptions[cluster]}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.cluster && <p className={errorClass}>{errors.cluster.message}</p>}
              </fieldset>

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary relative mt-2 flex w-full items-center justify-center px-5 py-3 text-sm font-semibold"
              >
                {pending ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Registering…
                  </>
                ) : (
                  "Register"
                )}
                <ArrowRightIcon className="absolute right-5 h-4 w-4" />
              </button>

              <p className="text-center text-xs text-ink-2">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={close}
                  className="font-semibold text-brand-ink underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
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

/** Left-hand brand panel: an illustrated ID-card scene in the MSMA palette. */
function RegisterArt() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-dark p-8 text-white md:flex md:flex-col">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#4d7c0f]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#2a78d6]/30 blur-3xl" />

      <div className="relative flex items-center gap-2.5">
        <img src="/brand/msma-mark.png" alt="MSMA" className="h-8 w-auto" />
        <span className="font-display text-base font-semibold">MSMA</span>
      </div>

      <IdCardScene className="relative mx-auto my-8 w-full max-w-[280px]" />

      <div className="relative mt-auto">
        <h3 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">Welcome to the team.</h3>
        <p className="mt-2 text-sm text-white/70">Register once and HR will set up your MSMA workspace.</p>
        <ol className="mt-5 flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm text-white/85">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/10 font-num text-xs font-semibold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Phone-only version of the brand panel: a short banner above the form. */
function RegisterBanner() {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden bg-brand-dark px-5 py-5 text-white md:hidden">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#4d7c0f]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[#2a78d6]/30 blur-3xl" />

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <img src="/brand/msma-mark.png" alt="MSMA" className="h-6 w-auto" />
          <span className="font-display text-sm font-semibold">MSMA</span>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold leading-tight tracking-[-0.02em]">Welcome to the team.</h3>
        <p className="mt-1 text-xs text-white/70">Register once and HR will set up your MSMA workspace.</p>
      </div>

      <IdCardScene className="relative -my-3 w-28 flex-none" />
    </div>
  );
}

function IdCardScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 260" className={className} aria-hidden="true">
      {/* orbit rings + stars */}
      <circle cx="140" cy="130" r="118" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="3 6" />
      <circle cx="140" cy="130" r="88" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
      <circle cx="34" cy="62" r="2" fill="#bfe36b" />
      <circle cx="250" cy="208" r="2.5" fill="#bfe36b" opacity="0.7" />
      <circle cx="236" cy="40" r="1.5" fill="#fff" opacity="0.6" />
      <circle cx="22" cy="190" r="1.5" fill="#fff" opacity="0.5" />

      {/* back card */}
      <g transform="rotate(-9 140 130)">
        <rect x="62" y="58" width="160" height="112" rx="14" fill="#1b2a52" />
      </g>

      {/* ID card */}
      <g transform="rotate(4 140 140)">
        <rect x="54" y="74" width="172" height="118" rx="14" fill="#ffffff" />
        <rect x="54" y="74" width="172" height="28" rx="14" fill="#4d7c0f" />
        <rect x="54" y="90" width="172" height="12" fill="#4d7c0f" />
        <rect x="120" y="84" width="40" height="6" rx="3" fill="#fff" opacity="0.7" />
        <rect x="70" y="114" width="46" height="56" rx="8" fill="#eef4dc" />
        <circle cx="93" cy="133" r="10" fill="#8fc93f" />
        <path d="M77 166c2-12 9-17 16-17s14 5 16 17z" fill="#8fc93f" />
        <rect x="128" y="118" width="80" height="8" rx="4" fill="#12172a" />
        <rect x="128" y="133" width="58" height="6" rx="3" fill="#c3c8d3" />
        <rect x="128" y="146" width="70" height="6" rx="3" fill="#c3c8d3" />
        <rect x="128" y="159" width="40" height="6" rx="3" fill="#c3c8d3" />
      </g>

      {/* check badge */}
      <circle cx="216" cy="78" r="20" fill="#8fc93f" />
      <path d="M207 78l6 6 12-12" fill="none" stroke="#0e1835" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      {/* floating chip */}
      <g transform="translate(26 196)">
        <rect width="96" height="30" rx="15" fill="#ffffff" fillOpacity="0.12" />
        <circle cx="16" cy="15" r="6" fill="#bfe36b" />
        <rect x="28" y="12" width="54" height="6" rx="3" fill="#fff" opacity="0.6" />
      </g>
    </svg>
  );
}
