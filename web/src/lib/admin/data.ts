/** Server-side reads for the admin pages (uncached: admins always see the latest). */
import { adminApi as api } from "@/lib/auth";
import type {
  AdminItem,
  AuditEntry,
  AuditFacets,
  AuditQuery,
  Stats,
  SyncStatus,
  ContentType,
  ItemList,
  LabelWithCount,
  MediaItem,
  Revision,
  SiteAdmin,
  Summary,
  TagWithCount,
} from "@/lib/admin/types";

export type ListQuery = {
  type: ContentType;
  status?: string[];
  q?: string;
  tag?: string;
  label?: string;
  badge?: string;
  featured?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export function listItems(query: ListQuery) {
  const p = new URLSearchParams({ type: query.type, page: String(query.page ?? 1), page_size: String(query.pageSize ?? 25) });
  for (const s of query.status ?? []) p.append("status", s);
  for (const key of ["q", "tag", "label", "badge", "featured", "sort"] as const) {
    if (query[key]) p.set(key, query[key]!);
  }
  return api<ItemList>(`/admin/content?${p}`);
}

export const getItem = (id: string) => api<AdminItem>(`/admin/content/${encodeURIComponent(id)}`);
export const getRevisions = (id: string) => api<Revision[]>(`/admin/content/${encodeURIComponent(id)}/revisions`);
export const getTags = () => api<TagWithCount[]>("/admin/tags");
export const getLabels = () => api<LabelWithCount[]>("/admin/labels");
export const getSummary = () => api<Summary>("/admin/content/summary");
export const getActivity = (pageSize = 12) =>
  api<{ items: AuditEntry[]; total: number }>(`/admin/audit?page_size=${pageSize}`);
export const getMedia = () => api<MediaItem[]>("/admin/media");
export const getSiteAdmin = () => api<SiteAdmin>("/admin/site");
export const getUsers = (scope: "team" | "members" = "team") =>
  api<import("@/lib/auth").AdminUser[]>(`/admin/users?scope=${scope}&limit=200`);
export const getInvites = () => api<import("@/lib/admin/types").InviteRow[]>("/admin/invites");

// ---------- Phase 5 ----------

export const getSyncStatus = () => api<SyncStatus>("/admin/sync");
export const getStats = (days = 30) => api<Stats>(`/admin/stats?days=${days}`);
export const getAuditFacets = () => api<AuditFacets>("/admin/audit/facets");

export function getAudit(query: AuditQuery) {
  const p = new URLSearchParams({ page: String(query.page ?? 1), page_size: String(query.pageSize ?? 50) });
  const keys = { q: "q", action: "action", entityType: "entity_type", actor: "actor", since: "since", until: "until" } as const;
  for (const [k, param] of Object.entries(keys)) {
    const v = query[k as keyof typeof keys];
    if (v) p.set(param, v);
  }
  return api<{ items: AuditEntry[]; total: number; page: number; pageSize: number }>(`/admin/audit?${p}`);
}
