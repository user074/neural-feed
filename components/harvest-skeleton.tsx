export function HarvestSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
      <header className="mb-4 space-y-1">
        <h2 className="text-xl font-semibold text-white">Harvesting public data…</h2>
        <p className="text-sm text-slate-400">The agent is crawling sources and deduplicating snippets.</p>
      </header>
      <div className="space-y-4">
        {[1, 2, 3].map((group) => (
          <div key={group} className="space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-slate-800/70" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-800/60" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-800/60" />
          </div>
        ))}
        <div className="space-y-2">
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-800/70" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-800/60" />
        </div>
      </div>
    </section>
  );
}
