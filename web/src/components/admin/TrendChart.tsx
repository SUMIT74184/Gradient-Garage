"use client";

import { useId, useRef, useState } from "react";
import type { StatsPoint } from "@/lib/admin/types";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const W = 640;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

/** Rounds the axis max up to a tidy value so the gridlines land on round numbers. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * p >= v / 4)! * p;
  return Math.ceil(v / step) * step;
}

/**
 * Single-series area chart of a daily total (downloads by default), with a crosshair
 * tooltip and a table view. One series, so no legend: the card title names it.
 */
export default function TrendChart({
  points,
  metric = "downloads",
  label = "Downloads",
}: {
  points: StatsPoint[];
  metric?: "downloads" | "likes" | "stars";
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const gradient = useId();
  if (!points.length) return null;

  const values = points.map((p) => p[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Start the axis at zero unless the line would be flat against the top
  const lo = min > 0 && (max - min) / max < 0.15 ? Math.floor(min * 0.9) : 0;
  const hi = niceMax(max - lo) + lo;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - lo) / (hi - lo || 1)) * ih;

  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(values.length - 1).toFixed(1)},${PAD.top + ih}L${x(0).toFixed(1)},${PAD.top + ih}Z`;
  const ticks = [0, 1, 2, 3, 4].map((n) => lo + ((hi - lo) / 4) * n);
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const onMove = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const sx = ((clientX - box.left) / box.width) * W;
    const i = Math.round(((sx - PAD.left) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const h = hover !== null ? points[hover] : null;
  const change = values[values.length - 1] - values[0];

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        {label} per day, {day.format(new Date(points[0].date))} to {day.format(new Date(points[points.length - 1].date))}
      </figcaption>
      <div className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`${label}: ${full.format(values[values.length - 1])} now, ${change >= 0 ? "up" : "down"} ${full.format(Math.abs(change))} over ${points.length} days`}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerDown={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted text-[10px] tabular-nums">
                {compact.format(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i, n) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}
              className="fill-muted text-[10px]"
            >
              {day.format(new Date(points[i].date))}
            </text>
          ))}
          <path d={area} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {h && (
            <g aria-hidden="true">
              <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--color-line-strong)" strokeWidth="1" />
              <circle cx={x(hover!)} cy={y(h[metric])} r="4.5" fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
          {/* Bigger invisible hit area than the 2px line */}
          <rect x={PAD.left} y={PAD.top} width={iw} height={ih} fill="transparent" />
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-line-strong bg-ink/95 px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              transform: `translateX(${hover! > points.length / 2 ? "calc(-100% - 10px)" : "10px"})`,
            }}
          >
            <div className="text-muted">{day.format(new Date(h.date))}</div>
            <div className="font-semibold tabular-nums text-fg">
              {full.format(h[metric])} <span className="font-normal text-muted">{label.toLowerCase()}</span>
            </div>
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted hover:text-soft">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-left text-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Day</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1 text-soft">{day.format(new Date(p.date))}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-fg">{full.format(p[metric])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
