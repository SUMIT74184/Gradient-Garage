"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import DatasetsSection from "@/components/DatasetsSection";
import DemosSection from "@/components/DemosSection";
import FineTunedSection from "@/components/FineTunedSection";
import HubDrawer from "@/components/HubDrawer";
import HubOverview from "@/components/HubOverview";
import Leaderboard from "@/components/Leaderboard";
import LibrariesSection from "@/components/LibrariesSection";
import ModelCatalog from "@/components/ModelCatalog";
import type { Hub, MLModel, Selection } from "@/lib/types";

/** Interactive sections share one detail drawer and the ⌘K palette. */
export default function Dashboard({ hub }: { hub: Hub }) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const selectModel = useCallback((m: MLModel) => setSelected({ type: "model", item: m }), []);
  // Deep link: /?open=model:owner/name (used by "Saved" and "Recently viewed" on /account)
  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get("open");
    if (!open) return;
    const [type, ...rest] = open.split(":");
    const id = rest.join(":").toLowerCase();
    const lists = { model: hub.models, dataset: hub.datasets, demo: hub.demos, library: hub.libraries } as const;
    const item = (lists[type as keyof typeof lists] as { id: string }[] | undefined)?.find((i) => i.id.toLowerCase() === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after hydration
    if (item) setSelected({ type, item } as Selection);
  }, [hub]);

  const demoModelIds = useMemo(
    () => new Set(hub.demos.flatMap((d) => d.models.map((m) => m.toLowerCase()))),
    [hub.demos],
  );

  return (
    <div className="relative mx-auto mt-16 w-full max-w-[1400px] space-y-24 px-6 md:px-12 lg:mt-24 lg:space-y-32">
      {/* Ambient orange light behind the sections */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-40 -top-40 -z-10 h-[900px] bg-[radial-gradient(45%_45%_at_50%_50%,rgb(240_122_42/0.12),transparent_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-40 top-[45%] -z-10 h-[900px] bg-[radial-gradient(35%_45%_at_20%_50%,rgb(240_122_42/0.08),transparent_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-40 -bottom-40 -z-10 h-[900px] bg-[radial-gradient(35%_45%_at_75%_50%,rgb(240_122_42/0.1),transparent_100%)]" />

      <HubOverview hub={hub} />
      <ModelCatalog models={hub.models} demoModelIds={demoModelIds} onSelect={selectModel} />
      <DemosSection demos={hub.demos} models={hub.models} onSelect={setSelected} />
      <FineTunedSection models={hub.models} onSelect={selectModel} />
      <Leaderboard models={hub.models} onSelect={selectModel} />
      <DatasetsSection datasets={hub.datasets} models={hub.models} onSelect={setSelected} />
      <LibrariesSection libraries={hub.libraries} onSelect={setSelected} />

      <HubDrawer selection={selected} hub={hub} onSelect={setSelected} onClose={close} />
      <CommandPalette hub={hub} onSelect={setSelected} />
    </div>
  );
}
