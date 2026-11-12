import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyCard } from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";

export const metadata: Metadata = { title: `Confirm email · ${site.name}` };

// Confirming takes a click, so link scanners in mail apps don't use up the link
async function Verify({ params }: { params: PageProps<"/verify/[token]">["params"] }) {
  const { token } = await params;
  return <VerifyCard token={token} />;
}

export default function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-48" />}>
        <Verify params={params} />
      </Suspense>
    </AuthShell>
  );
}
