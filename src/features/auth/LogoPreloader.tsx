import { useEffect, useState } from "react";

// The app's preloader: on every full page load (typing the address, refreshing, opening a link)
// the MSMA mark draws itself (outline, then the lime triangles a beat later), fills in, the
// wordmark rises in, and the overlay fades away once the page has loaded. Moving between pages
// inside the app doesn't replay it (it lives in App, which mounts once per load). Styles: .logo-preloader in index.css;
// under reduced motion the animations are off globally, so it shows the finished logo and leaves.

/** The mark's white shapes and lime triangles, traced from /brand/msma-mark.png (500 × 284). */
const OUTLINE = [
  "M4 282 L80 88 L126 138 L162 60 L150 50 L214 2 L226 82 L206 78 L138 228 L96 176 L56 282 Z",
  "M346 96 L500 96 L466 148 L304 148 Z",
  "M306 228 L468 228 L434 280 L272 280 Z",
];
const INNER = ["M202 108 L274 282 L222 282 L184 190 L164 196 Z", "M304 152 L383 152 L342 200 Z", "M428 172 L468 227 L392 227 Z"];

const DRAW_MS = 3400;
const FADE_MS = 400;
const MAX_WAIT_MS = 6000;

/** The overlay to render, and whether the page under it still counts as loading (for aria-busy). */
export function useLogoPreloader() {
  const [state, setState] = useState<"showing" | "leaving" | "gone">("showing");
  useEffect(() => {
    if (state !== "showing") return;
    let left = false;
    const drawn = new Promise((r) => setTimeout(r, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : DRAW_MS));
    // The page is ready at "load", but a stalled font or image never holds the sign-in form back.
    const loaded = document.readyState === "complete" ? Promise.resolve() : Promise.race([new Promise((r) => window.addEventListener("load", r, { once: true })), new Promise((r) => setTimeout(r, MAX_WAIT_MS))]);
    Promise.all([drawn, loaded]).then(() => {
      if (!left) setState("leaving");
    });
    return () => {
      left = true;
    };
  }, [state]);
  // Its own effect, so leaving "showing" doesn't cancel the removal.
  useEffect(() => {
    if (state !== "leaving") return;
    const timer = window.setTimeout(() => setState("gone"), FADE_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return { busy: state !== "gone", overlay: state === "gone" ? null : <LogoPreloader leaving={state === "leaving"} /> };
}

function LogoPreloader({ leaving }: { leaving: boolean }) {
  return (
    <div className="logo-preloader fixed inset-0 z-[100] flex items-center justify-center bg-[var(--login-bg)]" data-leaving={leaving || undefined}>
      <div className="flex flex-col items-center gap-5">
        <div className="logo-preloader-tile">
          <svg viewBox="-8 -8 516 300" className="h-auto w-[220px]">
            <g role="img" aria-label="MSMA" strokeLinecap="round" strokeLinejoin="round" strokeWidth={5}>
              {OUTLINE.map((d) => (
                <path key={`f${d}`} d={d} className="logo-fill" />
              ))}
              {INNER.map((d) => (
                <path key={`g${d}`} d={d} className="logo-inner-fill" />
              ))}
              {OUTLINE.map((d) => (
                <path key={`o${d}`} d={d} pathLength={1} className="logo-outline" />
              ))}
              {INNER.map((d) => (
                <path key={`i${d}`} d={d} pathLength={1} className="logo-inner" />
              ))}
            </g>
          </svg>
        </div>
        <div className="logo-wordmark text-center text-[var(--login-ink)]">
          <div className="font-display text-2xl font-semibold tracking-[0.04em]">MSMA</div>
          <div className="mt-1 text-xs text-[var(--login-ink-2)]">Mora, Sanchez, Meñoza and Associates</div>
        </div>
        <p role="status" className="sr-only">
          {leaving ? "Ready." : "Loading heyhr…"}
        </p>
      </div>
    </div>
  );
}
