import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `Admin · ${site.name}`, template: `%s · Admin · ${site.name}` },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-screen bg-ink">{children}</div>;
}
