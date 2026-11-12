/** Admin sessions on the website side: an httpOnly cookie holding the API session token. */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { api, ApiError } from "@/lib/api";

export const SESSION_COOKIE = "gg_session";
const MAX_AGE = 60 * 60 * 24 * 30; // matches the API's 30-day sliding session

import { can, type AdminUser } from "@/lib/auth-shared";
export { can, type AdminUser, type Role } from "@/lib/auth-shared";
export type { AdminUser as SiteUser } from "@/lib/auth-shared";

export async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The signed-in team member, or null. Cached for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = await getToken();
  if (!token) return null;
  try {
    return await api<AdminUser>("/auth/me", { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});

/** Signed-in team member (Viewer or above). Public members are sent to the site. */
export async function requireTeam(): Promise<AdminUser> {
  const user = await requireUser();
  if (!can(user, "viewer")) redirect("/account");
  return user;
}

export async function requireUser(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** API call as the signed-in user. */
export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return api<T>(path, { ...init, token: await getToken() });
}

/** Only call from a Server Action or Route Handler. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Client IP / user agent, forwarded to the API for rate limiting and the sessions list. */
export async function clientHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  return { "X-Client-IP": ip, "X-Client-UA": h.get("user-agent") ?? "" };
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: unknown, fallback = "/admin") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export const providersEnabled = () => ({
  github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
});
