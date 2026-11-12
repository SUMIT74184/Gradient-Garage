"use client";

import { useState, useTransition } from "react";
import { changePassword, signOutEverywhere, unlinkProvider, updateProfile } from "@/app/admin/auth-actions";
import { Field } from "@/components/admin/fields";
import { Card, buttonClass, inputClass } from "@/components/admin/ui";
import type { AdminUser } from "@/lib/auth-shared";

const ROLE_HINT = {
  owner: "Owner: everything, including site settings, permanent delete and the team.",
  editor: "Editor: add, edit, publish and archive content, tags, media and landing copy.",
  viewer: "Viewer: can see everything, change nothing.",
  member: "Site member: save items and keep your recently viewed list.",
};

export default function AccountSettings({ user, providers }: { user: AdminUser; providers: { github: boolean; google: boolean } }) {
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; where: string } | null>(null);
  const [pending, start] = useTransition();

  const say = (where: string, res: { ok: boolean; error?: string }, ok: string) =>
    setMsg(res.ok ? { ok: true, text: ok, where } : { ok: false, text: res.error ?? "Failed", where });

  const note = (where: string) =>
    msg?.where === where ? <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p> : null;

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card title="Profile">
        <p className="mb-4 text-sm text-muted">
          {user.email}
          <br />
          {ROLE_HINT[user.role]}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => say("profile", await updateProfile(name), "Saved."));
          }}
          className="space-y-3"
        >
          <Field label="Name" htmlFor="me-name">
            <input id="me-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <button type="submit" disabled={pending || name === user.name} className={buttonClass.primary}>
            Save
          </button>
          {note("profile")}
        </form>
      </Card>

      <Card title={user.hasPassword ? "Change password" : "Set a password"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await changePassword(current, next);
              say("password", res, "Password updated. Other sessions were signed out.");
              if (res.ok) {
                setCurrent("");
                setNext("");
              }
            });
          }}
          className="space-y-3"
        >
          {user.hasPassword && (
            <Field label="Current password" htmlFor="pw-cur">
              <input id="pw-cur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
            </Field>
          )}
          <Field label="New password" help="At least 10 characters" htmlFor="pw-new">
            <input id="pw-new" type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          </Field>
          <button type="submit" disabled={pending || !next} className={buttonClass.primary}>
            {user.hasPassword ? "Change password" : "Set password"}
          </button>
          {note("password")}
        </form>
      </Card>

      <Card title="Sign-in methods">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span>Password</span>
            <span className="text-muted">{user.hasPassword ? "Set" : "Not set"}</span>
          </li>
          {(["github", "google"] as const).map((p) => {
            const linked = user.providers.includes(p);
            return (
              <li key={p} className="flex items-center justify-between gap-2">
                <span>{p === "github" ? "GitHub" : "Google"}</span>
                {linked ? (
                  <button type="button" disabled={pending} onClick={() => start(async () => say("methods", await unlinkProvider(p), "Disconnected."))} className={buttonClass.ghost}>
                    Disconnect
                  </button>
                ) : providers[p] ? (
                  <a href={`/auth/${p}?next=/account`} className={buttonClass.ghost}>
                    Connect
                  </a>
                ) : (
                  <span className="text-xs text-muted">Not configured</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">Connecting works when the GitHub / Google account uses {user.email}.</p>
        {note("methods")}
      </Card>

      <Card title="Sessions">
        <p className="text-sm text-muted">Signed in on a shared or lost device? Sign out of every browser, including this one.</p>
        <form action={signOutEverywhere} className="mt-3">
          <button type="submit" className={buttonClass.danger}>
            Sign out everywhere
          </button>
        </form>
      </Card>
    </div>
  );
}
