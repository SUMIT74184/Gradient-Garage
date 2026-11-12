import { notFound, redirect } from "next/navigation";
import ImportWizard from "@/components/admin/ImportWizard";
import { BackLink, Card, PageHeader } from "@/components/admin/ui";
import { adminApi, can, requireUser } from "@/lib/auth";
import { sectionBySlug } from "@/lib/admin/schema";

export default async function ImportPage({ params }: PageProps<"/admin/[section]/import">) {
  const section = sectionBySlug((await params).section);
  if (!section) notFound();
  const user = await requireUser();
  if (!can(user, "editor")) redirect(`/admin/${section.slug}`);
  const { columns, listSeparator } = await adminApi<{ columns: string[]; readOnly: string[]; listSeparator: string }>(
    `/admin/import/columns?type=${section.type}`,
  );

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/${section.slug}`}>{section.label}</BackLink>
      <PageHeader
        eyebrow={section.label}
        title="Import from CSV"
        description="Rows are matched on slug: known slugs are updated, new ones become drafts. You'll see a preview before anything changes."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <ImportWizard type={section.type} sectionSlug={section.slug} />
        <Card title="File format">
          <ul className="space-y-2 text-xs leading-relaxed text-soft">
            <li>
              Easiest start:{" "}
              <a href={`/admin/export/${section.slug}`} className="text-brand-hover underline-offset-2 hover:underline" download>
                export this section
              </a>
              , edit it in a spreadsheet, and import it back.
            </li>
            <li>Only the columns in your file are changed. A file with just <code className="text-fg">slug</code> and <code className="text-fg">description</code> edits descriptions only.</li>
            <li>An empty cell clears that field.</li>
            <li>
              Lists are separated with <code className="text-fg">{listSeparator}</code>. Internal labels go in{" "}
              <code className="text-fg">labels</code> by name.
            </li>
            <li>
              <code className="text-fg">status</code>, <code className="text-fg">source</code> and <code className="text-fg">updatedAt</code> are ignored. Publish new drafts from the list afterwards.
            </li>
            <li>If any row has an error, nothing is imported.</li>
          </ul>
          <p className="mb-1.5 mt-4 text-xs font-medium text-soft">Columns</p>
          <p className="break-words font-mono text-[11px] leading-relaxed text-muted">{columns.join(", ")}</p>
        </Card>
      </div>
    </div>
  );
}
