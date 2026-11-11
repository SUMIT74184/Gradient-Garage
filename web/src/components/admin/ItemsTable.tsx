"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteItem, transitionItem } from "@/app/admin/actions";
import StatusBadges from "@/components/StatusBadges";
import { LabelChip, StatusPill, buttonClass, formatWhen } from "@/components/admin/ui";
import type { AdminItem, Transition } from "@/lib/admin/types";

const ROW_ACTIONS: Record<AdminItem["status"], Transition[]> = {
  draft: ["publish", "archive"],
  published: ["unpublish", "archive"],
  archived: ["restore"],
};

const ACTION_LABEL: Record<Transition, string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore",
};

function Row({ item, href }: { item: AdminItem; href: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
    });

  return (
    <tr className={`align-top transition ${pending ? "opacity-50" : ""}`}>
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2">
          {item.featured && (
            <span title="Featured" className="text-gold-300" aria-label="Featured">
              ★
            </span>
          )}
          <Link href={href} className="font-medium text-fg hover:text-brand-hover">
            {item.name}
          </Link>
          <StatusBadges badges={item.badges} />
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted">{item.slug}</p>
        {item.labels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.labels.map((l) => (
              <LabelChip key={l.id} label={l} small />
            ))}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
      <td className="px-3 py-3">
        <StatusPill status={item.status} />
        {item.source === "huggingface" && (
          <span className="ml-1.5 rounded border border-line px-1 font-mono text-[10px] text-muted" title="Synced from Hugging Face">
            HF
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        <div className="flex max-w-64 flex-wrap gap-1">
          {item.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-fg/5 px-1.5 py-px text-[11px] text-soft">
              {t}
            </span>
          ))}
          {item.tags.length > 4 && <span className="text-[11px] text-muted">+{item.tags.length - 4}</span>}
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-muted md:table-cell">{formatWhen(item.updatedAt)}</td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex flex-wrap justify-end gap-1">
          <Link href={href} className={buttonClass.ghost}>
            Edit
          </Link>
          {ROW_ACTIONS[item.status].map((a) => (
            <button
              key={a}
              type="button"
              disabled={pending}
              onClick={() => act(() => transitionItem(item.id, a, item.version))}
              className={buttonClass.ghost}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
          {item.status === "archived" &&
            (confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button type="button" disabled={pending} onClick={() => act(() => deleteItem(item.id))} className={`${buttonClass.danger} !px-2.5 !py-1.5`}>
                  Delete forever
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass.ghost}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${buttonClass.ghost} hover:!text-red-300`}>
                Delete…
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}

export default function ItemsTable({ items, sectionSlug, emptyText }: { items: AdminItem[]; sectionSlug: string; emptyText: string }) {
  if (!items.length) {
    return <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">{emptyText}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">Name</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Tags</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Edited</th>
            <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <Row key={`${item.id}:${item.version}`} item={item} href={`/admin/${sectionSlug}/${item.id}`} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
