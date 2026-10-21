import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// The sign-in page's decorative point cloud: 9,000 soft dots that morph sphere → rounded box →
// torus and lean toward the pointer. Colors: --cloud-deep (main) and --cloud-light (accent), index.css.

const N = 9000;
const HOLD = 1.5;
const MORPH = 1.9;
const STAGGER = 0.4;

/** Points sampled on a mesh's surface, sorted into rows by height, then by angle around Y. */
function sampleSorted(geometry: THREE.BufferGeometry): Float32Array {
  const mesh = new THREE.Mesh(geometry);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const v = new THREE.Vector3();
  const pts: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    sampler.sample(v);
    pts.push([v.x, v.y, v.z]);
  }
  geometry.dispose();
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const span = Math.max(...ys) - lo || 1;
  const ROWS = 90;
  const row = (p: [number, number, number]) => Math.min(ROWS - 1, Math.floor(((p[1] - lo) / span) * ROWS));
  // Lowest rows first, so the top of every shape sits at the end of the array.
  pts.sort((a, b) => row(a) - row(b) || Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]));
  return Float32Array.from(pts.flat());
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** A colour token as the shader should output it: its sRGB values as written (the shader writes them
 *  straight to the screen, so Three's linear conversion would darken every colour). */
function cssColor(el: Element, name: string, fallback: string) {
  const c = new THREE.Color(getComputedStyle(el).getPropertyValue(name).trim() || fallback);
  const rgb = { r: 0, g: 0, b: 0 };
  c.getRGB(rgb, THREE.SRGBColorSpace);
  return new THREE.Vector3(rgb.r, rgb.g, rgb.b);
}

const vertexShader = /* glsl */ `
  attribute float aMix;
  uniform float uSize;
  varying float vMix;
  void main() {
    vMix = aMix;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uLight;
  varying float vMix;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    if (a < 0.01) discard;
    // Brand colours as they are, never blended: mostly the main colour, about 30% lime accents.
    gl_FragColor = vec4(vMix > 0.7 ? uLight : uDeep, a * 0.85);
  }
`;

export function PointCloud({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);

    const targets = [sampleSorted(new THREE.SphereGeometry(1.3, 64, 48)), sampleSorted(new RoundedBoxGeometry(2, 2, 2, 5, 0.45)), sampleSorted(new THREE.TorusGeometry(1.05, 0.4, 48, 128))];
    const positions = Float32Array.from(targets[0]!);
    const mix = new Float32Array(N);
    for (let i = 0; i < N; i++) mix[i] = Math.random();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aMix", new THREE.BufferAttribute(mix, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: { uSize: { value: 30 * renderer.getPixelRatio() }, uDeep: { value: cssColor(el, "--cloud-deep", "#1e293b") }, uLight: { value: cssColor(el, "--cloud-light", "#bfd813") } },
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    const draw = () => renderer.render(scene, camera);

    // Light/dark switches change the tokens; pick the new colors up.
    const theme = new MutationObserver(() => {
      material.uniforms.uDeep!.value = cssColor(el, "--cloud-deep", "#1e293b");
      material.uniforms.uLight!.value = cssColor(el, "--cloud-light", "#bfd813");
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      // Back off until the widest shape (about 3 units) fills ~60% of the narrower side.
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.z = Math.max(5, 2.6 / (half * Math.min(1, camera.aspect)));
      camera.updateProjectionMatrix();
      draw();
    });
    resize.observe(el);

    // Pointer, as -1..1 across the cloud's box.
    const aim = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove);

    // Morph state: hold on `from`, then morph to the next shape. A click during a hold skips it.
    let from = 0;
    let phase: "hold" | "morph" = "hold";
    let elapsed = 0;
    const onClick = () => {
      if (phase === "hold") elapsed = HOLD;
    };
    el.addEventListener("click", onClick);

    let last = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      if (!reduced) {
        elapsed += dt;
        if (phase === "hold" && elapsed >= HOLD) (phase = "morph"), (elapsed = 0);
        if (phase === "morph") {
          const p = Math.min(1, elapsed / MORPH);
          const a = targets[from]!;
          const b = targets[(from + 1) % targets.length]!;
          for (let i = 0; i < N; i++) {
            const delay = STAGGER * (1 - i / N);
            const e = smoothstep(Math.max(0, Math.min(1, (p - delay) / (1 - STAGGER))));
            const k = i * 3;
            const x = a[k]! + (b[k]! - a[k]!) * e;
            const y = a[k + 1]! + (b[k + 1]! - a[k + 1]!) * e;
            const z = a[k + 2]! + (b[k + 2]! - a[k + 2]!) * e;
            // Swirl about Y and puff outward mid-flight.
            const flight = Math.sin(Math.PI * e);
            const puff = 1 + 0.12 * flight;
            const cos = Math.cos(flight);
            const sin = Math.sin(flight);
            positions[k] = (x * cos - z * sin) * puff;
            positions[k + 1] = y * puff;
            positions[k + 2] = (x * sin + z * cos) * puff;
          }
          geometry.attributes.position!.needsUpdate = true;
          if (p >= 1) (from = (from + 1) % targets.length), (phase = "hold"), (elapsed = 0);
        }
      }
      points.rotation.y += (aim.x * 0.6 - points.rotation.y) * 0.06;
      points.rotation.x += (aim.y * 0.35 - points.rotation.x) * 0.06;
      draw();
    };

    // Run only while the cloud is on screen and the tab is visible.
    let raf = 0;
    let running = false;
    let onScreen = true;
    const loop = (now: number) => {
      step(now);
      raf = requestAnimationFrame(loop);
    };
    const update = () => {
      const want = onScreen && document.visibilityState === "visible";
      if (want && !running) (running = true), (last = 0), (raf = requestAnimationFrame(loop));
      else if (!want && running) (running = false), cancelAnimationFrame(raf);
    };
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = !!entry?.isIntersecting;
      update();
    });
    seen.observe(el);
    document.addEventListener("visibilitychange", update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      resize.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("click", onClick);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className={className} />;
}
