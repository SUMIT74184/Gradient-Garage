import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Sign up · ${site.name}`,
};

export default function SignupPage() {
  return <AuthShell mode="signup" />;
}
