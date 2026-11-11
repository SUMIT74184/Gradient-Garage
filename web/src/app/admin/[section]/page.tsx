import Link from "next/link";
import { notFound } from "next/navigation";
import ItemsTable from "@/components/admin/ItemsTable";
import ListFilters from "@/components/admin/ListFilters";
import { PageHeader, buttonClass } from "@/components/admin/ui";
import { getLabels, getTags, listItems } from "@/lib/admin/data";
import { sectionBySlug } from "@/lib/admin/schema";

const TABS = [
  { id: "active", label: "Active", status: ["draft", "published"] },
  { id: "draft", label: "Drafts", status: ["draft"] },
  { id: "published", label: "Published", status: ["published"] },
  { id: "archived", label: "Archived", status: ["archived"] },
  { id: "all", label: "All", status: [] },
] as const;

const PAGE_SIZE = 25;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function SectionPage({ params, searchParams }: PageProps<"/admin/[section]">) {
  const { section: slug } = await params;
  const section = sectionBySlug(slug);
  if (!section) notFound();

  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === one(sp.status)) ?? TABS[0];
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const filters = {
    q: one(sp.q),
    tag: one(sp.tag),
    label: one(sp.label),
    badge: one(sp.badge),
    featured: one(sp.featured),
    sort: one(sp.sort) ?? "-updated",
  };

  const [list, tags, labels] = await Promise.all([
    listItems({ type: section.type, status: [...tab.status], page, pageSize: PAGE_SIZE, ...filters }),
    getTags(),
    getLabels(),
  ]);

  const base = `/admin/${section.slug}`;
  const query = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: tab.id === "active" ? undefined : tab.id, ...filters, ...over })) {
      if (v && !(k === "sort" && v === "-updated")) p.set(k, v);
    }
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title={section.label}
        description={`${list.total} ${list.total === 1 ? "item" : "items"} ${tab.id === "all" ? "in total" : `in ${tab.label.toLowerCase()}`}`}
        actions={
          <>
            <Link href={`${base}/order`} className={buttonClass.secondary}>
              Featured &amp; order
            </Link>
            <Link href={`${base}/new`} className={buttonClass.primary}>
              + New {section.item.toLowerCase()}
            </Link>
          </>
        }
      />

      <nav aria-label="Status" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={query({ status: t.id === "active" ? undefined : t.id, page: undefined })}
            aria-current={t.id === tab.id ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
              t.id === tab.id ? "border-brand font-medium text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <ListFilters
        key={JSON.stringify([tab.id, filters])}
        action={base}
        status={tab.id === "active" ? undefined : tab.id}
        values={filters}
        tags={tags.filter((t) => t.count > 0)}
        labels={labels}
      />

      <ItemsTable items={list.items} sectionSlug={section.slug} emptyText={emptyText(tab.id, !!(filters.q || filters.tag || filters.label || filters.badge || filters.featured))} />

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={query({ page: String(page - 1) })} className={buttonClass.secondary}>
                ← Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={query({ page: String(page + 1) })} className={buttonClass.secondary}>
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </div>
  );
}

function emptyText(tab: string, filtered: boolean) {
  if (filtered) return "Nothing matches these filters.";
  if (tab === "archived") return "Nothing archived. Archived items are hidden from the site and can be restored.";
  if (tab === "draft") return "No drafts. New items start as drafts until you publish them.";
  return "Nothing here yet.";
}
