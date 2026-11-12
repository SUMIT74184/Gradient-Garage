"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { listMedia, uploadMedia } from "@/app/admin/actions";
import { buttonClass, inputClass } from "@/components/admin/ui";
import type { MediaItem } from "@/lib/admin/types";

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload button: sends one image through the uploadMedia action. */
export function UploadButton({
  onUploaded,
  label = "Upload image",
  className = buttonClass.secondary,
}: {
  onUploaded: (m: MediaItem) => void;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col">
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) return setError("That file is over 10 MB.");
          start(async () => {
            setError("");
            const form = new FormData();
            form.set("file", file);
            form.set("alt", "");
            const res = await uploadMedia(form);
            if (res.ok) onUploaded(res.data);
            else setError(res.fieldErrors ? Object.values(res.fieldErrors).join(" ") : res.error);
          });
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} disabled={pending} className={className}>
        {pending ? "Uploading…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-300">{error}</span>}
    </span>
  );
}

/** Modal grid of uploaded images. Calls onPick with the chosen image. */
export function MediaPickerDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MediaItem) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      start(async () => {
        const res = await listMedia();
        if (res.ok) setItems(res.data);
        else setError(res.error);
      });
    } else if (!open && d.open) d.close();
  }, [open]);

  const shown = (items ?? []).filter((m) => !q || `${m.filename} ${m.alt}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Choose an image</h2>
        <button type="button" onClick={onClose} aria-label="Close" className={buttonClass.ghost}>
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or alt text" aria-label="Search images" className={`${inputClass} flex-1`} />
        <UploadButton
          label="Upload new"
          className={buttonClass.primary}
          onUploaded={(m) => {
            setItems((prev) => [m, ...(prev ?? [])]);
            onPick(m);
          }}
        />
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {items === null ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{items.length ? "No images match." : "No images yet. Upload one."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="group block w-full overflow-hidden rounded-lg border border-line text-left transition hover:border-brand/60 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails */}
                  <img src={m.url} alt={m.alt} loading="lazy" className="aspect-[4/3] w-full bg-ink object-cover" />
                  <span className="block truncate px-2 py-1.5 text-xs text-soft group-hover:text-fg">{m.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

/** A field showing the current image with Choose / Remove buttons. */
export function ImageField({
  value,
  onChange,
  allowRemove = true,
}: {
  value: { id?: string | null; url: string | null; alt?: string };
  onChange: (m: MediaItem | null) => void;
  allowRemove?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3">
      <div className="grid aspect-[4/3] w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink/60">
        {value.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={value.url} alt={value.alt ?? ""} className="size-full object-cover" />
        ) : (
          <span className="text-[11px] text-muted">No image</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.secondary} !py-1.5 text-xs`}>
          {value.url ? "Change…" : "Choose…"}
        </button>
        {allowRemove && value.url && (
          <button type="button" onClick={() => onChange(null)} className={`${buttonClass.ghost} !py-1 text-xs`}>
            Remove
          </button>
        )}
      </div>
      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange(m);
          setOpen(false);
        }}
      />
    </div>
  );
}
