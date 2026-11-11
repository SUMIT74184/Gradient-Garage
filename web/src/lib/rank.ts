import type { Curation } from "@/lib/types";

/**
 * Admin curation first (featured, then pinned order), then `popularity` (higher first).
 * With no curation set this is a plain popularity sort.
 */
export function byCuration<T extends Curation>(popularity: (item: T) => number) {
  return (a: T, b: T) =>
    Number(!!b.featured) - Number(!!a.featured) ||
    (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
    popularity(b) - popularity(a);
}
