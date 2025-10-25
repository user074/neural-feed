import { useState } from 'react';
import { ProfileCardData } from '../types';

interface ProfileCardProps {
  profile: ProfileCardData;
}

const preferenceMap = {
  depth: {
    label: 'Depth',
    hints: {
      theory: 'Prefers conceptual deep dives.',
      practice: 'Wants production-ready tactics.',
      mixed: 'Balances theory with pragmatism.',
    },
    width: {
      theory: '25%',
      practice: '85%',
      mixed: '55%',
    },
  },
  format: {
    label: 'Format',
    hints: {
      code: 'Ship code samples and repos.',
      essay: 'Long-form essays resonate most.',
      video: 'High signal video walkthroughs.',
      mixed: 'Varied mediums keep attention.',
    },
    width: {
      code: '80%',
      essay: '45%',
      video: '65%',
      mixed: '50%',
    },
  },
  novelty: {
    label: 'Novelty',
    hints: {
      low: 'Prefers established best practices.',
      medium: 'Looks for incremental innovation.',
      high: 'Thrives on frontier research.',
    },
    width: {
      low: '35%',
      medium: '60%',
      high: '82%',
    },
  },
} as const;

type PreferenceKey = keyof typeof preferenceMap;

export function ProfileCard({ profile }: ProfileCardProps) {
  const [isEvidenceOpen, setEvidenceOpen] = useState(false);

  const toggleEvidence = () => setEvidenceOpen((prev) => !prev);

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
      <header className="mb-4 space-y-1">
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="text-sm text-slate-400">Strictly factual — capped at 80 words.</p>
      </header>
      <p className="text-base leading-relaxed text-slate-200">{profile.summary}</p>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Keywords</h3>
        <div className="flex flex-wrap gap-2">
          {profile.keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Preferences</h3>
        {(Object.keys(preferenceMap) as PreferenceKey[]).map((key) => {
          const preference = profile.preferences[key];
          const config = preferenceMap[key];
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>{config.label}</span>
                <span className="text-slate-200">{preference}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/80">
                <div
                  className="h-2 rounded-full bg-sky-500 transition-all"
                  style={{ width: config.width[preference] }}
                />
              </div>
              <p className="text-xs text-slate-400">{config.hints[preference]}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={toggleEvidence}
          className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/50 hover:text-white"
        >
          <span>Evidence ({profile.evidence.length})</span>
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {isEvidenceOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {isEvidenceOpen ? (
          <ul className="mt-3 space-y-3 text-sm text-slate-300">
            {profile.evidence.map((item) => (
              <li key={item.claim} className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <p>{item.claim}</p>
                <a
                  href={item.support_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 underline-offset-2 hover:underline"
                >
                  Source
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
