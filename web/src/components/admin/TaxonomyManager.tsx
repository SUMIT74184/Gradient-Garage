"use client";

import { useState, useTransition } from "react";
import { createLabel, deleteLabel, deleteTag, mergeTag, renameTag, updateLabel } from "@/app/admin/actions";
import { useCan } from "@/components/admin/AdminUser";
import { Card, LabelChip, buttonClass, inputClass } from "@/components/admin/ui";
import type { ActionResult, LabelWithCount, TagWithCount } from "@/lib/admin/types";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (res.ok) onOk?.();
      else setError(res.fieldErrors ? Object.values(res.fieldErrors).join(" ") : res.error);
    });
  return { pending, error, run };
}

function TagRow({ tag, tags }: { tag: TagWithCount; tags: TagWithCount[] }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"view" | "rename" | "merge" | "delete">("view");
  const [name, setName] = useState(tag.name);
  const [into, setInto] = useState("");

  return (
    <li className={`py-2.5 ${pending ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "rename" ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameTag(tag.id, name), () => setMode("view"));
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="New tag name" className={`${inputClass} !py-1.5`} />
            <button type="submit" disabled={pending || !name.trim()} className={`${buttonClass.primary} !py-1.5`}>
              Save
            </button>
            <button type="button" onClick={() => { setMode("view"); setName(tag.name); }} className={buttonClass.ghost}>
              Cancel
            </button>
          </form>
        ) : mode === "merge" ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (into) run(() => mergeTag(tag.id, into));
            }}
          >
            <span className="text-sm text-soft">
              Merge <b className="text-fg">{tag.name}</b> into
            </span>
            <select value={into} onChange={(e) => setInto(e.target.value)} aria-label="Merge into" className={`${inputClass} !w-auto !py-1.5`}>
              <option value="">Choose a tag…</option>
              {tags
                .filter((t) => t.id !== tag.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button type="submit" disabled={pending || !into} className={`${buttonClass.primary} !py-1.5`}>
              Merge
            </button>
            <button type="button" onClick={() => setMode("view")} className={buttonClass.ghost}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-sm text-fg">{tag.name}</span>
              <span className="ml-2 font-mono text-xs text-muted">{tag.slug}</span>
            </span>
            <span className="w-16 text-right text-xs tabular-nums text-muted">{tag.count} used</span>
            {mode === "delete" ? (
              <>
                <button type="button" onClick={() => run(() => deleteTag(tag.id))} disabled={pending} className={`${buttonClass.danger} !px-2.5 !py-1.5`}>
                  Delete{tag.count ? ` from ${tag.count}` : ""}
                </button>
                <button type="button" onClick={() => setMode("view")} className={buttonClass.ghost}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode("rename")} className={buttonClass.ghost}>
                  Rename
                </button>
                <button type="button" onClick={() => setMode("merge")} className={buttonClass.ghost} disabled={tags.length < 2}>
                  Merge
                </button>
                <button type="button" onClick={() => setMode("delete")} className={`${buttonClass.ghost} hover:!text-red-300`}>
                  Delete…
                </button>
              </>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </li>
  );
}

function LabelForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  initial: { name: string; color: string; description: string };
  submitLabel: string;
  onSubmit: (v: { name: string; color: string; description: string }) => void;
  onCancel?: () => void;
  pending: boolean;
}) {
  const [v, setV] = useState(initial);
  return (
    <form
      className="grid gap-2 sm:grid-cols-[auto_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <input
        type="color"
        value={v.color}
        onChange={(e) => setV({ ...v, color: e.target.value })}
        aria-label="Color"
        className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-ink/60 p-1"
      />
      <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Label name, e.g. Needs benchmark" aria-label="Label name" required className={inputClass} />
      <input
        value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })}
        placeholder="What it means (optional)"
        aria-label="Description"
        className={`${inputClass} sm:col-span-2`}
      />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending || !v.name.trim()} className={buttonClass.primary}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonClass.ghost}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function LabelRow({ label }: { label: LabelWithCount }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  return (
    <li className={`py-3 ${pending ? "opacity-50" : ""}`}>
      {mode === "edit" ? (
        <LabelForm
          initial={label}
          submitLabel="Save"
          pending={pending}
          onCancel={() => setMode("view")}
          onSubmit={(v) => run(() => updateLabel(label.id, v), () => setMode("view"))}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <LabelChip label={label} />
            {label.description && <p className="mt-1 text-xs text-muted">{label.description}</p>}
          </div>
          <span className="w-16 text-right text-xs tabular-nums text-muted">{label.count} items</span>
          {mode === "delete" ? (
            <>
              <button type="button" onClick={() => run(() => deleteLabel(label.id))} disabled={pending} className={`${buttonClass.danger} !px-2.5 !py-1.5`}>
                Delete
              </button>
              <button type="button" onClick={() => setMode("view")} className={buttonClass.ghost}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setMode("edit")} className={buttonClass.ghost}>
                Edit
              </button>
              <button type="button" onClick={() => setMode("delete")} className={`${buttonClass.ghost} hover:!text-red-300`}>
                Delete…
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </li>
  );
}

export default function TaxonomyManager({ tags, labels }: { tags: TagWithCount[]; labels: LabelWithCount[] }) {
  const create = useAction();
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState("");
  const shown = tags.filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.slug.includes(filter.toLowerCase()));
  const unused = tags.filter((t) => t.count === 0).length;
  const canEdit = useCan("editor");

  return (
    <fieldset disabled={!canEdit} className="grid gap-6 xl:grid-cols-2">
      <Card title={`Tags (${tags.length})`} action={unused > 0 ? <span className="text-xs text-muted">{unused} unused</span> : undefined}>
        <p className="mb-3 text-xs text-muted">Public, shared by every section. Add them on an item; merge duplicates here.</p>
        <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tags…" aria-label="Filter tags" className={inputClass} />
        <ul className="mt-2 divide-y divide-line">
          {shown.map((t) => (
            <TagRow key={`${t.id}:${t.name}:${t.count}`} tag={t} tags={tags} />
          ))}
        </ul>
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">No tags match.</p>}
      </Card>

      <Card title={`Internal labels (${labels.length})`}>
        <p className="mb-3 text-xs text-muted">Only the team sees these. Use them to track work, like “Needs benchmark”.</p>
        <LabelForm
          key={formKey}
          initial={{ name: "", color: "#f97316", description: "" }}
          submitLabel="Add label"
          pending={create.pending}
          onSubmit={(v) => create.run(() => createLabel(v), () => setFormKey((k) => k + 1))}
        />
        {create.error && <p className="mt-1 text-xs text-red-300">{create.error}</p>}
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {labels.map((l) => (
            <LabelRow key={`${l.id}:${l.name}:${l.color}:${l.description}:${l.count}`} label={l} />
          ))}
        </ul>
      </Card>
    </fieldset>
  );
}
