import TaxonomyManager from "@/components/admin/TaxonomyManager";
import { PageHeader } from "@/components/admin/ui";
import { getLabels, getTags } from "@/lib/admin/data";

export const metadata = { title: "Tags & labels" };

export default async function TagsPage() {
  const [tags, labels] = await Promise.all([getTags(), getLabels()]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Organise" title="Tags & labels" description="Public tags power the site's filters. Internal labels are for the team only." />
      <TaxonomyManager tags={tags} labels={labels} />
    </div>
  );
}
