"use client";

import { useEffect, useState, useTransition } from "react";
import { getSiteRevisions, restoreSiteDoc, saveSiteDoc } from "@/app/admin/actions";
import { useCan } from "@/components/admin/AdminUser";
import { ImageField } from "@/components/admin/MediaPicker";
import { ChipsInput, Field } from "@/components/admin/fields";
import { buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import { EMPTY_SCENE, type Block, type Desc } from "@/lib/admin/siteSchema";
import type { SiteDoc, SiteRevision } from "@/lib/admin/types";
import type { Scene } from "@/lib/content/defaults";

type Value = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function SceneEditor({ scene, onChange }: { scene: Scene; onChange: (s: Scene) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
      <ImageField
        value={{ url: scene.src || null, alt: scene.title }}
        allowRemove={false}
        onChange={(m) => m && onChange({ ...scene, src: m.url, title: scene.title || m.alt })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={scene.title} onChange={(e) => onChange({ ...scene, title: e.target.value })} placeholder="Title (shown in the credit chip)" aria-label="Title" className={inputClass} />
        <input value={scene.credit} onChange={(e) => onChange({ ...scene, credit: e.target.value })} placeholder="Photo credit, e.g. Jane Doe, CC BY 2.0" aria-label="Credit" className={inputClass} />
        <input
          value={scene.href}
          onChange={(e) => onChange({ ...scene, href: e.target.value })}
          placeholder="Source link (https://…)"
          aria-label="Source link"
          className={`${inputClass} font-mono text-xs sm:col-span-2`}
        />
      </div>
    </div>
  );
}

function move<T>(list: T[], i: number, d: number) {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
}

function FieldControl({ desc, value, onChange, errors, path }: { desc: Desc; value: unknown; onChange: (v: unknown) => void; errors: Record<string, string>; path: string }) {
  const id = `sd-${path}`;
  const err = errors[path];
  switch (desc.kind) {
    case "text":
      return (
        <Field label={desc.label} help={desc.help} error={err} htmlFor={id}>
          <input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={desc.required} className={`${inputClass} ${desc.mono ? "font-mono text-xs" : ""}`} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={desc.label} help={desc.help} error={err} htmlFor={id} wide>
          <textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={desc.rows ?? 3} className={inputClass} />
        </Field>
      );
    case "strings":
      return (
        <Field label={desc.label} help={desc.help} error={err} htmlFor={id} wide>
          <ChipsInput id={id} value={(value as string[]) ?? []} onChange={onChange} placeholder="Type and press Enter" />
        </Field>
      );
    case "image":
      return (
        <Field label={desc.label} help={desc.help} error={err} wide>
          <SceneEditor scene={(value as Scene) ?? EMPTY_SCENE} onChange={onChange} />
        </Field>
      );
    case "scenes": {
      const list = (value as Scene[]) ?? [];
      return (
        <Field label={desc.label} help={desc.help} error={err} wide>
          <ol className="space-y-3">
            {list.map((s, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>Scene {i + 1}</span>
                  <span className="flex gap-0.5">
                    <button type="button" disabled={i === 0} onClick={() => onChange(move(list, i, -1))} aria-label="Move up" className={buttonClass.ghost}>↑</button>
                    <button type="button" disabled={i === list.length - 1} onClick={() => onChange(move(list, i, 1))} aria-label="Move down" className={buttonClass.ghost}>↓</button>
                    <button type="button" disabled={list.length <= 1} onClick={() => onChange(list.filter((_, j) => j !== i))} className={`${buttonClass.ghost} hover:!text-red-300`}>Remove</button>
                  </span>
                </div>
                <SceneEditor scene={s} onChange={(ns) => onChange(list.map((x, j) => (j === i ? ns : x)))} />
              </li>
            ))}
          </ol>
          {list.length < desc.max && (
            <button type="button" onClick={() => onChange([...list, { ...EMPTY_SCENE }])} className={`${buttonClass.secondary} mt-3`}>
              + Add scene
            </button>
          )}
        </Field>
      );
    }
    case "group": {
      const v = (value as Value) ?? {};
      return (
        <fieldset className="rounded-lg border border-line p-3 sm:col-span-2">
          <legend className="px-1 text-xs font-medium text-soft">{desc.label}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {desc.fields.map((f) => (
              <FieldControl key={f.key} desc={f} value={v[f.key]} onChange={(nv) => onChange({ ...v, [f.key]: nv })} errors={errors} path={`${path}.${f.key}`} />
            ))}
          </div>
        </fieldset>
      );
    }
    case "repeat": {
      const list = (value as Value[]) ?? [];
      return (
        <div className="space-y-3 sm:col-span-2">
          {err && <p className="text-xs text-red-300">{err}</p>}
          {list.map((item, i) => (
            <fieldset key={i} className="rounded-lg border border-line p-3">
              <legend className="flex items-center gap-2 px-1 text-xs font-medium text-soft">
                {desc.itemLabel} {i + 1}
              </legend>
              {!desc.fixed && (
                <div className="-mt-1 mb-2 flex justify-end gap-0.5">
                  <button type="button" disabled={i === 0} onClick={() => onChange(move(list, i, -1))} aria-label="Move up" className={buttonClass.ghost}>↑</button>
                  <button type="button" disabled={i === list.length - 1} onClick={() => onChange(move(list, i, 1))} aria-label="Move down" className={buttonClass.ghost}>↓</button>
                  <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={`${buttonClass.ghost} hover:!text-red-300`}>Remove</button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {desc.fields.map((f) => (
                  <FieldControl
                    key={f.key}
                    desc={f}
                    value={item[f.key]}
                    onChange={(nv) => onChange(list.map((x, j) => (j === i ? { ...x, [f.key]: nv } : x)))}
                    errors={errors}
                    path={`${path}.${i}.${f.key}`}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          {!desc.fixed && (desc.max === undefined || list.length < desc.max) && (
            <button type="button" onClick={() => onChange([...list, { ...desc.blank }])} className={buttonClass.secondary}>
              + Add {desc.itemLabel.toLowerCase()}
            </button>
          )}
        </div>
      );
    }
  }
}

export default function SiteDocEditor({ block, doc }: { block: Block; doc?: SiteDoc }) {
  // Site identity and section names are Owner-only; landing copy is for Editors too
  const canEdit = useCan(block.key === "site" || block.key === "sections" ? "owner" : "editor");
  // Saved values over defaults, so fields added later still show up
  const initial = { ...block.defaultValue, ...((doc?.value as Value) ?? {}) };
  const [saved, setSaved] = useState<{ value: Value; version: number; updatedAt?: string }>({ value: initial, version: doc?.version ?? 0, updatedAt: doc?.updatedAt });
  const [value, setValue] = useState<Value>(initial);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<SiteRevision[] | null>(null);
  const [pending, start] = useTransition();

  const dirty = !same(value, saved.value);
  const isDefault = same(saved.value, block.defaultValue);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const persist = (next: Value, okText: string) =>
    start(async () => {
      setBanner(null);
      const res = await saveSiteDoc(block.key, saved.version, next);
      if (res.ok) {
        setSaved({ value: res.data.value, version: res.data.version, updatedAt: res.data.updatedAt });
        setValue(res.data.value);
        setErrors({});
        setHistory(null);
        setBanner({ ok: true, text: okText });
      } else {
        setErrors(res.fieldErrors ?? {});
        setBanner({
          ok: false,
          text: res.status === 409 ? "Someone else saved this block since you opened the page. Reload to get their version." : res.fieldErrors ? `${res.error} ${Object.entries(res.fieldErrors).map(([k, v]) => `${k}: ${v}`).join("; ")}` : res.error,
        });
      }
    });

  const loadHistory = () =>
    start(async () => {
      const res = await getSiteRevisions(block.key);
      if (res.ok) setHistory(res.data);
      else setBanner({ ok: false, text: res.error });
    });

  const restore = (v: number) =>
    start(async () => {
      const res = await restoreSiteDoc(block.key, v, saved.version);
      if (res.ok) {
        setSaved({ value: res.data.value, version: res.data.version, updatedAt: res.data.updatedAt });
        setValue(res.data.value);
        setHistory(null);
        setBanner({ ok: true, text: `Restored v${v}. It's live.` });
      } else setBanner({ ok: false, text: res.error });
    });

  return (
    <section id={block.key} className="scroll-mt-6 rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">{block.title}</h2>
          {block.description && <p className="mt-0.5 text-xs text-muted">{block.description}</p>}
        </div>
        <p className="text-[11px] text-muted">
          {saved.version === 0 ? "Using the built-in copy" : `v${saved.version} · ${formatWhen(saved.updatedAt)}`}
          {isDefault && saved.version > 0 && " · same as built-in"}
        </p>
      </header>

      <fieldset disabled={!canEdit} className="grid gap-4 p-4 sm:grid-cols-2">
        {block.fields.map((f) => (
          <FieldControl key={f.key} desc={f} value={value[f.key]} onChange={(nv) => setValue((p) => ({ ...p, [f.key]: nv }))} errors={errors} path={f.key} />
        ))}
      </fieldset>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <>
              <button type="button" onClick={() => persist(value, "Saved. It's live on the site.")} disabled={!dirty || pending} className={buttonClass.primary}>
                {pending ? "Saving…" : "Save"}
              </button>
              {dirty && (
                <button type="button" onClick={() => setValue(saved.value)} className={buttonClass.ghost}>
                  Discard
                </button>
              )}
              {!isDefault && !dirty && (
                <button type="button" onClick={() => persist(block.defaultValue, "Reset to the built-in copy.")} disabled={pending} className={buttonClass.ghost}>
                  Reset to built-in
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-muted">{block.key.startsWith("landing.") ? "Viewers can’t change this." : "Only an Owner can change this."}</span>
          )}
          {banner && <span className={`text-sm ${banner.ok ? "text-emerald-300" : "text-red-300"}`}>{banner.text}</span>}
        </div>
        {saved.version > 0 && (
          <button type="button" onClick={() => (history ? setHistory(null) : loadHistory())} className={`${buttonClass.ghost} text-xs`}>
            {history ? "Hide history" : "History"}
          </button>
        )}
      </footer>

      {history && (
        <ol className="space-y-1.5 border-t border-line px-4 py-3 text-xs">
          {history.map((r, i) => (
            <li key={r.version} className="flex items-center justify-between gap-3">
              <span className="text-soft">
                <span className="font-mono text-fg">v{r.version}</span> {r.note && `· ${r.note} `}· {r.createdBy ?? "unknown"} · {formatWhen(r.createdAt)}
              </span>
              {i > 0 && canEdit && (
                <button type="button" disabled={pending || dirty} onClick={() => restore(r.version)} className={`${buttonClass.ghost} !py-1 text-xs`}>
                  Restore
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
