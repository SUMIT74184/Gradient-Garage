"use client";

import { useEffect, useMemo, useState } from "react";
import { TypeIcon, useTypeLabel } from "@/components/ui";
import { SECTION_ORDER, domainOf } from "@/config/sections";
import { formatCompact, formatTask } from "@/lib/format";
import type { Hub, Selection } from "@/lib/types";

export const OPEN_SEARCH_EVENT = "ml:open-search";

type Entry = { sel: Selection; title: string; sub: string; meta: string; haystack: string };

function entries(hub: Hub): Entry[] {
  return [
    ...hub.models.map((m) => ({
      sel: { type: "model", item: m } as Selection,
      title: m.name,
      sub: m.id,
      meta: `↓ ${formatCompact(m.downloads)}`,
      haystack: [m.name, m.id, m.task, domainOf(m.task), m.baseModel ?? "", ...m.tags].join(" "),
    })),
    ...hub.demos.map((d) => ({
      sel: { type: "demo", item: d } as Selection,
      title: `${d.emoji ? `${d.emoji} ` : ""}${d.name}`,
      sub: d.description,
      meta: `♥ ${formatCompact(d.likes)}`,
      haystack: [d.name, d.id, d.description, d.sdk, ...d.models, ...d.tags].join(" "),
    })),
    ...hub.datasets.map((d) => ({
      sel: { type: "dataset", item: d } as Selection,
      title: d.name,
      sub: d.id,
      meta: `↓ ${formatCompact(d.downloads)}`,
      haystack: [d.name, d.id, d.modality, d.task ?? "", ...d.tags, ...(d.labels ?? [])].join(" "),
    })),
    ...hub.libraries.map((l) => ({
      sel: { type: "library", item: l } as Selection,
      title: l.name,
      sub: l.install,
      meta: `★ ${formatCompact(l.stars)}`,
      haystack: [l.name, l.description, l.language, ...l.tags, ...(l.features ?? [])].join(" "),
    })),
  ];
}

/** ⌘K / Ctrl+K search across Checkpoints, Playground, Corpus and Toolkit. Opens from the navbar via OPEN_SEARCH_EVENT. */
export default function CommandPalette({ hub, onSelect }: { hub: Hub; onSelect: (s: Selection) => void }) {
  const typeLabel = useTypeLabel();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const show = () => {
      setQ("");
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      } else if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    // Arriving from another page's search button: /?search=1
    if (new URLSearchParams(window.location.search).get("search") === "1") show();
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, []);

  const all = useMemo(
    () => entries(hub).sort((a, b) => SECTION_ORDER.indexOf(a.sel.type) - SECTION_ORDER.indexOf(b.sel.type)),
    [hub],
  );
  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return all.slice(0, 10);
    return all.filter((e) => words.every((w) => e.haystack.toLowerCase().includes(w))).slice(0, 12);
  }, [all, q]);

  if (!open) return null;

  const choose = (e: Entry) => {
    setOpen(false);
    onSelect(e.sel);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl [animation:fade-in_200ms_ease_both]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) choose(results[active]);
            }}
            placeholder="Search checkpoints, playground, corpus, toolkit…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded-md border border-line px-1.5 text-xs text-muted">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing found.</li>}
          {results.map((e, i) => (
            <li key={`${e.sel.type}:${e.sel.item.id}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(e)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? "bg-brand/10" : ""}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg border ${i === active ? "border-brand/40 text-brand" : "border-line text-muted"}`}
                >
                  <TypeIcon type={e.sel.type} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{e.title}</span>
                  <span className="block truncate font-mono text-xs text-muted">{e.sub}</span>
                </span>
                <span className="hidden text-xs text-muted sm:block">
                  {e.sel.type === "model" ? `${domainOf(e.sel.item.task)} · ${formatTask(e.sel.item.task)}` : typeLabel[e.sel.type]}
                </span>
                <span className="font-mono text-xs tabular-nums text-gold-300">{e.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
