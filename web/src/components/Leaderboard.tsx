"use client";

import { useMemo, useState } from "react";
import { KindBadge } from "@/components/ModelCard";
import SectionHeader from "@/components/SectionHeader";
import { formatScore } from "@/lib/format";
import type { MLModel } from "@/lib/types";

export default function Leaderboard({
  models,
  onSelect,
}: {
  models: MLModel[];
  onSelect: (m: MLModel) => void;
}) {
  // Benchmarks ordered by how many models report them
  const benchmarks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of models)
      for (const b of m.benchmarks ?? []) counts.set(b.name, (counts.get(b.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [models]);

  const [selected, setSelected] = useState(benchmarks[0] ?? "");
  const active = benchmarks.includes(selected) ? selected : (benchmarks[0] ?? "");

  const rows = useMemo(() => {
    const list = models.flatMap((m) => {
      const b = m.benchmarks?.find((x) => x.name === active);
      return b ? [{ model: m, bench: b }] : [];
    });
    const lower = list[0]?.bench.lowerIsBetter;
    list.sort((a, b) => (lower ? a.bench.score - b.bench.score : b.bench.score - a.bench.score));
    return list;
  }, [models, active]);

  const max = Math.max(...rows.map((r) => r.bench.score), 1);
  const lowerIsBetter = rows[0]?.bench.lowerIsBetter;

  return (
    <section id="leaderboard" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Benchmarks"
        title="Ranked on"
        accent="real evals."
        description="Compare models on a single benchmark. Scores are self-reported in the model registry."
      />

      {benchmarks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          Add <code className="font-mono text-soft">benchmarks</code> to your models to see a
          leaderboard.
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Benchmark">
            {benchmarks.map((b) => (
              <button
                key={b}
                type="button"
                role="tab"
                aria-selected={b === active}
                onClick={() => setSelected(b)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  b === active
                    ? "bg-brand text-brand-fg"
                    : "border border-line bg-surface text-soft hover:border-brand/40 hover:text-fg"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="w-12 px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="w-[40%] px-5 py-3 font-medium">
                    {active}
                    {lowerIsBetter && <span className="ml-1 normal-case">(lower is better)</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ model, bench }, i) => {
                  // For lower-is-better metrics, the best score gets the longest bar
                  const pct = lowerIsBetter
                    ? (rows[0].bench.score / bench.score) * 100
                    : (bench.score / max) * 100;
                  return (
                    <tr
                      key={model.id}
                      onClick={() => onSelect(model)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                    >
                      <td className={`px-5 py-3 tabular-nums ${i === 0 ? "text-gold-300" : "text-muted"}`}>
                        {i + 1}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(model);
                          }}
                          className="text-left font-medium text-fg hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {model.name}
                        </button>
                        <div className="font-mono text-xs text-muted">{model.id}</div>
                      </td>
                      <td className="px-5 py-3">
                        <KindBadge kind={model.kind} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-right font-semibold tabular-nums text-gold-300">
                            {formatScore(bench.score, bench.unit)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
