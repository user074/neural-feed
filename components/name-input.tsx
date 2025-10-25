import { FormEvent } from 'react';

interface NameInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function NameInput({ value, onChange, onSubmit, disabled }: NameInputProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-6 shadow-xl ring-1 ring-slate-700/60">
        <div>
          <h1 className="text-3xl font-semibold text-white">Neural Feed</h1>
          <p className="text-sm text-slate-300/90">
            We&apos;ll search the public web, then you&apos;ll confirm who you are. From there the agent takes over.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder='Your name (e.g., "Ilya Sutskever")'
            className="flex-1 rounded-lg border border-slate-600/70 bg-slate-950/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-3 text-base font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {disabled ? 'Working…' : 'Find me'}
          </button>
        </div>
      </div>
    </form>
  );
}
