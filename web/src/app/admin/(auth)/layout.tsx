import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Navbar";
import { site } from "@/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,rgb(240_122_42/0.12),transparent_70%)] px-4 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
        <Logo size={34} />
        <span className="display text-lg text-fg">{site.name}</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl md:p-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-fg/5" />}>{children}</Suspense>
      </div>
      <p className="mt-6 text-xs text-muted">Team sign-in. Accounts are invite-only.</p>
    </div>
  );
}
