import type { MLModel } from "@/lib/types";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Simple line glyphs per task family
function Glyph({ task }: { task: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (task.includes("keypoint") || task.includes("pose"))
    return (
      <g {...common}>
        <circle cx="24" cy="8" r="4" />
        <path d="M24 12v14M14 18l10 2 10-2M24 26l-8 14M24 26l8 14" />
      </g>
    );
  if (task.includes("object-detection"))
    return (
      <g {...common}>
        <rect x="6" y="10" width="20" height="16" rx="2" />
        <rect x="22" y="22" width="20" height="16" rx="2" strokeDasharray="3 3" />
        <path d="M30 6l4 4-4 4" />
      </g>
    );
  if (task.includes("image"))
    return (
      <g {...common}>
        <rect x="6" y="8" width="36" height="28" rx="4" />
        <circle cx="17" cy="18" r="4" />
        <path d="M6 32l11-9 8 6 7-5 10 8" />
      </g>
    );
  if (task.includes("speech") || task.includes("audio"))
    return (
      <g {...common}>
        <path d="M6 24h4M14 16v16M20 10v28M26 18v12M32 12v24M38 20v8M42 24h0" />
      </g>
    );
  if (task.includes("classification"))
    return (
      <g {...common}>
        <path d="M24 6l16 6v10c0 10-7 17-16 20C15 39 8 32 8 22V12z" />
        <path d="M17 23l5 5 9-10" />
      </g>
    );
  if (task.includes("similarity"))
    return (
      <g {...common}>
        <circle cx="16" cy="24" r="9" />
        <circle cx="32" cy="24" r="9" />
      </g>
    );
  return (
    <g {...common}>
      <path d="M8 14h32M8 24h24M8 34h28" />
    </g>
  );
}

/** Generated cover art: dot grid, a warm glow placed by the model id, and a task glyph. */
export default function ModelCover({ model }: { model: MLModel }) {
  const h = hash(model.id);
  const x = 20 + (h % 60);
  const y = 10 + ((h >> 4) % 60);
  return (
    <div
      aria-hidden="true"
      className="dot-bg relative h-28 overflow-hidden rounded-xl border border-line bg-surface-2"
      style={{
        backgroundImage: `radial-gradient(60% 90% at ${x}% ${y}%, rgb(240 122 42 / 0.35), transparent 70%), radial-gradient(circle, rgb(220 220 225 / 0.16) 1px, transparent 1px)`,
        backgroundSize: "auto, 14px 14px",
      }}
    >
      <svg viewBox="0 0 48 48" className="absolute bottom-3 right-3 size-14 text-brand-hover/90 transition-transform duration-500 group-hover:scale-110">
        <Glyph task={model.task} />
      </svg>
      <span className="absolute left-3 top-3 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-soft backdrop-blur">
        {model.task.replace(/-/g, " ")}
      </span>
    </div>
  );
}
