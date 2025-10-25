import { NextRequest } from 'next/server';

type LogLevel = 'info' | 'success' | 'warning' | 'error';

interface CandidateProfile {
  id: string;
  displayName: string;
  source: 'github' | 'linkedin' | 'site';
  headline: string;
  location: string;
  avatarUrl: string;
  profileUrl: string;
}

interface ProfileCard {
  summary: string;
  keywords: string[];
  queries: string[];
  preferences: {
    depth: 'theory' | 'practice' | 'mixed';
    format: 'code' | 'essay' | 'video' | 'mixed';
    novelty: 'low' | 'medium' | 'high';
  };
  evidence: Array<{
    claim: string;
    support_url: string;
  }>;
}

interface FeedItem {
  id: string;
  source: 'arxiv' | 'hn' | 'github' | 'news';
  title: string;
  summary: string;
  because: string;
  url: string;
  date: string;
}

interface DeepenDigest {
  tldr: string;
  why_me: string;
  next_actions: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const toSlug = (value: string) => value.toLowerCase().replace(/\s+/g, '-');

const avatarFor = (name: string, variant: string) =>
  `https://avatar.vercel.sh/${encodeURIComponent(name)}.${variant}?text=${encodeURIComponent(
    name
      .split(' ')
      .map(part => part[0] ?? '')
      .join('')
      .slice(0, 2)
  )}`;

const sourceBadges: Record<CandidateProfile['source'], string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  site: 'Website',
};

function buildCandidates(name: string): CandidateProfile[] {
  const baseSlug = toSlug(name || 'candidate');
  return [
    {
      id: `${baseSlug}-gh`,
      displayName: `${name} (GitHub)`,
      source: 'github',
      headline: 'Maintainer • Neural systems • Open-source',
      location: 'San Francisco, US',
      avatarUrl: avatarFor(name, 'png'),
      profileUrl: `https://github.com/${baseSlug}`,
    },
    {
      id: `${baseSlug}-li`,
      displayName: `${name} (LinkedIn)`,
      source: 'linkedin',
      headline: 'Senior Research Scientist @ Theta Labs',
      location: 'Seattle, US',
      avatarUrl: avatarFor(`${name}-li`, 'png'),
      profileUrl: `https://www.linkedin.com/in/${baseSlug}`,
    },
    {
      id: `${baseSlug}-site`,
      displayName: `${name} (Site)`,
      source: 'site',
      headline: 'Founder • Neural Feed • Personal site',
      location: 'Remote',
      avatarUrl: avatarFor(`${name}-site`, 'png'),
      profileUrl: `https://${baseSlug}.dev`,
    },
    {
      id: `${baseSlug}-extra`,
      displayName: `${name} (Scholar)`,
      source: 'site',
      headline: 'Adjunct Professor • Applied ML • Scholar',
      location: 'Toronto, CA',
      avatarUrl: avatarFor(`${name}-scholar`, 'png'),
      profileUrl: `https://scholar.google.com/${baseSlug}`,
    },
  ];
}

function buildProfileCard(name: string): ProfileCard {
  return {
    summary: `${name} leads applied AI initiatives, blending research on representation learning with production-grade systems that ship to users.`,
    keywords: [
      'representation learning',
      'retrieval augmented generation',
      'autonomous agents',
      'scalable infra',
      'ml ops',
      'product strategy',
    ],
    queries: [
      `${name} retrieval augmented generation`,
      `${name} agentic workflows`,
      'neural feed architecture',
      'practical ml systems 2024',
    ],
    preferences: {
      depth: 'mixed',
      format: 'mixed',
      novelty: 'medium',
    },
    evidence: [
      {
        claim: 'Led design of autonomous curation pipeline for AI personalization.',
        support_url: 'https://example.com/case-study',
      },
      {
        claim: 'Published guidance on combining symbolic search with LLM reasoning.',
        support_url: 'https://medium.com/@jianingqi/systems',
      },
      {
        claim: 'Maintains GitHub repos on retrievers and evaluation harnesses.',
        support_url: 'https://github.com/jianingqi',
      },
    ],
  };
}

function buildFeedItems(name: string): FeedItem[] {
  const base = [
    {
      id: 'arxiv-2501-graph-bridges',
      source: 'arxiv' as const,
      title: 'Graph-Augmented Retrieval for Streaming Agents',
      summary: 'Hybrid retrieval graph enables agents to adapt to rapidly changing corpora.',
      because: 'mirrors your retrieval augmented generation focus.',
      url: 'https://arxiv.org/abs/2501.01234',
      date: '2025-01-18',
    },
    {
      id: 'hn-42562121',
      source: 'hn' as const,
      title: 'We shipped a lightweight vector DB on SQLite',
      summary: 'A lean approach to on-device embeddings with strong benchmarks.',
      because: 'aligns with your scalable infra preference.',
      url: 'https://news.ycombinator.com/item?id=42562121',
      date: '2025-01-17',
    },
    {
      id: 'gh-labs-agentkit',
      source: 'github' as const,
      title: 'labmlai/agentkit',
      summary: 'Composable agent toolkit with built-in evaluation harnesses.',
      because: 'targets autonomous agents exploration.',
      url: 'https://github.com/labmlai/agentkit',
      date: '2025-01-16',
    },
    {
      id: 'news-mlops-eu',
      source: 'news' as const,
      title: 'EU firms double down on continuous eval for LLM products',
      summary: 'Survey shows trend toward real-time eval loops in production AI.',
      because: 'supports your product strategy work.',
      url: 'https://example.com/news/eu-llm-eval',
      date: '2025-01-13',
    },
    {
      id: 'arxiv-2412-rag-routing',
      source: 'arxiv' as const,
      title: 'Routing Ensembles for Multi-granular Retrieval',
      summary: 'Mixture-of-experts controller for retrieval decisions.',
      because: 'speaks to representation learning interests.',
      url: 'https://arxiv.org/abs/2412.06789',
      date: '2024-12-22',
    },
    {
      id: 'gh-openfeed',
      source: 'github' as const,
      title: 'open-feed/observer',
      summary: 'Event-driven pipeline for personalized content ranking.',
      because: 'echoes your autonomous curation pipeline.',
      url: 'https://github.com/open-feed/observer',
      date: '2024-12-19',
    },
    {
      id: 'hn-42491234',
      source: 'hn' as const,
      title: 'A practical guide to evaluation-driven agent systems',
      summary: 'Practitioners share lessons on closing the loop for agents.',
      because: 'matches your evaluation interest.',
      url: 'https://news.ycombinator.com/item?id=42491234',
      date: '2024-12-18',
    },
    {
      id: 'news-llm-cortex',
      source: 'news' as const,
      title: 'Cortex opens agent logs for transparency',
      summary: 'Open-sourcing log schema to make agents auditable.',
      because: 'fits your preference for high signal logs.',
      url: 'https://example.com/news/cortex-agent-logs',
      date: '2024-12-12',
    },
    {
      id: 'arxiv-2411-synopsis',
      source: 'arxiv' as const,
      title: 'Synopsis: Summarizing Long Agent Traces',
      summary: 'Compressing agent traces into actionable briefs.',
      because: 'reinforces your summarization workflows.',
      url: 'https://arxiv.org/abs/2411.04567',
      date: '2024-11-28',
    },
    {
      id: 'gh-curator',
      source: 'github' as const,
      title: 'curator-dev/rank-slate',
      summary: 'Differentiable ranking blocks for feed personalization.',
      because: 'aligns with your feed ranking experiments.',
      url: 'https://github.com/curator-dev/rank-slate',
      date: '2024-11-24',
    },
  ];

  return base.map(item => ({
    ...item,
    because: item.because.replace('your', `${name.split(' ')[0]}'s`),
  }));
}

function buildDeepenDigest(item: FeedItem, firstName: string): DeepenDigest {
  return {
    tldr: `${item.title} distills concrete tactics for ${firstName}'s current focus on ${item.because.replace('.', '')}`,
    why_me: `It mirrors priorities tagged in your profile.`,
    next_actions: [
      'Skim highlighted sections for implementation notes.',
      'Capture 2 takeaways into your lab notebook.',
      'Flag follow-up questions for the next refresh run.',
    ],
  };
}

function sendEvent(controller: ReadableStreamDefaultController, type: string, data: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

async function handleDiscover(controller: ReadableStreamDefaultController, name: string) {
  sendEvent(controller, 'stage', { state: 'DiscoverCandidates' });
  sendEvent(controller, 'log', {
    message: `Searching public web for "${name}"…`,
    level: 'info' as LogLevel,
  });

  await delay(700);

  const candidates = buildCandidates(name);
  sendEvent(controller, 'log', {
    message: `Found ${candidates.length} candidate profiles.`,
    level: 'success' as LogLevel,
  });
  sendEvent(controller, 'candidates', { candidates });
  sendEvent(controller, 'stage', { state: 'AwaitUserConfirm' });
  sendEvent(controller, 'complete', { message: 'Discovery complete.' });
}

async function handleRun(controller: ReadableStreamDefaultController, name: string, candidateId: string | undefined) {
  if (!candidateId) {
    sendEvent(controller, 'error', { message: 'Candidate confirmation is required.' });
    controller.close();
    return;
  }

  const firstName = name.split(' ')[0] ?? name;
  const candidates = buildCandidates(name);
  const confirmed = candidates.find(candidate => candidate.id === candidateId) ?? candidates[0];

  sendEvent(controller, 'stage', { state: 'ResolveEntities' });
  sendEvent(controller, 'log', {
    message: `Confirmed ${sourceBadges[confirmed.source]}:${confirmed.profileUrl}.`,
    level: 'success' as LogLevel,
  });

  await delay(600);
  sendEvent(controller, 'log', {
    message: 'Resolving linked identities (website, LinkedIn, Scholar, X)…',
    level: 'info' as LogLevel,
  });

  await delay(900);
  sendEvent(controller, 'stage', { state: 'HarvestPublicData' });
  sendEvent(controller, 'log', {
    message: 'Crawling website (depth 2)… kept 4 pages.',
    level: 'info' as LogLevel,
  });

  await delay(900);
  sendEvent(controller, 'log', {
    message: 'Fetching GitHub repos & stars…',
    level: 'info' as LogLevel,
  });

  await delay(900);
  sendEvent(controller, 'log', {
    message: 'Parsing LinkedIn (public page)…',
    level: 'warning' as LogLevel,
  });

  await delay(900);
  sendEvent(controller, 'log', {
    message: 'Collecting news mentions (last 12 months)…',
    level: 'info' as LogLevel,
  });

  await delay(900);
  sendEvent(controller, 'log', {
    message: 'Pruning & deduplicating snippets (cap 20).',
    level: 'info' as LogLevel,
  });

  await delay(600);
  const profileCard = buildProfileCard(firstName);
  sendEvent(controller, 'stage', { state: 'BuildProfile' });
  sendEvent(controller, 'log', {
    message: 'Summarizing to profile (LLM)… done.',
    level: 'success' as LogLevel,
  });
  sendEvent(controller, 'profile', { profileCard });

  await delay(800);
  sendEvent(controller, 'stage', { state: 'FetchCandidates' });
  sendEvent(controller, 'log', {
    message: 'Fetching candidates (arXiv/HN/GitHub)… 63 items.',
    level: 'info' as LogLevel,
  });

  await delay(1000);
  sendEvent(controller, 'stage', { state: 'RankAndExplain' });
  sendEvent(controller, 'log', {
    message: 'Ranking & explaining (LLM)…',
    level: 'info' as LogLevel,
  });

  const feedItems = buildFeedItems(firstName);
  await delay(1400);
  sendEvent(controller, 'log', {
    message: 'Ranking complete.',
    level: 'success' as LogLevel,
  });
  sendEvent(controller, 'feed', { items: feedItems });

  sendEvent(controller, 'complete', { message: 'Run complete.' });
}

export async function POST(request: NextRequest) {
  const phase = request.nextUrl.searchParams.get('phase') ?? 'discover';

  const body = await request.json().catch(() => ({}));
  const name: string | undefined = body.name;
  const candidateId: string | undefined = body.candidateId;

  if (!name || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Name is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (phase === 'discover') {
          await handleDiscover(controller, name);
        } else {
          await handleRun(controller, name, candidateId);
        }
      } catch (error) {
        sendEvent(controller, 'error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const itemId = searchParams.get('itemId');
  const name = searchParams.get('name') ?? 'You';

  if (!itemId) {
    return new Response(JSON.stringify({ error: 'itemId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const feedItems = buildFeedItems(name);
  const item = feedItems.find(entry => entry.id === itemId);

  if (!item) {
    return new Response(JSON.stringify({ error: 'Unknown feed item.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const digest = buildDeepenDigest(item, name.split(' ')[0] ?? name);

  return new Response(JSON.stringify(digest), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
