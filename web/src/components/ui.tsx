"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SECTIONS } from "@/config/sections";
import type { Selection } from "@/lib/types";

export type ItemType = Selection["type"];

export const TYPE_LABEL: Record<ItemType, string> = {
  model: SECTIONS.model.item,
  library: SECTIONS.library.item,
  dataset: SECTIONS.dataset.item,
  demo: SECTIONS.demo.item,
};

/** One line glyph per kind of item, used in tiles, the palette and drawers. */
export function TypeIcon({ type, className = "size-5" }: { type: ItemType; className?: string }) {
  const p = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (type) {
    case "model":
      return (
        <svg {...p}>
          <circle cx="5" cy="6" r="2" />
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M7 6.8 10.2 11M7 17.2l3.2-4.2M14 12h3" />
        </svg>
      );
    case "library":
      return (
        <svg {...p}>
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />
        </svg>
      );
    case "dataset":
      return (
        <svg {...p}>
          <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
          <path d="M4.5 5.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6M4.5 11.5v7c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-7" />
        </svg>
      );
    case "demo":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="14" rx="2.5" />
          <path d="m10.5 8.5 4 2.5-4 2.5zM8 21h8" />
        </svg>
      );
  }
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`rounded-md bg-fg/5 px-2 py-0.5 text-[11px] text-soft ${className}`}>{children}</span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export const LANGUAGE_COLOR: Record<string, string> = {
  python: "#3572A5",
  typescript: "#3178c6",
  javascript: "#f1e05a",
  rust: "#dea584",
  go: "#00ADD8",
  "c++": "#f34b7d",
  c: "#555555",
  julia: "#a270ba",
};

export function LanguageDot({ language }: { language: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-soft">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ background: LANGUAGE_COLOR[language.toLowerCase()] ?? "var(--color-gold-400)" }}
      />
      {language}
    </span>
  );
}

/** Code block with a copy button. */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-black/60 p-4 pr-16 font-mono text-xs leading-relaxed text-soft">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-soft hover:text-fg"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const LINK_LABEL: Record<string, string> = {
  huggingface: "Hugging Face",
  github: "GitHub",
  pypi: "PyPI",
  npm: "npm",
  docs: "Docs",
  paper: "Paper",
  demo: SECTIONS.demo.label,
};

/** Row of outbound links; the first one is the primary button. */
export function LinkButtons({ links }: { links: Record<string, string | undefined> }) {
  const entries = Object.entries(links).filter(([, url]) => url) as [string, string][];
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-6">
      {entries.map(([name, url], i) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noreferrer"
          className={
            i === 0
              ? "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
              : "rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-fg hover:bg-fg/5"
          }
        >
          {LINK_LABEL[name] ?? name} ↗
        </a>
      ))}
    </div>
  );
}

/** Heading + content block inside a drawer. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** A chip that jumps to another item inside the drawer. */
export function RelatedChip({
  type,
  label,
  onClick,
}: {
  type: ItemType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-soft transition hover:border-brand/40 hover:text-brand-hover"
    >
      <TypeIcon type={type} className="size-3.5 shrink-0 text-brand" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span key={c} className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs text-brand-hover">
          {c}
        </span>
      ))}
    </div>
  );
}

export function StatTiles({ stats }: { stats: [string, string][] }) {
  return (
    <div className={`grid gap-3 ${stats.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
          <div className="mt-1 truncate text-2xl font-semibold tabular-nums text-gold-300">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function FactList({ facts }: { facts: [string, string | undefined][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
      {facts
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 truncate text-soft" title={v}>
              {v}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** Side drawer: overlay, sticky header, Escape to close, focus return, scroll lock. */
export function DrawerShell({
  type,
  title,
  subtitle,
  badge,
  scrollKey,
  onClose,
  children,
}: {
  /** When this changes (another item opened in place), scroll back to the top */
  scrollKey?: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    asideRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm [animation:fade-in_200ms_ease_both]" onClick={onClose} />
      <aside ref={asideRef} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl [animation:drawer-in_280ms_cubic-bezier(0.2,0.7,0.2,1)_both]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-6 py-5 backdrop-blur">
          <div className="min-w-0">
            <p className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
              <TypeIcon type={type} className="size-3.5" />
              {TYPE_LABEL[type]}
            </p>
            <div className="flex items-center gap-2">
              <h2 id="drawer-title" className="truncate text-xl font-semibold text-fg">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && <p className="mt-1 truncate font-mono text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-line px-2.5 py-1 text-muted transition hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </header>
        <div className="space-y-8 px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}
