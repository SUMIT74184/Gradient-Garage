import { notFound } from "next/navigation";
import OrderBoard from "@/components/admin/OrderBoard";
import { BackLink, PageHeader } from "@/components/admin/ui";
import { listItems } from "@/lib/admin/data";
import { sectionBySlug } from "@/lib/admin/schema";

export default async function OrderPage({ params }: PageProps<"/admin/[section]/order">) {
  const section = sectionBySlug((await params).section);
  if (!section) notFound();
  const { items } = await listItems({ type: section.type, status: ["draft", "published"], sort: "order", pageSize: 200 });

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/${section.slug}`}>{section.label}</BackLink>
      <PageHeader
        eyebrow={section.label}
        title="Featured & order"
        description="On the site, featured items (★) come first, then pinned items in this order, then everything else by popularity. Mark an item featured from its edit page."
      />
      <OrderBoard type={section.type} sectionSlug={section.slug} items={items} />
    </div>
  );
}
