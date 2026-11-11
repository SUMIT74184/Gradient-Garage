/** Small helpers shared by the Hugging Face, GitHub and PyPI fetchers. */

export function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function prettyName(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function hfHeaders(): HeadersInit {
  return process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};
}

/** GET a JSON API; logs and returns null on any failure so the page still renders. */
export async function getJson<T>(url: string, headers: HeadersInit = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`${url} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    return null;
  }
}

/** Merge live entries with the local registry by id: local metadata wins, `live` picks the fields that come from the API. */
export function mergeById<T extends { id: string }>(
  remote: T[],
  local: T[],
  live: (remote: T, local: T) => Partial<T>,
): T[] {
  const byId = new Map<string, T>();
  for (const r of remote) byId.set(r.id.toLowerCase(), r);
  for (const l of local) {
    const key = l.id.toLowerCase();
    const r = byId.get(key);
    byId.set(key, r ? { ...r, ...l, ...live(r, l) } : l);
  }
  return [...byId.values()];
}
