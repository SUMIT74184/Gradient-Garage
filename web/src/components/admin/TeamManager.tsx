"use client";

import { useState, useTransition } from "react";
import { createResetLink, inviteMember, revokeInvite, signOutMember, updateMember } from "@/app/admin/auth-actions";
import { Card, buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import type { InviteRow } from "@/lib/admin/types";
import type { AdminUser, Role } from "@/lib/auth-shared";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "viewer", label: "Viewer", hint: "Can see everything in the admin panel, change nothing" },
  { value: "editor", label: "Editor", hint: "Add, edit, publish and archive content; tags, media, landing copy" },
  { value: "owner", label: "Owner", hint: "Everything, plus permanent delete, site settings and the team" },
];
const MEMBER_OPTION = { value: "member" as Role, label: "Member (no admin)", hint: "" };

/** A one-time link with a copy button. Shown once: only its hash is stored. */
function LinkBox({ url, note, onClose }: { url: string; note: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
      <p className="text-xs text-emerald-200">{note}</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link" className={`${inputClass} font-mono text-xs`} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
          className={buttonClass.secondary}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button type="button" onClick={onClose} className={`${buttonClass.ghost} mt-1 text-xs`}>
        Done
      </button>
    </div>
  );
}

function MemberRow({ m, me, origin }: { m: AdminUser; me: AdminUser; origin: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const isMe = m.id === me.id;

  const act = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (d: unknown) => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else after?.(res.data);
    });

  return (
    <li className={`py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-fg">
            {m.name || m.email}
            {isMe && <span className="ml-1.5 text-xs text-muted">(you)</span>}
            {!m.isActive && <span className="ml-1.5 rounded border border-red-400/30 px-1 text-[10px] text-red-300">Disabled</span>}
          </p>
          <p className="truncate text-xs text-muted">
            {m.email} · {[m.hasPassword && "password", ...m.providers].filter(Boolean).join(", ") || "no sign-in method yet"} · last sign-in{" "}
            {formatWhen(m.lastLoginAt)}
            {m.sessions ? ` · ${m.sessions} active session${m.sessions === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <select
          value={m.role}
          disabled={isMe || pending}
          onChange={(e) => act(() => updateMember(m.id, { role: e.target.value as Role }))}
          aria-label={`Role for ${m.email}`}
          className={`${inputClass} !w-auto cursor-pointer`}
        >
          {[MEMBER_OPTION, ...ROLES].map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {!isMe && (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => createResetLink(m.id), (d) => setLink(`${origin}/admin/reset/${(d as { token: string }).token}`))}
              className={buttonClass.ghost}
            >
              Reset link
            </button>
            {m.sessions ? (
              <button type="button" disabled={pending} onClick={() => act(() => signOutMember(m.id))} className={buttonClass.ghost}>
                Sign out
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => updateMember(m.id, { isActive: !m.isActive }))}
              className={`${buttonClass.ghost} ${m.isActive ? "hover:!text-red-300" : ""}`}
            >
              {m.isActive ? "Disable" : "Enable"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {link && <LinkBox url={link} note={`Send this to ${m.email}. It works once, for 24 hours, and signs them out everywhere else.`} onClose={() => setLink(null)} />}
    </li>
  );
}

export default function TeamManager({
  users,
  members,
  invites,
  me,
  origin,
}: {
  users: AdminUser[];
  members: AdminUser[];
  invites: InviteRow[];
  me: AdminUser;
  origin: string;
}) {
  const [q, setQ] = useState("");
  const shownMembers = members.filter((m) => !q || `${m.email} ${m.name}`.toLowerCase().includes(q.toLowerCase()));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pending_ = invites.filter((i) => i.state === "pending");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <Card title={`Team (${users.length})`}>
          <ul className="divide-y divide-line">
            {users.map((m) => (
              <MemberRow key={`${m.id}:${m.role}:${m.isActive}:${m.sessions}`} m={m} me={me} origin={origin} />
            ))}
          </ul>
        </Card>
        <Card title={`Site members (${members.length})`}>
          <p className="mb-3 text-xs text-muted">People who signed up on the site. Give someone a team role here to let them into the admin panel.</p>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name" aria-label="Search members" className={inputClass} />
          {shownMembers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{members.length ? "No members match." : "No sign-ups yet."}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {shownMembers.map((m) => (
                <MemberRow key={`${m.id}:${m.role}:${m.isActive}:${m.sessions}`} m={m} me={me} origin={origin} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Invite someone">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setError("");
                const res = await inviteMember(email, role);
                if (res.ok) {
                  setLink({ url: `${origin}/admin/invite/${res.data.token}`, email: res.data.email });
                  setEmail("");
                } else setError(res.fieldErrors?.email ? "Enter a valid email." : res.error);
              });
            }}
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email" className={inputClass} />
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-xs font-medium text-soft">Role</legend>
              {ROLES.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-1 accent-[var(--color-brand)]" />
                  <span>
                    <span className="text-fg">{r.label}</span>
                    <span className="block text-xs text-muted">{r.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" disabled={pending || !email} className={`${buttonClass.primary} w-full`}>
              {pending ? "Creating…" : "Create invite link"}
            </button>
            {error && <p className="text-xs text-red-300">{error}</p>}
          </form>
          {link && (
            <LinkBox
              url={link.url}
              note={`Send this to ${link.email}. It's shown only once and expires in 7 days. They can set a password or use GitHub / Google with that email.`}
              onClose={() => setLink(null)}
            />
          )}
        </Card>

        <Card title={`Pending invites (${pending_.length})`}>
          {pending_.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending_.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">{i.email}</span>
                    <span className="text-xs text-muted">
                      {i.role} · expires {formatWhen(i.expiresAt)}
                    </span>
                  </span>
                  <button type="button" onClick={() => start(async () => void (await revokeInvite(i.id)))} className={`${buttonClass.ghost} hover:!text-red-300`}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
