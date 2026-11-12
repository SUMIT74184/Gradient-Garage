import { redirect } from "next/navigation";

export default async function AdminResetRedirect({ params }: PageProps<"/admin/reset/[token]">) {
  redirect(`/reset/${encodeURIComponent((await params).token)}`);
}
