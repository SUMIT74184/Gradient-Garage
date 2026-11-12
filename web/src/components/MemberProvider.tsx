"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { recordView as recordViewAction, setBookmark } from "@/app/admin/auth-actions";
import type { AdminUser } from "@/lib/auth-shared";

type Ref = { type: string; id: string };
type MemberState = {
  /** undefined while loading, null when signed out */
  user: AdminUser | null | undefined;
  isSaved: (type: string, id: string) => boolean;
  toggleSaved: (type: string, id: string) => Promise<"saved" | "removed" | "signed-out" | "error">;
  recordView: (type: string, id: string) => void;
};

const Ctx = createContext<MemberState>({
  user: null,
  isSaved: () => false,
  toggleSaved: async () => "signed-out",
  recordView: () => {},
});

const key = (type: string, id: string) => `${type}:${id.toLowerCase()}`;

/** Signed-in visitor state for the public site: who they are and what they saved. */
export function MemberProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user: AdminUser | null; bookmarks: Ref[] }) => {
        if (!alive) return;
        setUser(d.user);
        setSaved(new Set((d.bookmarks ?? []).map((b) => key(b.type, b.id))));
      })
      .catch(() => alive && setUser(null));
    return () => {
      alive = false;
    };
  }, []);

  const isSaved = useCallback((type: string, id: string) => saved.has(key(type, id)), [saved]);

  const toggleSaved = useCallback(
    async (type: string, id: string) => {
      if (!user) return "signed-out" as const;
      const k = key(type, id);
      const next = !saved.has(k);
      // Optimistic; rolled back if the server says no
      setSaved((s) => {
        const n = new Set(s);
        if (next) n.add(k);
        else n.delete(k);
        return n;
      });
      const res = await setBookmark(type, id, next);
      if (!res.ok) {
        setSaved((s) => {
          const n = new Set(s);
          if (next) n.delete(k);
          else n.add(k);
          return n;
        });
        if (res.error === "signed-out") {
          setUser(null);
          return "signed-out" as const;
        }
        return "error" as const;
      }
      return next ? ("saved" as const) : ("removed" as const);
    },
    [saved, user],
  );

  const recordView = useCallback(
    (type: string, id: string) => {
      if (user) void recordViewAction(type, id);
    },
    [user],
  );

  const value = useMemo(() => ({ user, isSaved, toggleSaved, recordView }), [user, isSaved, toggleSaved, recordView]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMember = () => useContext(Ctx);
