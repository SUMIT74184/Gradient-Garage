import type { Badge } from "@/lib/types";

export const BADGE_META: Record<Badge, { label: string; className: string }> = {
  new: { label: "New", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  beta: { label: "Beta", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  updated: { label: "Updated", className: "border-brand/30 bg-brand/10 text-brand-hover" },
  deprecated: { label: "Deprecated", className: "border-red-400/30 bg-red-400/10 text-red-300" },
  coming_soon: { label: "Coming soon", className: "border-gold-400/30 bg-gold-400/10 text-gold-300" },
};

/** Status badges set in the admin panel (New, Beta, Deprecated…). Renders nothing when there are none. */
export default function StatusBadges({ badges, className = "" }: { badges?: Badge[]; className?: string }) {
  if (!badges?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {badges.map((b) =>
        BADGE_META[b] ? (
          <span
            key={b}
            className={`rounded-md border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${BADGE_META[b].className}`}
          >
            {BADGE_META[b].label}
          </span>
        ) : null,
      )}
    </span>
  );
}
