import { headers } from "next/headers";
import { notFound } from "next/navigation";
import TeamManager from "@/components/admin/TeamManager";
import { PageHeader } from "@/components/admin/ui";
import { getInvites, getUsers } from "@/lib/admin/data";
import { requireTeam } from "@/lib/auth";

export const metadata = { title: "Team" };

async function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function TeamPage() {
  const me = await requireTeam();
  if (me.role !== "owner") notFound();
  const [users, members, invites, origin] = await Promise.all([getUsers(), getUsers("members"), getInvites(), siteOrigin()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Site"
        title="Team"
        description="Invite people, set their role, and send password-reset links. Invites and resets are also emailed; the link is shown once so you can send it yourself."
      />
      <TeamManager users={users} members={members} invites={invites} me={me} origin={origin} />
    </div>
  );
}
