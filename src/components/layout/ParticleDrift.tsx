import { useEffect, useRef } from "react";

// A quiet field of dots drifting upward behind every workspace page. Depth (z, 0 = far, 1 = near)
// sets each dot's size, opacity and speed. The color is --drift (index.css), chosen so muted text
// keeps 4.5:1 even with a dot at full strength behind it. Fixed to the page area right of the
// sidebar, under all content; it never takes clicks.

const COUNT = 70;
const MAX_DT = 0.05;

interface Dot {
  x: number;
  y: number;
  z: number;
  phase: number;
}

export function ParticleDrift() {
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = box.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!el || !canvas || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let rgb = "181, 222, 249";

    // --drift as "r, g, b" for rgba(); the canvas normalizes any CSS color to #rrggbb.
    const readColor = () => {
      ctx.fillStyle = getComputedStyle(el).getPropertyValue("--drift").trim() || "#b5def9";
      const hex = String(ctx.fillStyle);
      if (/^#[0-9a-f]{6}$/i.test(hex)) rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const sway = Math.sin(t * (0.4 + d.z * 0.5) + d.phase) * (2 + d.z * 4);
        ctx.beginPath();
        ctx.arc(d.x + sway, d.y, 1 + d.z * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${0.14 + d.z * 0.5})`;
        ctx.fill();
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      if (!nw || !nh) return;
      canvas.width = Math.round(nw * dpr);
      canvas.height = Math.round(nh * dpr);
      canvas.style.width = `${nw}px`;
      canvas.style.height = `${nh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // First size: scatter the dots; later sizes: stretch them into the new box.
      dots = dots.length
        ? dots.map((d) => ({ ...d, x: (d.x / (w || nw)) * nw, y: (d.y / (h || nh)) * nh }))
        : Array.from({ length: COUNT }, () => ({ x: Math.random() * nw, y: Math.random() * nh, z: Math.random(), phase: Math.random() * Math.PI * 2 }));
      w = nw;
      h = nh;
      draw(performance.now() / 1000);
    };

    let raf = 0;
    let last = 0;
    let running = false;
    const frame = (now: number) => {
      // Capped so a stall (or a paused tab) never makes the dots jump.
      const dt = Math.min(MAX_DT, last ? (now - last) / 1000 : 0);
      last = now;
      for (const d of dots) {
        d.y -= (6 + d.z * 30) * dt;
        const r = 1 + d.z * 2.5;
        if (d.y < -r - 8) {
          d.y = h + r + 8;
          d.x = Math.random() * w;
        }
      }
      draw(now / 1000);
      raf = requestAnimationFrame(frame);
    };

    // Work only while the tab and the page area are visible; reduced motion keeps a still frame.
    let onScreen = true;
    const update = () => {
      const want = !motion.matches && onScreen && document.visibilityState === "visible";
      if (want && !running) (running = true), (last = 0), (raf = requestAnimationFrame(frame));
      else if (!want && running) (running = false), cancelAnimationFrame(raf), draw(performance.now() / 1000);
    };

    readColor();
    const sized = new ResizeObserver(resize);
    sized.observe(el);
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = !!entry?.isIntersecting;
      update();
    });
    seen.observe(el);
    // Light/dark changes swap --drift.
    const recolor = () => (readColor(), draw(performance.now() / 1000));
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", recolor);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      sized.disconnect();
      seen.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", recolor);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={box} aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 left-0 z-[-1] sm:left-[var(--sidenav-w)]">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
