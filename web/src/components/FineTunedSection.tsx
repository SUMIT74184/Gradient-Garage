import SectionHeader from "@/components/SectionHeader";
import { formatCompact, formatScore, formatTask } from "@/lib/format";
import type { MLModel } from "@/lib/types";

export default function FineTunedSection({
  models,
  onSelect,
}: {
  models: MLModel[];
  onSelect: (m: MLModel) => void;
}) {
  const fineTuned = models.filter((m) => m.kind === "fine-tuned");
  const byId = new Map(models.map((m) => [m.id.toLowerCase(), m]));

  return (
    <section id="fine-tuned" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Fine-tunes"
        title="Every fine-tune,"
        accent="traced."
        description="Every fine-tune with its lineage: the base model it started from and the data it was trained on."
      />

      {fineTuned.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No fine-tuned models yet.
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {fineTuned.map((m) => {
            const base = m.baseModel ? byId.get(m.baseModel.toLowerCase()) : undefined;
            const top = m.benchmarks?.[0];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center"
                >
                  {/* Lineage: base -> fine-tune */}
                  <div className="flex min-w-0 items-center gap-3 text-sm">
                    <span
                      className={`truncate font-mono text-xs ${base ? "text-soft" : "text-muted"}`}
                      title={m.baseModel}
                    >
                      {m.baseModel ?? "unknown base"}
                    </span>
                    <span className="shrink-0 text-brand">→</span>
                    <span className="truncate font-semibold text-fg">{m.name}</span>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    <span className="rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-soft">
                      {formatTask(m.task)}
                    </span>
                    {(m.datasets ?? []).slice(0, 2).map((d) => (
                      <span
                        key={d}
                        className="max-w-[14rem] truncate rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted"
                        title={d}
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-5 text-xs text-muted md:justify-end">
                    {top && (
                      <span>
                        {top.name}{" "}
                        <span className="font-semibold tabular-nums text-gold-300">
                          {formatScore(top.score, top.unit)}
                        </span>
                      </span>
                    )}
                    <span className="tabular-nums">↓ {formatCompact(m.downloads)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
