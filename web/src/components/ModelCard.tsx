import ModelCover from "@/components/ModelCover";
import StatusBadges from "@/components/StatusBadges";
import { formatCompact, formatDate, formatTask } from "@/lib/format";
import type { MLModel } from "@/lib/types";

export function KindBadge({ kind }: { kind: MLModel["kind"] }) {
  return kind === "fine-tuned" ? (
    <span className="rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[11px] font-medium text-gold-300">
      Fine-tuned
    </span>
  ) : (
    <span className="rounded-md border border-line bg-fg/5 px-2 py-0.5 text-[11px] font-medium text-soft">
      Base
    </span>
  );
}

export default function ModelCard({
  model,
  hasDemo,
  onSelect,
}: {
  model: MLModel;
  hasDemo?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative">
        <ModelCover model={model} />
        {hasDemo && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium text-soft backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Playground
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-fg group-hover:text-brand-hover">
            {model.name}
          </h3>
          <p className="truncate font-mono text-xs text-muted">{model.id}</p>
          <StatusBadges badges={model.badges} className="mt-1.5" />
        </div>
        <KindBadge kind={model.kind} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
        {model.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-soft">
          {formatTask(model.task)}
        </span>
        {model.params && (
          <span className="rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-soft">
            {model.params}
          </span>
        )}
        <span className="rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-soft">
          {model.license}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-4 pt-5 text-xs text-muted">
        <span className="tabular-nums">
          <span className="text-gold-400">↓</span> {formatCompact(model.downloads)}
        </span>
        <span className="tabular-nums">
          <span className="text-gold-400">♥</span> {formatCompact(model.likes)}
        </span>
        <span className="ml-auto">{formatDate(model.updatedAt)}</span>
      </div>
    </button>
  );
}
