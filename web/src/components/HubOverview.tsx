import type { CSSProperties } from "react";
import { TypeIcon, type ItemType } from "@/components/ui";
import { SECTION_ORDER, SECTIONS, href } from "@/config/sections";
import type { Hub } from "@/lib/types";

const TILES = SECTION_ORDER.map((type) => ({ type, href: href(type), ...SECTIONS[type] }));

/** Four jump tiles at the top of the dashboard: one per section, with live counts. */
export default function HubOverview({ hub }: { hub: Hub }) {
  const counts: Record<ItemType, number> = {
    model: hub.models.length,
    library: hub.libraries.length,
    dataset: hub.datasets.length,
    demo: hub.demos.length,
  };
  return (
    <nav aria-label="Hub sections" className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-reveal>
      {TILES.map((t, i) => (
        <a
          key={t.type}
          href={t.href}
          style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}
          className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/40"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand/10 blur-2xl transition group-hover:bg-brand/25"
          />
          <span className="relative flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-brand">
              <TypeIcon type={t.type} />
            </span>
            <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand">→</span>
          </span>
          <span className="display relative mt-5 block text-4xl tabular-nums text-fg">{counts[t.type]}</span>
          <span className="relative mt-1 block font-medium text-soft">{t.label}</span>
          <span className="relative block text-xs text-muted">{t.blurb}</span>
        </a>
      ))}
    </nav>
  );
}
