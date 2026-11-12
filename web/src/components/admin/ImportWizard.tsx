"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { importCsv } from "@/app/admin/actions";
import { buttonClass } from "@/components/admin/ui";
import type { ContentType, ImportPlan, ImportRow } from "@/lib/admin/types";

const ACTION_STYLE: Record<ImportRow["action"], { label: string; className: string }> = {
  create: { label: "New draft", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  update: { label: "Update", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  unchanged: { label: "No change", className: "border-line bg-fg/5 text-muted" },
  error: { label: "Error", className: "border-red-400/30 bg-red-400/10 text-red-300" },
  skip: { label: "Blank", className: "border-line bg-fg/5 text-muted" },
};

type Stage = { kind: "pick" } | { kind: "preview"; plan: ImportPlan; file: File } | { kind: "done"; plan: ImportPlan };

export default function ImportWizard({ type, sectionSlug }: { type: ContentType; sectionSlug: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [error, setError] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const preview = (file: File) =>
    start(async () => {
      setError("");
      const form = new FormData();
      form.set("file", file);
      const res = await importCsv(type, form, false);
      if (!res.ok) return setError(res.error);
      setStage({ kind: "preview", plan: res.data, file });
    });

  const apply = (file: File) =>
    start(async () => {
      setError("");
      const form = new FormData();
      form.set("file", file);
      const res = await importCsv(type, form, true);
      if (!res.ok) return setError(res.error);
      setStage({ kind: "done", plan: res.data });
    });

  if (stage.kind === "pick") {
    return (
      <div className="space-y-3">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) preview(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface p-12 text-center transition hover:border-brand/50 ${pending ? "opacity-60" : ""}`}
        >
          <svg viewBox="0 0 24 24" className="size-8 text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <span className="text-sm font-medium text-fg">{pending ? "Reading file…" : "Drop a CSV here or click to choose"}</span>
          <span className="text-xs text-muted">UTF-8, up to 2 MB / 2,000 rows</span>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) preview(f);
              e.target.value = "";
            }}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    );
  }

  const plan = stage.plan;
  const s = plan.summary;
  const rows = onlyChanges && stage.kind === "preview" ? plan.rows.filter((r) => r.action !== "unchanged" && r.action !== "skip") : plan.rows;
  const writes = s.create + s.update;

  return (
    <div className="space-y-4">
      {stage.kind === "done" ? (
        <div role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Imported: {s.create} new {s.create === 1 ? "draft" : "drafts"}, {s.update} updated, {s.unchanged} unchanged.{" "}
          <Link href={`/admin/${sectionSlug}${s.create ? "?status=draft" : ""}`} className="font-medium underline underline-offset-2">
            {s.create ? "Review the new drafts" : "Back to the list"}
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <span className="mr-2 truncate font-mono text-xs text-soft" title={stage.file.name}>
            {stage.file.name}
          </span>
          {(["create", "update", "unchanged", "error"] as const).map((k) => (
            <span key={k} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACTION_STYLE[k].className}`}>
              {s[k]} {ACTION_STYLE[k].label.toLowerCase()}
            </span>
          ))}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setStage({ kind: "pick" })} className={buttonClass.ghost} disabled={pending}>
              Choose another file
            </button>
            <button
              type="button"
              onClick={() => apply(stage.file)}
              disabled={pending || s.error > 0 || writes === 0}
              title={s.error ? "Fix the rows with errors first" : writes === 0 ? "Nothing to change" : undefined}
              className={buttonClass.primary}
            >
              {pending ? "Importing…" : s.error ? "Fix errors to import" : writes === 0 ? "Nothing to import" : `Import ${writes} ${writes === 1 ? "row" : "rows"}`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {stage.kind === "preview" && (
        <label className="flex items-center gap-2 text-xs text-soft">
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} className="size-3.5 accent-[var(--color-brand)]" />
          Only show rows that change or have errors
        </label>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="w-14 py-2.5 pl-4 pr-2 font-medium">Row</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Slug</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Result</th>
              <th scope="col" className="py-2.5 pl-3 pr-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-muted">
                  Every row matches what&apos;s already saved.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.row} className="align-top">
                <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-muted">{r.row}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-fg">
                  {r.id && stage.kind === "done" ? (
                    <Link href={`/admin/${sectionSlug}/${r.id}`} className="hover:text-brand-hover">
                      {r.slug}
                    </Link>
                  ) : (
                    r.slug || <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACTION_STYLE[r.action].className}`}>
                    {ACTION_STYLE[r.action].label}
                  </span>
                </td>
                <td className="py-2.5 pl-3 pr-4 text-xs">
                  {r.errors.length > 0 ? (
                    <ul className="space-y-0.5 text-red-300">
                      {r.errors.map((e, i) => (
                        <li key={i}>
                          <span className="font-mono">{e.field || "row"}</span>: {e.msg}
                        </li>
                      ))}
                    </ul>
                  ) : r.changes.length ? (
                    <span className="font-mono text-soft">{r.changes.join(", ")}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
