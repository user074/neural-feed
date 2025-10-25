import Image from 'next/image';
import { CandidateProfile } from '../types';

interface CandidateGalleryProps {
  candidates: CandidateProfile[];
  selectedId: string | null;
  onSelect: (candidate: CandidateProfile) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

const sourceCopy: Record<CandidateProfile['source'], string> = {
  github: 'GitHub',
  site: 'Website',
};

export function CandidateGallery({
  candidates,
  selectedId,
  onSelect,
  onConfirm,
  isConfirming,
}: CandidateGalleryProps) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
      <header className="mb-5 space-y-1">
        <h2 className="text-xl font-semibold text-white">Confirm your profile</h2>
        <p className="text-sm text-slate-400">
          Pick the card that matches you. We only continue once you confirm.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {candidates.map((candidate) => {
          const isSelected = selectedId === candidate.id;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate)}
              className={`flex w-full flex-col gap-3 rounded-xl border px-4 py-4 text-left transition ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/20'
                  : 'border-slate-700/70 bg-slate-900/80 hover:border-sky-500/50 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Image
                  src={candidate.avatarUrl}
                  alt={candidate.displayName}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full border border-slate-700/70 object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{candidate.displayName}</h3>
                    <span className="rounded-full border border-slate-600/70 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-300">
                      {sourceCopy[candidate.source]}
                    </span>
                  </div>
                  {candidate.location ? <p className="text-xs text-slate-400">{candidate.location}</p> : null}
                </div>
              </div>
              <p className="text-sm text-slate-300">
                {candidate.summary ?? candidate.headline ?? 'Candidate identified from search results.'}
              </p>
              <p className="text-xs text-slate-500 truncate">{candidate.profileUrl}</p>
              {candidate.mergedFrom && candidate.mergedFrom.length > 1 ? (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Merged sources</p>
                  <ul className="space-y-1">
                    {candidate.mergedFrom.slice(0, 3).map(source => (
                      <li key={source.url} className="text-[12px] text-slate-400">
                        <span className="line-clamp-1">{source.title ?? source.url}</span>
                      </li>
                    ))}
                    {candidate.mergedFrom.length > 3 ? (
                      <li className="text-[12px] text-slate-500">+{candidate.mergedFrom.length - 3} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedId || isConfirming}
          className="inline-flex items-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {isConfirming ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    </section>
  );
}
