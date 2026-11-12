/** Form definitions for the Site settings and Landing copy screens (one block = one saved key). */
import { DEFAULT_LANDING, DEFAULT_SECTIONS, DEFAULT_SITE } from "@/lib/content/defaults";

export type Desc =
  | { kind: "text"; key: string; label: string; help?: string; mono?: boolean; required?: boolean }
  | { kind: "textarea"; key: string; label: string; help?: string; rows?: number }
  | { kind: "strings"; key: string; label: string; help?: string }
  | { kind: "image"; key: string; label: string; help?: string }
  | { kind: "scenes"; key: string; label: string; help?: string; max: number }
  | { kind: "group"; key: string; label: string; fields: Desc[] }
  | { kind: "repeat"; key: string; label: string; itemLabel: string; fields: Desc[]; fixed?: boolean; max?: number; blank: Record<string, unknown> };

export type Block = {
  key: string;
  title: string;
  description?: string;
  fields: Desc[];
  defaultValue: Record<string, unknown>;
};

const MARKUP = "Supports *orange*, _dim_, `code` and {name}, {license}, {author}";

export const SITE_BLOCKS: Block[] = [
  {
    key: "site",
    title: "Site identity",
    description: "Name, logo mark and author shown across the site and in the browser tab.",
    defaultValue: DEFAULT_SITE,
    fields: [
      { kind: "text", key: "name", label: "Site name", required: true },
      { kind: "text", key: "mark", label: "Logo mark (1–3 letters)", required: true },
      { kind: "text", key: "tagline", label: "Tagline", help: "Used as the page description for search engines" },
      { kind: "text", key: "author", label: "Author" },
      { kind: "text", key: "authorRole", label: "Author role" },
      { kind: "text", key: "githubUrl", label: "GitHub URL", mono: true, help: "Used by every GitHub button" },
      { kind: "text", key: "license", label: "License", mono: true },
    ],
  },
  {
    key: "sections",
    title: "Section names",
    description: "What the four sections are called on the site and in the admin panel. Anchors (#checkpoints…) stay the same.",
    defaultValue: DEFAULT_SECTIONS,
    fields: (["model", "demo", "dataset", "library"] as const).map((k) => ({
      kind: "group" as const,
      key: k,
      label: { model: "Models", demo: "Demos", dataset: "Datasets", library: "Libraries" }[k],
      fields: [
        { kind: "text" as const, key: "label", label: "Section name", required: true },
        { kind: "text" as const, key: "item", label: "One item is a…", required: true },
        { kind: "text" as const, key: "blurb", label: "Short description" },
      ],
    })),
  },
];

const scene = { src: "", title: "", credit: "", href: "" };

export const LANDING_BLOCKS: Block[] = [
  {
    key: "landing.hero",
    title: "Hero",
    defaultValue: DEFAULT_LANDING.hero,
    fields: [
      { kind: "text", key: "headlineTop", label: "Headline, first line", help: "Shown muted. " + MARKUP },
      { kind: "text", key: "headlineBottom", label: "Headline, second line", help: MARKUP },
      { kind: "textarea", key: "subtitle", label: "Subtitle", rows: 3, help: "One sentence per line. " + MARKUP },
      { kind: "text", key: "primaryCta", label: "Main button", required: true },
      { kind: "text", key: "secondaryCta", label: "GitHub button", required: true },
      { kind: "scenes", key: "scenes", label: "Background scenes", max: 8, help: "Cycled every 9 s and drawn as particles. Use 2:1 images with the subject top-right." },
    ],
  },
  {
    key: "landing.stack",
    title: "“Runs on” strip",
    defaultValue: DEFAULT_LANDING.stack,
    fields: [{ kind: "strings", key: "items", label: "Tools", help: "Scrolls under the hero" }],
  },
  {
    key: "landing.manifesto",
    title: "Manifesto",
    defaultValue: DEFAULT_LANDING.manifesto,
    fields: [{ kind: "textarea", key: "text", label: "Quote", rows: 3, help: "~word~ draws the hand-drawn underline. " + MARKUP }],
  },
  {
    key: "landing.whatIs",
    title: "“What is…” card",
    defaultValue: DEFAULT_LANDING.whatIs,
    fields: [
      { kind: "text", key: "title", label: "Title", help: MARKUP },
      { kind: "textarea", key: "body", label: "Body", rows: 6, help: "Also {models}, {tasks}, {fineTunes} (live counts). " + MARKUP },
      { kind: "text", key: "footnote", label: "Footnote" },
    ],
  },
  {
    key: "landing.tryIt",
    title: "“Try it out”",
    defaultValue: DEFAULT_LANDING.tryIt,
    fields: [
      { kind: "text", key: "title", label: "Headline", help: "{words} is replaced by the flipping words. " + MARKUP },
      { kind: "strings", key: "words", label: "Flipping words" },
      { kind: "text", key: "note", label: "Note under the command", help: MARKUP },
      { kind: "textarea", key: "blurb", label: "Caption", rows: 3 },
      { kind: "image", key: "image", label: "Background photo", help: "Drawn as particles" },
    ],
  },
  {
    key: "landing.quote",
    title: "Quote",
    defaultValue: DEFAULT_LANDING.quote,
    fields: [{ kind: "textarea", key: "text", label: "Quote", rows: 2, help: MARKUP }],
  },
  {
    key: "landing.features",
    title: "Feature cards",
    description: "Four cards, each paired with its animation (network, lineage tree, benchmark bars, code).",
    defaultValue: DEFAULT_LANDING.features,
    fields: [
      {
        kind: "repeat",
        key: "items",
        label: "Cards",
        itemLabel: "Card",
        fixed: true,
        blank: { title: "", body: "", cta: "" },
        fields: [
          { kind: "text", key: "title", label: "Title", required: true },
          { kind: "textarea", key: "body", label: "Text", rows: 3, help: MARKUP },
          { kind: "text", key: "cta", label: "Button label", help: "Leave empty to hide the button (card 1 has none)" },
        ],
      },
    ],
  },
  {
    key: "landing.openSource",
    title: "Open-source call-out",
    defaultValue: DEFAULT_LANDING.openSource,
    fields: [
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Text", rows: 3, help: MARKUP },
      { kind: "text", key: "cta", label: "Link label" },
    ],
  },
  {
    key: "landing.faq",
    title: "FAQ",
    defaultValue: DEFAULT_LANDING.faq,
    fields: [
      {
        kind: "repeat",
        key: "items",
        label: "Questions",
        itemLabel: "Question",
        max: 30,
        blank: { q: "", a: "" },
        fields: [
          { kind: "text", key: "q", label: "Question", required: true },
          { kind: "textarea", key: "a", label: "Answer", rows: 3, help: MARKUP },
        ],
      },
    ],
  },
  {
    key: "landing.footer",
    title: "Footer",
    defaultValue: DEFAULT_LANDING.footer,
    fields: [{ kind: "text", key: "note", label: "Footer note", help: MARKUP }],
  },
];

export const EMPTY_SCENE = scene;
