"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { formatCompact } from "@/lib/format";
import type { MLModel } from "@/lib/types";

const POINTS = 90;
const W = 420;
const H = 150;

// Deterministic noise so server and client render the same first frame
function noise(i: number) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

const RUN = 6000; // steps per simulated run, then a new run starts
const STRIDE = 12; // steps between plotted points

function lossAt(step: number) {
  const run = step % RUN;
  return 2.6 * Math.exp(-run / 900) + 0.42 + noise(step) * 0.08 * (0.4 + Math.exp(-run / 2000));
}

function logLine(step: number) {
  const loss = lossAt(step).toFixed(3);
  if (step % 400 === 0) return `eval  step=${step}  mmlu=${(34 + (step % RUN) / 700).toFixed(1)}%  ✓ checkpoint saved`;
  const lr = (2e-5 * Math.min(1, (step % RUN) / 200)).toExponential(1);
  return `train step=${step}  loss=${loss}  lr=${lr}  grad_norm=${(0.9 + noise(step * 3) * 0.4).toFixed(2)}`;
}

type State = { step: number; gpu: number[] };

const START = 1440;

/** A fake-but-live training dashboard: loss curve, GPU load, log stream and model table. */
export default function TrainingMonitor({ models }: { models: MLModel[] }) {
  const reduced = useReducedMotion();
  const [s, setS] = useState<State>({ step: START, gpu: [0.82, 0.91, 0.77, 0.88] });

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setS((p) => ({
        step: p.step + 4,
        gpu: p.gpu.map((g, i) => Math.min(0.99, Math.max(0.6, g + noise(p.step + i * 7) * 0.08))),
      }));
    }, 110);
    return () => clearInterval(id);
  }, [reduced]);

  // Window of recent losses, auto-scaled like a W&B panel
  const values: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    const step = s.step - (POINTS - 1 - i) * STRIDE;
    values.push(lossAt(Math.max(step, 0)));
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 + 0.01;
  const pts: [number, number][] = values.map((v, i) => [
    (i / (POINTS - 1)) * W,
    8 + (1 - (v - lo + pad) / (hi - lo + pad * 2)) * (H - 16),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const [lx, ly] = pts[pts.length - 1];

  const logs = Array.from({ length: 6 }, (_, i) => s.step - (5 - i) * 20 - (s.step % 20)).filter(
    (x) => x > 0,
  );
  const rows = models.slice(0, 5);
  const active = Math.floor(s.step / 88) % Math.max(rows.length, 1);
  const epoch = ((s.step % RUN) / RUN) * 3;

  return (
    <div className="w-[1050px] max-w-none overflow-hidden rounded-xl border border-line-strong bg-[#141416]/95 font-mono text-[11px] text-soft shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="ml-3 text-muted">
          <span className="text-fg/40">&gt;_</span> gradient-garage train --model {rows[0]?.id ?? "nova-1.1b"}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-brand">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> live
        </span>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr]">
        {/* Loss curve */}
        <div className="border-r border-line p-4">
          <div className="flex items-baseline justify-between">
            <span className="uppercase tracking-[0.2em] text-muted">train/loss</span>
            <span className="text-base text-gold-300 tabular-nums">{lossAt(s.step).toFixed(3)}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[150px] w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tm-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#f07a2a" stopOpacity="0.35" />
                <stop offset="1" stopColor="#f07a2a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgb(220 220 225 / 0.07)" strokeDasharray="3 5" />
            ))}
            <path d={area} fill="url(#tm-area)" />
            <path d={line} fill="none" stroke="#ff9a4d" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            <circle cx={lx} cy={ly} r="6" fill="#ff9a4d" opacity="0.25" />
            <circle cx={lx} cy={ly} r="2.5" fill="#ffd989" />
          </svg>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["step", s.step.toLocaleString("en-US")],
              ["epoch", `${epoch.toFixed(2)}/3`],
              ["tok/s", (41200 + Math.round(noise(s.step) * 900)).toLocaleString("en-US")],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-line px-2.5 py-1.5">
                <div className="text-muted">{k}</div>
                <div className="text-fg tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* GPUs + logs */}
        <div className="flex flex-col p-4">
          <span className="uppercase tracking-[0.2em] text-muted">gpu utilization</span>
          <div className="mt-3 space-y-2">
            {s.gpu.map((g, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-10 text-muted">gpu{i}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-600 via-brand to-gold-300 transition-[width] duration-300"
                    style={{ width: `${g * 100}%` }}
                  />
                </div>
                <span className="w-9 text-right tabular-nums">{Math.round(g * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex-1 space-y-1 overflow-hidden rounded-md border border-line bg-black/40 p-2.5">
            {logs.map((st, i) => (
              <div
                key={st}
                className={`truncate ${st % 400 === 0 ? "text-olive" : "text-muted"} ${i === logs.length - 1 ? "text-soft" : ""}`}
              >
                {logLine(st)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model table */}
      <div className="border-t border-line">
        <div className="grid grid-cols-[2fr_1.3fr_1fr_1fr_1.2fr] gap-4 px-4 py-2 uppercase tracking-[0.15em] text-muted">
          <span>model</span>
          <span>task</span>
          <span>params</span>
          <span>downloads</span>
          <span>status</span>
        </div>
        {rows.map((m, i) => (
          <div
            key={m.id}
            className={`grid grid-cols-[2fr_1.3fr_1fr_1fr_1.2fr] items-center gap-4 border-t border-line px-4 py-2 transition-colors duration-500 ${
              i === active ? "bg-brand/10 text-fg" : ""
            }`}
          >
            <span className="truncate">
              <span className={i === active ? "text-brand" : "text-fg/30"}>{i === active ? "▸ " : "  "}</span>
              {m.id}
            </span>
            <span className="truncate text-muted">{m.task}</span>
            <span className="tabular-nums">{m.params ?? "—"}</span>
            <span className="tabular-nums">{formatCompact(m.downloads)}</span>
            <span className={i === active ? "text-brand" : "text-olive"}>
              {i === active ? "evaluating…" : "✓ published"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
