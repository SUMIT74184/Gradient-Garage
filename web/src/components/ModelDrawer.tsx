"use client";

import { useState } from "react";
import {
  ChipList,
  CodeBlock,
  DrawerSection,
  FactList,
  LinkButtons,
  RelatedChip,
  StatTiles,
} from "@/components/ui";
import { formatCompact, formatDate, formatScore, formatTask } from "@/lib/format";
import type { Hub, MLModel, Selection } from "@/lib/types";

type SnippetTab = "transformers" | "curl";

function snippet(m: MLModel, tab: SnippetTab) {
  if (tab === "curl") {
    return `curl https://router.huggingface.co/hf-inference/models/${m.id} \\
  -H "Authorization: Bearer $HF_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"inputs": "Hello!"}'`;
  }
  if (m.usage) return m.usage;
  if (m.library === "sentence-transformers") {
    return `from sentence_transformers import SentenceTransformer

model = SentenceTransformer("${m.id}")
embeddings = model.encode(["Hello world", "Open models rock"])`;
  }
  if (m.library === "peft") {
    return `from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer

model = AutoPeftModelForCausalLM.from_pretrained("${m.id}")
tokenizer = AutoTokenizer.from_pretrained("${m.id}")`;
  }
  return `from transformers import pipeline

pipe = pipeline("${m.task}", model="${m.id}")
print(pipe(${m.task.includes("image") || m.task.includes("speech") ? '"path/to/input"' : '"Hello!"'}))`;
}

/** Body of the drawer for a model. Rendered inside DrawerShell by HubDrawer. */
export default function ModelDrawer({
  model,
  hub,
  onSelect,
}: {
  model: MLModel;
  hub: Hub;
  onSelect: (s: Selection) => void;
}) {
  const [tab, setTab] = useState<SnippetTab>("transformers");

  const id = model.id.toLowerCase();
  const demos = hub.demos.filter((d) => d.models.some((m) => m.toLowerCase() === id));
  const libraries = hub.libraries.filter((l) => l.usedBy?.some((m) => m.toLowerCase() === id));
  const base = model.baseModel
    ? hub.models.find((m) => m.id.toLowerCase() === model.baseModel!.toLowerCase())
    : undefined;
  const fineTunes = hub.models.filter((m) => m.baseModel?.toLowerCase() === id);
  const datasetById = new Map(hub.datasets.map((d) => [d.id.toLowerCase(), d]));

  return (
    <>
      <p className="text-sm leading-relaxed text-soft">{model.description}</p>

      {demos[0] && (
        <button
          type="button"
          onClick={() => onSelect({ type: "demo", item: demos[0] })}
          className="group flex w-full items-center gap-4 rounded-xl border border-brand/30 bg-brand/10 p-4 text-left transition hover:border-brand/60"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink/60 text-xl">
            {demos[0].emoji ?? "▶"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Open in Playground: {demos[0].name}</span>
            <span className="block truncate text-xs text-muted">{demos[0].description}</span>
          </span>
          <span className="text-brand transition group-hover:translate-x-0.5">→</span>
        </button>
      )}

      <StatTiles
        stats={[
          ["Downloads", formatCompact(model.downloads)],
          ["Likes", formatCompact(model.likes)],
        ]}
      />

      <FactList
        facts={[
          ["Task", formatTask(model.task)],
          ["Parameters", model.params],
          ["License", model.license],
          ["Framework", model.library],
          ["Base model", model.baseModel],
          ["Updated", formatDate(model.updatedAt)],
        ]}
      />

      {!!model.capabilities?.length && (
        <DrawerSection title="What it does">
          <ChipList items={model.capabilities} />
        </DrawerSection>
      )}

      {(base || fineTunes.length > 0) && (
        <DrawerSection title="Lineage">
          <div className="flex flex-wrap gap-1.5">
            {base && (
              <RelatedChip type="model" label={`Base: ${base.name}`} onClick={() => onSelect({ type: "model", item: base })} />
            )}
            {fineTunes.map((m) => (
              <RelatedChip key={m.id} type="model" label={`Fine-tune: ${m.name}`} onClick={() => onSelect({ type: "model", item: m })} />
            ))}
          </div>
        </DrawerSection>
      )}

      {!!model.datasets?.length && (
        <DrawerSection title="Corpus">
          <div className="flex flex-wrap gap-1.5">
            {model.datasets.map((d) => {
              const own = datasetById.get(d.toLowerCase());
              return own ? (
                <RelatedChip key={d} type="dataset" label={own.name} onClick={() => onSelect({ type: "dataset", item: own })} />
              ) : (
                <a
                  key={d}
                  href={`https://huggingface.co/datasets/${d}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-line px-2 py-1 font-mono text-xs text-soft hover:border-brand/40 hover:text-brand-hover"
                >
                  {d} ↗
                </a>
              );
            })}
          </div>
        </DrawerSection>
      )}

      {libraries.length > 0 && (
        <DrawerSection title="Toolkit">
          <div className="flex flex-wrap gap-1.5">
            {libraries.map((l) => (
              <RelatedChip key={l.id} type="library" label={l.name} onClick={() => onSelect({ type: "library", item: l })} />
            ))}
          </div>
        </DrawerSection>
      )}

      {!!model.benchmarks?.length && (
        <DrawerSection title="Benchmarks">
          <ul className="space-y-3 pt-1">
            {model.benchmarks.map((b) => (
              <li key={b.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-soft">
                    {b.name}
                    {b.lowerIsBetter && <span className="text-muted"> · lower is better</span>}
                  </span>
                  <span className="font-semibold tabular-nums text-gold-300">{formatScore(b.score, b.unit)}</span>
                </div>
                {b.unit === "%" && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300"
                      style={{ width: `${Math.min(b.score, 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DrawerSection>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">Use it</h3>
          <div className="flex gap-1 rounded-lg border border-line p-0.5">
            {(["transformers", "curl"] as SnippetTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === t ? "bg-fg/10 text-fg" : "text-muted hover:text-fg"}`}
              >
                {t === "transformers" ? "Python" : "cURL"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <CodeBlock code={snippet(model, tab)} />
        </div>
      </div>

      {!!model.tags.length && (
        <div className="flex flex-wrap gap-1.5">
          {model.tags.map((t) => (
            <span key={t} className="rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-muted">
              #{t}
            </span>
          ))}
        </div>
      )}

      <LinkButtons links={model.links} />
    </>
  );
}
