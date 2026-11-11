import { cacheLife } from "next/cache";
import { site } from "@/config/site";
import { localModels } from "@/data/models";
import { asArray, getJson, hfHeaders, mergeById, prettyName } from "@/lib/hf";
import type { MLModel } from "@/lib/types";

type HFModel = {
  id: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  library_name?: string;
  lastModified?: string;
  tags?: string[];
  safetensors?: { total?: number };
  cardData?: {
    license?: string;
    base_model?: string | string[];
    datasets?: string | string[];
  };
};

const HF_FIELDS = [
  "downloads",
  "likes",
  "pipeline_tag",
  "library_name",
  "lastModified",
  "tags",
  "safetensors",
  "cardData",
];

// Tags the Hub adds automatically; not useful to show
const NOISE_TAG = /^(base_model:|license:|dataset:|arxiv:|region:|endpoints_compatible|deploy:|autotrain_compatible|text-generation-inference|safetensors|eval-results)/;

function formatParams(n?: number): string | undefined {
  if (!n) return undefined;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  return `${Math.round(n / 1e3)}K`;
}

function fromHF(m: HFModel): MLModel {
  const [author, slug = m.id] = m.id.split("/");
  const tags = m.tags ?? [];
  const baseModel =
    asArray(m.cardData?.base_model)[0] ??
    tags
      .find((t) => t.startsWith("base_model:"))
      ?.replace(/^base_model:(finetune:|adapter:|quantized:|merge:)?/, "");
  const datasets = asArray(m.cardData?.datasets);
  if (!datasets.length) {
    for (const t of tags) if (t.startsWith("dataset:")) datasets.push(t.slice(8));
  }
  const task = m.pipeline_tag ?? "other";

  return {
    id: m.id,
    name: prettyName(slug),
    author,
    description: `${prettyName(task)} model${baseModel ? ` fine-tuned from ${baseModel}` : ""}.`,
    task,
    kind: baseModel ? "fine-tuned" : "base",
    baseModel,
    datasets,
    params: formatParams(m.safetensors?.total),
    license:
      m.cardData?.license ?? tags.find((t) => t.startsWith("license:"))?.slice(8) ?? "unknown",
    library: m.library_name,
    tags: tags.filter((t) => !NOISE_TAG.test(t) && t !== task && t !== m.library_name).slice(0, 6),
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    updatedAt: m.lastModified ?? new Date(0).toISOString(),
    links: { huggingface: `https://huggingface.co/${m.id}` },
    source: "huggingface",
  };
}

async function fetchHFModels(username: string): Promise<MLModel[]> {
  "use cache";
  cacheLife("hours");

  if (!username) return [];
  const params = new URLSearchParams({ author: username, limit: "200", sort: "downloads" });
  for (const f of HF_FIELDS) params.append("expand[]", f);

  const data = await getJson<HFModel[]>(`https://huggingface.co/api/models?${params}`, hfHeaders());
  return (data ?? []).map(fromHF);
}

/** Local registry merged with live Hugging Face models (local metadata wins, HF stats win). */
export async function getModels(): Promise<MLModel[]> {
  const remote = await fetchHFModels(site.hfUsername);
  return mergeById(remote, localModels, (hf, local) => ({
    downloads: hf.downloads,
    likes: hf.likes,
    updatedAt: hf.updatedAt,
    links: { ...hf.links, ...local.links },
    source: "huggingface" as const,
  })).sort((a, b) => b.downloads - a.downloads);
}
