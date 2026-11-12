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
  coverMediaId: string | null;
  [key: string]: unknown;
};

export type AdminItem = ItemValues & {
  id: string;
  type: ContentType;
  status: Status;
  version: number;
  source: "local" | "huggingface";
  labels: AdminLabel[];
  cover: { url: string; alt: string; width: number; height: number } | null;
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

export type MediaUsage = { kind: "cover"; type: ContentType; id: string; name: string } | { kind: "site"; key: string };

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string;
  createdAt: string;
  usage: MediaUsage[];
};

export type SiteDoc = { value: Record<string, unknown>; version: number; updatedAt: string };
export type SiteAdmin = { keys: Record<string, { role: "owner" | "editor" }>; values: Record<string, SiteDoc> };
export type SiteRevision = { version: number; note: string; createdAt: string; createdBy: string | null; snapshot: Record<string, unknown> };

export type InviteRow = {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  state: "pending" | "expired" | "revoked" | "accepted";
  createdAt: string | null;
  expiresAt: string;
};

// ---------- Phase 5: sync, bulk, CSV, stats ----------

export type ItemRef = { id: string; type: ContentType; slug: string; name: string };

export type SyncReport = {
  authors: string[];
  created: ItemRef[];
  updated: (ItemRef & { fields: string[] })[];
  refreshed: number;
  unchanged: number;
  missing: ItemRef[];
  errors: string[];
  libraries: number;
};

export type SyncRun = {
  id: string;
  status: "running" | "succeeded" | "failed";
  trigger: "manual" | "schedule";
  actorEmail: string;
  report: Partial<SyncReport>;
  error: string;
  startedAt: string;
  finishedAt: string | null;
};

export type SyncSettings = {
  hfAuthors: string[];
  importModels: boolean;
  importDatasets: boolean;
  importDemos: boolean;
  refreshLibraries: boolean;
};

export type SyncStatus = {
  settings: SyncSettings;
  saved: boolean;
  tokens: { huggingface: boolean; github: boolean };
  runs: SyncRun[];
};

export type BulkAction =
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "add_tags"
  | "remove_tags"
  | "add_labels"
  | "remove_labels"
  | "add_badge"
  | "remove_badge"
  | "feature"
  | "unfeature"
  | "delete";

export type BulkResult = {
  action: BulkAction;
  done: string[];
  unchanged: string[];
  skipped: { id: string; name: string; reason: string }[];
};

export type ImportRow = {
  row: number;
  slug: string;
  action: "create" | "update" | "unchanged" | "error" | "skip";
  changes: string[];
  errors: { field: string; msg: string }[];
  id?: string;
};

export type ImportPlan = {
  type: ContentType;
  columns: string[];
  rows: ImportRow[];
  summary: Record<"create" | "update" | "unchanged" | "error" | "skip", number>;
};

export type StatsPoint = { date: string; downloads: number; likes: number; stars: number };

export type Mover = { id: string; type: ContentType; name: string; slug: string; downloads: number; gain: number | null };

export type Stats = {
  days: number;
  totals: Record<ContentType, { published: number; downloads: number; likes: number; stars: number }>;
  series: StatsPoint[];
  hasHistory: boolean;
  top: Mover[];
  rising: Mover[];
  attention: {
    drafts: number;
    hfImports: number;
    noDescription: number;
    recentDrafts: { id: string; type: ContentType; name: string; source: "local" | "huggingface"; updatedAt: string }[];
  };
  lastSync: { status: SyncRun["status"]; startedAt: string; finishedAt: string | null } | null;
};

export type AuditFacets = { actions: string[]; entityTypes: string[]; actors: string[] };

export type AuditQuery = {
  q?: string;
  action?: string;
  entityType?: string;
  actor?: string;
  since?: string;
  until?: string;
  page?: number;
  pageSize?: number;
};
