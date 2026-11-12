"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/admin/auth-actions";
import { useAdminUser } from "@/components/admin/AdminUser";
import { Logo } from "@/components/Navbar";
import { TypeIcon } from "@/components/ui";
import { site } from "@/config/site";
import { ADMIN_SECTIONS } from "@/lib/admin/schema";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer", member: "Member" } as const;

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

/** Sidebar that highlights the current page (reads the URL, so it renders inside <Suspense>). */
export default function Sidebar() {
  return <SidebarView pathname={usePathname()} />;
}

/** Same sidebar with no active link: the prerendered fallback while the URL streams in. */
export function SidebarView({ pathname }: { pathname: string }) {
  const user = useAdminUser();
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
        <div className="flex flex-col gap-0.5">
        <NavLink href="/admin/media" active={is("/admin/media")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
          Media
        </NavLink>
        <NavLink href="/admin/tags" active={is("/admin/tags")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z" strokeLinejoin="round" />
            <circle cx="8" cy="8" r="1.5" />
          </svg>
          Tags &amp; labels
        </NavLink>
        <NavLink href="/admin/sync" active={is("/admin/sync")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Hugging Face sync
        </NavLink>
        <NavLink href="/admin/activity" active={is("/admin/activity")}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 12h4l3-8 4 16 3-8h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Activity
        </NavLink>
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Site</p>
        <div className="flex flex-col gap-0.5">
          <NavLink href="/admin/landing" active={is("/admin/landing")}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M8 13h8M8 17h5" />
            </svg>
            Landing copy
          </NavLink>
          <NavLink href="/admin/site" active={is("/admin/site")}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
            </svg>
            Site settings
          </NavLink>
          {user?.role === "owner" && (
            <NavLink href="/admin/team" active={is("/admin/team")}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
              </svg>
              Team
            </NavLink>
          )}
        </div>
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
          {user && (
            <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider avatar
                <img src={user.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
              ) : (
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-semibold text-brand-hover">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </span>
              )}
              <Link href="/account" className="min-w-0 flex-1 hover:text-fg">
                <span className="block truncate text-sm text-fg">{user.name || user.email}</span>
                <span className="block text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
              </Link>
              <form action={logout.bind(null, "/login")}>
                <button type="submit" title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-muted hover:bg-fg/5 hover:text-fg">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
