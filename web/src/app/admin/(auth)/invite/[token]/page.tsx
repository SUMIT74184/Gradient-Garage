import Link from "next/link";
import { ProviderButtons, SetPasswordForm } from "@/components/admin/AuthForms";
import { api, ApiError } from "@/lib/api";
import { providersEnabled } from "@/lib/auth";

export const metadata = { title: "Join the team" };

const ROLE = { owner: "an Owner", editor: "an Editor", viewer: "a Viewer" } as const;

export default async function InvitePage({ params }: PageProps<"/admin/invite/[token]">) {
  const { token } = await params;
  let invite: { email: string; role: keyof typeof ROLE; expiresAt: string };
  try {
    invite = await api(`/auth/invites/${encodeURIComponent(token)}`);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    return (
      <div className="space-y-3">
        <h1 className="display text-2xl text-fg">Invite not valid</h1>
        <p className="text-sm text-muted">{String(e.body.detail ?? "This link has expired or was already used.")}</p>
        <Link href="/admin/login" className="text-sm text-brand-hover hover:underline">
          Go to sign in →
        </Link>
      </div>
    );
  }
  const p = providersEnabled();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-2xl text-fg">Join the team</h1>
        <p className="mt-1 text-sm text-muted">
          You&apos;re invited as {ROLE[invite.role]} with <span className="text-fg">{invite.email}</span>.
        </p>
      </div>
      <ProviderButtons github={p.github} google={p.google} query={`?invite=${encodeURIComponent(token)}`} />
      {(p.github || p.google) && <p className="-mt-2 text-xs text-muted">GitHub / Google must use {invite.email}.</p>}
      <SetPasswordForm token={token} mode="invite" />
    </div>
  );
}
