import { redirect } from "next/navigation";

/** Team and visitors share one sign-in page now. */
export default async function AdminLoginRedirect({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["next", "error"] as const) if (typeof sp[k] === "string") q.set(k, sp[k] as string);
  redirect(`/login${q.size ? `?${q}` : ""}`);
}
