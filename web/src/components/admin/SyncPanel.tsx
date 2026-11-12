"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runSync, saveSiteDoc } from "@/app/admin/actions";
import { useCan } from "@/components/admin/AdminUser";
import { Card, buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import { sectionByType } from "@/lib/admin/schema";
import type { ItemRef, SyncRun, SyncSettings, SyncStatus } from "@/lib/admin/types";

const TOGGLES: { key: keyof Omit<SyncSettings, "hfAuthors">; label: string; help: string }[] = [
  { key: "importModels", label: "Checkpoints", help: "Models on Hugging Face" },
  { key: "importDatasets", label: "Corpus", help: "Datasets on Hugging Face" },
  { key: "importDemos", label: "Playground", help: "Spaces on Hugging Face" },
  { key: "refreshLibraries", label: "Toolkit stats", help: "GitHub stars, PyPI / npm versions" },
];

function duration(run: SyncRun) {
  if (!run.finishedAt) return "";
  const s = Math.max(0, (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000);
  return s < 1 ? "<1s" : `${Math.round(s)}s`;
}

function RefList({ title, items, extra }: { title: string; items: (ItemRef & { fields?: string[] })[]; extra?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-soft">
        {title} <span className="text-muted">({items.length})</span>
      </p>
      <ul className="space-y-0.5 text-xs">
        {items.slice(0, 12).map((i) => {
          const section = sectionByType(i.type);
          return (
            <li key={i.id} className="flex flex-wrap gap-x-2">
              <Link href={`/admin/${section.slug}/${i.id}`} className="text-fg hover:text-brand-hover">
                {i.name}
              </Link>
              <span className="font-mono text-muted">{i.slug}</span>
              {i.fields && <span className="font-mono text-muted">· {i.fields.join(", ")}</span>}
            </li>
          );
        })}
        {items.length > 12 && <li className="text-muted">…and {items.length - 12} more</li>}
      </ul>
      {extra && <p className="mt-1 text-[11px] text-muted">{extra}</p>}
    </div>
  );
}

function RunCard({ run, open }: { run: SyncRun; open: boolean }) {
  const r = run.report;
  const tone =
    run.status === "succeeded" ? "text-emerald-300" : run.status === "failed" ? "text-red-300" : "text-gold-300";
  return (
    <details open={open} className="group rounded-lg border border-line bg-ink/40">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
        <span className={`font-medium capitalize ${tone}`}>{run.status}</span>
        <time className="text-xs text-muted" dateTime={run.startedAt}>
          {formatWhen(run.startedAt)}
        </time>
        <span className="text-xs text-muted">
          {run.trigger === "schedule" ? "scheduled" : run.actorEmail} {duration(run) && `· ${duration(run)}`}
        </span>
        {run.status === "succeeded" && (
          <span className="ml-auto text-xs text-soft">
            {r.created?.length ?? 0} imported · {r.updated?.length ?? 0} updated · {r.refreshed ?? 0} refreshed
            {!!r.errors?.length && <span className="text-red-300"> · {r.errors.length} errors</span>}
          </span>
        )}
      </summary>
      <div className="space-y-3 border-t border-line px-3 py-3">
        {run.error && <p className="text-sm text-red-300">{run.error}</p>}
        <RefList title="Imported as drafts" items={r.created ?? []} />
        <RefList title="Synced fields updated" items={r.updated ?? []} />
        <RefList
          title="Gone from Hugging Face"
          items={r.missing ?? []}
          extra="Still here (nothing is deleted automatically). Archive them if they were removed on purpose."
        />
        {!!r.errors?.length && (
          <div>
            <p className="mb-1 text-xs font-medium text-red-300">Errors</p>
            <ul className="space-y-0.5 font-mono text-[11px] text-red-200/80">
              {r.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {run.status === "succeeded" && (
          <p className="text-xs text-muted">
            {r.unchanged ?? 0} unchanged · {r.libraries ?? 0} Toolkit items refreshed
            {r.authors?.length ? ` · accounts: ${r.authors.join(", ")}` : ""}
          </p>
        )}
      </div>
    </details>
  );
}

export default function SyncPanel({ status, settingsVersion }: { status: SyncStatus; settingsVersion: number }) {
  const router = useRouter();
  const isOwner = useCan("owner");
  const canRun = useCan("editor");
  const [settings, setSettings] = useState<SyncSettings>(status.settings);
  const [authorsText, setAuthorsText] = useState(status.settings.hfAuthors.join(", "));
  const [version, setVersion] = useState(settingsVersion);
  const [pending, start] = useTransition();
  const [running, startRun] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [runError, setRunError] = useState("");
  const [latest, setLatest] = useState<string | null>(null);

  const authors = authorsText.split(/[\s,]+/).map((a) => a.trim()).filter(Boolean);
  const dirty =
    authors.join(",") !== status.settings.hfAuthors.join(",") ||
    TOGGLES.some((t) => settings[t.key] !== status.settings[t.key]) ||
    !status.saved;

  const save = () =>
    start(async () => {
      setMessage(null);
      const value = { ...settings, hfAuthors: authors };
      const res = await saveSiteDoc("sync", version, value);
      if (!res.ok) {
        setMessage({
          tone: "error",
          text: res.status === 409 ? "Someone else changed the settings; reload the page." : res.fieldErrors?.hfAuthors ?? res.error,
        });
        return;
      }
      setVersion(res.data.version);
      setSettings(value);
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    });

  const sync = () =>
    startRun(async () => {
      setRunError("");
      const res = await runSync();
      if (!res.ok) return setRunError(res.error);
      setLatest(res.data.id);
    });

  const noAccounts = status.settings.hfAuthors.length === 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card
          title="Run"
          action={
            canRun && (
              <button type="button" onClick={sync} disabled={running} className={buttonClass.primary}>
                {running ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-brand-fg/30 border-t-brand-fg" aria-hidden="true" />
                    Syncing…
                  </>
                ) : (
                  "Sync now"
                )}
              </button>
            )
          }
        >
          {noAccounts && !status.settings.refreshLibraries ? (
            <p className="text-sm text-muted">Nothing to sync yet. Add a Hugging Face account in the settings.</p>
          ) : (
            <p className="text-sm text-soft">
              {noAccounts
                ? "No Hugging Face account set, so only Toolkit stats will refresh."
                : `Pulls from ${status.settings.hfAuthors.join(", ")}. New items arrive as drafts; nothing goes live until someone publishes it.`}
            </p>
          )}
          {runError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {runError}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            To sync on a schedule, run <code className="text-soft">python -m scripts.sync --quiet</code> from the <code className="text-soft">api</code> folder with cron
            or a systemd timer, e.g. once a day. Scheduled runs show up below.
          </p>
        </Card>

        <section aria-label="Recent runs" className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Recent runs</h2>
          {status.runs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">No runs yet.</p>
          ) : (
            status.runs.map((run, i) => <RunCard key={run.id} run={run} open={run.id === latest || (i === 0 && !latest && !!run.report.created?.length)} />)
          )}
        </section>
      </div>

      <div className="space-y-6">
        <Card title="Settings">
          <fieldset disabled={!isOwner || pending} className="space-y-4">
            {!isOwner && <p className="text-xs text-muted">Only an Owner can change these.</p>}
            <div>
              <label htmlFor="hf-authors" className="text-xs font-medium text-soft">
                Hugging Face accounts
              </label>
              <input
                id="hf-authors"
                value={authorsText}
                onChange={(e) => setAuthorsText(e.target.value)}
                placeholder="your-username, your-org"
                className={`${inputClass} mt-1.5 font-mono`}
              />
              <p className="mt-1 text-[11px] text-muted">Users or organisations, comma-separated (max 10).</p>
            </div>
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-soft">What to sync</p>
              {TOGGLES.map((t) => (
                <label key={t.key} className="flex items-start gap-2.5 text-sm text-soft">
                  <input
                    type="checkbox"
                    checked={settings[t.key]}
                    onChange={(e) => setSettings((s) => ({ ...s, [t.key]: e.target.checked }))}
                    className="mt-0.5 size-4 accent-[var(--color-brand)]"
                  />
                  <span>
                    {t.label}
                    <span className="block text-xs text-muted">{t.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {isOwner && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={!dirty || pending} className={buttonClass.secondary}>
                  {pending ? "Saving…" : "Save settings"}
                </button>
                {message && <span className={`text-xs ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</span>}
              </div>
            )}
            {!status.saved && (
              <p className="text-[11px] text-muted">Not saved yet: using HF_USERNAME from the API&apos;s environment.</p>
            )}
          </fieldset>
        </Card>

        <Card title="How it decides">
          <ul className="space-y-2 text-xs leading-relaxed text-soft">
            <li>
              <span className="text-fg">Your edits win.</span> Once you edit a field on a synced item, the sync leaves it alone. The editor shows these fields and
              lets you hand them back.
            </li>
            <li>
              <span className="text-fg">Stats always refresh</span> (downloads, likes, stars, versions), on items you added by hand too, without counting as an edit.
            </li>
            <li>
              <span className="text-fg">Nothing is deleted.</span> Items that disappear from Hugging Face are listed so you can archive them.
            </li>
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-muted">
            Tokens (set on the API server): Hugging Face {status.tokens.huggingface ? "✓" : "not set"} · GitHub {status.tokens.github ? "✓" : "not set"}. Optional;
            they raise rate limits.
          </p>
        </Card>
      </div>
    </div>
  );
}
