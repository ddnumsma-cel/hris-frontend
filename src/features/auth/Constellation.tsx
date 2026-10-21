import { useEffect, useRef } from "react";

// The sign-in page's background: slow drifting dots joined by faint lines when they're close, with
// the pointer as one more dot. Colour --constellation (index.css), chosen so the page's muted text
// keeps 4.5:1 with a line at full strength behind it. Sits under the page content (z-index 1).

const MAX_ALPHA = 0.4;
const MAX_DT = 0.05;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function Constellation({ className }: { className?: string }) {
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
    let nodes: Node[] = [];
    let rgb = "191, 216, 19";
    const pointer = { x: 0, y: 0, on: false };

    const readColor = () => {
      ctx.fillStyle = getComputedStyle(el).getPropertyValue("--constellation").trim() || "#bfd813";
      const hex = String(ctx.fillStyle);
      if (/^#[0-9a-f]{6}$/i.test(hex)) rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
    };

    const spawn = () => {
      // Pair checks grow with the square of the count, so small screens get fewer dots.
      const count = Math.round(Math.min(w < 640 ? 30 : 60, Math.max(35, (w * h) / 22000)));
      nodes = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 14;
        return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const reach = Math.min(w, h) * 0.3;
      const all = pointer.on ? [...nodes, { x: pointer.x, y: pointer.y, vx: 0, vy: 0 }] : nodes;
      ctx.lineWidth = 1;
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]!;
          const b = all[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d >= reach) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${MAX_ALPHA * (1 - d / reach)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${rgb}, ${MAX_ALPHA})`;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
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
      const first = !nodes.length;
      if (!first) nodes = nodes.map((n) => ({ ...n, x: (n.x / w) * nw, y: (n.y / h) * nh }));
      w = nw;
      h = nh;
      if (first) spawn();
      draw();
    };

    let raf = 0;
    let last = 0;
    let running = false;
    const frame = (now: number) => {
      // Capped, so coming back to the tab doesn't make the dots jump.
      const dt = Math.min(MAX_DT, last ? (now - last) / 1000 : 0);
      last = now;
      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < 0 || n.x > w) (n.vx = -n.vx), (n.x = Math.max(0, Math.min(w, n.x)));
        if (n.y < 0 || n.y > h) (n.vy = -n.vy), (n.y = Math.max(0, Math.min(h, n.y)));
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    // Only while the tab is visible; reduced motion keeps a still frame.
    const update = () => {
      const want = !motion.matches && document.visibilityState === "visible";
      if (want && !running) (running = true), (last = 0), (raf = requestAnimationFrame(frame));
      else if (!want && running) (running = false), cancelAnimationFrame(raf), draw();
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height;
      if (!running) draw();
    };
    const onLeave = () => (pointer.on = false);

    readColor();
    const sized = new ResizeObserver(resize);
    sized.observe(el);
    const recolor = () => (readColor(), draw());
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", recolor);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    update();

    return () => {
      cancelAnimationFrame(raf);
      sized.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", recolor);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={box} aria-hidden="true" className={className}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
