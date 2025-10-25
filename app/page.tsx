'use client';

import { useCallback, useMemo, useState } from 'react';
import { AgentLog } from '../components/agent-log';
import { CandidateGallery } from '../components/candidate-gallery';
import { DeepenDrawer } from '../components/deepen-drawer';
import { FeedList } from '../components/feed-list';
import { HarvestSkeleton } from '../components/harvest-skeleton';
import { ProfileCard } from '../components/profile-card';
import { NameInput } from '../components/name-input';
import { CandidatePool } from '../components/candidate-pool';
import {
  AgentState,
  CandidateProfile,
  DeepenDigest,
  CandidatePoolItem,
  FeedItem,
  LogEntry,
  LogLevel,
  ProfileCardData,
} from '../types';

type Phase = 'discover' | 'run';

interface StreamPayload {
  type: string;
  [key: string]: unknown;
}

const stageLabelMap: Partial<Record<AgentState, string>> = {
  DiscoverCandidates: 'Discover',
  AwaitUserConfirm: 'Await Confirm',
  ResolveEntities: 'Resolve',
  HarvestPublicData: 'Harvest',
  BuildProfile: 'Profile',
  FetchCandidates: 'Fetch',
  RankAndExplain: 'Rank',
};

export default function Home() {
  const [name, setName] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [profileCard, setProfileCard] = useState<ProfileCardData | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [explorationItems, setExplorationItems] = useState<FeedItem[]>([]);
  const [candidatePool, setCandidatePool] = useState<CandidatePoolItem[]>([]);
  const [remainingItems, setRemainingItems] = useState<CandidatePoolItem[]>([]);
  const [planMeta, setPlanMeta] = useState<{ mode: string; plan: Record<string, string[]> } | null>(null);

  const [drawerItem, setDrawerItem] = useState<FeedItem | null>(null);
  const [drawerDigest, setDrawerDigest] = useState<DeepenDigest | null>(null);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);

  const appendLog = useCallback((message: string, level: LogLevel = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        level,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const handleStreamEvent = useCallback(
    (payload: StreamPayload, phase: Phase) => {
      switch (payload.type) {
        case 'log': {
          appendLog(String(payload.message ?? ''), (payload.level as LogLevel) ?? 'info');
          break;
        }
        case 'stage': {
          const state = payload.state as AgentState;
          if (state) {
            setAgentState(state);
          }
          break;
        }
        case 'candidates': {
          const candidatePayload = Array.isArray(payload.candidates) ? payload.candidates : [];
          setCandidates(candidatePayload as CandidateProfile[]);
          if (candidatePayload.length === 0) {
            setError('No confident identity found. Provide a GitHub handle or public bio snippet.');
          }
          break;
        }
        case 'profile': {
          setProfileCard(payload.profileCard as ProfileCardData);
          break;
        }
        case 'feed': {
          const items = Array.isArray(payload.items) ? (payload.items as FeedItem[]) : [];
          const exploration = Array.isArray(payload.explorationItems) ? (payload.explorationItems as FeedItem[]) : [];
          const remaining = Array.isArray(payload.remaining) ? (payload.remaining as CandidatePoolItem[]) : [];
          setFeedItems(items.slice(0, 10));
          setExplorationItems(exploration);
          setRemainingItems(remaining);
          break;
        }
        case 'candidate_pool': {
          const poolItems = Array.isArray(payload.items) ? (payload.items as CandidatePoolItem[]) : [];
          const plan = (payload.plan as Record<string, string[]>) ?? {};
          const mode = (payload.mode as string) ?? 'fallback';
          setCandidatePool(poolItems);
          setPlanMeta({ mode, plan });
          break;
        }
        case 'error': {
          const message = String(payload.message ?? 'Unknown error');
          setError(message);
          appendLog(message, 'error');
          if (phase === 'discover') {
            setIsDiscovering(false);
          } else {
            setIsRunning(false);
          }
          break;
        }
        case 'complete': {
          if (phase === 'discover') {
            setIsDiscovering(false);
          } else {
            setIsRunning(false);
          }
          break;
        }
        default:
          break;
      }
    },
    [appendLog],
  );

  const readStream = useCallback(
    async (response: Response, phase: Phase) => {
      if (!response.body) {
        throw new Error('Stream unavailable.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const segments = buffer.split('\n\n');
        buffer = segments.pop() ?? '';

        for (const segment of segments) {
          const line = segment.trim();
          if (!line.startsWith('data: ')) {
            continue;
          }
          const json = line.slice(6);
          try {
            const payload = JSON.parse(json) as StreamPayload;
            handleStreamEvent(payload, phase);
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Failed to parse SSE payload', err);
            }
          }
        }
      }
    },
    [handleStreamEvent],
  );

  const startDiscover = useCallback(
    async (targetName: string) => {
      setIsDiscovering(true);
      try {
        const response = await fetch('/api/feed?phase=discover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: targetName }),
        });
        if (!response.ok) {
          throw new Error('Failed to discover candidates.');
        }
        await readStream(response, 'discover');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start discovery.';
        setError(message);
        appendLog(message, 'error');
      } finally {
        setIsDiscovering(false);
      }
    },
    [appendLog, readStream],
  );

  const startRun = useCallback(
    async (targetName: string, candidateId: string) => {
      setIsRunning(true);
      try {
        const response = await fetch('/api/feed?phase=run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: targetName, candidateId }),
        });
        if (!response.ok) {
          throw new Error('Failed to run harvesting pipeline.');
        }
        await readStream(response, 'run');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline run failed.';
        setError(message);
        appendLog(message, 'error');
      } finally {
        setIsRunning(false);
      }
    },
    [appendLog, readStream],
  );

  const handleFind = useCallback(async () => {
    if (!name.trim()) {
      setError('Please enter a name.');
      appendLog('Please enter a name.', 'error');
      return;
    }

    setError(null);
    setLogs([]);
    setAgentState(null);
    setCandidates([]);
    setSelectedCandidate(null);
    setProfileCard(null);
    setFeedItems([]);
    setExplorationItems([]);
    setCandidatePool([]);
    setRemainingItems([]);
    setPlanMeta(null);
    setDrawerItem(null);
    setDrawerDigest(null);

    await startDiscover(name.trim());
  }, [appendLog, name, startDiscover]);

  const handleConfirmCandidate = useCallback(async () => {
    if (!selectedCandidate) {
      return;
    }
    setError(null);
    setProfileCard(null);
    setFeedItems([]);
    setExplorationItems([]);
    setCandidatePool([]);
    setRemainingItems([]);
    setPlanMeta(null);
    setDrawerItem(null);
    setDrawerDigest(null);
    await startRun(name.trim(), selectedCandidate.id);
  }, [name, selectedCandidate, startRun]);

  const handleDeepen = useCallback(
    async (item: FeedItem) => {
      setDrawerItem(item);
      setDrawerDigest(null);
      setIsDrawerLoading(true);
      try {
        const params = new URLSearchParams({
          itemId: item.id,
          name: name.trim() || 'You',
        });
        const response = await fetch(`/api/feed?${params.toString()}`, {
          method: 'GET',
        });
        if (!response.ok) {
          throw new Error('Failed to load deepen digest.');
        }
        const digest = (await response.json()) as DeepenDigest;
        setDrawerDigest(digest);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load deepen digest.';
        setError(message);
        appendLog(message, 'error');
      } finally {
        setIsDrawerLoading(false);
      }
    },
    [appendLog, name],
  );

  const stageLabel = useMemo(() => {
    if (!agentState) {
      return null;
    }
    return stageLabelMap[agentState] ?? agentState.replace(/([A-Z])/g, ' $1').trim();
  }, [agentState]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 py-10 text-white sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <NameInput value={name} onChange={setName} onSubmit={handleFind} disabled={isDiscovering || isRunning} />

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {candidates.length > 0 && (
            <CandidateGallery
              candidates={candidates}
              selectedId={selectedCandidate?.id ?? null}
              onSelect={(candidate) => setSelectedCandidate(candidate)}
              onConfirm={handleConfirmCandidate}
              isConfirming={isRunning}
            />
          )}

          {isRunning && !profileCard ? <HarvestSkeleton /> : null}

          {profileCard ? <ProfileCard profile={profileCard} /> : null}

          {feedItems.length > 0 ? (
            <FeedList items={feedItems} explorationItems={explorationItems} onDeepen={handleDeepen} />
          ) : null}

          {planMeta ? (
            <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-lg">
              <header className="mb-4">
                <h2 className="text-xl font-semibold text-white">Query Plan</h2>
                <p className="text-sm text-slate-400">
                  Mode: {planMeta.mode === 'llm' ? 'LLM-crafted queries' : 'Keyword fallback'}
                </p>
              </header>
              <div className="grid gap-4 sm:grid-cols-3">
                {Object.entries(planMeta.plan).map(([source, queries]) => (
                  <div key={source} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{source}</h3>
                    <ul className="mt-2 space-y-2 text-xs text-slate-300">
                      {queries.slice(0, 4).map((query) => (
                        <li key={query} className="line-clamp-2">{query}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(candidatePool.length > 0 || remainingItems.length > 0) ? (
            <CandidatePool pool={candidatePool} remainder={remainingItems} />
          ) : null}

          {!isDiscovering && !isRunning && logs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/60 p-8 text-center text-slate-400">
              Enter a name to kick off the agent-driven discovery.
            </div>
          )}
        </div>

        <AgentLog entries={logs} stage={stageLabel} />
      </div>

      <DeepenDrawer
        item={drawerItem}
        digest={drawerDigest}
        isLoading={isDrawerLoading}
        onClose={() => {
          setDrawerItem(null);
          setDrawerDigest(null);
        }}
      />
    </main>
  );
}
