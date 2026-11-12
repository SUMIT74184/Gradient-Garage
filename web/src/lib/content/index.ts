import { cacheLife, cacheTag } from "next/cache";
import { api, API_URL } from "@/lib/api";
import {
  DEFAULT_CONTENT,
  DEFAULT_LANDING,
  DEFAULT_SECTIONS,
  DEFAULT_SITE,
  LANDING_KEYS,
  type Landing,
  type Sections,
  type SiteContent,
} from "@/lib/content/defaults";

/** Cache tag for site settings + landing copy; the admin panel expires it on save. */
export const SITE_TAG = "site";

type Stored = Record<string, Record<string, unknown> | undefined>;

/** Saved overrides on top of the built-in defaults, key by key. */
export function mergeContent(stored: Stored): SiteContent {
  const sections = Object.fromEntries(
    (Object.keys(DEFAULT_SECTIONS) as (keyof Sections)[]).map((k) => [
      k,
      { ...DEFAULT_SECTIONS[k], ...(stored.sections?.[k] as object | undefined) },
    ]),
  ) as Sections;
  const landing = Object.fromEntries(
    LANDING_KEYS.map((k) => [k, { ...DEFAULT_LANDING[k], ...stored[`landing.${k}`] }]),
  ) as Landing;
  return { site: { ...DEFAULT_SITE, ...stored.site }, sections, landing };
}

export async function getSiteContent(): Promise<SiteContent> {
  if (!API_URL) return DEFAULT_CONTENT;
  return getApiContent();
}

async function getApiContent(): Promise<SiteContent> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SITE_TAG);
  return mergeContent(await api<Stored>("/public/site"));
}
