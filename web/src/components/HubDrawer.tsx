"use client";

import { useState } from "react";
import CopyCommand from "@/components/CopyCommand";
import { KindBadge } from "@/components/ModelCard";
import ModelDrawer from "@/components/ModelDrawer";
import {
  ChipList,
  CodeBlock,
  DrawerSection,
  DrawerShell,
  FactList,
  LanguageDot,
  LinkButtons,
  RelatedChip,
  StatTiles,
} from "@/components/ui";
import { formatCompact, formatDate, formatTask } from "@/lib/format";
import type { Dataset, Demo, Hub, Library, MLModel, Selection } from "@/lib/types";

type Props = { hub: Hub; onSelect: (s: Selection) => void };

function findModels(hub: Hub, ids: string[] = []) {
  const wanted = new Set(ids.map((i) => i.toLowerCase()));
  return hub.models.filter((m) => wanted.has(m.id.toLowerCase()));
}

function ModelChips({ models, onSelect }: { models: MLModel[]; onSelect: Props["onSelect"] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {models.map((m) => (
        <RelatedChip key={m.id} type="model" label={m.name} onClick={() => onSelect({ type: "model", item: m })} />
      ))}
    </div>
  );
}

function LibraryBody({ lib, hub, onSelect }: { lib: Library } & Props) {
  const models = findModels(hub, lib.usedBy);
  return (
    <>
      <p className="text-sm leading-relaxed text-soft">{lib.description}</p>
      <CopyCommand command={lib.install} />
      <StatTiles
        stats={[
          ["Stars", formatCompact(lib.stars)],
          ["Version", lib.version ? `v${lib.version}` : "—"],
          ["Used by", `${models.length}`],
        ]}
      />
      <div className="flex items-center gap-4">
        <LanguageDot language={lib.language} />
        <span className="text-xs text-muted">{lib.license}</span>
        <span className="ml-auto text-xs text-muted">Updated {formatDate(lib.updatedAt)}</span>
      </div>
      {!!lib.features?.length && (
        <DrawerSection title="Features">
          <ChipList items={lib.features} />
        </DrawerSection>
      )}
      {lib.usage && (
        <DrawerSection title="Quickstart">
          <CodeBlock code={lib.usage} />
        </DrawerSection>
      )}
      {models.length > 0 && (
        <DrawerSection title="Checkpoints built with it">
          <ModelChips models={models} onSelect={onSelect} />
        </DrawerSection>
      )}
      <LinkButtons links={lib.links} />
    </>
  );
}

function DatasetBody({ ds, hub, onSelect }: { ds: Dataset } & Props) {
  const id = ds.id.toLowerCase();
  const models = hub.models.filter((m) => m.datasets?.some((d) => d.toLowerCase() === id));
  return (
    <>
      <p className="text-sm leading-relaxed text-soft">{ds.description}</p>
      <CodeBlock
        code={`from datasets import load_dataset

ds = load_dataset("${ds.id}")
print(ds)`}
      />
      <StatTiles
        stats={[
          ["Downloads", formatCompact(ds.downloads)],
          ["Likes", formatCompact(ds.likes)],
          ["Size", ds.size ?? "—"],
        ]}
      />
      <FactList
        facts={[
          ["Modality", formatTask(ds.modality)],
          ["Task", ds.task && formatTask(ds.task)],
          ["License", ds.license],
          ["Updated", formatDate(ds.updatedAt)],
        ]}
      />
      {!!ds.labels?.length && (
        <DrawerSection title="Labels">
          <ChipList items={ds.labels} />
        </DrawerSection>
      )}
      {ds.notes && (
        <DrawerSection title="Data card notes">
          <p className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-xs leading-relaxed text-soft">
            {ds.notes}
          </p>
        </DrawerSection>
      )}
      {models.length > 0 && (
        <DrawerSection title="Checkpoints trained on it">
          <ModelChips models={models} onSelect={onSelect} />
        </DrawerSection>
      )}
      <LinkButtons links={ds.links} />
    </>
  );
}

function DemoBody({ demo, hub, onSelect }: { demo: Demo } & Props) {
  const [live, setLive] = useState(false);
  const models = findModels(hub, demo.models);
  return (
    <>
      <p className="text-sm leading-relaxed text-soft">{demo.description}</p>
      {demo.embedUrl ? (
        live ? (
          <iframe
            src={demo.embedUrl}
            title={demo.name}
            allow="camera; microphone; clipboard-write; fullscreen"
            className="h-[560px] w-full rounded-xl border border-line bg-black"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLive(true)}
            className="dot-bg group relative grid h-56 w-full place-items-center overflow-hidden rounded-xl border border-line bg-surface-2 transition hover:border-brand/40"
          >
            <span className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_50%,rgb(240_122_42/0.25),transparent_70%)]" />
            <span className="relative flex flex-col items-center gap-3">
              <span className="text-5xl transition group-hover:scale-110">{demo.emoji ?? "▶"}</span>
              <span className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg">Run it here</span>
              <span className="text-[11px] text-muted">Loads the live app in this panel</span>
            </span>
          </button>
        )
      ) : (
        <a
          href={demo.url}
          target="_blank"
          rel="noreferrer"
          className="dot-bg flex h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface-2 transition hover:border-brand/40"
        >
          <span className="text-5xl">{demo.emoji ?? "▶"}</span>
          <span className="text-sm font-semibold text-brand-hover">Open playground ↗</span>
        </a>
      )}
      <FactList
        facts={[
          ["Runs on", demo.sdk === "web" ? "Web app" : `${formatTask(demo.sdk)}${demo.url.includes("huggingface.co") ? " · Hugging Face" : ""}`],
          ["Likes", formatCompact(demo.likes)],
          ["Updated", formatDate(demo.updatedAt)],
        ]}
      />
      {models.length > 0 && (
        <DrawerSection title="Checkpoints it runs">
          <ModelChips models={models} onSelect={onSelect} />
        </DrawerSection>
      )}
      <LinkButtons links={{ demo: demo.url }} />
    </>
  );
}

/** One drawer for every kind of item; related items open in place. */
export default function HubDrawer({
  selection,
  hub,
  onSelect,
  onClose,
}: Props & { selection: Selection | null; onClose: () => void }) {
  if (!selection) return null;
  const { type, item } = selection;
  const key = `${type}:${item.id}`;

  const header =
    type === "model"
      ? { title: item.name, subtitle: item.id, badge: <KindBadge kind={item.kind} /> }
      : type === "library"
        ? { title: item.name, subtitle: item.install, badge: item.version && <span className="rounded-md border border-line bg-fg/5 px-2 py-0.5 font-mono text-[11px] text-soft">v{item.version}</span> }
        : type === "dataset"
          ? { title: item.name, subtitle: item.id }
          : { title: `${item.emoji ? `${item.emoji} ` : ""}${item.name}`, subtitle: item.id };

  return (
    <DrawerShell type={type} scrollKey={key} itemId={item.id} onClose={onClose} {...header}>
      {type === "model" && <ModelDrawer key={key} model={item} hub={hub} onSelect={onSelect} />}
      {type === "library" && <LibraryBody key={key} lib={item} hub={hub} onSelect={onSelect} />}
      {type === "dataset" && <DatasetBody key={key} ds={item} hub={hub} onSelect={onSelect} />}
      {type === "demo" && <DemoBody key={key} demo={item} hub={hub} onSelect={onSelect} />}
    </DrawerShell>
  );
}
