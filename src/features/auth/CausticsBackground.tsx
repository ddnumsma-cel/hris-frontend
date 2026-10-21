import { useEffect, useRef } from "react";
import * as THREE from "three";

// Underwater caustics behind the registration panel, in MSMA's colours: the brand navy as the
// water (darker toward the bottom, where the text sits), lime caustic lines and a little white
// where they cross. A full-screen quad with a shader; slow time so it shimmers. Colours come from
// --surface-strong, --brand-lime and --mark-ink (index.css).

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform vec3 uWater;
  uniform vec3 uLine;
  uniform vec3 uFoam;

  // The classic tileable caustic iteration.
  float caustic(vec2 uv, float time) {
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.0065;
    for (int n = 0; n < 5; n++) {
      float tt = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c = 1.17 - pow(c / 5.0, 1.4);
    return pow(abs(c), 8.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 q = vec2(uv.x * uRes.x / uRes.y, uv.y) * 1.8 + uPointer * 0.04;
    float a = caustic(q, uTime);
    float b = caustic(q * 1.6 + 3.7, uTime * 0.7);
    float lines = clamp(a * 0.6 + b * 0.35, 0.0, 1.0);
    // Darker toward the bottom, a little brighter at the top.
    vec3 col = uWater * mix(0.7, 1.35, uv.y);
    // Lines fade toward the bottom too, so the text there stays easy to read.
    float reach = smoothstep(0.05, 0.75, uv.y);
    col += uLine * lines * 0.6 * reach;
    col += uFoam * smoothstep(0.35, 0.9, a * b) * 0.5 * reach;
    // Gentle vignette.
    vec2 d = uv - 0.5;
    col *= 1.0 - dot(d, d) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A colour token as the shader should output it: its sRGB values as written (the shader writes them
 *  straight to the screen, so Three's linear conversion would darken every colour). */
function cssColor(el: Element, name: string, fallback: string) {
  const c = new THREE.Color(getComputedStyle(el).getPropertyValue(name).trim() || fallback);
  const rgb = { r: 0, g: 0, b: 0 };
  c.getRGB(rgb, THREE.SRGBColorSpace);
  return new THREE.Vector3(rgb.r, rgb.g, rgb.b);
}

export function CausticsBackground({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uWater: { value: cssColor(el, "--surface-strong", "#1e293b") },
        uLine: { value: cssColor(el, "--brand-lime", "#bfd813") },
        uFoam: { value: cssColor(el, "--mark-ink", "#ffffff") },
      },
    });
    scene.add(new THREE.Mesh(geometry, material));
    const draw = () => renderer.render(scene, camera);

    // Light/dark switches change --surface-strong.
    const theme = new MutationObserver(() => {
      material.uniforms.uWater!.value = cssColor(el, "--surface-strong", "#1e293b");
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = new ResizeObserver(() => {
      // Layout size, not the on-screen box: the dialog zooms in as it opens.
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      (material.uniforms.uRes!.value as THREE.Vector2).set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
      draw();
    });
    resize.observe(el);

    // The pointer nudges the pattern, eased.
    const aim = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      aim.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let running = false;
    let onScreen = true;
    const start = performance.now();
    const loop = (now: number) => {
      material.uniforms.uTime!.value = ((now - start) / 1000) * 0.45;
      (material.uniforms.uPointer!.value as THREE.Vector2).lerp(aim, 0.05);
      draw();
      raf = requestAnimationFrame(loop);
    };
    // Reduced motion: one still frame. Otherwise only while on screen and the tab is visible.
    const update = () => {
      const want = !reduced && onScreen && document.visibilityState === "visible";
      if (want && !running) (running = true), (raf = requestAnimationFrame(loop));
      else if (!want && running) (running = false), cancelAnimationFrame(raf);
    };
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = !!entry?.isIntersecting;
      update();
    });
    seen.observe(el);
    document.addEventListener("visibilitychange", update);
    if (reduced) material.uniforms.uTime!.value = 12;
    update();

    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      resize.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", onMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className={className} />;
}
