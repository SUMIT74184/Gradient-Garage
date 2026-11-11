"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Navbar";
import { TypeIcon } from "@/components/ui";
import { site } from "@/config/site";
import { ADMIN_SECTIONS } from "@/lib/admin/schema";

const SOON = [
  { label: "Media", phase: 4 },
  { label: "Site settings", phase: 4 },
  { label: "Landing copy", phase: 4 },
  { label: "Activity", phase: 5 },
  { label: "Users", phase: 6 },
];

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-brand/10 font-medium text-brand-hover" : "text-soft hover:bg-fg/5 hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const is = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-6" onClick={() => setOpen(false)}>
      <div className="flex flex-col gap-0.5">
        <NavLink href="/admin" active={is("/admin")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
          </svg>
          Overview
        </NavLink>
      </div>

      <div>
        <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Content</p>
        <div className="flex flex-col gap-0.5">
          {ADMIN_SECTIONS.map((s) => (
            <NavLink key={s.slug} href={`/admin/${s.slug}`} active={is(`/admin/${s.slug}`)}>
              <TypeIcon type={s.type} className="size-4" />
              {s.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Organise</p>
        <NavLink href="/admin/tags" active={is("/admin/tags")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z" strokeLinejoin="round" />
            <circle cx="8" cy="8" r="1.5" />
          </svg>
          Tags &amp; labels
        </NavLink>
      </div>

      <div>
        <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Coming next</p>
        <ul className="flex flex-col gap-0.5">
          {SOON.map((s) => (
            <li key={s.label} className="flex items-center justify-between px-3 py-1.5 text-sm text-muted/70">
              {s.label}
              <span className="rounded border border-line px-1 font-mono text-[9px]">P{s.phase}</span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-stone/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="display text-sm text-fg">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="rounded-lg border border-line px-2.5 py-1 text-sm text-soft"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="admin-nav" className="border-b border-line bg-stone px-3 py-4 lg:hidden">
          {nav}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-stone px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
          <Logo size={28} />
          <span className="min-w-0">
            <span className="display block truncate text-sm text-fg">{site.name}</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Admin</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 border-t border-line pt-4">
          <Link href="/" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-soft hover:bg-fg/5 hover:text-fg">
            View site <span aria-hidden="true">↗</span>
          </Link>
          <p className="mt-2 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-2 text-[11px] leading-snug text-gold-300">
            Dev mode: no sign-in yet. Don&apos;t deploy until Phase 6.
          </p>
        </div>
      </aside>
    </>
  );
}
