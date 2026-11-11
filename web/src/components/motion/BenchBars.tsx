/** Benchmark bars that grow and gently breathe. */
export default function BenchBars({
  items,
  className = "",
}: {
  items: { label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={`flex h-40 items-end gap-3 ${className}`} aria-hidden="true">
      {items.map((it, i) => (
        <div key={it.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-gold-300">{it.value.toFixed(1)}</span>
          <div
            className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-gold-600 via-brand to-gold-300"
            style={{
              height: `${(it.value / max) * 100}px`,
              animation: `bar-grow 1.2s ${i * 0.12}s cubic-bezier(.2,.7,.2,1) both`,
            }}
          />
          <span className="max-w-full truncate font-mono text-[10px] text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
