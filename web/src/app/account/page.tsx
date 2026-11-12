import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SavedAndRecent, VerifyBanner, type LibraryEntry } from "@/components/AccountLibrary";
import AccountSettings from "@/components/admin/AccountSettings";
import DeleteAccount from "@/components/DeleteAccount";
import Footer from "@/components/Footer";
import { MemberProvider } from "@/components/MemberProvider";
import Navbar from "@/components/Navbar";
import { SiteContentProvider } from "@/components/SiteContentProvider";
import { site } from "@/config/site";
import { adminApi, providersEnabled, requireUser } from "@/lib/auth";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = { title: `Your account · ${site.name}`, robots: { index: false } };

async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const library = await adminApi<{ saved: LibraryEntry[]; recent: LibraryEntry[] }>("/auth/me/library");
  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">Your account</p>
          <h1 className="display mt-1 text-3xl text-fg md:text-4xl">{user.name ? `Hi, ${user.name.split(" ")[0]}` : "Welcome"}</h1>
        </div>
        {user.isTeam && (
          <Link href="/admin" className="rounded-full border border-line-strong px-4 py-2 text-sm text-fg hover:bg-fg/5">
            Open the admin panel →
          </Link>
        )}
      </header>
      {sp.welcome === "1" && (
        <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Your account is ready. We sent a confirmation link to {user.email}.
        </p>
      )}
      {!user.emailVerified && <VerifyBanner email={user.email} />}
      <SavedAndRecent saved={library.saved} recent={library.recent} />
      <section className="space-y-6">
        <h2 className="display text-2xl text-fg">Settings</h2>
        <AccountSettings user={user} providers={providersEnabled()} />
        {user.role === "member" && <DeleteAccount email={user.email} hasPassword={user.hasPassword} />}
      </section>
    </div>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const content = await getSiteContent();
  return (
    <SiteContentProvider value={content}>
      <MemberProvider>
        <Navbar />
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10 md:px-12">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-fg/5" />}>
            <Account searchParams={searchParams} />
          </Suspense>
        </main>
        <Footer content={content} />
      </MemberProvider>
    </SiteContentProvider>
  );
}
