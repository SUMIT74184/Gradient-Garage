"use server";

/**
 * Admin mutations. Each one calls the FastAPI admin API, then expires the public hub
 * cache so the site shows the change on the next request, and refreshes the admin page.
 *
 * Every call carries the signed-in user's session; the API checks their role.
 */
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { adminApi as api } from "@/lib/auth";
import type {
  ActionResult,
  AdminItem,
  BulkAction,
  BulkResult,
  ContentType,
  ImportPlan,
  MediaItem,
  Revision,
  SiteDoc,
  SiteRevision,
  SyncRun,
  Transition,
} from "@/lib/admin/types";
import { SITE_TAG } from "@/lib/content";
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

async function run<T>(
  fn: () => Promise<T>,
  { revalidate = true, reload = true, tags = [HUB_TAG] }: { revalidate?: boolean; reload?: boolean; tags?: string[] } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (revalidate) for (const tag of tags) updateTag(tag);
    if (reload) refresh();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
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

// ---------- site settings & landing copy ----------

export async function saveSiteDoc(key: string, version: number, value: Record<string, unknown>) {
  return run(() => api<SiteDoc>(`/admin/site/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ version, value }) }), {
    tags: [SITE_TAG],
  });
}

export async function getSiteRevisions(key: string) {
  return run(() => api<SiteRevision[]>(`/admin/site/${encodeURIComponent(key)}/revisions`), { revalidate: false, reload: false });
}

export async function restoreSiteDoc(key: string, revVersion: number, version: number) {
  return run(() => api<SiteDoc>(`/admin/site/${encodeURIComponent(key)}/revisions/${revVersion}/restore`, json({ version })), {
    tags: [SITE_TAG],
  });
}

// ---------- media ----------

export async function listMedia() {
  return run(() => api<MediaItem[]>("/admin/media"), { revalidate: false, reload: false });
}

/** `form` carries `file` and optional `alt`. */
export async function uploadMedia(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Choose an image to upload." };
  const body = new FormData();
  body.set("file", file, file.name);
  body.set("alt", String(form.get("alt") ?? ""));
  return run(() => api<MediaItem>("/admin/media", { method: "POST", body }), { revalidate: false });
}

export async function updateMediaAlt(id: string, alt: string) {
  // Alt text appears on the public site (covers), so refresh the hub
  return run(() => api<MediaItem>(`/admin/media/${id}`, { method: "PATCH", body: JSON.stringify({ alt }) }));
}

export async function deleteMedia(id: string) {
  return run(() => api<null>(`/admin/media/${id}`, { method: "DELETE" }), { revalidate: false });
}

// ---------- Phase 5: sync, bulk, CSV ----------

/** Runs the Hugging Face / GitHub sync. New items arrive as drafts, so only stats can change on the site. */
export async function runSync() {
  return run(() => api<SyncRun>("/admin/sync/huggingface", { method: "POST" }));
}

export async function resetOverrides(id: string, fields: string[], version: number) {
  return run(() => api<AdminItem>(`${path(id)}/overrides/reset`, json({ fields, version })), { revalidate: false });
}

export async function bulkAction(ids: string[], action: BulkAction, value?: unknown) {
  // Labels are internal; everything else can change what the site shows
  const internal = action === "add_labels" || action === "remove_labels";
  return run(() => api<BulkResult>("/admin/content/bulk", json({ ids, action, value: value ?? null })), { revalidate: !internal });
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** `form` carries the CSV `file`. `apply=false` previews; `apply=true` imports all rows or none. */
export async function importCsv(type: ContentType, form: FormData, apply: boolean) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Choose a CSV file." };
  if (file.size > MAX_CSV_BYTES) return { ok: false as const, error: "The file is larger than 2 MB." };
  const body = new FormData();
  body.set("file", file, file.name);
  const q = new URLSearchParams({ type, dry_run: String(!apply) });
  // Imports create drafts and edit existing items; refresh the site only when applying
  return run(() => api<ImportPlan>(`/admin/import?${q}`, { method: "POST", body }), { revalidate: apply, reload: apply });
}
