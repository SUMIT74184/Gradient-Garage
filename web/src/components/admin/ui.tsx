/** Small presentational pieces shared by the admin screens (no hooks, usable on server and client). */
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_META } from "@/lib/admin/schema";
import type { AdminLabel, Status } from "@/lib/admin/types";

export const inputClass =
  "w-full rounded-lg border border-line bg-ink/60 px-3 py-2 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-brand/60 focus:bg-ink aria-[invalid=true]:border-red-400/60";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-fg transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-fg/10 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-soft transition hover:bg-fg/5 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3.5 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50",
};

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {m.label}
    </span>
  );
}

export function LabelChip({ label, small = false }: { label: Pick<AdminLabel, "name" | "color">; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-fg/5 text-soft ${small ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs"}`}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: label.color }} aria-hidden="true" />
      {label.name}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
        <h1 className="display truncate text-2xl text-fg md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, className = "", action }: { title?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg">
      ← {children}
    </Link>
  );
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
