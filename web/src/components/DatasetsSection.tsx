"use client";

import { useMemo, useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import StatusBadges from "@/components/StatusBadges";
import { SECTIONS } from "@/config/sections";
import { EmptyState, Pill } from "@/components/ui";
import { formatCompact, formatTask } from "@/lib/format";
import type { Dataset, MLModel, Modality, Selection } from "@/lib/types";

/** Small modality glyph shown in each row */
function ModalityIcon({ modality }: { modality: Modality }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <g {...p}>
        {modality === "image" && (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="9" cy="10" r="2" />
            <path d="m3 17 5-4 4 3 3-2 6 5" />
          </>
        )}
        {modality === "video" && (
          <>
            <rect x="3" y="6" width="13" height="12" rx="2.5" />
            <path d="m16 10 5-3v10l-5-3" />
          </>
        )}
        {modality === "audio" && <path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 12h0" />}
        {modality === "text" && <path d="M5 6h14M5 11h10M5 16h12" />}
        {modality === "tabular" && (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M3 15h18M10 4v16" />
          </>
        )}
        {(modality === "multimodal" || modality === "other") && (
          <>
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <circle cx="17" cy="7" r="4" />
            <path d="M3 17h8M3 21h5M14 14l7 7M21 14l-7 7" />
          </>
        )}
      </g>
    </svg>
  );
}

export default function DatasetsSection({
  datasets,
  models,
  onSelect,
}: {
  datasets: Dataset[];
  models: MLModel[];
  onSelect: (s: Selection) => void;
}) {
  const [modality, setModality] = useState<Modality | "all">("all");
  const modalities = useMemo(() => [...new Set(datasets.map((d) => d.modality))], [datasets]);
  const visible = datasets.filter((d) => modality === "all" || d.modality === modality);

  const usedBy = (d: Dataset) => {
    const id = d.id.toLowerCase();
    return models.filter((m) => m.datasets?.some((x) => x.toLowerCase() === id));
  };

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
      active ? "bg-brand text-brand-fg" : "border border-line bg-surface text-soft hover:border-brand/40 hover:text-fg"
    }`;

  return (
    <section id={SECTIONS.dataset.id} className="scroll-mt-24">
      <SectionHeader
        eyebrow={SECTIONS.dataset.label}
        title="The data,"
        accent="in the open."
        description="Data I collected and labelled, with the checkpoints trained on each set."
      />

      {datasets.length === 0 ? (
        <EmptyState>The Corpus is empty. Add a dataset in src/data/datasets.ts.</EmptyState>
      ) : (
        <>
          {modalities.length > 1 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setModality("all")} className={chip(modality === "all")}>
                All
              </button>
              {modalities.map((m) => (
                <button key={m} type="button" onClick={() => setModality(m)} className={chip(modality === m)}>
                  {formatTask(m)}
                </button>
              ))}
            </div>
          )}

          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {visible.map((d) => {
              const trained = usedBy(d);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ type: "dataset", item: d })}
                    className="group grid w-full gap-4 px-5 py-5 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-brand transition group-hover:border-brand/40">
                        <ModalityIcon modality={d.modality} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold text-fg group-hover:text-brand-hover">{d.name}</span>
                          <StatusBadges badges={d.badges} className="shrink-0" />
                        </span>
                        <span className="block truncate text-sm text-muted">{d.description}</span>
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Pill>{formatTask(d.modality)}</Pill>
                      {d.size && <Pill>{d.size}</Pill>}
                      {trained.length > 0 && (
                        <span className="truncate text-xs text-muted">
                          → trains <span className="text-soft">{trained.map((m) => m.name).join(", ")}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-5 text-xs text-muted md:justify-end">
                      <span>{d.license}</span>
                      <span className="tabular-nums">
                        <span className="text-gold-400">↓</span> {formatCompact(d.downloads)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
