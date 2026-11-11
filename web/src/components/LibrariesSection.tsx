"use client";

import CopyCommand from "@/components/CopyCommand";
import SectionHeader from "@/components/SectionHeader";
import StatusBadges from "@/components/StatusBadges";
import { SECTIONS } from "@/config/sections";
import { EmptyState, LanguageDot, Pill } from "@/components/ui";
import { formatCompact, formatDate } from "@/lib/format";
import type { Library, Selection } from "@/lib/types";

export default function LibrariesSection({
  libraries,
  onSelect,
}: {
  libraries: Library[];
  onSelect: (s: Selection) => void;
}) {
  return (
    <section id={SECTIONS.library.id} className="scroll-mt-24">
      <SectionHeader
        eyebrow={SECTIONS.library.label}
        title="The code behind"
        accent="the checkpoints."
        description="Libraries, SDKs and CLIs I wrote while building these checkpoints. Install them in one line."
      />

      {libraries.length === 0 ? (
        <EmptyState>The Toolkit is empty. Add a library in src/data/libraries.ts.</EmptyState>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {libraries.map((lib) => (
            <article
              key={lib.id}
              className="group relative flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-2"
            >
              {/* Whole card opens the drawer; the copy box sits above this layer */}
              <button
                type="button"
                onClick={() => onSelect({ type: "library", item: lib })}
                aria-label={`Open ${lib.name}`}
                className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-brand"
              />
              <div className="pointer-events-none flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-mono text-lg font-semibold text-fg group-hover:text-brand-hover">
                    {lib.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-3">
                    <LanguageDot language={lib.language} />
                    {lib.version && <span className="font-mono text-xs text-muted">v{lib.version}</span>}
                    <StatusBadges badges={lib.badges} />
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-ink/40 px-2.5 py-1 text-xs tabular-nums text-gold-300">
                  ★ {formatCompact(lib.stars)}
                </span>
              </div>

              <p className="pointer-events-none mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{lib.description}</p>

              <div className="pointer-events-none mt-4 flex flex-wrap gap-1.5">
                {(lib.features ?? lib.tags).slice(0, 4).map((f) => (
                  <Pill key={f}>{f}</Pill>
                ))}
              </div>

              <div className="relative z-10 mt-5 flex">
                <CopyCommand command={lib.install} />
              </div>

              <div className="pointer-events-none mt-4 flex items-center gap-4 text-xs text-muted">
                <span>{lib.license}</span>
                {!!lib.usedBy?.length && (
                  <span>
                    Powers <span className="text-soft">{lib.usedBy.length}</span>{" "}
                    {lib.usedBy.length === 1 ? "checkpoint" : "checkpoints"}
                  </span>
                )}
                <span className="ml-auto">{formatDate(lib.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
