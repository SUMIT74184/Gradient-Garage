"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/admin/auth-actions";
import { useMember } from "@/components/MemberProvider";

/** Log in / Sign up when signed out; an avatar menu when signed in. */
export default function AccountMenu() {
  const { user } = useMember();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Keep the space while we check the session, so the header doesn't jump
  if (user === undefined) return <span className="inline-block h-8 w-[136px] max-sm:w-[76px]" aria-hidden="true" />;

  if (!user) {
    return (
      <>
        <Link href="/login" className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg max-sm:hidden">
          Log in
        </Link>
        <Link href="/signup" className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover">
          Sign up
        </Link>
      </>
    );
  }

  const initial = (user.name || user.email)[0]?.toUpperCase();
  const item = "block rounded-lg px-3 py-2 text-sm text-soft hover:bg-fg/5 hover:text-fg";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="ms-1 grid size-8 place-items-center overflow-hidden rounded-full border border-line bg-brand/20 text-sm font-semibold text-brand-hover transition hover:border-brand/50"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider avatar
          <img src={user.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm text-fg">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            {!user.emailVerified && <p className="mt-1 text-[11px] text-gold-300">Email not confirmed yet</p>}
          </div>
          <div className="py-1">
            <Link role="menuitem" href="/account#saved" className={item} onClick={() => setOpen(false)}>
              Saved &amp; recently viewed
            </Link>
            <Link role="menuitem" href="/account" className={item} onClick={() => setOpen(false)}>
              Account settings
            </Link>
            {user.isTeam && (
              <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>
                Admin panel
              </Link>
            )}
          </div>
          <form action={logout.bind(null, "/")} className="border-t border-line pt-1">
            <button role="menuitem" type="submit" className={`${item} w-full text-left`}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
