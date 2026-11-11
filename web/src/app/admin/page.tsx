import Link from "next/link";
import { Card, LabelChip, PageHeader, buttonClass, formatWhen } from "@/components/admin/ui";
import { TypeIcon } from "@/components/ui";
import { getActivity, getLabels, getSummary } from "@/lib/admin/data";
import { ADMIN_SECTIONS, sectionByType } from "@/lib/admin/schema";
import type { AuditEntry, ContentType } from "@/lib/admin/types";

export const metadata = { title: "Overview" };

const ACTION_VERB: Record<string, string> = {
  create: "created",
  update: "edited",
  publish: "published",
  unpublish: "unpublished",
  archive: "archived",
  restore: "restored",
  delete: "deleted",
  reorder: "reordered",
};

function describe(e: AuditEntry) {
  const verb = ACTION_VERB[e.action] ?? e.action.replace(".", " ");
  const isContent = ["model", "dataset", "demo", "library"].includes(e.entityType);
  const section = isContent ? sectionByType(e.entityType as ContentType) : null;
  const target = e.action === "reorder" ? `${section?.label ?? e.entityType} order` : e.entityLabel || e.entityType;
  const href = isContent && e.entityId && e.action !== "delete" ? `/admin/${section!.slug}/${e.entityId}` : null;
  const fields = e.action === "update" ? Object.keys(e.changes) : [];
  return { verb, target, href, fields, section };
}

export default async function OverviewPage() {
  const [summary, labels, activity] = await Promise.all([getSummary(), getLabels(), getActivity(12)]);

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
