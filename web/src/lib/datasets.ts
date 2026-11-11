import { cacheLife } from "next/cache";
import { site } from "@/config/site";
import { localDatasets } from "@/data/datasets";
import { getJson, hfHeaders, mergeById, prettyName } from "@/lib/hf";
import type { Dataset, Modality } from "@/lib/types";

type HFDataset = {
  id: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
  cardData?: { license?: string | string[]; pretty_name?: string };
  description?: string;
};

const MODALITIES: Modality[] = ["image", "video", "text", "audio", "tabular"];

function tagValues(tags: string[], prefix: string) {
  return tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
}

/** "1K<n<10K" -> "1K–10K", "n<1K" -> "< 1K", "n>1T" -> "> 1T" */
function formatSizeCategory(c: string) {
  const range = c.match(/^(\w+)<n<(\w+)$/);
  if (range) return `${range[1]}–${range[2]}`;
  return c.replace(/^n([<>])/, "$1 ");
}

function fromHF(d: HFDataset): Dataset {
  const [author, slug = d.id] = d.id.split("/");
  const tags = d.tags ?? [];
  const modalities = tagValues(tags, "modality:").filter((m): m is Modality =>
    MODALITIES.includes(m as Modality),
  );
  const task = tagValues(tags, "task_categories:")[0];
  const size = tagValues(tags, "size_categories:")[0];
  const license = [d.cardData?.license].flat()[0] ?? tagValues(tags, "license:")[0] ?? "unknown";

  return {
    id: d.id,
    name: d.cardData?.pretty_name ?? prettyName(slug),
    author,
    description: d.description?.trim().split("\n")[0] || `${prettyName(task ?? "ML")} dataset.`,
    modality: modalities.length > 1 ? "multimodal" : (modalities[0] ?? "other"),
    task,
    size: size ? `${formatSizeCategory(size)} rows` : undefined,
    license,
    tags: tags.filter((t) => !t.includes(":")).slice(0, 6),
    downloads: d.downloads ?? 0,
    likes: d.likes ?? 0,
    updatedAt: d.lastModified ?? new Date(0).toISOString(),
    links: { huggingface: `https://huggingface.co/datasets/${d.id}` },
    source: "huggingface",
  };
}

async function fetchHFDatasets(username: string): Promise<Dataset[]> {
  "use cache";
  cacheLife("hours");

  if (!username) return [];
  const params = new URLSearchParams({ author: username, limit: "100", sort: "downloads" });
  for (const f of ["downloads", "likes", "lastModified", "tags", "cardData", "description"])
    params.append("expand[]", f);
  const data = await getJson<HFDataset[]>(`https://huggingface.co/api/datasets?${params}`, hfHeaders());
  return (data ?? []).map(fromHF);
}

/** Local dataset registry merged with live Hugging Face datasets. */
export async function getDatasets(): Promise<Dataset[]> {
  const remote = await fetchHFDatasets(site.hfUsername);
  return mergeById(remote, localDatasets, (hf, local) => ({
    downloads: hf.downloads,
    likes: hf.likes,
    updatedAt: hf.updatedAt,
    links: { ...hf.links, ...local.links },
    source: "huggingface" as const,
  })).sort((a, b) => b.downloads - a.downloads);
}
