import { notFound } from "next/navigation";
import ItemEditor from "@/components/admin/ItemEditor";
import { BackLink, PageHeader, StatusPill } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { getItem, getLabels, getRevisions, getTags } from "@/lib/admin/data";
import { sectionBySlug } from "@/lib/admin/schema";

async function load(id: string) {
  try {
    return await Promise.all([getItem(id), getRevisions(id), getLabels(), getTags()]);
  } catch (e) {
    // Unknown or malformed id
    if (e instanceof ApiError && (e.status === 404 || e.status === 422)) notFound();
    throw e;
  }
}

export default async function EditItemPage({ params, searchParams }: PageProps<"/admin/[section]/[id]">) {
  const { section: slug, id } = await params;
  const section = sectionBySlug(slug);
  if (!section) notFound();

  const [item, revisions, labels, tags] = await load(id);
  if (item.type !== section.type) notFound();
  const created = (await searchParams).created === "1";

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/${section.slug}`}>{section.label}</BackLink>
      <PageHeader
        eyebrow={section.item}
        title={
          <span className="inline-flex items-center gap-3">
            {item.name}
            <StatusPill status={item.status} />
          </span>
        }
        description={<span className="font-mono text-xs">{item.slug}</span>}
      />
      {created && (
        <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Draft created. Publish it from the Status panel when it&apos;s ready.
        </p>
      )}
      <ItemEditor
        key={item.id}
        type={section.type}
        sectionSlug={section.slug}
        itemLabel={section.item}
        item={item}
        revisions={revisions}
        labels={labels}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}
