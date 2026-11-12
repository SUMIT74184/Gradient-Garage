import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignupCard } from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";
import { getCurrentUser, providersEnabled, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: `Sign up · ${site.name}` };

async function Signup({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/account");
  const next = typeof sp.next === "string" ? safeNext(sp.next, "") : "";
  return <SignupCard next={next || undefined} providers={providersEnabled()} />;
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-96" />}>
        <Signup searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-center text-xs text-muted">By creating an account you agree to the Terms and Privacy Policy.</p>
    </AuthShell>
  );
}
