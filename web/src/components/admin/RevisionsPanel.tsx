"use client";

import { useState, useTransition } from "react";
import { getRevision, restoreRevision } from "@/app/admin/actions";
import { Card, buttonClass, formatWhen } from "@/components/admin/ui";
import type { ActionResult, AdminItem, Revision } from "@/lib/admin/types";

const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

export default function RevisionsPanel({
  itemId,
  version,
  revisions,
  current,
  dirty,
  onRestored,
}: {
  itemId: string;
  version: number;
  revisions: Revision[];
  /** Current form values (normalized), to compare a revision against */
  current: Record<string, unknown>;
  dirty: boolean;
  onRestored: (res: ActionResult<AdminItem>) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, Record<string, unknown>>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const compare = (v: number) =>
    start(async () => {
      setError("");
      if (open === v) return setOpen(null);
      if (!snapshots[v]) {
        const res = await getRevision(itemId, v);
        if (!res.ok) return setError(res.error);
        setSnapshots((s) => ({ ...s, [v]: res.data.snapshot ?? {} }));
      }
      setOpen(v);
    });

  const restore = (v: number) =>
    start(async () => {
      setError("");
      const res = await restoreRevision(itemId, v, version);
      onRestored(res);
      if (res.ok) setOpen(null);
    });

  const list = showAll ? revisions : revisions.slice(0, 6);

  return (
    <Card title="History">
      {revisions.length === 0 ? (
        <p className="text-xs text-muted">No versions yet.</p>
      ) : (
        <ol className="space-y-2">
          {list.map((r, i) => {
            const snap = snapshots[r.version];
            const diffs = open === r.version && snap ? Object.keys(snap).filter((k) => k in current && JSON.stringify(snap[k]) !== JSON.stringify(current[k])) : [];
            return (
              <li key={r.id} className="rounded-lg border border-line p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-xs">
                    <p className="text-fg">
                      <span className="font-mono">v{r.version}</span>
                      {i === 0 && <span className="ml-1.5 text-muted">(latest)</span>}
                      {r.note && <span className="ml-1.5 text-soft">· {r.note}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-muted">
                      {r.createdBy ?? "unknown"} · {formatWhen(r.createdAt)}
                    </p>
                  </div>
                  {i > 0 && (
                    <button type="button" onClick={() => compare(r.version)} disabled={pending} className={`${buttonClass.ghost} !px-2 !py-1 text-xs`}>
                      {open === r.version ? "Hide" : "Compare"}
                    </button>
                  )}
                </div>
                {open === r.version && snap && (
                  <div className="mt-2 border-t border-line pt-2">
                    {diffs.length === 0 ? (
                      <p className="text-xs text-muted">Same as the form right now.</p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px]">
                        {diffs.map((k) => (
                          <li key={k}>
                            <span className="font-mono text-muted">{k}</span>
                            <div className="mt-0.5 rounded bg-red-400/10 px-1.5 py-0.5 text-red-200 line-through decoration-red-300/40">{show(current[k])}</div>
                            <div className="mt-0.5 rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-200">{show(snap[k])}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => restore(r.version)}
                      disabled={pending || dirty || diffs.length === 0}
                      className={`${buttonClass.secondary} mt-2 w-full !py-1.5 text-xs`}
                    >
                      Restore v{r.version}
                    </button>
                    {dirty && <p className="mt-1 text-[11px] text-muted">Save or discard your edits first.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {revisions.length > 6 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={`${buttonClass.ghost} mt-2 w-full text-xs`}>
          {showAll ? "Show fewer" : `Show all ${revisions.length}`}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </Card>
  );
}
