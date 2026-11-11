"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";
import { BADGE_META } from "@/components/StatusBadges";
import { inputClass } from "@/components/admin/ui";
import { BADGES } from "@/lib/admin/schema";
import type { LabelWithCount, TagWithCount } from "@/lib/admin/types";

const SORTS = [
  ["-updated", "Recently edited"],
  ["-created", "Newest"],
  ["name", "Name A–Z"],
  ["-date", "Content date"],
  ["order", "Featured & pinned"],
] as const;

const selectClass = `${inputClass} cursor-pointer !w-auto pr-8`;

/** GET form: every change navigates with the new query string (no JS needed to work). */
export default function ListFilters({
  action,
  status,
  values,
  tags,
  labels,
}: {
  action: string;
  status?: string;
  values: Record<string, string | undefined>;
  tags: TagWithCount[];
  labels: LabelWithCount[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  const active = values.q || values.tag || values.label || values.badge || values.featured;

  return (
    <Form ref={ref} action={action} replace scroll={false} className="flex flex-wrap items-center gap-2">
      {status && <input type="hidden" name="status" value={status} />}
      <input
        type="search"
        name="q"
        defaultValue={values.q}
        placeholder="Search name, id, description…"
        aria-label="Search"
        className={`${inputClass} min-w-56 flex-1`}
      />
      <select name="tag" defaultValue={values.tag ?? ""} onChange={submit} aria-label="Tag" className={selectClass}>
        <option value="">Any tag</option>
        {tags.map((t) => (
          <option key={t.id} value={t.slug}>
            {t.name} ({t.count})
          </option>
        ))}
      </select>
      <select name="label" defaultValue={values.label ?? ""} onChange={submit} aria-label="Internal label" className={selectClass}>
        <option value="">Any label</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select name="badge" defaultValue={values.badge ?? ""} onChange={submit} aria-label="Badge" className={selectClass}>
        <option value="">Any badge</option>
        {BADGES.map((b) => (
          <option key={b} value={b}>
            {BADGE_META[b].label}
          </option>
        ))}
      </select>
      <select name="featured" defaultValue={values.featured ?? ""} onChange={submit} aria-label="Featured" className={selectClass}>
        <option value="">Featured or not</option>
        <option value="true">Featured only</option>
        <option value="false">Not featured</option>
      </select>
      <select name="sort" defaultValue={values.sort ?? "-updated"} onChange={submit} aria-label="Sort" className={selectClass}>
        {SORTS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button type="submit" className="sr-only">
        Apply
      </button>
      {active && (
        <Link href={status ? `${action}?status=${status}` : action} className="px-2 text-sm text-muted hover:text-fg">
          Clear
        </Link>
      )}
    </Form>
  );
}
