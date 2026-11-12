import SyncPanel from "@/components/admin/SyncPanel";
import { PageHeader } from "@/components/admin/ui";
import { getSiteAdmin, getSyncStatus } from "@/lib/admin/data";

export const metadata = { title: "Sync" };

export default async function SyncPage() {
  const [status, site] = await Promise.all([getSyncStatus(), getSiteAdmin()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organise"
        title="Hugging Face sync"
        description="Imports your Hugging Face checkpoints, corpus and playground apps as drafts, keeps synced fields up to date, and refreshes downloads, likes and Toolkit stars."
      />
      <SyncPanel status={status} settingsVersion={site.values.sync?.version ?? 0} />
    </div>
  );
}
