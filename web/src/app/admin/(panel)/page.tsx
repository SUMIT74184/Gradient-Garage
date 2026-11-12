import Link from "next/link";
import { Card, LabelChip, PageHeader, buttonClass, formatWhen } from "@/components/admin/ui";
import { TypeIcon } from "@/components/ui";
import TrendChart from "@/components/admin/TrendChart";
import { getActivity, getLabels, getStats, getSummary } from "@/lib/admin/data";
import { ADMIN_SECTIONS, sectionByType } from "@/lib/admin/schema";
import { describe } from "@/lib/admin/activity";
import type { Mover, Stats } from "@/lib/admin/types";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function Kpi({ label, value, delta, hint }: { label: string; value: number; delta?: number | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{compact.format(value)}</p>
      <p className="mt-0.5 text-xs text-muted">
        {delta ? (
          <>
            <span className={delta > 0 ? "text-emerald-300" : "text-red-300"}>
              {delta > 0 ? "▲" : "▼"} {compact.format(Math.abs(delta))}
            </span>{" "}
            in 30 days
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}

function MoverList({ title, items, empty, gain }: { title: string; items: Mover[]; empty: string; gain?: boolean }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 text-sm">
              <span className="w-4 text-right font-mono text-xs text-muted">{i + 1}</span>
              <Link href={`/admin/${sectionByType(m.type).slug}/${m.id}`} className="min-w-0 flex-1 truncate text-fg hover:text-brand-hover">
                {m.name}
              </Link>
              <span className="shrink-0 tabular-nums text-soft">
                {gain ? <span className="text-emerald-300">+{compact.format(m.gain ?? 0)}</span> : compact.format(m.downloads)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function sum(stats: Stats, key: "downloads" | "likes" | "stars") {
  return Object.values(stats.totals).reduce((n, t) => n + t[key], 0);
}

function delta(stats: Stats, key: "downloads" | "likes" | "stars") {
  if (!stats.hasHistory || stats.series.length < 2) return null;
  return stats.series[stats.series.length - 1][key] - stats.series[0][key];
}

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [summary, labels, activity, stats] = await Promise.all([getSummary(), getLabels(), getActivity(12), getStats(30)]);
  const att = stats.attention;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Overview" description="Everything on the site, by section and status." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_SECTIONS.map((s) => {
          const c = summary.counts[s.type];
          return (
            <div key={s.type} className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <Link href={`/admin/${s.slug}`} className="flex items-center gap-2 text-sm font-semibold text-fg hover:text-brand-hover">
                  <TypeIcon type={s.type} className="size-4 text-brand" />
                  {s.label}
                </Link>
                <Link href={`/admin/${s.slug}/new`} className="text-xs text-muted hover:text-brand-hover">
                  + New
                </Link>
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums text-gold-300">{c.published}</div>
              <div className="text-xs text-muted">published</div>
              <div className="mt-4 flex gap-3 border-t border-line pt-3 text-xs">
                <Link href={`/admin/${s.slug}?status=draft`} className="text-soft hover:text-fg">
                  <span className="tabular-nums text-fg">{c.draft}</span> drafts
                </Link>
                <Link href={`/admin/${s.slug}?status=archived`} className="text-soft hover:text-fg">
                  <span className="tabular-nums text-fg">{c.archived}</span> archived
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Downloads (published)" value={sum(stats, "downloads")} delta={delta(stats, "downloads")} hint="Checkpoints + Corpus" />
        <Kpi label="Likes" value={sum(stats, "likes")} delta={delta(stats, "likes")} hint="Across all sections" />
        <Kpi label="Toolkit stars" value={sum(stats, "stars")} delta={delta(stats, "stars")} hint="From GitHub" />
        <Link
          href="/admin/sync"
          className="group rounded-xl border border-line bg-surface p-4 transition hover:border-brand/40"
        >
          <p className="text-xs text-muted">Last sync</p>
          {stats.lastSync ? (
            <>
              <p className={`mt-1 text-sm font-medium capitalize ${stats.lastSync.status === "failed" ? "text-red-300" : "text-fg"}`}>
                {stats.lastSync.status}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatWhen(stats.lastSync.startedAt)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-soft">Never run</p>
          )}
          <p className="mt-2 text-xs text-brand-hover opacity-80 group-hover:opacity-100">Open sync →</p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card title="Downloads, last 30 days">
          {stats.hasHistory ? (
            <TrendChart points={stats.series} />
          ) : (
            <div className="grid h-48 place-items-center rounded-lg border border-dashed border-line text-center text-sm text-muted">
              <p>
                The chart fills in as the sync records daily numbers.
                <br />
                <Link href="/admin/sync" className="text-brand-hover hover:underline">
                  Run a sync
                </Link>{" "}
                to take the first snapshot.
              </p>
            </div>
          )}
        </Card>
        <Card title="Needs attention">
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-soft">Drafts</span>
              <span className="tabular-nums text-fg">{att.drafts}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-soft">New from Hugging Face, unreviewed</span>
              <span className={`tabular-nums ${att.hfImports ? "text-gold-300" : "text-fg"}`}>{att.hfImports}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-soft">Published without a description</span>
              <span className={`tabular-nums ${att.noDescription ? "text-gold-300" : "text-fg"}`}>{att.noDescription}</span>
            </li>
          </ul>
          {att.recentDrafts.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 text-xs font-medium text-soft">Latest drafts</p>
              <ul className="space-y-1 text-sm">
                {att.recentDrafts.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <TypeIcon type={d.type} className="size-3.5 shrink-0 text-muted" />
                    <Link href={`/admin/${sectionByType(d.type).slug}/${d.id}`} className="min-w-0 flex-1 truncate text-fg hover:text-brand-hover">
                      {d.name}
                    </Link>
                    {d.source === "huggingface" && <span className="rounded border border-line px-1 font-mono text-[9px] text-muted">HF</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <MoverList title="Most downloaded" items={stats.top} empty="No published checkpoints or corpus yet." />
        <MoverList
          title="Rising (30-day gain)"
          items={stats.rising}
          gain
          empty={stats.hasHistory ? "No download gains in this window yet." : "Needs at least two syncs on different days."}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card title="Recent activity">
          {activity.items.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {activity.items.map((e) => {
                const d = describe(e);
                return (
                  <li key={e.id} className="flex items-start justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-soft">
                        <span className="text-muted">{e.actorEmail}</span> {d.verb}{" "}
                        {d.href ? (
                          <Link href={d.href} className="font-medium text-fg hover:text-brand-hover">
                            {d.target}
                          </Link>
                        ) : (
                          <span className="font-medium text-fg">{d.target}</span>
                        )}
                        {d.section && e.action !== "reorder" && <span className="text-muted"> · {d.section.item}</span>}
                      </p>
                      {d.fields.length > 0 && (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{d.fields.join(", ")}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-xs text-muted" dateTime={e.createdAt}>
                      {formatWhen(e.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card title="Internal labels" action={<Link href="/admin/tags" className="text-xs text-muted hover:text-brand-hover">Manage</Link>}>
          {labels.length === 0 ? (
            <p className="text-sm text-muted">No labels yet.</p>
          ) : (
            <ul className="space-y-2">
              {labels.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3">
                  <LabelChip label={l} />
                  <span className="text-xs tabular-nums text-muted">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Only the team sees these. Filter any section by a label to find work.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ADMIN_SECTIONS.map((s) => (
              <Link key={s.type} href={`/admin/${s.slug}/new`} className={buttonClass.secondary + " !px-2.5 !py-1.5 text-xs"}>
                + {s.item}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
