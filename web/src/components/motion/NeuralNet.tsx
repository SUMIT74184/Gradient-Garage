/** Layered network diagram with signals travelling along the edges (pure CSS animation). */
const LAYERS = [3, 5, 5, 2];
const W = 360;
const H = 200;

export default function NeuralNet({ className = "" }: { className?: string }) {
  const nodes = LAYERS.map((count, l) =>
    Array.from({ length: count }, (_, i) => ({
      x: 30 + (l * (W - 60)) / (LAYERS.length - 1),
      y: H / 2 + (i - (count - 1) / 2) * 36,
    })),
  );
  const edges: { x1: number; y1: number; x2: number; y2: number; k: number }[] = [];
  let k = 0;
  for (let l = 0; l < nodes.length - 1; l++)
    for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, k: k++ });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      {edges.map((e) => (
        <line key={`b${e.k}`} {...e} stroke="rgb(220 220 225 / 0.08)" strokeWidth="1" />
      ))}
      {edges.map((e) => (
        <line
          key={`s${e.k}`}
          {...e}
          stroke="#ff9a4d"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="6 58"
          style={{
            animation: `signal ${1.6 + (e.k % 5) * 0.35}s linear infinite`,
            animationDelay: `${-(e.k * 0.37) % 3}s`,
            opacity: 0.35 + ((e.k * 13) % 7) / 12,
          }}
        />
      ))}
      {nodes.flat().map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="9" fill="#f07a2a" opacity="0.12" />
          <circle
            cx={n.x}
            cy={n.y}
            r="4.5"
            fill="#ffd989"
            style={{ animation: `node-pulse ${2 + (i % 4) * 0.5}s ease-in-out infinite`, animationDelay: `${-i * 0.3}s` }}
          />
        </g>
      ))}
    </svg>
  );
}
