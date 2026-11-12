import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginCard } from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";
import { getCurrentUser, providersEnabled, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: `Log in · ${site.name}` };

const ERRORS: Record<string, string> = {
  oauth_state: "That sign-in took too long or was interrupted. Please try again.",
  oauth_failed: "Couldn't sign in with that provider. Please try again.",
};

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next, "") : "";
  const user = await getCurrentUser();
  if (user) redirect(next || (user.isTeam ? "/admin" : "/account"));
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? sp.error.slice(0, 200)) : undefined;
  return <LoginCard next={next || undefined} error={error} providers={providersEnabled()} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-96" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
