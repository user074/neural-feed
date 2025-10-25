import { FeedItem } from '../types';

interface FeedListProps {
  items: FeedItem[];
  explorationItems?: FeedItem[];
  onDeepen: (item: FeedItem) => void;
}

const sourceStyles: Record<FeedItem['source'], string> = {
  arxiv: 'bg-purple-500/20 text-purple-200 border border-purple-500/40',
  hn: 'bg-amber-500/20 text-amber-200 border border-amber-500/40',
  github: 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/40',
  news: 'bg-sky-500/20 text-sky-100 border border-sky-500/40',
};

const sourceLabel: Record<FeedItem['source'], string> = {
  arxiv: 'arXiv',
  hn: 'HN',
  github: 'GH',
  news: 'News',
};

export function FeedList({ items, explorationItems = [], onDeepen }: FeedListProps) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
      <header className="mb-4">
        <h2 className="text-xl font-semibold text-white">Neural Feed</h2>
        <p className="text-sm text-slate-400">Ten items tuned to this profile. Click to open, deepen for context.</p>
      </header>
      <div className="space-y-8">
        <div className="space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Core Picks</h3>
          {items.map((item) => (
            <article key={item.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sourceStyles[item.source]}`}>
                  {sourceLabel[item.source]}
                </span>
                <span className="text-xs text-slate-500">{item.date}</span>
              </div>
              <h3 className="text-lg font-semibold text-sky-200">
                <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {item.title}
                </a>
              </h3>
              <p className="text-sm text-slate-300">{item.summary}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Because… <span className="normal-case font-normal text-slate-200">{item.because}</span></p>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onDeepen(item)}
                  className="rounded-md border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-white"
                >
                  Deepen
                </button>
              </div>
            </article>
          ))}
        </div>

        {explorationItems.length > 0 ? (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Exploration Picks</h3>
            {explorationItems.map((item) => (
              <article key={item.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sourceStyles[item.source]}`}>
                    {sourceLabel[item.source]}
                  </span>
                  <span className="text-xs text-slate-500">{item.date}</span>
                </div>
                <h3 className="text-base font-semibold text-sky-200">
                  <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {item.title}
                  </a>
                </h3>
                <p className="text-sm text-slate-300">{item.summary}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Because… <span className="normal-case font-normal text-slate-200">{item.because}</span></p>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onDeepen(item)}
                    className="rounded-md border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-white"
                  >
                    Deepen
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
