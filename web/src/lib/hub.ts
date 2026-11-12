import { cacheLife, cacheTag } from "next/cache";
import { getDatasets } from "@/lib/datasets";
import { getDemos } from "@/lib/demos";
import { getLibraries } from "@/lib/libraries";
import { getModels } from "@/lib/models";
import { api, API_URL } from "@/lib/api";
import { byCuration } from "@/lib/rank";
import type { Hub } from "@/lib/types";

/** Cache tag for the public hub; the admin panel expires it after every change. */
export const HUB_TAG = "hub";

/**
 * Everything the page shows.
 *
 * With API_URL set, published content comes from the admin API (Postgres). Otherwise
 * it comes from src/data merged with Hugging Face, as before.
 */
export async function getHub(): Promise<Hub> {
  if (API_URL) return getApiHub();
  const [models, libraries, datasets, demos] = await Promise.all([
    getModels(),
    getLibraries(),
    getDatasets(),
    getDemos(),
  ]);
  return { models, libraries, datasets, demos };
}

async function getApiHub(): Promise<Hub> {
  "use cache";
  cacheLife("minutes");
  cacheTag(HUB_TAG);
  // Throws on failure so an error is never cached; Next keeps serving the last good copy
  const hub = await api<Hub>("/public/hub");
  return {
    models: hub.models.sort(byCuration((m) => m.downloads)),
    datasets: hub.datasets.sort(byCuration((d) => d.downloads)),
    demos: hub.demos.sort(byCuration((d) => d.likes)),
    // Stars and versions are refreshed by the API's sync job (admin → Hugging Face sync)
    libraries: hub.libraries.sort(byCuration((l) => l.stars)),
  };
}
