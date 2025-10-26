import { CandidatePoolItem, FeedItem } from '../types';

interface CandidatePoolProps {
  pool: CandidatePoolItem[];
  remainder: CandidatePoolItem[];
}

const sourceStyles: Record<CandidatePoolItem['source'], string> = {
  arxiv: 'text-purple-300',
  hn: 'text-amber-300',
  news: 'text-sky-300',
  github: 'text-emerald-300',
  x: 'text-indigo-300',
};

export function CandidatePool({ pool, remainder }: CandidatePoolProps) {
  if (pool.length === 0 && remainder.length === 0) {
    return null;
  }

  const sections = [
    {
      title: 'Candidate Pool',
      description: 'All fetched items before ranking.',
      items: pool,
    },
    {
      title: 'Remaining Suggestions',
      description: 'Items not in the top feed — explore manually.',
      items: remainder,
    },
  ].filter(section => section.items.length > 0);

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
      <header className="mb-4">
        <h2 className="text-xl font-semibold text-white">Full Candidate Pool</h2>
        <p className="text-sm text-slate-400">
          Includes every item fetched from ArXiv, Hacker News, X.com, and news/blog sources.
        </p>
      </header>
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{section.title}</h3>
              <p className="text-xs text-slate-500">{section.description}</p>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span className={sourceStyles[item.source] ?? 'text-slate-300'}>{item.source.toUpperCase()}</span>
                    <span>{item.date}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {item.title}
                    </a>
                  </h4>
                  <p className="mt-1 text-sm text-slate-300">{item.snippet}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
