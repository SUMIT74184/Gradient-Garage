"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createItem, resetOverrides, transitionItem, updateItem } from "@/app/admin/actions";
import { BADGE_META } from "@/components/StatusBadges";
import { useCan } from "@/components/admin/AdminUser";
import { ImageField } from "@/components/admin/MediaPicker";
import RevisionsPanel from "@/components/admin/RevisionsPanel";
import { BenchmarksEditor, ChipsInput, Field } from "@/components/admin/fields";
import { Card, LabelChip, StatusPill, buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import { BADGES, FIELDS, LINK_KEYS, LINK_LABEL, editableKeys, emptyValues, type FieldDef } from "@/lib/admin/schema";
import type {
  ActionResult,
  AdminItem,
  BenchmarkRow,
  ContentType,
  ItemValues,
  LabelWithCount,
  Revision,
  Transition,
} from "@/lib/admin/types";
import type { Badge } from "@/lib/types";

type Banner = { tone: "error" | "success" | "conflict"; text: string } | null;

function pick(type: ContentType, item: AdminItem): ItemValues {
  const out = emptyValues(type);
  for (const k of editableKeys(type)) if (k in item) out[k] = item[k];
  return out;
}

/** Shape values the way the API expects: empty optional strings become null, numbers are numbers. */
function normalize(type: ContentType, values: ItemValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const defs = new Map(FIELDS[type].map((f) => [f.key, f]));
  for (const k of editableKeys(type)) {
    let v = values[k];
    const def = defs.get(k);
    if (typeof v === "string") v = v.trim();
    if (def?.nullable && v === "") v = null;
    if (def?.kind === "number") v = v === "" || v === null ? 0 : Number(v);
    if (k === "contentDate" && v === "") v = null;
    if (k === "labelIds") v = [...(v as string[])].sort();
    if (k === "links") v = Object.fromEntries(Object.entries(v as Record<string, string>).filter(([, u]) => u.trim()).map(([n, u]) => [n, u.trim()]));
    if (k === "benchmarks") v = (v as BenchmarkRow[]).map((b) => ({ ...b, name: b.name.trim(), unit: b.unit?.trim() || null, lowerIsBetter: !!b.lowerIsBetter }));
    out[k] = v;
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const LIFECYCLE: Record<AdminItem["status"], { action: Transition; label: string; primary?: boolean; hint: string }[]> = {
  draft: [
    { action: "publish", label: "Publish", primary: true, hint: "Show it on the site" },
    { action: "archive", label: "Archive", hint: "Hide it; can be restored" },
  ],
  published: [
    { action: "unpublish", label: "Unpublish", hint: "Back to draft, hidden from the site" },
    { action: "archive", label: "Archive", hint: "Hide it; can be restored" },
  ],
  archived: [{ action: "restore", label: "Restore to draft", primary: true, hint: "Bring it back as a draft" }],
};

export default function ItemEditor({
  type,
  sectionSlug,
  itemLabel,
  item: initialItem,
  labels,
  tagSuggestions,
  revisions = [],
}: {
  type: ContentType;
  sectionSlug: string;
  itemLabel: string;
  item?: AdminItem;
  labels: LabelWithCount[];
  tagSuggestions: string[];
  revisions?: Revision[];
}) {
  const router = useRouter();
  const isNew = !initialItem;
  const canEdit = useCan("editor");
  const [item, setItem] = useState(initialItem);
  const [saved, setSaved] = useState<ItemValues>(() => (initialItem ? pick(type, initialItem) : emptyValues(type)));
  const [values, setValues] = useState<ItemValues>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [pending, start] = useTransition();
  // Preview URL for the cover; the form itself only stores the media id
  const [coverUrl, setCoverUrl] = useState<string | null>(initialItem?.cover?.url ?? null);

  const savedNorm = useMemo(() => normalize(type, saved), [type, saved]);
  const currentNorm = useMemo(() => normalize(type, values), [type, values]);
  const dirtyKeys = useMemo(
    () => editableKeys(type).filter((k) => !same(currentNorm[k], savedNorm[k])),
    [type, currentNorm, savedNorm],
  );
  const dirty = isNew ? !!(values.name || values.slug) : dirtyKeys.length > 0;

  const set = (key: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
  };

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const applyResult = (res: ActionResult<AdminItem>, success: string) => {
    if (res.ok) {
      setItem(res.data);
      const next = pick(type, res.data);
      setSaved(next);
      // Keep any edits made to fields this result didn't touch
      setValues((prev) => {
        const merged = { ...next };
        for (const k of editableKeys(type)) if (!same(normalize(type, prev)[k], savedNorm[k])) merged[k] = prev[k];
        return merged;
      });
      setErrors({});
      setBanner({ tone: "success", text: success });
      return true;
    }
    if (res.status === 409 && res.currentVersion !== undefined) {
      setBanner({ tone: "conflict", text: "Someone else changed this item since you opened it." });
    } else {
      setBanner({ tone: "error", text: res.error });
      setErrors(res.fieldErrors ?? {});
    }
    return false;
  };

  const save = () =>
    start(async () => {
      setBanner(null);
      if (isNew) {
        const res = await createItem(type, currentNorm);
        if (res.ok) {
          router.push(`/admin/${sectionSlug}/${res.data.id}?created=1`);
        } else {
          setBanner({ tone: "error", text: res.error });
          setErrors(res.fieldErrors ?? {});
        }
        return;
      }
      if (!dirtyKeys.length) return;
      const changes = Object.fromEntries(dirtyKeys.map((k) => [k, currentNorm[k]]));
      const res = await updateItem(item!.id, item!.version, changes);
      if (res.ok) {
        setItem(res.data);
        const next = pick(type, res.data);
        setSaved(next);
        setValues(next);
        setErrors({});
        setBanner({ tone: "success", text: "Saved." });
      } else applyResult(res, "");
    });

  const transition = (action: Transition) =>
    start(async () => {
      setBanner(null);
      const res = await transitionItem(item!.id, action, item!.version);
      applyResult(res, action === "publish" ? "Published. It's live on the site." : `Done: ${action}.`);
    });

  const releaseField = (field: string) =>
    start(async () => {
      setBanner(null);
      const res = await resetOverrides(item!.id, [field], item!.version);
      applyResult(res, "Handed back to Hugging Face. It takes the Hugging Face value on the next sync.");
    });

  const reloadLatest = () => {
    // Drop local edits and pull the current server version
    window.location.reload();
  };

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit && dirty && !pending) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const renderField = (f: FieldDef) => {
    const id = `f-${f.key}`;
    const v = values[f.key];
    const invalid = !!errors[f.key];
    let control;
    if (f.kind === "list") {
      control = <ChipsInput id={id} value={(v as string[]) ?? []} onChange={(nv) => set(f.key, nv)} placeholder={f.placeholder} invalid={invalid} />;
    } else if (f.kind === "select") {
      control = (
        <select id={id} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} className={`${inputClass} cursor-pointer`} aria-invalid={invalid}>
          {f.options!.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    } else if (f.kind === "textarea" || f.kind === "code") {
      control = (
        <textarea
          id={id}
          value={(v as string) ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
          rows={f.kind === "code" ? 7 : 3}
          spellCheck={f.kind !== "code"}
          placeholder={f.placeholder}
          aria-invalid={invalid}
          className={`${inputClass} ${f.kind === "code" ? "font-mono text-xs leading-relaxed" : ""}`}
        />
      );
    } else {
      control = (
        <input
          id={id}
          type={f.kind === "number" ? "number" : "text"}
          min={f.kind === "number" ? 0 : undefined}
          value={v === null || v === undefined ? "" : String(v)}
          onChange={(e) => set(f.key, f.kind === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          placeholder={f.placeholder}
          aria-invalid={invalid}
          className={`${inputClass} ${f.mono ? "font-mono" : ""}`}
        />
      );
    }
    const changed = !isNew && dirtyKeys.includes(f.key);
    const hfLocked = item?.source === "huggingface" && item.editedFields.includes(f.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
    return (
      <Field
        key={f.key}
        label={`${f.label}${changed ? " •" : ""}${hfLocked ? " (overrides HF)" : ""}`}
        help={f.help}
        error={errors[f.key]}
        htmlFor={id}
        wide={f.wide}
      >
        {control}
      </Field>
    );
  };

  const linkKeys = LINK_KEYS[type];
  const links = values.links ?? {};

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="pb-24"
    >
      {!canEdit && (
        <p className="mb-6 rounded-lg border border-line bg-fg/5 px-4 py-3 text-sm text-soft">You have view-only access (Viewer role).</p>
      )}
      <fieldset disabled={!canEdit} className="contents">
      {banner && (
        <div
          role={banner.tone === "success" ? "status" : "alert"}
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            banner.tone === "success"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : banner.tone === "conflict"
                ? "border-gold-400/30 bg-gold-400/10 text-gold-200"
                : "border-red-400/30 bg-red-400/10 text-red-200"
          }`}
        >
          <span>{banner.text}</span>
          {banner.tone === "conflict" && (
            <button type="button" onClick={reloadLatest} className={buttonClass.secondary}>
              Load latest (discards your edits)
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name} htmlFor="f-name">
                <input id="f-name" value={values.name} onChange={(e) => set("name", e.target.value)} required aria-invalid={!!errors.name} className={inputClass} placeholder="Nova 1.1B" />
              </Field>
              <Field
                label="ID"
                error={errors.slug}
                help={type === "library" ? "Unique slug, e.g. posekit" : "Hugging Face style owner/name. Used to link items together"}
                htmlFor="f-slug"
              >
                <input id="f-slug" value={values.slug} onChange={(e) => set("slug", e.target.value)} required aria-invalid={!!errors.slug} className={`${inputClass} font-mono`} placeholder={type === "library" ? "posekit" : "your-username/name"} />
              </Field>
              <Field label="Description" error={errors.description} htmlFor="f-description" wide>
                <textarea id="f-description" value={values.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputClass} />
              </Field>
            </div>
          </Card>

          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">{FIELDS[type].map(renderField)}</div>
          </Card>

          {type === "model" && (
            <Card title="Benchmarks">
              <BenchmarksEditor value={(values.benchmarks as BenchmarkRow[]) ?? []} onChange={(v) => set("benchmarks", v)} error={errors.benchmarks} />
            </Card>
          )}

          {linkKeys.length > 0 && (
            <Card title="Links">
              <div className="grid gap-4 sm:grid-cols-2">
                {linkKeys.map((k) => (
                  <Field key={k} label={LINK_LABEL[k]} htmlFor={`link-${k}`}>
                    <input
                      id={`link-${k}`}
                      type="url"
                      value={links[k] ?? ""}
                      onChange={(e) => set("links", { ...links, [k]: e.target.value })}
                      placeholder="https://"
                      className={`${inputClass} font-mono text-xs`}
                    />
                  </Field>
                ))}
              </div>
              {errors.links && <p className="mt-2 text-xs text-red-300">{errors.links}</p>}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {item && (
            <Card title="Status">
              <div className="flex items-center justify-between">
                <StatusPill status={item.status} />
                <span className="font-mono text-xs text-muted">v{item.version}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {LIFECYCLE[item.status].map((l) => (
                  <button
                    key={l.action}
                    type="button"
                    disabled={pending}
                    onClick={() => transition(l.action)}
                    title={l.hint}
                    className={l.primary ? buttonClass.primary : buttonClass.secondary}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {dirty && item.status !== "archived" && (
                <p className="mt-2 text-xs text-muted">Unsaved edits stay in the form; save them to put them live.</p>
              )}
              <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Created</dt>
                  <dd className="text-soft">{formatWhen(item.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Last edit</dt>
                  <dd className="text-soft">{formatWhen(item.updatedAt)}</dd>
                </div>
                {item.publishedAt && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Published</dt>
                    <dd className="text-soft">{formatWhen(item.publishedAt)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Source</dt>
                  <dd className="text-soft">{item.source === "huggingface" ? "Hugging Face sync" : "Added here"}</dd>
                </div>
              </dl>
            </Card>
          )}

          {item?.source === "huggingface" && (
            <Card title="Hugging Face sync">
              <p className="text-xs text-muted">
                Last synced {item.hfSyncedAt ? formatWhen(item.hfSyncedAt) : "never"}. Stats always refresh; other fields follow Hugging Face until you edit them.
              </p>
              {item.editedFields.length === 0 ? (
                <p className="mt-3 text-xs text-soft">No overrides: every synced field follows Hugging Face.</p>
              ) : (
                <>
                  <p className="mb-1.5 mt-3 text-xs font-medium text-soft">Your edits (sync leaves these alone)</p>
                  <ul className="space-y-1">
                    {item.editedFields.map((f) => (
                      <li key={f} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-soft">{f.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}</span>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={pending || dirty}
                            title={dirty ? "Save or discard your changes first" : "Use the Hugging Face value from the next sync on"}
                            onClick={() => releaseField(f)}
                            className={`${buttonClass.ghost} !px-2 !py-1 text-xs`}
                          >
                            Use HF value
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          <Card title="Display">
            <label className="flex items-start gap-2.5 text-sm text-soft">
              <input type="checkbox" checked={values.featured} onChange={(e) => set("featured", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
              <span>
                Featured
                <span className="block text-xs text-muted">Shown first in its section</span>
              </span>
            </label>

            <p className="mb-2 mt-5 text-xs font-medium text-soft">Badges</p>
            <div className="flex flex-wrap gap-1.5">
              {BADGES.map((b) => {
                const on = values.badges.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("badges", on ? values.badges.filter((x) => x !== b) : [...values.badges, b as Badge])}
                    className={`rounded-md border px-2 py-1 text-xs transition ${on ? BADGE_META[b].className : "border-line text-muted hover:text-fg"}`}
                  >
                    {BADGE_META[b].label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <Field label="Content date" help="The “updated” date shown on the site" error={errors.contentDate} htmlFor="f-date">
                <input id="f-date" type="date" value={values.contentDate ?? ""} onChange={(e) => set("contentDate", e.target.value || null)} className={inputClass} />
              </Field>
            </div>
          </Card>

          <Card title="Cover image">
            <ImageField
              value={{ id: values.coverMediaId, url: values.coverMediaId ? coverUrl : null }}
              onChange={(m) => {
                set("coverMediaId", m?.id ?? null);
                setCoverUrl(m?.url ?? null);
              }}
            />
            <p className="mt-2 text-xs text-muted">
              {type === "model" || type === "demo" ? "Shown on the card instead of the generated art." : "Stored with the item; this section's cards don't show covers yet."}
            </p>
            {errors.coverMediaId && <p className="mt-1 text-xs text-red-300">{errors.coverMediaId}</p>}
          </Card>

          <Card title="Tags">
            <ChipsInput value={values.tags} onChange={(v) => set("tags", v)} placeholder="Add a tag, press Enter" suggestions={tagSuggestions} invalid={!!errors.tags} />
            <p className="mt-2 text-xs text-muted">Public. New tags are created automatically.</p>
          </Card>

          <Card title="Internal labels">
            {labels.length === 0 ? (
              <p className="text-xs text-muted">No labels yet. Create them under Tags &amp; labels.</p>
            ) : (
              <div className="space-y-2">
                {labels.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={values.labelIds.includes(l.id)}
                      onChange={(e) => set("labelIds", e.target.checked ? [...values.labelIds, l.id] : values.labelIds.filter((x) => x !== l.id))}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    <LabelChip label={l} />
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Only the team sees these.</p>
          </Card>

          {item && (
            <RevisionsPanel
              itemId={item.id}
              version={item.version}
              revisions={revisions}
              current={currentNorm}
              dirty={dirty}
              onRestored={(res) => applyResult(res, "Restored. Saved as a new version.")}
            />
          )}
        </div>
      </div>

      </fieldset>
      {canEdit && (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-stone/95 backdrop-blur lg:left-60">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
          <p className="text-sm text-muted" aria-live="polite">
            {isNew
              ? `New ${itemLabel.toLowerCase()}: saved as a draft`
              : dirty
                ? `${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? "change" : "changes"}`
                : "All changes saved"}
          </p>
          <div className="flex gap-2">
            {!isNew && dirty && (
              <button type="button" onClick={() => { setValues(saved); setErrors({}); setCoverUrl(item?.cover?.url ?? null); }} disabled={pending} className={buttonClass.ghost}>
                Discard
              </button>
            )}
            <button type="submit" disabled={pending || !dirty} className={buttonClass.primary}>
              {pending ? "Saving…" : isNew ? "Create draft" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
      )}
    </form>
  );
}
