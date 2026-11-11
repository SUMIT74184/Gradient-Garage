"use client";

import { useEffect, useRef } from "react";

export type ParticleScene = {
  /** Same-origin image, e.g. "/scenes/acacia.jpg" */
  src: string;
  /** Horizontal framing, see `imageFocus` */
  focus?: [number, number];
  /** Zoom, see `imageZoom` */
  zoom?: number;
};

export type GoldParticleWaveProps = {
  /** Distance between dots in CSS pixels. Grows automatically on small screens. */
  spacing?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Overall brightness multiplier (0–1.5). */
  intensity?: number;
  /** "round" for halftone dots, "square" for a pixel-dither look. */
  shape?: "round" | "square";
  /** "right" keeps the left side (where hero text sits) calm; "none" lights the whole field. */
  bias?: "right" | "none";
  /** Minimum brightness everywhere (0–0.4). Gives a full dithered texture instead of black gaps. */
  floor?: number;
  /**
   * Image (same-origin, e.g. "/elephant.jpg") rendered as dither particles: bright areas become
   * gold dots, dark areas become slate particles that fly in and assemble when first seen.
   */
  image?: string;
  /** Horizontal framing: [source x, target x] as fractions, e.g. [0.65, 0.8] moves the image's 65% point to 80% of the card. */
  imageFocus?: [number, number];
  /** Zoom on top of object-fit: cover. The image is always anchored to the bottom. */
  imageZoom?: number;
  /** Several images shown one after another; each scene's particles scatter out and the next one assembles. */
  scenes?: ParticleScene[];
  /** Seconds each scene stays assembled before the next one comes in. */
  interval?: number;
  /**
   * "full" redraws the whole image as dither. "subject" keeps only its dark silhouette and lets the
   * wave field show through everywhere else.
   */
  imageMode?: "full" | "subject";
  /** Fraction of the width left of which the image is ignored, with a dithered edge (e.g. to keep text clear). */
  imageFrom?: number;
  /** Called with the scene index whenever a new scene starts assembling. */
  onSceneChange?: (index: number) => void;
  className?: string;
};

// Gold ramp: deep bronze -> gold -> pale champagne
const RAMP: [number, number, number][] = [
  [0x8a, 0x64, 0x28],
  [0xd6, 0xa6, 0x4b],
  [0xff, 0xd9, 0x89],
];

const BUCKETS = 24;

// Cool slate tones for the dark subject of the image, so it reads against the gold field
const SLATE: string[] = Array.from({ length: 6 }, (_, i) => {
  const t = i / 5;
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgba(${c(72, 128)}, ${c(74, 130)}, ${c(122, 190)}, ${(0.75 + t * 0.25).toFixed(2)})`;
});

// Image brightness below this is drawn as the slate "subject"
const DARK = 0.3;

function rampColor(t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

// Cheap deterministic per-dot hash in [0, 1)
function hash(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeGlowSprite(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 217, 137, 0.9)");
  grad.addColorStop(0.25, "rgba(214, 166, 75, 0.35)");
  grad.addColorStop(1, "rgba(138, 100, 40, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * Animated halftone field of gold dots. Brightness, size and vertical offset
 * of every dot come from layered sine waves masked by a slowly drifting ribbon,
 * so the dots themselves form the hills and valleys of light.
 */
export default function GoldParticleWave({
  spacing = 9,
  speed = 1,
  intensity = 1.5,
  shape = "round",
  bias = "right",
  floor = 0,
  image,
  imageFocus = [0.5, 0.5],
  imageZoom = 1,
  scenes,
  interval = 8,
  imageMode = "full",
  imageFrom = 0,
  onSceneChange,
  className = "",
}: GoldParticleWaveProps) {
  // Serialized so a fresh array with the same scenes doesn't restart the animation
  const sceneKey = JSON.stringify(
    scenes ?? (image ? [{ src: image, focus: imageFocus, zoom: imageZoom }] : []),
  );
  const onSceneRef = useRef(onSceneChange);
  useEffect(() => {
    onSceneRef.current = onSceneChange;
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;

    const glow = makeGlowSprite();
    const fills = Array.from({ length: BUCKETS }, (_, b) => {
      const t = b / (BUCKETS - 1);
      const [r, g, bl] = rampColor(t);
      const alpha = 0.08 + Math.pow(t, 0.8) * 0.92;
      return `rgba(${r | 0}, ${g | 0}, ${bl | 0}, ${alpha.toFixed(3)})`;
    });
    // Reused per-frame buffers: bucket -> flat [x, y, r, x, y, r, ...]
    const bucketData: Float32Array[] = [];
    const bucketLen = new Int32Array(BUCKETS);
    let glowData = new Float32Array(0);

    let width = 0;
    let height = 0;
    let dpr = 1;
    // Per-dot static data: x, y, u, v, seed
    let dots = new Float32Array(0);
    let count = 0;
    // Image data per dot: brightness (-1 = no image) and the offset each dark particle flies in from
    let lum = new Float32Array(0);
    let scatter = new Float32Array(0);
    const slateData: Float32Array[] = [];
    const slateLen = new Int32Array(SLATE.length);
    let seen = false;
    let assembleStart = -1;
    let leaveStart = -1;
    const list: ParticleScene[] = JSON.parse(sceneKey);
    const cycling = list.length > 1;
    const imgs: (HTMLImageElement | null)[] = list.map(() => null);
    let cur = 0;
    let img: HTMLImageElement | null = null;

    const sampleImage = () => {
      lum = new Float32Array(count).fill(-1);
      scatter = new Float32Array(count * 2);
      for (let i = 0; i < SLATE.length; i++) slateData[i] = new Float32Array(count * 3);
      if (!img) return;
      const [focusFrom, focusTo] = list[cur].focus ?? [0.5, 0.5];
      const imageZoom = list[cur].zoom ?? 1;

      // object-fit: cover (times zoom), bottom-anchored, shifted so the focus point lands where asked
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight) * imageZoom;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = Math.min(0, Math.max(width - dw, focusTo * width - focusFrom * dw));
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const g = off.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, dx, height - dh, dw, dh);
      const data = g.getImageData(0, 0, width, height).data;

      for (let n = 0, k = 0; n < count; n++, k += 5) {
        const xi = Math.min(width - 1, Math.max(0, Math.round(dots[k])));
        const yi = Math.min(height - 1, Math.max(0, Math.round(dots[k + 1])));
        const o = (yi * width + xi) * 4;
        // Brightest channel, so a saturated orange sky counts as bright and a silhouette as dark
        const l = Math.max(data[o], data[o + 1], data[o + 2]) / 255;
        if (imageFrom && dots[k + 4] > smoothstep(imageFrom, imageFrom + 0.15, dots[k + 2])) continue;
        if (imageMode === "subject" && l >= DARK) continue;
        lum[n] = l;
        if (l < DARK) {
          const angle = dots[k + 4] * Math.PI * 2 * 7.13;
          const dist = 60 + hash(n, 3) * 260;
          scatter[n * 2] = Math.cos(angle) * dist;
          scatter[n * 2 + 1] = Math.sin(angle) * dist - 40;
        }
      }
    };

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Coarser grid on small screens keeps mobile cheap
      const gap = width < 640 ? spacing * 1.25 : spacing;
      const cols = Math.ceil(width / gap) + 1;
      const rows = Math.ceil(height / gap) + 2;
      const offX = (width - (cols - 1) * gap) / 2;
      const offY = (height - (rows - 1) * gap) / 2;
      const aspect = height / width;

      count = cols * rows;
      dots = new Float32Array(count * 5);
      let k = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = offX + i * gap;
          const y = offY + j * gap;
          dots[k++] = x;
          dots[k++] = y;
          dots[k++] = x / width;
          dots[k++] = (y / height) * aspect;
          dots[k++] = hash(i, j);
        }
      }
      for (let b = 0; b < BUCKETS; b++) bucketData[b] = new Float32Array(count * 3);
      glowData = new Float32Array(count * 3);
      sampleImage();
      draw(time);
    };

    let time = 7.3; // start mid-flow so the first frame already looks composed

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      bucketLen.fill(0);
      slateLen.fill(0);
      let glowLen = 0;

      const aspect = height / width;
      const gap = width < 640 ? spacing * 1.25 : spacing;
      const lift = gap * 0.9;

      for (let n = 0, k = 0; n < count; n++, k += 5) {
        const x = dots[k];
        const y = dots[k + 1];
        const u = dots[k + 2];
        const v = dots[k + 3];
        const seed = dots[k + 4];

        const l = lum[n];
        if (l >= 0) {
          const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + seed * 40);
          if (l < DARK) {
            // Dark subject: slate particles that ease in from scattered starts, staggered by seed
            let q = 1;
            if (!reduced) {
              const local = assembleStart < 0 ? 0 : (t - assembleStart - seed * 0.9) / 1.8;
              const c = Math.min(Math.max(local, 0), 1);
              q = 1 - Math.pow(1 - c, 3);
              if (leaveStart >= 0) {
                const out = Math.min(Math.max((t - leaveStart - seed * 0.6) / 1.0, 0), 1);
                q *= 1 - out * out * out;
              }
            }
            const px = x + scatter[n * 2] * (1 - q);
            const py = y + scatter[n * 2 + 1] * (1 - q) + Math.sin(t * 0.9 + x * 0.01) * 0.7 * q;
            const level = Math.min(SLATE.length - 1, Math.round((l / DARK) * 4 + tw));
            const arr = slateData[level];
            let p = slateLen[level];
            arr[p++] = px;
            arr[p++] = py;
            // Cycled scenes grow out of / shrink into nothing so the swap between images is invisible
            arr[p++] = gap * (0.28 + (l / DARK) * 0.1 + tw * 0.05) * (cycling ? q : 1);
            slateLen[level] = p;
            continue;
          }
          // Bright areas: gold dither, shimmering with a slow travelling wave
          const wave = 0.5 + 0.5 * Math.sin(u * 6 - t * 0.8 + v * 4);
          const I = Math.min(1, ((l - DARK) / (1 - DARK)) * (0.75 + 0.35 * wave) * intensity * 0.7 + 0.05);
          const b = Math.min(BUCKETS - 1, (I * (BUCKETS - 1)) | 0);
          const arr = bucketData[b];
          let p = bucketLen[b];
          arr[p++] = x;
          arr[p++] = y;
          arr[p++] = 0.45 + I * 1.35;
          bucketLen[b] = p;
          if (I > 0.8) {
            glowData[glowLen++] = x;
            glowData[glowLen++] = y;
            glowData[glowLen++] = I * 0.7;
          }
          continue;
        }

        // Layered waves: broad swell + cross swell + fine ripple
        const w1 = Math.sin(u * 3.1 + t * 0.32 + Math.sin(v * 2.3 + t * 0.21) * 1.4);
        const w2 = Math.sin(v * 5.2 - u * 1.9 - t * 0.47);
        const w3 = Math.sin((u * 0.7 + v) * 9.0 + t * 0.66 + w1);
        const h = w1 * 0.55 + w2 * 0.3 + w3 * 0.15; // -1..1

        // Drifting ribbon that concentrates light in selected areas
        const center =
          aspect * (0.42 + 0.2 * Math.sin(u * 2.4 + t * 0.23) + 0.08 * Math.sin(u * 5.3 - t * 0.37));
        const d = (v - center) / (aspect * 0.3);
        const ribbon = Math.exp(-d * d);
        // Second, fainter ribbon for layered depth
        const center2 = aspect * (0.82 + 0.1 * Math.sin(u * 3.3 - t * 0.19 + 1.7));
        const d2 = (v - center2) / (aspect * 0.16);
        const ribbon2 = Math.exp(-d2 * d2) * 0.55;

        // Keep the left (text side) calmer and fade toward the right edge less
        const sideMask = bias === "right" ? 0.25 + 0.75 * smoothstep(0.05, 0.75, u) : 1;
        const crest = Math.pow(Math.max(0, h * 0.5 + 0.5), 2.4);
        let I = crest * (ribbon + ribbon2) * sideMask * intensity;
        if (floor) I = Math.max(I, floor * (0.35 + 0.65 * (h * 0.5 + 0.5)) * (0.5 + seed));

        // Density variation: thin out dots in dark zones
        if (I < 0.03) {
          if (seed > 0.55) continue;
          I = 0.012 + seed * 0.02;
        }
        I = Math.min(I, 1);

        const b = Math.min(BUCKETS - 1, (I * (BUCKETS - 1)) | 0);
        const r = 0.45 + I * 1.35;
        const yy = y - h * lift * (ribbon + ribbon2);
        const arr = bucketData[b];
        let p = bucketLen[b];
        arr[p++] = x;
        arr[p++] = yy;
        arr[p++] = r;
        bucketLen[b] = p;

        if (I > 0.5) {
          glowData[glowLen++] = x;
          glowData[glowLen++] = yy;
          glowData[glowLen++] = I;
        }
      }

      // One path per color bucket: thousands of dots in ~24 fill calls
      for (let b = 0; b < BUCKETS; b++) {
        const len = bucketLen[b];
        if (!len) continue;
        const arr = bucketData[b];
        ctx.fillStyle = fills[b];
        ctx.beginPath();
        if (shape === "square") {
          for (let p = 0; p < len; p += 3) {
            const r = arr[p + 2];
            ctx.rect(arr[p] - r, arr[p + 1] - r, r * 2, r * 2);
          }
        } else {
          for (let p = 0; p < len; p += 3) {
            ctx.moveTo(arr[p] + arr[p + 2], arr[p + 1]);
            ctx.arc(arr[p], arr[p + 1], arr[p + 2], 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }

      // Image subject particles sit on top of the field
      for (let l = 0; l < SLATE.length; l++) {
        const len = slateLen[l];
        if (!len) continue;
        const arr = slateData[l];
        ctx.fillStyle = SLATE[l];
        ctx.beginPath();
        for (let p = 0; p < len; p += 3) {
          const r = arr[p + 2];
          if (shape === "square") ctx.rect(arr[p] - r, arr[p + 1] - r, r * 2, r * 2);
          else {
            ctx.moveTo(arr[p] + r, arr[p + 1]);
            ctx.arc(arr[p], arr[p + 1], r, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }

      // Soft additive glow around the brightest dots
      ctx.globalCompositeOperation = "lighter";
      for (let p = 0; p < glowLen; p += 3) {
        const I = glowData[p + 2];
        const s = gap * (1.2 + I * 1.6);
        ctx.globalAlpha = (I - 0.5) * 0.55;
        ctx.drawImage(glow, glowData[p] - s / 2, glowData[p + 1] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    let last = 0;
    let visible = true;

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      time += dt * speed;
      if (assembleStart < 0 && seen) assembleStart = time;
      if (cycling && img && assembleStart >= 0) {
        if (leaveStart < 0 && time - assembleStart > interval) leaveStart = time;
        else if (leaveStart >= 0 && time - leaveStart > 1.7) {
          // Next scene that has finished loading
          for (let s = 1; s <= list.length; s++) {
            const next = (cur + s) % list.length;
            if (imgs[next]) {
              cur = next;
              break;
            }
          }
          img = imgs[cur];
          sampleImage();
          leaveStart = -1;
          assembleStart = time;
          onSceneRef.current?.(cur);
        }
      }
      draw(time);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || reduced || !visible) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);

    // Pause when the hero scrolls off-screen
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) seen = true;
      if (visible) start();
      else stop();
    });
    io.observe(wrap);

    const onMotionChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      if (reduced) {
        stop();
        draw(time);
      } else start();
    };
    motionQuery.addEventListener("change", onMotionChange);

    layout();
    start();

    list.forEach((scene, i) => {
      const el = new Image();
      el.onload = () => {
        imgs[i] = el;
        if (img) return;
        // First scene to arrive is shown first
        img = el;
        cur = i;
        sampleImage();
        if (seen && cycling) assembleStart = time;
        onSceneRef.current?.(cur);
        draw(time);
      };
      el.src = scene.src;
    });

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [spacing, speed, intensity, shape, bias, floor, sceneKey, interval, imageMode, imageFrom]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
