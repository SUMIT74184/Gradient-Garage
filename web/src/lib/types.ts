export type ModelKind = "base" | "fine-tuned";

/** Public status badge set in the admin panel */
export type Badge = "new" | "beta" | "updated" | "deprecated" | "coming_soon";

/** Curation fields set in the admin panel (absent when data comes from the static files). */
export type Curation = {
  badges?: Badge[];
  /** Shown first in its section */
  featured?: boolean;
  /** Manual pin order within a section, lower first */
  sortOrder?: number;
};

export type Benchmark = {
  name: string;
  score: number;
  /** Shown after the score, e.g. "%" */
  unit?: string;
  /** e.g. WER or perplexity, where smaller scores rank higher */
  lowerIsBetter?: boolean;
};

export type MLModel = Curation & {
  /** Hugging Face style id: "owner/model-name" */
  id: string;
  name: string;
  author: string;
  description: string;
  /** Pipeline task, e.g. "text-generation", "image-classification" */
  task: string;
  kind: ModelKind;
  baseModel?: string;
  datasets?: string[];
  /** Human readable size, e.g. "1.1B" */
  params?: string;
  license: string;
  library?: string;
  tags: string[];
  downloads: number;
  likes: number;
  /** ISO date */
  updatedAt: string;
  benchmarks?: Benchmark[];
  /** What the model outputs or detects, shown as chips in the detail drawer */
  capabilities?: string[];
  /** Custom Python usage snippet; overrides the generated one */
  usage?: string;
  links: {
    huggingface?: string;
    github?: string;
    paper?: string;
    demo?: string;
  };
  source: "local" | "huggingface";
};

/** A library, CLI or tool you wrote (not a model). */
export type Library = Curation & {
  /** Unique slug, e.g. "posekit" */
  id: string;
  name: string;
  description: string;
  /** e.g. "Python", "TypeScript", "Rust" */
  language: string;
  /** Install command shown with a copy button, e.g. "pip install posekit" */
  install: string;
  /** GitHub "owner/repo". When set, stars, license and updated date are pulled live. */
  repo?: string;
  /** PyPI package name. When set, the latest version is pulled live. */
  pypi?: string;
  /** npm package name. When set, the latest version is pulled live. */
  npm?: string;
  version?: string;
  stars: number;
  license: string;
  tags: string[];
  /** Short feature list shown as chips */
  features?: string[];
  /** Quickstart snippet shown in the detail drawer */
  usage?: string;
  /** Model ids built with this library; links them both ways */
  usedBy?: string[];
  /** ISO date */
  updatedAt: string;
  links: {
    github?: string;
    docs?: string;
    pypi?: string;
    npm?: string;
  };
};

export type Modality = "image" | "video" | "text" | "audio" | "tabular" | "multimodal" | "other";

/** A dataset you collected, labelled or cleaned. */
export type Dataset = Curation & {
  /** Hugging Face style id: "owner/dataset-name" */
  id: string;
  name: string;
  author: string;
  description: string;
  modality: Modality;
  /** Task it was built for, e.g. "object-detection" */
  task?: string;
  /** Human readable size, e.g. "12.4K images" */
  size?: string;
  /** Labels / classes, shown as chips */
  labels?: string[];
  license: string;
  tags: string[];
  downloads: number;
  likes: number;
  /** ISO date */
  updatedAt: string;
  /** Notes on consent, anonymisation or known limitations */
  notes?: string;
  links: {
    huggingface?: string;
    github?: string;
    paper?: string;
  };
  source: "local" | "huggingface";
};

export type DemoSdk = "gradio" | "streamlit" | "docker" | "static" | "web";

/** A runnable demo: a Hugging Face Space or any hosted app. */
export type Demo = Curation & {
  /** Space id "owner/space" or any unique slug */
  id: string;
  name: string;
  description: string;
  sdk: DemoSdk;
  /** Page people open */
  url: string;
  /** URL that can be shown inside an iframe (Spaces: https://<sub>.hf.space) */
  embedUrl?: string;
  /** Model ids the demo runs */
  models: string[];
  emoji?: string;
  likes: number;
  tags: string[];
  /** ISO date */
  updatedAt: string;
  source: "local" | "huggingface";
};

export type Hub = {
  models: MLModel[];
  libraries: Library[];
  datasets: Dataset[];
  demos: Demo[];
};

/** Anything that can be opened in the detail drawer or found with ⌘K */
export type Selection =
  | { type: "model"; item: MLModel }
  | { type: "library"; item: Library }
  | { type: "dataset"; item: Dataset }
  | { type: "demo"; item: Demo };
