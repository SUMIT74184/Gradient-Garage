"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setOrder } from "@/app/admin/actions";
import { useCan } from "@/components/admin/AdminUser";
import { StatusPill, buttonClass } from "@/components/admin/ui";
import type { AdminItem, ContentType } from "@/lib/admin/types";

function Row({
  item,
  href,
  children,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
}: {
  item: AdminItem;
  href: string;
  children: React.ReactNode;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  dragging?: boolean;
}) {
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 ${dragging ? "border-brand/60 opacity-60" : "border-line"} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable && (
        <span aria-hidden="true" className="select-none text-muted">
          ⋮⋮
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.featured && <span className="text-gold-300" title="Featured">★</span>}
          <Link href={href} className="truncate text-sm font-medium text-fg hover:text-brand-hover">
            {item.name}
          </Link>
          {item.status !== "published" && <StatusPill status={item.status} />}
        </div>
        <p className="truncate font-mono text-xs text-muted">{item.slug}</p>
      </div>
      <div className="flex shrink-0 gap-0.5">{children}</div>
    </li>
  );
}

export default function OrderBoard({ type, sectionSlug, items }: { type: ContentType; sectionSlug: string; items: AdminItem[] }) {
  const initial = items.filter((i) => i.sortOrder !== null).sort((a, b) => a.sortOrder! - b.sortOrder!).map((i) => i.id);
  const [pinned, setPinned] = useState<string[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canEdit = useCan("editor");

  const byId = new Map(items.map((i) => [i.id, i]));
  const rest = items.filter((i) => !pinned.includes(i.id)).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  const dirty = JSON.stringify(pinned) !== JSON.stringify(initial);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pinned.length || from === to) return;
    const next = [...pinned];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    setPinned(next);
  };

  const save = () =>
    start(async () => {
      const res = await setOrder(type, pinned);
      setMessage(res.ok ? { ok: true, text: "Order saved. The site is updated." } : { ok: false, text: res.error });
    });

  const href = (id: string) => `/admin/${sectionSlug}/${id}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Pinned, in this order</h2>
          <span className="text-xs text-muted">Drag or use the arrows</span>
        </div>
        {pinned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Nothing pinned. Pin items from the right to fix their position.
          </p>
        ) : (
          <ol className="space-y-2">
            {pinned.map((id, i) => {
              const item = byId.get(id);
              if (!item) return null;
              return (
                <Row
                  key={id}
                  item={item}
                  href={href(id)}
                  draggable
                  dragging={dragId === id}
                  onDragStart={() => setDragId(id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== id) move(pinned.indexOf(dragId), i);
                  }}
                  onDrop={() => setDragId(null)}
                >
                  <span className="mr-1 self-center font-mono text-xs text-muted">{i + 1}</span>
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${item.name} up`} className={buttonClass.ghost}>
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === pinned.length - 1} aria-label={`Move ${item.name} down`} className={buttonClass.ghost}>
                    ↓
                  </button>
                  <button type="button" onClick={() => setPinned(pinned.filter((x) => x !== id))} className={buttonClass.ghost}>
                    Unpin
                  </button>
                </Row>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={save} disabled={!canEdit || !dirty || pending} className={buttonClass.primary}>
            {pending ? "Saving…" : "Save order"}
          </button>
          {dirty && (
            <button type="button" onClick={() => setPinned(initial)} className={buttonClass.ghost}>
              Reset
            </button>
          )}
          {message && <p className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}>{message.text}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-fg">Not pinned</h2>
        {rest.length === 0 ? (
          <p className="text-sm text-muted">Everything is pinned.</p>
        ) : (
          <ul className="space-y-2">
            {rest.map((item) => (
              <Row key={item.id} item={item} href={href(item.id)}>
                <button type="button" onClick={() => setPinned([...pinned, item.id])} className={buttonClass.ghost}>
                  Pin
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
