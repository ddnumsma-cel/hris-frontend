import { lazy, Suspense } from "react";

// The sign-in page's left panel: the brand over a morphing point cloud. On phones only the brand
// strip shows.

const PointCloud = lazy(() => import("./PointCloud").then((m) => ({ default: m.PointCloud })));

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

export function LoginHero() {
  return (
    <div className="relative flex flex-col px-6 py-6 text-[var(--login-ink)] sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
      {/* Decorative, behind the brand; a click skips to the next shape. */}
      <Suspense fallback={null}>
        <PointCloud className="absolute inset-0 hidden cursor-pointer lg:block" />
      </Suspense>
      <div className="pointer-events-none relative flex flex-1 flex-col">
        <Brand />
        <h1 className="sr-only">Welcome to MSMA HRIS</h1>
        <div className="hidden flex-1 lg:block" />
        <p className="mx-auto hidden w-full max-w-lg text-xs text-[var(--login-ink-3)] lg:block">© {new Date().getFullYear()} MSMA Group</p>
      </div>
    </div>
  );
}
