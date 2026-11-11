"use client";

import SectionHeader from "@/components/SectionHeader";
import StatusBadges from "@/components/StatusBadges";
import { SECTIONS } from "@/config/sections";
import { EmptyState, Pill } from "@/components/ui";
import { formatCompact, formatTask } from "@/lib/format";
import type { Demo, MLModel, Selection } from "@/lib/types";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function DemosSection({
  demos,
  models,
  onSelect,
}: {
  demos: Demo[];
  models: MLModel[];
  onSelect: (s: Selection) => void;
}) {
  const byId = new Map(models.map((m) => [m.id.toLowerCase(), m]));

  return (
    <section id={SECTIONS.demo.id} className="scroll-mt-24">
      <SectionHeader
        eyebrow={SECTIONS.demo.label}
        title="Don't read about it."
        accent="Try it."
        description="Live apps for the checkpoints. Open one in a new tab or run it right here on the page."
      />

      {demos.length === 0 ? (
        <EmptyState>Nothing in the Playground yet. Add an app in src/data/demos.ts.</EmptyState>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {demos.map((d) => {
            const h = hash(d.id);
            const runs = d.models.map((id) => byId.get(id.toLowerCase())).filter((m): m is MLModel => !!m);
            return (
              <article
                key={d.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-brand/40"
              >
                <button
                  type="button"
                  onClick={() => onSelect({ type: "demo", item: d })}
                  aria-label={`Open ${d.name}`}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-brand"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none relative grid h-44 place-items-center overflow-hidden border-b border-line"
                  style={{
                    backgroundImage: `radial-gradient(55% 90% at ${25 + (h % 50)}% ${30 + ((h >> 3) % 40)}%, rgb(240 122 42 / 0.2), transparent 70%)`,
                  }}
                >
                  <span className="absolute size-36 rounded-full bg-brand/10 blur-2xl transition duration-500 group-hover:scale-125" />
                  <span
                    className="absolute size-32 rounded-full border border-line-strong transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `radial-gradient(circle at 35% 25%, rgb(255 255 255 / 0.1), transparent 58%), radial-gradient(circle, rgb(220 220 225 / 0.12) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                    }}
                  />
                  <span className="relative grid size-24 place-items-center rounded-full border border-white/10 bg-surface/80 shadow-[0_12px_40px_rgb(0_0_0/0.35)] backdrop-blur transition duration-500 group-hover:-rotate-6 group-hover:scale-110">
                    <span className="text-5xl drop-shadow-[0_6px_20px_rgb(0_0_0/0.5)]">
                      {d.emoji ?? "▶"}
                    </span>
                  </span>
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-soft backdrop-blur">
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 [animation:live-ping_1.8s_ease-out_infinite]" />
                      <span className="relative size-2 rounded-full bg-emerald-400" />
                    </span>
                    Live
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-soft backdrop-blur">
                    {d.sdk}
                  </span>
                </div>

                <div className="pointer-events-none flex flex-1 flex-col p-5">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold text-fg group-hover:text-brand-hover">
                    {d.name}
                    <StatusBadges badges={d.badges} />
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{d.description}</p>
                  {runs.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {runs.map((m) => (
                        <Pill key={m.id}>
                          {m.name} · {formatTask(m.task)}
                        </Pill>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-5">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="pointer-events-auto relative z-10 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-hover"
                    >
                      Open ↗
                    </a>
                    <span className="text-xs text-muted">or click to run here</span>
                    <span className="ml-auto text-xs tabular-nums text-muted">
                      <span className="text-gold-400">♥</span> {formatCompact(d.likes)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
