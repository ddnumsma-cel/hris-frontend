import type { ReactNode } from "react";
import clsx from "clsx";
import { CalendarIcon, CheckIcon, FingerprintIcon, PayrollIcon } from "@/components/icons";

// The sign-in page's left panel: brand, welcome, and three floating cards that preview what the
// system does (sample pictures, not anyone's data). On phones only the brand strip shows.

function Brand() {
  return (
    <div className="mx-auto flex w-full max-w-lg items-center gap-3">
      <img src="/brand/msma-mark.png" alt="MSMA" className="login-mark h-9 w-auto" />
      <div className="leading-tight">
        <div className="font-display text-base font-semibold">MSMA</div>
        <div className="text-xs text-[var(--login-ink-2)]">Mora, Sanchez, Meñoza and Associates</div>
      </div>
    </div>
  );
}

/** "Welcome to" light, "MSMA" bold, "HRIS" bold in sky blue. */
function Headline() {
  return (
    <h1 className="font-display text-4xl leading-tight tracking-[-0.02em]">
      <span className="font-light text-[var(--login-ink-2)]">Welcome to </span>
      <span className="font-bold">MSMA</span> <span className="font-bold text-[var(--login-link)]">HRIS</span>
    </h1>
  );
}

/** A small floating card, drifting gently (see .login-float). */
function PreviewCard({ icon, title, sub, right, className }: { icon: ReactNode; title: string; sub: string; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx("login-float flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--login-line)] bg-[var(--login-card)] p-4 backdrop-blur-[var(--blur-control)]", className)}>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-logo)] bg-[var(--login-tile)] text-[var(--login-link)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-[var(--login-ink-2)]">{sub}</span>
      </span>
      {right}
    </div>
  );
}

export function LoginHero() {
  return (
    <div className="flex flex-col px-6 py-6 text-[var(--login-ink)] sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
      <Brand />

      <div className="mx-auto hidden w-full max-w-lg flex-1 flex-col justify-center gap-10 py-12 lg:flex">
        <div>
          <Headline />
          <p className="mt-4 text-[0.95rem] text-[var(--login-ink-2)]">Sign in to manage your attendance, leave and pay.</p>
        </div>
        <div className="flex flex-col gap-4" aria-hidden="true">
          <PreviewCard icon={<FingerprintIcon className="h-4.5 w-4.5" />} title="Clocked in · 8:02 AM" sub="Office fingerprint scanner" right={<span className="h-2 w-2 flex-none rounded-full bg-good" />} className="mr-12" />
          <PreviewCard
            icon={<CalendarIcon className="h-4.5 w-4.5" />}
            title="Vacation leave approved"
            sub="By your manager · 2 days"
            right={
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-[var(--radius-pill)] bg-good-tint text-good">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            }
            className="ml-12"
          />
          <PreviewCard
            icon={<PayrollIcon className="h-4.5 w-4.5" />}
            title="Your payslip is ready"
            sub="Released with this cutoff's payroll"
            right={
              <span className="flex w-16 flex-none flex-col gap-1">
                <span className="h-1.5 rounded-full bg-[var(--sky)]" />
                <span className="h-1.5 w-2/3 rounded-full bg-[var(--login-bar)]" />
              </span>
            }
            className="mr-6"
          />
        </div>
      </div>

      <p className="mx-auto hidden w-full max-w-lg text-xs text-[var(--login-ink-3)] lg:block">© {new Date().getFullYear()} MSMA Group</p>
    </div>
  );
}
