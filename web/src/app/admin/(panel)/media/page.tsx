import MediaLibrary from "@/components/admin/MediaLibrary";
import { PageHeader } from "@/components/admin/ui";
import { getMedia } from "@/lib/admin/data";

export const metadata = { title: "Media" };

export default async function MediaPage() {
  const items = await getMedia();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Media"
        description="Images for item covers and the landing page. An image can't be deleted while something uses it."
      />
      <MediaLibrary items={items} />
    </div>
  );
}
