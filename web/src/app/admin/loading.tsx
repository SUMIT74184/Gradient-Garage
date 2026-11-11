export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="space-y-2 border-b border-line pb-6">
        <div className="h-3 w-24 rounded bg-fg/10" />
        <div className="h-7 w-64 rounded bg-fg/10" />
      </div>
      <div className="h-10 rounded-lg bg-fg/5" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 rounded-lg bg-fg/5" />
        ))}
      </div>
    </div>
  );
}
