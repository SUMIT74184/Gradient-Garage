import { cacheLife } from "next/cache";
import { localLibraries } from "@/data/libraries";
import { getJson } from "@/lib/hf";
import { byCuration } from "@/lib/rank";
import type { Library } from "@/lib/types";

type GitHubRepo = {
  stargazers_count?: number;
  pushed_at?: string;
  license?: { spdx_id?: string } | null;
};

async function fetchRepo(repo: string): Promise<GitHubRepo | null> {
  "use cache";
  cacheLife("hours");
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return getJson<GitHubRepo>(`https://api.github.com/repos/${repo}`, headers);
}

async function fetchVersion(pypi?: string, npm?: string): Promise<string | undefined> {
  "use cache";
  cacheLife("hours");
  if (pypi) {
    const d = await getJson<{ info?: { version?: string } }>(`https://pypi.org/pypi/${pypi}/json`);
    return d?.info?.version;
  }
  if (npm) {
    const d = await getJson<{ version?: string }>(`https://registry.npmjs.org/${npm}/latest`);
    return d?.version;
  }
  return undefined;
}

/** Local library registry, with stars from GitHub and versions from PyPI / npm when configured. */
export async function getLibraries(): Promise<Library[]> {
  return enrichLibraries(localLibraries);
}

/** Add live stars, license and version from GitHub / PyPI / npm for libraries that set `repo`, `pypi` or `npm`. */
export async function enrichLibraries(source: Library[]): Promise<Library[]> {
  const libs = await Promise.all(
    source.map(async (lib) => {
      const [repo, version] = await Promise.all([
        lib.repo ? fetchRepo(lib.repo) : null,
        fetchVersion(lib.pypi, lib.npm),
      ]);
      const license = repo?.license?.spdx_id;
      return {
        ...lib,
        stars: repo?.stargazers_count ?? lib.stars,
        updatedAt: repo?.pushed_at ?? lib.updatedAt,
        license: license && license !== "NOASSERTION" ? license.toLowerCase() : lib.license,
        version: version ?? lib.version,
        links: {
          ...(lib.repo && { github: `https://github.com/${lib.repo}` }),
          ...(lib.pypi && { pypi: `https://pypi.org/project/${lib.pypi}/` }),
          ...(lib.npm && { npm: `https://www.npmjs.com/package/${lib.npm}` }),
          ...lib.links,
        },
      };
    }),
  );
  return libs.sort(byCuration((l) => l.stars));
}
