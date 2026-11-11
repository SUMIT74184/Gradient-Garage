import type { Badge } from "@/lib/types";

export type ContentType = "model" | "dataset" | "demo" | "library";
export type Status = "draft" | "published" | "archived";
export type Transition = "publish" | "unpublish" | "archive" | "restore";

export type AdminLabel = { id: string; name: string; color: string; description: string };
export type LabelWithCount = AdminLabel & { count: number };
export type TagWithCount = { id: string; name: string; slug: string; count: number };

export type BenchmarkRow = { name: string; score: number; unit?: string | null; lowerIsBetter?: boolean };

/** Editable fields, camelCase, as the admin API sends and accepts them. Type-specific keys vary. */
export type ItemValues = {
  slug: string;
  name: string;
  description: string;
  links: Record<string, string>;
  badges: Badge[];
  featured: boolean;
  sortOrder: number | null;
  contentDate: string | null;
  tags: string[];
  labelIds: string[];
  [key: string]: unknown;
};

export type AdminItem = ItemValues & {
  id: string;
  type: ContentType;
  status: Status;
  version: number;
  source: "local" | "huggingface";
  labels: AdminLabel[];
  editedFields: string[];
  hfSyncedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemList = { items: AdminItem[]; total: number; page: number; pageSize: number };

export type Revision = {
  id: string;
  version: number;
  note: string;
  createdAt: string;
  createdBy: string | null;
  snapshot?: Record<string, unknown> | null;
};

export type AuditEntry = {
  id: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type Summary = { counts: Record<ContentType, Record<Status, number>> };

/** What every server action returns to the client. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; fieldErrors?: Record<string, string>; currentVersion?: number };
