import { Suspense, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PageSkeleton } from "./PageLoadingFallback";

export function RolePage({ sidenav, children }: { sidenav: ReactNode; children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[var(--sidenav-w)_1fr] sm:items-start">
      {sidenav}
      <main className="flex min-w-0 flex-col gap-5.5 px-4 py-5.5 pb-15 sm:px-6">
        {/* While a page's code loads, only the page area shows placeholders; the sidebar stays. */}
        <Suspense fallback={<PageSkeleton />}>
          <div key={location.pathname} className="page-enter flex min-w-0 flex-col gap-5.5">
            {children}
          </div>
        </Suspense>
      </main>
    </div>
  );
}

export function ContentHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
