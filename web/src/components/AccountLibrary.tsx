"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clearHistory, resendVerification, setBookmark } from "@/app/admin/auth-actions";
import { TypeIcon, type ItemType } from "@/components/ui";
import { useSections } from "@/components/SiteContentProvider";

export type LibraryEntry = {
  type: ItemType;
  item: { id: string; name: string; description: string; tags?: string[]; cover?: { url: string } };
  views?: number;
  lastViewedAt?: string;
};

const open = (e: LibraryEntry) => `/?open=${e.type}:${encodeURIComponent(e.item.id)}`;

function ago(iso?: string) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function Card({ e, onRemove }: { e: LibraryEntry; onRemove?: () => void }) {
  const sections = useSections();
  return (
    <li className="group relative flex flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40">
      <Link href={open(e)} className="absolute inset-0 rounded-2xl" aria-label={`Open ${e.item.name}`} />
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-brand">
        <TypeIcon type={e.type} className="size-3.5" />
        {sections[e.type].item}
      </div>
      <h3 className="mt-2 truncate font-semibold text-fg group-hover:text-brand-hover">{e.item.name}</h3>
      <p className="truncate font-mono text-xs text-muted">{e.item.id}</p>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{e.item.description}</p>
      {e.lastViewedAt && (
        <p className="mt-3 text-xs text-muted">
          Viewed {e.views === 1 ? "once" : `${e.views} times`} · {ago(e.lastViewedAt)}
        </p>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="relative mt-3 w-fit text-xs text-muted hover:text-red-300">
          Remove
        </button>
      )}
    </li>
  );
}

export function SavedAndRecent({ saved: initialSaved, recent: initialRecent }: { saved: LibraryEntry[]; recent: LibraryEntry[] }) {
  const [saved, setSaved] = useState(initialSaved);
  const [recent, setRecent] = useState(initialRecent);
  const [, start] = useTransition();

  return (
    <div className="space-y-12">
      <section id="saved" className="scroll-mt-24">
        <h2 className="display text-2xl text-fg">Saved</h2>
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing saved yet. Open any model, dataset, demo or library and press <span className="text-fg">☆ Save</span>.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((e) => (
              <Card
                key={`${e.type}:${e.item.id}`}
                e={e}
                onRemove={() =>
                  start(async () => {
                    setSaved((s) => s.filter((x) => x !== e));
                    await setBookmark(e.type, e.item.id, false);
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section id="recent" className="scroll-mt-24">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="display text-2xl text-fg">Recently viewed</h2>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setRecent([]);
                  await clearHistory();
                })
              }
              className="text-xs text-muted hover:text-fg"
            >
              Clear history
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Items you open on the site show up here.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((e) => (
              <Card key={`${e.type}:${e.item.id}`} e={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function VerifyBanner({ email }: { email: string }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-200">
      <span>
        Confirm <span className="text-fg">{email}</span> so you can reset your password if you forget it.
      </span>
      <span className="flex items-center gap-3">
        {msg && <span className="text-xs">{msg}</span>}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendVerification();
              setMsg(r.ok ? "Sent. Check your inbox." : r.error);
            })
          }
          className="rounded-full border border-gold-400/40 px-3 py-1 text-xs hover:bg-gold-400/10"
        >
          {pending ? "Sending…" : "Resend email"}
        </button>
      </span>
    </div>
  );
}
