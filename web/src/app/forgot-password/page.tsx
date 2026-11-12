import type { Metadata } from "next";
import { ForgotCard } from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";

export const metadata: Metadata = { title: `Reset password · ${site.name}` };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotCard />
    </AuthShell>
  );
}
