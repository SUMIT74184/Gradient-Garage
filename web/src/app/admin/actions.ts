"use server";

/**
 * Admin mutations. Each one calls the FastAPI admin API, then expires the public hub
 * cache so the site shows the change on the next request, and refreshes the admin page.
 *
 * There is no sign-in yet (Phase 6): these only work while ADMIN_DEV_MODE=true here
 * and on the API.
 */
import { refresh, updateTag } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { adminEnabled } from "@/lib/admin/data";
import type { ActionResult, AdminItem, ContentType, Revision, Transition } from "@/lib/admin/types";
import { HUB_TAG } from "@/lib/hub";

type ValidationIssue = { loc?: (string | number)[]; msg?: string };

const TYPES = new Set(["model", "dataset", "demo", "library"]);

/** Turn FastAPI / pydantic 422 details into { field: message }. */
function fieldErrors(body: Record<string, unknown>): Record<string, string> | undefined {
  const issues = (Array.isArray(body.errors) ? body.errors : Array.isArray(body.detail) ? body.detail : []) as ValidationIssue[];
  if (!issues.length) return undefined;
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const path = (issue.loc ?? []).filter((p) => p !== "body" && !TYPES.has(String(p)));
    const key = String(path[0] ?? "_");
    out[key] ??= (issue.msg ?? "Invalid value").replace(/^Value error, /, "");
  }
  return out;
}

async function run<T>(fn: () => Promise<T>, { revalidate = true, reload = true } = {}): Promise<ActionResult<T>> {
  if (!adminEnabled()) return { ok: false, error: "The admin panel is disabled.", status: 404 };
  try {
    const data = await fn();
    if (revalidate) updateTag(HUB_TAG);
    if (reload) refresh();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        ok: false,
        status: e.status,
        error: e.status === 422 ? "Some fields need fixing." : e.message,
        fieldErrors: e.status === 422 ? fieldErrors(e.body) : undefined,
        currentVersion: typeof e.body.currentVersion === "number" ? e.body.currentVersion : undefined,
      };
    }
    throw e;
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const path = (id: string) => `/admin/content/${encodeURIComponent(id)}`;

// ---------- content ----------

export async function createItem(type: ContentType, values: Record<string, unknown>) {
  return run(() => api<AdminItem>("/admin/content", json({ ...values, type })), { revalidate: false });
}

export async function updateItem(id: string, version: number, changes: Record<string, unknown>) {
  return run(() => api<AdminItem>(path(id), { method: "PATCH", body: JSON.stringify({ ...changes, version }) }));
}

export async function transitionItem(id: string, action: Transition, version: number) {
  return run(() => api<AdminItem>(`${path(id)}/${action}`, json({ version })));
}

export async function deleteItem(id: string) {
  return run(() => api<null>(path(id), { method: "DELETE" }));
}

export async function getRevision(id: string, version: number) {
  return run(() => api<Revision>(`${path(id)}/revisions/${version}`), { revalidate: false, reload: false });
}

export async function restoreRevision(id: string, revVersion: number, version: number) {
  return run(() => api<AdminItem>(`${path(id)}/revisions/${revVersion}/restore`, json({ version })));
}

export async function setOrder(type: ContentType, ids: string[]) {
  return run(() => api<null>("/admin/content/order", { method: "PUT", body: JSON.stringify({ type, ids }) }));
}

// ---------- tags ----------

export async function createTag(name: string) {
  return run(() => api("/admin/tags", json({ name })), { revalidate: false });
}

export async function renameTag(id: string, name: string) {
  return run(() => api(`/admin/tags/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }));
}

export async function mergeTag(id: string, intoId: string) {
  return run(() => api(`/admin/tags/${id}/merge`, json({ intoId })));
}

export async function deleteTag(id: string) {
  return run(() => api(`/admin/tags/${id}`, { method: "DELETE" }));
}

// ---------- labels (internal, so the public cache is untouched) ----------

export async function createLabel(values: { name: string; color: string; description: string }) {
  return run(() => api("/admin/labels", json(values)), { revalidate: false });
}

export async function updateLabel(id: string, values: { name?: string; color?: string; description?: string }) {
  return run(() => api(`/admin/labels/${id}`, { method: "PATCH", body: JSON.stringify(values) }), { revalidate: false });
}

export async function deleteLabel(id: string) {
  return run(() => api(`/admin/labels/${id}`, { method: "DELETE" }), { revalidate: false });
}
