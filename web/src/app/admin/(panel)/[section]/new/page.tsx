import { notFound } from "next/navigation";
import ItemEditor from "@/components/admin/ItemEditor";
import { BackLink, PageHeader } from "@/components/admin/ui";
import { getLabels, getTags } from "@/lib/admin/data";
import { sectionBySlug } from "@/lib/admin/schema";

export default async function NewItemPage({ params }: PageProps<"/admin/[section]/new">) {
  const section = sectionBySlug((await params).section);
  if (!section) notFound();
  const [labels, tags] = await Promise.all([getLabels(), getTags()]);

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/${section.slug}`}>{section.label}</BackLink>
      <PageHeader
        eyebrow={section.label}
        title={`New ${section.item.toLowerCase()}`}
        description="It starts as a draft. Nothing shows on the site until you publish it."
      />
      <ItemEditor
        type={section.type}
        sectionSlug={section.slug}
        itemLabel={section.item}
        labels={labels}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}
