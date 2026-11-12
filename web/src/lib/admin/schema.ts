/**
 * Admin sections and form definitions. Everything the admin UI knows about a content
 * type's fields lives here, so adding a field means one entry in FIELDS (plus the API).
 */
import { SECTIONS, SECTION_ORDER } from "@/config/sections";
import type { Badge } from "@/lib/types";
import type { ContentType, ItemValues, Status } from "@/lib/admin/types";

export const ADMIN_SECTIONS = SECTION_ORDER.map((type) => ({
  type: type as ContentType,
  /** URL segment: /admin/checkpoints */
  slug: SECTIONS[type].id,
  label: SECTIONS[type].label,
  item: SECTIONS[type].item,
}));

export function sectionBySlug(slug: string) {
  return ADMIN_SECTIONS.find((s) => s.slug === slug);
}

export function sectionByType(type: ContentType) {
  return ADMIN_SECTIONS.find((s) => s.type === type)!;
}

export const STATUS_META: Record<Status, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-line-strong bg-fg/5 text-soft" },
  published: { label: "Published", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  archived: { label: "Archived", className: "border-red-400/25 bg-red-400/10 text-red-300" },
};

export const BADGES: Badge[] = ["new", "beta", "updated", "deprecated", "coming_soon"];

export type FieldKind = "text" | "textarea" | "code" | "select" | "number" | "list" | "date";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Empty input is sent as null */
  nullable?: boolean;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  mono?: boolean;
  /** Spans both columns in the details grid */
  wide?: boolean;
};

const TASK_HELP = "Hugging Face pipeline tag, e.g. text-generation, image-classification";

/** Type-specific fields, shown under "Details" (common fields are rendered separately). */
export const FIELDS: Record<ContentType, FieldDef[]> = {
  model: [
    { key: "author", label: "Author", kind: "text", placeholder: "your-username" },
    { key: "task", label: "Task", kind: "text", mono: true, help: TASK_HELP, placeholder: "text-generation" },
    { key: "kind", label: "Kind", kind: "select", options: ["base", "fine-tuned"] },
    { key: "baseModel", label: "Base model", kind: "text", nullable: true, mono: true, placeholder: "owner/model", help: "Only for fine-tunes" },
    { key: "params", label: "Parameters", kind: "text", nullable: true, placeholder: "1.1B" },
    { key: "license", label: "License", kind: "text", mono: true, placeholder: "apache-2.0" },
    { key: "library", label: "Library", kind: "text", nullable: true, placeholder: "transformers" },
    { key: "downloads", label: "Downloads", kind: "number" },
    { key: "likes", label: "Likes", kind: "number" },
    { key: "datasets", label: "Trained on (dataset ids)", kind: "list", wide: true, placeholder: "owner/dataset, press Enter" },
    { key: "capabilities", label: "Capabilities", kind: "list", wide: true, placeholder: "e.g. Calories, press Enter", help: "What it outputs or detects; shown as chips" },
    { key: "usage", label: "Usage snippet (Python)", kind: "code", nullable: true, wide: true, help: "Leave empty to use the generated snippet" },
  ],
  dataset: [
    { key: "author", label: "Author", kind: "text", placeholder: "your-username" },
    { key: "modality", label: "Modality", kind: "select", options: ["image", "video", "text", "audio", "tabular", "multimodal", "other"] },
    { key: "task", label: "Task", kind: "text", nullable: true, mono: true, help: TASK_HELP },
    { key: "size", label: "Size", kind: "text", nullable: true, placeholder: "12.4K images" },
    { key: "license", label: "License", kind: "text", mono: true, placeholder: "cc-by-4.0" },
    { key: "downloads", label: "Downloads", kind: "number" },
    { key: "likes", label: "Likes", kind: "number" },
    { key: "classLabels", label: "Classes", kind: "list", wide: true, placeholder: "e.g. Squat, press Enter", help: "The dataset's own labels / classes" },
    { key: "notes", label: "Notes (consent, anonymisation, limits)", kind: "textarea", nullable: true, wide: true },
  ],
  demo: [
    { key: "sdk", label: "SDK", kind: "select", options: ["gradio", "streamlit", "docker", "static", "web"] },
    { key: "emoji", label: "Emoji", kind: "text", nullable: true, placeholder: "🥗" },
    { key: "url", label: "URL", kind: "text", required: true, wide: true, mono: true, placeholder: "https://huggingface.co/spaces/owner/space" },
    { key: "embedUrl", label: "Embed URL", kind: "text", nullable: true, wide: true, mono: true, placeholder: "https://owner-space.hf.space", help: "Lets visitors run it inside the page. Leave empty for sites that block iframes" },
    { key: "likes", label: "Likes", kind: "number" },
    { key: "models", label: "Runs these models (ids)", kind: "list", wide: true, placeholder: "owner/model, press Enter" },
  ],
  library: [
    { key: "language", label: "Language", kind: "text", placeholder: "Python" },
    { key: "packageVersion", label: "Version", kind: "text", nullable: true, mono: true, placeholder: "1.0.0" },
    { key: "install", label: "Install command", kind: "text", wide: true, mono: true, placeholder: "pip install mylib" },
    { key: "repo", label: "GitHub repo", kind: "text", nullable: true, mono: true, placeholder: "owner/repo", help: "Stars and license are pulled live" },
    { key: "pypi", label: "PyPI package", kind: "text", nullable: true, mono: true },
    { key: "npm", label: "npm package", kind: "text", nullable: true, mono: true },
    { key: "stars", label: "Stars", kind: "number" },
    { key: "license", label: "License", kind: "text", mono: true, placeholder: "mit" },
    { key: "features", label: "Features", kind: "list", wide: true, placeholder: "e.g. Rep counting, press Enter" },
    { key: "usedBy", label: "Used by (model ids)", kind: "list", wide: true, placeholder: "owner/model, press Enter" },
    { key: "usage", label: "Quickstart snippet", kind: "code", nullable: true, wide: true },
  ],
};

export const LINK_KEYS: Record<ContentType, string[]> = {
  model: ["huggingface", "github", "paper", "demo"],
  dataset: ["huggingface", "github", "paper"],
  demo: [],
  library: ["github", "docs", "pypi", "npm"],
};

export const LINK_LABEL: Record<string, string> = {
  huggingface: "Hugging Face",
  github: "GitHub",
  paper: "Paper",
  demo: "Demo",
  docs: "Docs",
  pypi: "PyPI",
  npm: "npm",
};

/** Starting values for a new item of `type`. */
export function emptyValues(type: ContentType): ItemValues {
  const base: ItemValues = {
    slug: "",
    name: "",
    description: "",
    links: {},
    badges: [],
    featured: false,
    sortOrder: null,
    contentDate: new Date().toISOString().slice(0, 10),
    tags: [],
    labelIds: [],
    coverMediaId: null,
  };
  for (const f of FIELDS[type]) {
    base[f.key] =
      f.kind === "list" ? [] : f.kind === "number" ? 0 : f.kind === "select" ? f.options![0] : f.nullable ? null : "";
  }
  if (type === "model") {
    base.task = "text-generation";
    base.license = "apache-2.0";
    base.benchmarks = [];
  }
  if (type === "dataset" || type === "library") base.license = type === "library" ? "mit" : "cc-by-4.0";
  if (type === "demo") base.sdk = "gradio";
  return base;
}

/** The editable keys for a type, in the order the API knows them. */
export function editableKeys(type: ContentType): string[] {
  const common = ["slug", "name", "description", "links", "badges", "featured", "contentDate", "tags", "labelIds", "coverMediaId"];
  return [...common, ...FIELDS[type].map((f) => f.key), ...(type === "model" ? ["benchmarks"] : [])];
}
