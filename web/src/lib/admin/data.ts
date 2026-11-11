/** Server-side reads for the admin pages (uncached: admins always see the latest). */
import { api } from "@/lib/api";
import type {
  AdminItem,
  AuditEntry,
  ContentType,
  ItemList,
  LabelWithCount,
  Revision,
  Summary,
  TagWithCount,
} from "@/lib/admin/types";

export const adminEnabled = () => process.env.ADMIN_DEV_MODE === "true";

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
