import SiteDocEditor from "@/components/admin/SiteDocEditor";
import { PageHeader } from "@/components/admin/ui";
import { getSiteAdmin } from "@/lib/admin/data";
import { SITE_BLOCKS } from "@/lib/admin/siteSchema";

export const metadata = { title: "Site settings" };

export default async function SiteSettingsPage() {
  const { values } = await getSiteAdmin();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Site" title="Site settings" description="Each block saves on its own and goes live right away. Every save is kept in its history." />
      {SITE_BLOCKS.map((b) => (
        <SiteDocEditor key={b.key} block={b} doc={values[b.key]} />
      ))}
    </div>
  );
}
