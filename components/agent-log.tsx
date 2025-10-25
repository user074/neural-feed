import { LogEntry } from '../types';

const levelStyles: Record<LogEntry['level'], string> = {
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
};

interface AgentLogProps {
  entries: LogEntry[];
  stage?: string | null;
}

export function AgentLog({ entries, stage }: AgentLogProps) {
  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-700/60 bg-slate-950/80 p-4 shadow-inner">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Agent Log</h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">Live stream</p>
        </div>
        {stage ? (
          <span className="rounded-full border border-slate-600/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
            {stage}
          </span>
        ) : null}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">Logs will appear once the agent starts working.</p>
        ) : (
          entries.map((entry) => (
            <p key={entry.id} className={`font-mono text-xs leading-5 ${levelStyles[entry.level]}`}>
              <span className="text-slate-500">[{entry.timestamp}]</span> {entry.message}
            </p>
          ))
        )}
      </div>
    </aside>
  );
}
