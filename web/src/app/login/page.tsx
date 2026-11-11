import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Log in · ${site.name}`,
};

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
