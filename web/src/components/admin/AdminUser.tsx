"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type AdminUser, type Role } from "@/lib/auth-shared";

const Ctx = createContext<AdminUser | null>(null);

export function AdminUserProvider({ user, children }: { user: AdminUser; children: ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export const useAdminUser = () => useContext(Ctx);

/** True when the signed-in user has at least `need`. The API enforces the same rules. */
export function useCan(need: Role) {
  return can(useContext(Ctx), need);
}
