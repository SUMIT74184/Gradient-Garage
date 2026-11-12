"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteMedia, updateMediaAlt } from "@/app/admin/actions";
import { useCan } from "@/components/admin/AdminUser";
import { UploadButton, formatBytes } from "@/components/admin/MediaPicker";
import { buttonClass, formatWhen, inputClass } from "@/components/admin/ui";
import { sectionByType } from "@/lib/admin/schema";
import type { MediaItem, MediaUsage } from "@/lib/admin/types";

function usageLink(u: MediaUsage) {
  if (u.kind === "cover") {
    const s = sectionByType(u.type);
    return { href: `/admin/${s.slug}/${u.id}`, label: `${s.item}: ${u.name}` };
  }
  const isLanding = u.key.startsWith("landing.");
  return { href: isLanding ? `/admin/landing#${u.key}` : "/admin/site", label: isLanding ? `Landing: ${u.key.slice(8)}` : `Site: ${u.key}` };
}

function MediaCard({ m }: { m: MediaItem }) {
  const [alt, setAlt] = useState(m.alt);
  const [saved, setSaved] = useState(m.alt);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const saveAlt = () => {
    if (alt.trim() === saved) return;
    start(async () => {
      const res = await updateMediaAlt(m.id, alt);
      if (res.ok) setSaved(res.data.alt);
      else setError(res.error);
    });
  };

  return (
    <li className={`flex flex-col overflow-hidden rounded-xl border border-line bg-surface ${pending ? "opacity-60" : ""}`}>
      <a href={m.url} target="_blank" rel="noreferrer" className="block bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails */}
        <img src={m.url} alt={saved} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-fg" title={m.filename}>
            {m.filename}
          </p>
          <p className="text-[11px] text-muted">
            {m.width}×{m.height} · {formatBytes(m.sizeBytes)} · {formatWhen(m.createdAt)}
          </p>
        </div>
        <label className="text-[11px] text-muted">
          Alt text
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={saveAlt}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveAlt())}
            placeholder="Describe the image"
            className={`${inputClass} mt-1 !py-1.5 text-xs`}
          />
        </label>
        {m.usage.length > 0 ? (
          <ul className="space-y-0.5 text-[11px]">
            {m.usage.map((u, i) => {
              const l = usageLink(u);
              return (
                <li key={i}>
                  <Link href={l.href} className="text-soft hover:text-brand-hover">
                    ↳ {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-muted">Not used anywhere</p>
        )}
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(m.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className={`${buttonClass.ghost} !px-2 !py-1 text-xs`}
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
          {confirm ? (
            <>
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    const res = await deleteMedia(m.id);
                    if (!res.ok) {
                      setError(res.error);
                      setConfirm(false);
                    }
                  })
                }
                className={`${buttonClass.danger} !px-2 !py-1 text-xs`}
              >
                Delete forever
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={`${buttonClass.ghost} !px-2 !py-1 text-xs`}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              disabled={m.usage.length > 0}
              title={m.usage.length ? "Still in use: replace it there first" : undefined}
              className={`${buttonClass.ghost} !px-2 !py-1 text-xs hover:!text-red-300`}
            >
              Delete…
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-red-300">{error}</p>}
      </div>
    </li>
  );
}

export default function MediaLibrary({ items }: { items: MediaItem[] }) {
  const [q, setQ] = useState("");
  const shown = items.filter((m) => !q || `${m.filename} ${m.alt}`.toLowerCase().includes(q.toLowerCase()));
  const missingAlt = items.filter((m) => !m.alt).length;
  const canEdit = useCan("editor");

  return (
    <fieldset disabled={!canEdit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or alt text" aria-label="Search images" className={`${inputClass} max-w-sm flex-1`} />
        <UploadButton onUploaded={() => {}} className={buttonClass.primary} />
        <span className="text-xs text-muted">JPEG, PNG, WebP or GIF, up to 10 MB</span>
        {missingAlt > 0 && <span className="ml-auto text-xs text-gold-300">{missingAlt} without alt text</span>}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
          {items.length ? "No images match." : "No images yet. Upload covers for items or photos for the landing page."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((m) => (
            <MediaCard key={`${m.id}:${m.usage.length}`} m={m} />
          ))}
        </ul>
      )}
    </fieldset>
  );
}
