/**
 * Built-in site copy. The admin panel (Site settings / Landing copy) saves overrides per key;
 * anything never saved falls back to these values. The API validates the same shapes
 * (api/app/schemas/site.py), so keep the two in step when adding a field.
 *
 * Text supports a small markup, rendered by <Rich>: *orange*, _dim_, ~underlined~, `code`,
 * a new line for a line break, and {placeholders} such as {name}, {license}, {author},
 * {models}, {tasks}, {fineTunes}.
 */
import { site as siteConfig } from "@/config/site";
import type { SectionKey } from "@/config/sections";

export type Scene = { src: string; title: string; credit: string; href: string };

export type SiteSettings = {
  name: string;
  mark: string;
  tagline: string;
  author: string;
  authorRole: string;
  githubUrl: string;
  license: string;
};

export type SectionName = { label: string; item: string; blurb: string };
export type Sections = Record<SectionKey, SectionName>;

export type Landing = {
  hero: {
    headlineTop: string;
    headlineBottom: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    scenes: Scene[];
  };
  stack: { items: string[] };
  manifesto: { text: string };
  whatIs: { title: string; body: string; footnote: string };
  tryIt: { title: string; words: string[]; note: string; blurb: string; image: Scene };
  quote: { text: string };
  features: { items: { title: string; body: string; cta: string }[] };
  openSource: { title: string; body: string; cta: string };
  faq: { items: { q: string; a: string }[] };
  footer: { note: string };
};

export type SiteContent = { site: SiteSettings; sections: Sections; landing: Landing };

export const DEFAULT_SITE: SiteSettings = {
  name: siteConfig.name,
  mark: siteConfig.mark,
  tagline: siteConfig.tagline,
  author: siteConfig.author,
  authorRole: siteConfig.authorRole,
  githubUrl: siteConfig.githubUrl,
  license: siteConfig.license,
};

export const DEFAULT_SECTIONS: Sections = {
  model: { label: "Checkpoints", item: "Checkpoint", blurb: "Trained & fine-tuned weights" },
  demo: { label: "Playground", item: "Playground", blurb: "Run them in the browser" },
  dataset: { label: "Corpus", item: "Corpus", blurb: "The data behind the weights" },
  library: { label: "Toolkit", item: "Toolkit", blurb: "Libraries & SDKs you can install" },
};

const SCENE_FOCUS_NOTE = "Pre-composed 2:1, subject in the top-right corner";

export const DEFAULT_LANDING: Landing = {
  hero: {
    headlineTop: "Closed weights. More black boxes.",
    headlineBottom: "_Open the model._ Start *measuring*.",
    subtitle:
      "{name}: an open-source hub for my checkpoints, toolkit, corpus and playground.\nWeights, training data, code and benchmarks, all public.\nPick a model, read its evals, pull it in one line.",
    primaryCta: "Browse checkpoints",
    secondaryCta: "Star on GitHub",
    scenes: [
      {
        src: "/scenes/acacia.jpg",
        title: "Acacia at sunrise, Serengeti",
        credit: "Daniel Zaas, public domain",
        href: "https://commons.wikimedia.org/wiki/File:Acacia_tree_on_a_sunrise_safari_at_the_Serengeti_National_Park,_Tanzania.jpg",
      },
      {
        src: "/scenes/giraffe.jpg",
        title: "Giraffe at dusk, Masai Mara",
        credit: "LindaPatterson, CC BY-SA 3.0 (edited)",
        href: "https://commons.wikimedia.org/wiki/File:Masi_mara_sunset_and_giraffe_-_panoramio.jpg",
      },
      {
        src: "/scenes/serengeti.jpg",
        title: "Treeline at sunset, Serengeti",
        credit: "Anita Ritenour, CC BY 2.0",
        href: "https://commons.wikimedia.org/wiki/File:Serengeti_Sunset.jpg",
      },
    ],
  },
  stack: { items: ["PyTorch", "Transformers", "PEFT · LoRA", "Safetensors", "ONNX", "vLLM", "llama.cpp"] },
  manifesto: { text: "“_Big labs_ ship models behind *APIs*.\nI ship the ~weights~, the data and the _evals_.”" },
  whatIs: {
    title: "What is *{name}*?",
    body:
      "{name} is an open-source catalog of machine-learning models: {models} models across {tasks} tasks, {fineTunes} of them fine-tunes with their full lineage. Every entry lists its base model, training data, license and benchmark scores, plus a copy-paste snippet to run it. Weights live on Hugging Face, so you pull them straight into PyTorch, Transformers or your own stack. *No API keys*, *no paywall*, *no black boxes*. {license}-licensed, and contributions are welcome.",
    footnote: "{models} models · Open source · {license}",
  },
  tryIt: {
    title: "Pull any {words} into your stack in *one line*.",
    words: ["LLM", "fine-tune", "ViT", "Whisper", "embedder"],
    note: "Needs Python 3.10+ and `huggingface_hub`. No GPU? Small models run fine on CPU.",
    blurb:
      "Instead of digging through model cards and scattered repos, you get one place that lists every model, how it was trained, how it scores, and the exact code to run it.",
    image: {
      src: "/elephant.jpg",
      title: "African sunset with elephant",
      credit: "Liv Unni Sødem, CC BY 2.0",
      href: "https://commons.wikimedia.org/wiki/File:African_sunset_with_elephant.jpg",
    },
  },
  quote: { text: "“A model you can’t inspect is a model you can’t *trust*.”" },
  features: {
    items: [
      {
        title: "Open weights. Open data.",
        body: "Every model ships with its weights, its training datasets and a model card. Nothing is gated behind an API, and you can fine-tune any of them further.",
        cta: "",
      },
      {
        title: "Fine-tunes with lineage.",
        body: "See exactly which base model each fine-tune started from, what data moved it, and how much it gained. `base → sft → dpo`, all traceable.",
        cta: "See the lineage",
      },
      {
        title: "Benchmarks you can rerun.",
        body: "MMLU, HellaSwag, HumanEval, WER and more, reported per model and ranked on the leaderboard. Same harness, same prompts, so the numbers compare.",
        cta: "Open the leaderboard",
      },
      {
        title: "Shipped with the community.",
        body: "{name} grows through pull requests: new models, new evals, fixes to model cards. Open an issue, send a PR, and your model shows up here on the next deploy.",
        cta: "Contribute a model",
      },
    ],
  },
  openSource: {
    title: "100% Open-Source.",
    body: "Built by *{author}* and trained in the open.\nEvery training config and eval script is published.\nNow open to the community.",
    cta: "Meet the contributors →",
  },
  faq: {
    items: [
      {
        q: "Are these models really free to use?",
        a: "Yes. Every model lists its license (Apache-2.0, MIT and so on) on its card. Most allow commercial use; check the license field before you ship.",
      },
      {
        q: "How are the benchmarks measured?",
        a: "Scores come from standard harnesses (lm-eval-harness for language models, held-out test splits for vision and speech). Each model card notes the setup, so you can rerun it yourself.",
      },
      {
        q: "Can I fine-tune one of these models further?",
        a: "Absolutely. Base models are meant for it, and fine-tunes can be stacked. Open the model, copy the snippet, and point your trainer (Transformers, PEFT, Axolotl) at the id.",
      },
      {
        q: "How do I add my own model?",
        a: "Add an entry to the registry file and open a pull request, or publish it on Hugging Face under the configured account and it appears automatically.",
      },
    ],
  },
  footer: { note: "{license}-licensed. Weights are distributed under each model's own license." },
};

/** Landing keys as stored by the API ("landing.hero", …), with what each one edits. */
export const LANDING_KEYS = Object.keys(DEFAULT_LANDING) as (keyof Landing)[];

export const SCENE_HELP = SCENE_FOCUS_NOTE;

export const DEFAULT_CONTENT: SiteContent = { site: DEFAULT_SITE, sections: DEFAULT_SECTIONS, landing: DEFAULT_LANDING };
