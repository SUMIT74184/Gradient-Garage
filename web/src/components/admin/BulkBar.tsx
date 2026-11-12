"use client";

import { useState, useTransition } from "react";
import { bulkAction } from "@/app/admin/actions";
import { BADGE_META } from "@/components/StatusBadges";
import { useCan } from "@/components/admin/AdminUser";
import { buttonClass, inputClass } from "@/components/admin/ui";
import { BADGES } from "@/lib/admin/schema";
import type { BulkAction, BulkResult, LabelWithCount } from "@/lib/admin/types";

type Option = { action: BulkAction; label: string; value?: "tags" | "label" | "badge"; owner?: boolean };

const MORE: Option[] = [
  { action: "feature", label: "Feature" },
  { action: "unfeature", label: "Unfeature" },
  { action: "add_tags", label: "Add tags…", value: "tags" },
  { action: "remove_tags", label: "Remove tags…", value: "tags" },
  { action: "add_labels", label: "Add internal label…", value: "label" },
  { action: "remove_labels", label: "Remove internal label…", value: "label" },
  { action: "add_badge", label: "Add badge…", value: "badge" },
  { action: "remove_badge", label: "Remove badge…", value: "badge" },
  { action: "restore", label: "Restore to draft" },
  { action: "unpublish", label: "Unpublish" },
  { action: "delete", label: "Delete forever (archived only)", owner: true },
];

const DONE_VERB: Partial<Record<BulkAction, string>> = {
  publish: "Published",
  unpublish: "Unpublished",
  archive: "Archived",
  restore: "Restored",
  delete: "Deleted",
  feature: "Featured",
  unfeature: "Unfeatured",
};

export type BulkMessage = { tone: "ok" | "error"; text: string; skipped?: BulkResult["skipped"] };

function summarise(r: BulkResult) {
  const verb = DONE_VERB[r.action] ?? "Updated";
  const parts = [`${verb} ${r.done.length}`];
  if (r.unchanged.length) parts.push(`${r.unchanged.length} already done`);
  if (r.skipped.length) parts.push(`${r.skipped.length} skipped`);
  return parts.join(" · ");
}

/** Sticky bar shown while rows are selected: quick lifecycle buttons plus a "more actions" menu. */
export default function BulkBar({
  ids,
  labels,
  tagSuggestions,
  onResult,
  onClear,
}: {
  ids: string[];
  labels: LabelWithCount[];
  tagSuggestions: string[];
  /** Shown above the table, so it survives rows leaving the current tab */
  onResult: (m: BulkMessage | null, deleted?: boolean) => void;
  onClear: () => void;
}) {
  const isOwner = useCan("owner");
  const [pending, start] = useTransition();
  const [more, setMore] = useState<BulkAction | "">("");
  const [value, setValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const option = MORE.find((o) => o.action === more);

  const apply = (action: BulkAction, raw?: string) =>
    start(async () => {
      onResult(null);
      let v: unknown = undefined;
      if (action === "add_tags" || action === "remove_tags") {
        v = (raw ?? "").split(",").map((t) => t.trim()).filter(Boolean);
        if (!(v as string[]).length) return onResult({ tone: "error", text: "Type at least one tag (comma-separated)." });
      } else if (action === "add_labels" || action === "remove_labels") {
        if (!raw) return onResult({ tone: "error", text: "Pick a label." });
        v = [raw];
      } else if (action === "add_badge" || action === "remove_badge") {
        if (!raw) return onResult({ tone: "error", text: "Pick a badge." });
        v = raw;
      }
      const res = await bulkAction(ids, action, v);
      if (!res.ok) return onResult({ tone: "error", text: res.error });
      onResult({ tone: "ok", text: summarise(res.data), skipped: res.data.skipped }, action === "delete");
      setMore("");
      setValue("");
      setConfirmDelete(false);
    });

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mt-4 rounded-xl border border-brand/30 bg-surface-2/95 p-3 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-fg">
          <span className="tabular-nums">{ids.length}</span> selected
        </span>
        <button type="button" disabled={pending} onClick={() => apply("publish")} className={`${buttonClass.primary} !py-1.5`}>
          Publish
        </button>
        <button type="button" disabled={pending} onClick={() => apply("archive")} className={`${buttonClass.secondary} !py-1.5`}>
          Archive
        </button>

        <select
          aria-label="More bulk actions"
          value={more}
          disabled={pending}
          onChange={(e) => {
            setMore(e.target.value as BulkAction | "");
            setValue("");
            setConfirmDelete(false);
          }}
          className={`${inputClass} !w-auto cursor-pointer !py-1.5`}
        >
          <option value="">More actions…</option>
          {MORE.filter((o) => !o.owner || isOwner).map((o) => (
            <option key={o.action} value={o.action}>
              {o.label}
            </option>
          ))}
        </select>

        {option?.value === "tags" && (
          <>
            <input
              list="bulk-tag-suggestions"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="vision, beta-test"
              aria-label="Tags, comma-separated"
              className={`${inputClass} !w-56 !py-1.5`}
            />
            <datalist id="bulk-tag-suggestions">
              {tagSuggestions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </>
        )}
        {option?.value === "label" && (
          <select aria-label="Label" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} !w-auto cursor-pointer !py-1.5`}>
            <option value="">Choose label…</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        {option?.value === "badge" && (
          <select aria-label="Badge" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} !w-auto cursor-pointer !py-1.5`}>
            <option value="">Choose badge…</option>
            {BADGES.map((b) => (
              <option key={b} value={b}>
                {BADGE_META[b].label}
              </option>
            ))}
          </select>
        )}
        {option &&
          (option.action === "delete" ? (
            confirmDelete ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs text-red-300">Can&apos;t be undone.</span>
                <button type="button" disabled={pending} onClick={() => apply("delete")} className={`${buttonClass.danger} !py-1.5`}>
                  Delete {ids.length} forever
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${buttonClass.danger} !py-1.5`}>
                Delete…
              </button>
            )
          ) : (
            <button type="button" disabled={pending} onClick={() => apply(option.action, value)} className={`${buttonClass.secondary} !py-1.5`}>
              Apply
            </button>
          ))}

        <button type="button" onClick={onClear} className={`${buttonClass.ghost} ml-auto`}>
          Clear selection
        </button>
      </div>

      {pending && <p className="mt-2 text-xs text-muted">Working…</p>}
    </div>
  );
}

export function BulkMessageView({ message, onDismiss }: { message: BulkMessage; onDismiss: () => void }) {
  return (
    <div
      role={message.tone === "ok" ? "status" : "alert"}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${
        message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"
      }`}
    >
      <div>
        {message.text}
        {!!message.skipped?.length && (
          <ul className="mt-1 space-y-0.5 text-xs text-soft">
            {message.skipped.slice(0, 5).map((s) => (
              <li key={s.id}>
                {s.name || s.id}: {s.reason}
              </li>
            ))}
            {message.skipped.length > 5 && <li>…and {message.skipped.length - 5} more</li>}
          </ul>
        )}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-xs opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
