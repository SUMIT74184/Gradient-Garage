import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { site } from "@/config/site";
import { adminEnabled } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: { default: `Admin · ${site.name}`, template: `%s · Admin · ${site.name}` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  // No sign-in until Phase 6, so the whole panel only exists in dev mode
  if (!adminEnabled()) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-ink lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-8">{children}</main>
    </div>
  );
}
