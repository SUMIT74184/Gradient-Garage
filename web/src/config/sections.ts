/**
 * Dashboard vocabulary. Every section name, anchor and item label comes from
 * here, so the site keeps its own naming (and doesn't borrow Hugging Face's
 * "Models / Datasets / Spaces"). Rename things in this one file.
 */
export const SECTIONS = {
  model: { id: "checkpoints", label: "Checkpoints", item: "Checkpoint", blurb: "Trained & fine-tuned weights" },
  demo: { id: "playground", label: "Playground", item: "Playground", blurb: "Run them in the browser" },
  dataset: { id: "corpus", label: "Corpus", item: "Corpus", blurb: "The data behind the weights" },
  library: { id: "toolkit", label: "Toolkit", item: "Toolkit", blurb: "Libraries & SDKs you can install" },
} as const;

export type SectionKey = keyof typeof SECTIONS;

/** Display order of the four sections (overview tiles, navbar, search results) */
export const SECTION_ORDER: SectionKey[] = ["model", "demo", "dataset", "library"];

export const href = (key: SectionKey) => `#${SECTIONS[key].id}`;

/** Checkpoint task groups shown as the first filter row. "Vision" = computer-vision checkpoints. */
export const DOMAINS: { id: string; label: string; match: (task: string) => boolean }[] = [
  {
    id: "vision",
    label: "Vision",
    match: (t) =>
      /^(image-|object-detection|keypoint-detection|depth-estimation|video-|mask-generation|zero-shot-image|zero-shot-object|unconditional-image)/.test(
        t,
      ),
  },
  {
    id: "language",
    label: "Language",
    match: (t) =>
      /^(text-|token-classification|question-answering|summarization|translation|fill-mask|sentence-similarity|feature-extraction|zero-shot-classification|table-)/.test(
        t,
      ),
  },
  {
    id: "audio",
    label: "Audio",
    match: (t) => /^(automatic-speech-recognition|audio-|text-to-speech|text-to-audio|voice-activity)/.test(t),
  },
];

export function domainOf(task: string) {
  return DOMAINS.find((d) => d.match(task))?.label ?? "Other";
}
