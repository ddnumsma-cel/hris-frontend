import clsx from "clsx";
import { LoaderIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/AuthContext";
import { initialCollapsed } from "./sidebarState";

/** Placeholder shaped like a typical page: title, a row of stat cards, two content cards. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}

// Row label widths, so the placeholder sidebar doesn't look like identical bars.
const ROW_WIDTHS = ["w-20", "w-28", "w-24", "w-32", "w-20", "w-28", "w-24", "w-16"];

/**
 * Shown while a workspace loads (e.g. on refresh): a placeholder sidebar at the width the
 * person last chose (compact rail or full) beside a placeholder page, instead of a blank screen.
 */
export function PageLoadingFallback() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderIcon className="h-6 w-6 animate-spin text-brand-ink" />
      </div>
    );
  }
  const collapsed = initialCollapsed();
  // Every workspace collapses to the 80px compact rail.
  const rail = collapsed;

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[var(--sidenav-w)_1fr] sm:items-start">
      <aside
        aria-hidden="true"
        className={clsx(
          "sidebar sidebar-desktop hidden sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:flex sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:flex-col sm:self-start sm:overflow-hidden sm:border-r sm:border-[var(--sb-border)]",
          collapsed && "sidebar-collapsed",
          rail && "sidebar-rail",
        )}
      >
        <div className="flex h-20 flex-none items-center justify-center border-b border-[var(--sb-border)]">
          <Skeleton className={collapsed ? "h-7 w-7 rounded-[var(--radius-logo)]" : "h-8 w-28"} />
        </div>
        <div className="flex flex-col gap-2 px-2 pt-4">
          {ROW_WIDTHS.map((w, i) =>
            collapsed ? (
              <Skeleton key={i} className="mx-auto h-9 w-9 rounded-[var(--radius-control)]" />
            ) : (
              <div key={i} className="flex h-9 items-center gap-2.5 px-3">
                <Skeleton className="h-5 w-5 flex-none rounded-[var(--radius-logo)]" />
                <Skeleton className={clsx("h-3.5", w)} />
              </div>
            ),
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-col px-4 py-5.5 pb-15 sm:px-6">
        <PageSkeleton />
      </main>
    </div>
  );
}
