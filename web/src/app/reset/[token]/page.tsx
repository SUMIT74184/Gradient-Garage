import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetCard } from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";
import { api, ApiError } from "@/lib/api";

export const metadata: Metadata = { title: `New password · ${site.name}` };

async function Reset({ params }: { params: PageProps<"/reset/[token]">["params"] }) {
  const { token } = await params;
  let email: string | null = null;
  try {
    ({ email } = await api<{ email: string }>(`/auth/reset/${encodeURIComponent(token)}`));
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
  }
  if (email) return <ResetCard token={token} email={email} />;
  return (
    <>
      <h1 className="display text-3xl text-fg">Link expired</h1>
      <p className="mt-2 text-sm text-muted">This reset link was already used or is too old.</p>
      <Link href="/forgot-password" className="mt-6 inline-block text-sm text-brand-hover hover:underline">
        Send a new link →
      </Link>
    </>
  );
}

export default function ResetPage({ params }: PageProps<"/reset/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-72" />}>
        <Reset params={params} />
      </Suspense>
    </AuthShell>
  );
}
