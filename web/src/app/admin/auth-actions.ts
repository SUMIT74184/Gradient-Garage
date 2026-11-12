"use server";

/** Sign-in, invites, password resets, own account and team management. */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  adminApi,
  clearSessionCookie,
  clientHeaders,
  getToken,
  safeNext,
  setSessionCookie,
  type AdminUser,
  type Role,
} from "@/lib/auth";
import type { ActionResult, InviteRow } from "@/lib/admin/types";

type Session = { token: string; user: AdminUser };
export type FormState = { error?: string; fields?: Record<string, string>; done?: boolean } | null;

function failure(e: unknown): { error: string; fields?: Record<string, string> } {
  if (!(e instanceof ApiError)) throw e;
  const issues = (Array.isArray(e.body.errors) ? e.body.errors : Array.isArray(e.body.detail) ? e.body.detail : []) as {
    loc?: (string | number)[];
    msg?: string;
  }[];
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const key = String((i.loc ?? []).filter((p) => p !== "body").at(-1) ?? "_");
    fields[key] ??= (i.msg ?? "Invalid").replace(/^Value error, /, "");
  }
  const message = typeof e.body.detail === "string" ? e.body.detail : "Please check the form.";
  return { error: message.charAt(0).toUpperCase() + message.slice(1), fields: issues.length ? fields : undefined };
}

/** Where to land after signing in when there's no ?next: the admin panel for the team, else `memberHome`. */
async function startSession(path: string, body: unknown, next: unknown, memberHome = "/"): Promise<FormState> {
  let session: Session;
  try {
    session = await api<Session>(path, { method: "POST", body: JSON.stringify(body), headers: await clientHeaders() });
  } catch (e) {
    return failure(e);
  }
  await setSessionCookie(session.token);
  const isTeam = ["owner", "editor", "viewer"].includes(session.user.role);
  redirect(safeNext(next, isTeam ? "/admin" : memberHome));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  return startSession("/auth/login", { email: form.get("email"), password: form.get("password") }, form.get("next"));
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  return startSession(
    "/auth/signup",
    { name: form.get("name"), email: form.get("email"), password: form.get("password") },
    form.get("next") || undefined,
    "/account?welcome=1",
  );
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  try {
    await api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
  } catch (e) {
    return failure(e);
  }
  // Same answer whether or not the address has an account
  return { done: true };
}

export async function confirmEmail(token: string): Promise<FormState> {
  try {
    await api(`/auth/verify/${encodeURIComponent(token)}`, { method: "POST" });
  } catch (e) {
    return failure(e);
  }
  return { done: true };
}

export async function acceptInvite(token: string, _: FormState, form: FormData): Promise<FormState> {
  if (form.get("password") !== form.get("confirm")) return { error: "The passwords don't match.", fields: { confirm: "Doesn't match" } };
  return startSession(`/auth/invites/${encodeURIComponent(token)}/accept`, { name: form.get("name"), password: form.get("password") }, "/admin");
}

export async function resetPassword(token: string, _: FormState, form: FormData): Promise<FormState> {
  if (form.get("password") !== form.get("confirm")) return { error: "The passwords don't match.", fields: { confirm: "Doesn't match" } };
  return startSession(`/auth/reset/${encodeURIComponent(token)}`, { password: form.get("password") }, undefined, "/account");
}

export async function logout(next: string = "/login") {
  const token = await getToken();
  if (token) await api("/auth/logout", { method: "POST", token }).catch(() => {});
  await clearSessionCookie();
  redirect(safeNext(next, "/login"));
}

// ---------- own account ----------

async function guarded<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    const f = failure(e);
    return { ok: false, error: f.error, fieldErrors: f.fields };
  }
}

export async function updateProfile(name: string) {
  return guarded(() => adminApi<AdminUser>("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }));
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return guarded(() => adminApi<null>("/auth/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }));
}

export async function unlinkProvider(provider: string) {
  return guarded(() => adminApi<null>(`/auth/me/oauth/${provider}`, { method: "DELETE" }));
}

export async function signOutEverywhere() {
  const token = await getToken();
  await adminApi("/auth/logout-all", { method: "POST" }).catch(() => {});
  if (token) await clearSessionCookie();
  redirect("/login");
}

export async function resendVerification() {
  return guarded(() => adminApi<null>("/auth/me/verify", { method: "POST" }));
}

export async function deleteAccount(password: string, confirmEmail: string): Promise<ActionResult<null>> {
  try {
    await adminApi("/auth/me/delete", { method: "POST", body: JSON.stringify({ password: password || null, confirmEmail: confirmEmail || null }) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    const f = failure(e);
    return { ok: false, error: f.error, fieldErrors: f.fields };
  }
  await clearSessionCookie();
  redirect("/?account=deleted");
}

// ---------- saved items & recently viewed (no page refresh: the UI updates itself) ----------

async function quiet(fn: () => Promise<unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.status === 401 ? "signed-out" : e.message };
    throw e;
  }
}

export async function setBookmark(type: string, id: string, saved: boolean) {
  return quiet(() => adminApi("/auth/me/bookmarks", { method: "PUT", body: JSON.stringify({ type, id, saved }) }));
}

export async function recordView(type: string, id: string) {
  return quiet(() => adminApi("/auth/me/views", { method: "POST", body: JSON.stringify({ type, id }) }));
}

export async function clearHistory() {
  return guarded(() => adminApi<null>("/auth/me/views", { method: "DELETE" }));
}

// ---------- team (Owners) ----------

export async function inviteMember(email: string, role: Role) {
  return guarded(() => adminApi<InviteRow & { token: string }>("/admin/invites", { method: "POST", body: JSON.stringify({ email, role }) }));
}

export async function revokeInvite(id: string) {
  return guarded(() => adminApi<null>(`/admin/invites/${id}`, { method: "DELETE" }));
}

export async function updateMember(id: string, patch: { role?: Role; isActive?: boolean }) {
  return guarded(() => adminApi<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
}

export async function createResetLink(id: string) {
  return guarded(() => adminApi<{ token: string; expiresAt: string }>(`/admin/users/${id}/reset-link`, { method: "POST" }));
}

export async function signOutMember(id: string) {
  return guarded(() => adminApi<null>(`/admin/users/${id}/logout-all`, { method: "POST" }));
}
