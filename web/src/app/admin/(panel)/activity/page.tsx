import Link from "next/link";
import { PageHeader, buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import { actionLabel, describe, entityTypeLabel, preview } from "@/lib/admin/activity";
import { getAudit, getAuditFacets } from "@/lib/admin/data";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const sp = await searchParams;
  const filters = {
    q: one(sp.q),
    action: one(sp.action),
    entityType: one(sp.type),
    actor: one(sp.actor),
    since: isDay(one(sp.since)),
    until: isDay(one(sp.until)),
  };
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [log, facets] = await Promise.all([getAudit({ ...filters, page, pageSize: PAGE_SIZE }), getAuditFacets()]);
  const pages = Math.max(1, Math.ceil(log.total / PAGE_SIZE));
  const filtered = Object.values(filters).some(Boolean);

  const link = (p: number) => {
    const q = new URLSearchParams();
    const names = { q: "q", action: "action", entityType: "type", actor: "actor", since: "since", until: "until" } as const;
    for (const [k, name] of Object.entries(names)) {
      const v = filters[k as keyof typeof filters];
      if (v) q.set(name, v);
    }
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/activity?${s}` : "/admin/activity";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organise"
        title="Activity"
        description={`Every change in the admin panel: who, what and when. ${log.total} ${log.total === 1 ? "entry" : "entries"}${filtered ? " match" : ""}.`}
      />

      <form action="/admin/activity" className="grid gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto_auto]">
        <input name="q" defaultValue={filters.q} placeholder="Search item name…" aria-label="Search item name" className={inputClass} />
        <select name="action" defaultValue={filters.action ?? ""} aria-label="Action" className={`${inputClass} cursor-pointer`}>
          <option value="">Any action</option>
          {facets.actions.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={filters.entityType ?? ""} aria-label="Area" className={`${inputClass} cursor-pointer`}>
          <option value="">Anything</option>
          {facets.entityTypes.map((t) => (
            <option key={t} value={t}>
              {entityTypeLabel(t)}
            </option>
          ))}
        </select>
        <select name="actor" defaultValue={filters.actor ?? ""} aria-label="Person" className={`${inputClass} cursor-pointer`}>
          <option value="">Anyone</option>
          {facets.actors.map((a) => (
            <option key={a} value={a}>
              {a === "system@localhost" ? "System (scheduled / scripts)" : a}
            </option>
          ))}
        </select>
        <input type="date" name="since" defaultValue={filters.since} aria-label="From" className={`${inputClass} [color-scheme:dark]`} />
        <input type="date" name="until" defaultValue={filters.until} aria-label="To" className={`${inputClass} [color-scheme:dark]`} />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass.secondary}>
            Filter
          </button>
          {filtered && (
            <Link href="/admin/activity" className={buttonClass.ghost}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {log.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
          {filtered ? "Nothing matches these filters." : "No activity yet."}
        </p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {log.items.map((e) => {
            const d = describe(e);
            const diffs = d.fields.length ? Object.entries(e.changes) : [];
            return (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 text-soft">
                    <span className="text-muted">{e.actorEmail === "system@localhost" ? "System" : e.actorEmail}</span> {d.verb}{" "}
                    {d.target &&
                      (d.href ? (
                        <Link href={d.href} className="font-medium text-fg hover:text-brand-hover">
                          {d.target}
                        </Link>
                      ) : (
                        <span className="font-medium text-fg">{d.target}</span>
                      ))}
                    {d.section && !["reorder", "import.csv"].includes(e.action) && <span className="text-muted"> · {d.section.item}</span>}
                    {d.detail && (
                      <span className="text-muted">
                        {" "}
                        ·{" "}
                        {d.href && e.action === "sync.run" ? (
                          <Link href={d.href} className="hover:text-fg">
                            {d.detail}
                          </Link>
                        ) : (
                          d.detail
                        )}
                      </span>
                    )}
                  </p>
                  <time className="shrink-0 text-xs text-muted" dateTime={e.createdAt}>
                    {formatWhen(e.createdAt)}
                  </time>
                </div>
                {diffs.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer font-mono text-[11px] text-muted hover:text-soft">{d.fields.join(", ")}</summary>
                    <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-lg border border-line bg-ink/40 p-3 text-xs sm:grid-cols-[10rem_1fr]">
                      {diffs.map(([field, change]) => {
                        const [before, after] = Array.isArray(change) ? change : [undefined, change];
                        return (
                          <div key={field} className="contents">
                            <dt className="font-mono text-muted">{field}</dt>
                            <dd className="min-w-0 break-words">
                              <span className="text-red-300/80 line-through decoration-red-300/40">{preview(before)}</span>
                              <span className="mx-1.5 text-muted">→</span>
                              <span className="text-emerald-300">{preview(after)}</span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={link(page - 1)} className={buttonClass.secondary}>
                ← Newer
              </Link>
            )}
            {page < pages && (
              <Link href={link(page + 1)} className={buttonClass.secondary}>
                Older →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
