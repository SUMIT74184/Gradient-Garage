"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);

/** Makes admin-edited settings and section names available to client components. */
export function SiteContentProvider({ value, children }: { value: SiteContent; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSiteContent = () => useContext(Ctx);
export const useSections = () => useContext(Ctx).sections;
