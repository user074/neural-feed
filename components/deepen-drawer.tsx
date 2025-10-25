import { DeepenDigest, FeedItem } from '../types';

interface DeepenDrawerProps {
  item: FeedItem | null;
  digest: DeepenDigest | null;
  isLoading: boolean;
  onClose: () => void;
}

export function DeepenDrawer({ item, digest, isLoading, onClose }: DeepenDrawerProps) {
  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Deepen</p>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800/70" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-800/70" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800/70" />
            </div>
          ) : digest ? (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">TL;DR</h3>
                <p className="text-sm text-slate-200">{digest.tldr}</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Why you</h3>
                <p className="text-sm text-slate-200">{digest.why_me}</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Next actions</h3>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
                  {digest.next_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <p className="text-sm text-slate-400">Unable to load digest.</p>
          )}
        </div>
      </div>
    </div>
  );
}
