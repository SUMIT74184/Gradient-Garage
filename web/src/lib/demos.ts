import { cacheLife } from "next/cache";
import { site } from "@/config/site";
import { localDemos } from "@/data/demos";
import { getJson, hfHeaders, mergeById, prettyName } from "@/lib/hf";
import type { Demo, DemoSdk } from "@/lib/types";

type HFSpace = {
  id: string;
  likes?: number;
  sdk?: string;
  lastModified?: string;
  tags?: string[];
  models?: string[];
  subdomain?: string;
  cardData?: { title?: string; emoji?: string; short_description?: string };
};

const SDKS: DemoSdk[] = ["gradio", "streamlit", "docker", "static"];

function fromHF(s: HFSpace): Demo {
  const [, slug = s.id] = s.id.split("/");
  const sdk = SDKS.includes(s.sdk as DemoSdk) ? (s.sdk as DemoSdk) : "web";
  return {
    id: s.id,
    name: s.cardData?.title ?? prettyName(slug),
    description: s.cardData?.short_description ?? "Interactive demo on Hugging Face Spaces.",
    sdk,
    url: `https://huggingface.co/spaces/${s.id}`,
    embedUrl: s.subdomain ? `https://${s.subdomain}.hf.space` : undefined,
    models: s.models ?? [],
    emoji: s.cardData?.emoji,
    likes: s.likes ?? 0,
    tags: (s.tags ?? []).filter((t) => !t.includes(":") && t !== sdk).slice(0, 5),
    updatedAt: s.lastModified ?? new Date(0).toISOString(),
    source: "huggingface",
  };
}

async function fetchHFSpaces(username: string): Promise<Demo[]> {
  "use cache";
  cacheLife("hours");

  if (!username) return [];
  const params = new URLSearchParams({ author: username, limit: "100", sort: "likes" });
  for (const f of ["likes", "sdk", "lastModified", "tags", "models", "subdomain", "cardData"])
    params.append("expand[]", f);
  const data = await getJson<HFSpace[]>(`https://huggingface.co/api/spaces?${params}`, hfHeaders());
  return (data ?? []).map(fromHF);
}

/** Spaces are served from https://<owner>-<name>.hf.space, which can be embedded in an iframe. */
function spaceEmbedUrl(url: string) {
  const m = url.match(/huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/);
  return m ? `https://${`${m[1]}-${m[2]}`.toLowerCase().replace(/[._]/g, "-")}.hf.space` : undefined;
}

/** Local demo registry merged with live Hugging Face Spaces. */
export async function getDemos(): Promise<Demo[]> {
  const remote = await fetchHFSpaces(site.hfUsername);
  const local = localDemos.map((d) => ({ ...d, embedUrl: d.embedUrl ?? spaceEmbedUrl(d.url) }));
  return mergeById(remote, local, (hf, local) => ({
    likes: hf.likes,
    updatedAt: hf.updatedAt,
    embedUrl: local.embedUrl ?? hf.embedUrl,
    models: [...new Set([...hf.models, ...local.models])],
    source: "huggingface" as const,
  })).sort((a, b) => b.likes - a.likes);
}
