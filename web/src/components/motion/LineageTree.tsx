/** Base model branching into fine-tunes, drawn in when it scrolls into view. */
export default function LineageTree({
  base,
  branches,
  className = "",
}: {
  base: string;
  branches: string[];
  className?: string;
}) {
  const kids = branches.slice(0, 3);
  const H = 56 + kids.length * 44;
  return (
    <svg viewBox={`0 0 360 ${H}`} className={className} aria-hidden="true">
      <rect x="8" y="10" width="150" height="28" rx="6" fill="rgb(220 220 225 / 0.05)" stroke="rgb(220 220 225 / 0.18)" />
      <text x="18" y="28" fill="#ededee" fontSize="11" fontFamily="var(--font-geist-mono)">
        {base.length > 20 ? `${base.slice(0, 19)}…` : base}
      </text>
      {kids.map((c, i) => {
        const y = 64 + i * 44;
        const d = `M40 38 V${y + 14} H190`;
        return (
          <g key={c}>
            <path
              d={d}
              fill="none"
              stroke="#f07a2a"
              strokeWidth="1.4"
              strokeDasharray="400"
              style={{ animation: `draw-line 1.4s ${0.3 + i * 0.25}s cubic-bezier(.2,.7,.2,1) both` }}
            />
            <rect x="190" y={y} width="162" height="28" rx="6" fill="rgb(240 122 42 / 0.1)" stroke="rgb(240 122 42 / 0.4)" />
            <text x="200" y={y + 18} fill="#ffd989" fontSize="11" fontFamily="var(--font-geist-mono)">
              {c.length > 21 ? `${c.slice(0, 20)}…` : c}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
