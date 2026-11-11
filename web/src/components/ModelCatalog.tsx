"use client";

import { useMemo, useState } from "react";
import ModelCard from "@/components/ModelCard";
import SectionHeader from "@/components/SectionHeader";
import { DOMAINS, SECTIONS } from "@/config/sections";
import { formatTask } from "@/lib/format";
import { byCuration } from "@/lib/rank";
import type { MLModel } from "@/lib/types";

const featuredFirst = byCuration<MLModel>((m) => m.downloads);

type KindFilter = "all" | MLModel["kind"];
type SortKey = "featured" | "downloads" | "likes" | "updated" | "name";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "downloads", label: "Most downloaded" },
  { value: "likes", label: "Most liked" },
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
];

export default function ModelCatalog({
  models,
  demoModelIds,
  onSelect,
}: {
  models: MLModel[];
  /** Lower-cased ids of models that have a live demo */
  demoModelIds?: Set<string>;
  onSelect: (m: MLModel) => void;
}) {
  const [query, setQuery] = useState("");
  const [task, setTask] = useState("all");
  const [domain, setDomain] = useState("all");
  const domains = useMemo(() => DOMAINS.filter((d) => models.some((m) => d.match(m.task))), [models]);
  const activeDomain = DOMAINS.find((d) => d.id === domain);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const tasks = useMemo(
    () =>
      [...new Set(models.map((m) => m.task))]
        .filter((t) => !activeDomain || activeDomain.match(t))
        .sort(),
    [models, activeDomain],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = models.filter(
      (m) =>
        (!activeDomain || activeDomain.match(m.task)) &&
        (task === "all" || m.task === task) &&
        (kind === "all" || m.kind === kind) &&
        (!q ||
          [m.name, m.id, m.description, m.baseModel ?? "", ...m.tags].some((s) =>
            s.toLowerCase().includes(q),
          )),
    );
    return list.sort((a, b) => {
      switch (sort) {
        case "likes":
          return b.likes - a.likes;
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt);
        case "name":
          return a.name.localeCompare(b.name);
        case "featured":
          return featuredFirst(a, b);
        default:
          return b.downloads - a.downloads;
      }
    });
  }, [models, query, task, kind, sort, activeDomain]);

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
      active
        ? "bg-brand text-brand-fg"
        : "border border-line bg-surface text-soft hover:border-brand/40 hover:text-fg"
    }`;

  return (
    <section id={SECTIONS.model.id} className="scroll-mt-24">
      <SectionHeader
        eyebrow={SECTIONS.model.label}
        title="Every"
        accent="checkpoint."
        description="Everything I trained or fine-tuned. Click a card for benchmarks, its corpus, usage and the playground."
      />

      <div className="mt-10 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search checkpoints, tags, base models…"
            aria-label="Search checkpoints"
            className="w-full rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "base", "fine-tuned"] as KindFilter[]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)}>
              {k === "all" ? "All" : k === "base" ? "Base" : "Fine-tuned"}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-auto">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort checkpoints"
            className="w-full cursor-pointer appearance-none rounded-full border border-line bg-surface px-4 py-2.5 pr-10 text-sm text-soft shadow-sm transition hover:border-brand/40 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20 lg:min-w-48"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-surface text-fg">
                {s.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted"
          >
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {domains.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-1 rounded-full border border-line bg-surface p-1 sm:mx-auto sm:w-fit">
          {[{ id: "all", label: "All domains", match: () => true }, ...domains].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDomain(d.id);
                setTask("all");
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                domain === d.id ? "bg-fg text-ink" : "text-muted hover:text-fg"
              }`}
            >
              {d.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-60">
                {models.filter((m) => d.match(m.task)).length}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setTask("all")} className={chip(task === "all")}>
          All tasks
        </button>
        {tasks.map((t) => (
          <button key={t} type="button" onClick={() => setTask(t)} className={chip(task === t)}>
            {formatTask(t)}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <ModelCard key={m.id} model={m} hasDemo={demoModelIds?.has(m.id.toLowerCase())} onSelect={() => onSelect(m)} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No checkpoints match these filters.
        </div>
      )}
    </section>
  );
}
