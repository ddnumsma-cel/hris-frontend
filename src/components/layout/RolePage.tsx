import { createContext, Suspense, useContext, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PageSkeleton } from "./PageLoadingFallback";
import { useStickyPageTop } from "./useStickyPageTop";
import { ParticleDrift } from "./ParticleDrift";
import { ErrorBoundary } from "./ErrorBoundary";

export function RolePage({ sidenav, children }: { sidenav: ReactNode; children: ReactNode }) {
  const location = useLocation();
  // The page's heading, tabs and toolbars stay pinned under the top bar (see useStickyPageTop).
  const bodyRef = useRef<HTMLDivElement>(null);
  useStickyPageTop(bodyRef, location.pathname);
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[var(--sidenav-w)_1fr] sm:items-start">
      {/* Drifting dots behind every page, under all content. */}
      <ParticleDrift />
      {sidenav}
      <main className="flex min-w-0 flex-col gap-5.5 px-4 py-5.5 pb-15 sm:px-6">
        {/* While a page's code loads, only the page area shows placeholders; the sidebar stays. */}
        <Suspense fallback={<PageSkeleton />}>
          <div ref={bodyRef} key={location.pathname} className="page-body page-enter flex min-w-0 flex-col gap-5.5">
            {/* A page that crashes shows the error here; the sidebar stays and other pages still open. */}
            <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
          </div>
        </Suspense>
      </main>
    </div>
  );
}

/** Set inside a page shown within another page, so its title is a sub-heading (one h1 per page). */
const Inner = createContext(false);

/** A whole page shown inside another (Settings sections, Rules › Workflows, Approvals tabs). */
export function InnerPage({ children }: { children: ReactNode }) {
  return (
    <Inner.Provider value>
      <div className="settings-embed flex min-w-0 flex-col gap-5">{children}</div>
    </Inner.Provider>
  );
}

export function ContentHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const Heading = useContext(Inner) ? "h2" : "h1";
  return (
    <div data-page-head className="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <Heading className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</Heading>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
