/** Turns audit log entries into readable sentences for the Overview and Activity pages. */
import { sectionByType } from "@/lib/admin/schema";
import type { AuditEntry, ContentType } from "@/lib/admin/types";

const CONTENT = new Set(["model", "dataset", "demo", "library"]);

export const ACTION_VERB: Record<string, string> = {
  create: "created",
  update: "edited",
  publish: "published",
  unpublish: "unpublished",
  archive: "archived",
  restore: "restored",
  delete: "deleted",
  reorder: "reordered",
  "sync.run": "ran the Hugging Face sync",
  "sync.import": "imported from Hugging Face",
  "sync.update": "synced from Hugging Face",
  "sync.release": "handed back to Hugging Face",
  "import.csv": "imported a CSV into",
  "import.create": "created from CSV",
  "import.update": "updated from CSV",
  "site.update": "changed site settings",
};

/** Label for the action filter dropdown */
export function actionLabel(action: string) {
  const verb = ACTION_VERB[action];
  return verb ? verb[0].toUpperCase() + verb.slice(1) : action.replace(/[._]/g, " ");
}

export function entityTypeLabel(t: string) {
  if (CONTENT.has(t)) return sectionByType(t as ContentType).label;
  return { tag: "Tags", label: "Labels", site: "Site", sync: "Sync", media: "Media", user: "Team", invite: "Invites" }[t] ?? t;
}

export function describe(e: AuditEntry) {
  const verb = ACTION_VERB[e.action] ?? e.action.replace(/[._]/g, " ");
  const isContent = CONTENT.has(e.entityType);
  const section = isContent ? sectionByType(e.entityType as ContentType) : null;
  let target = e.entityLabel || e.entityType;
  if (e.action === "reorder") target = `${section?.label ?? e.entityType} order`;
  if (e.action === "import.csv") target = section?.label ?? e.entityType;
  if (e.action === "sync.run") target = "";
  const href =
    isContent && e.entityId && e.action !== "delete" && e.action !== "reorder" && e.action !== "import.csv"
      ? `/admin/${section!.slug}/${e.entityId}`
      : e.action === "sync.run"
        ? "/admin/sync"
        : null;
  const detail = e.action === "sync.run" || e.action === "import.csv" ? e.entityLabel : "";
  const fields = ["update", "sync.update", "import.update"].includes(e.action) ? Object.keys(e.changes) : [];
  return { verb, target, href, fields, section, detail };
}

/** Short, single-line rendering of a changed value */
export function preview(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}
