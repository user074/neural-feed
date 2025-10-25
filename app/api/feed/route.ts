import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import type {
  AgentState,
  CandidateProfile,
  DeepenDigest,
  FeedItem,
  LogLevel,
  ProfileCardData,
} from '../../../types';

type CandidateSource = CandidateProfile['source'];

interface HarvestSnippet {
  source: string;
  title: string;
  snippet: string;
  url: string;
}

interface IdentityResult {
  core: string;
  identities: string[];
}

interface CandidateContent {
  id: string;
  source: FeedItem['source'];
  title: string;
  snippet: string;
  url: string;
  date: string;
}

interface SearchResult {
  title: string;
  url: string;
  description?: string;
}

interface CandidateCluster {
  display_name: string;
  primary_url: string;
  summary: string;
  support_urls: string[];
}

interface SourceQueryPlan {
  arxiv: string[];
  hn: string[];
  news: string[];
}

interface PlanResult {
  plan: SourceQueryPlan;
  mode: 'llm' | 'fallback';
}

interface FeedCacheEntry {
  item: FeedItem;
  profile: ProfileCardData;
  name: string;
  expires: number;
}

const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS ?? 8000);
const NEWS_WINDOW_MONTHS = 12;
const MAX_DOC_SNIPPETS = 20;
const CANDIDATE_TARGET = 30;
const FEED_CACHE_TTL = 15 * 60 * 1000;

const feedCache = new Map<string, FeedCacheEntry>();

const env = {
  googleSearchKey: process.env.GOOGLE_SEARCH_API_KEY ?? '',
  googleSearchCx: process.env.GOOGLE_SEARCH_CX ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModelProfile: process.env.OPENAI_PROFILE_MODEL ?? 'gpt-4o-mini',
  openaiModelRank: process.env.OPENAI_RANK_MODEL ?? 'gpt-4o-mini',
  openaiModelDeepen: process.env.OPENAI_DEEPEN_MODEL ?? 'gpt-4o-mini',
  githubToken: process.env.GITHUB_TOKEN ?? '',
};

const openaiClient = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

const sourceBadges: Record<CandidateSource, string> = {
  github: 'GitHub',
  site: 'Website',
};

function sanitizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutTags = withoutScripts.replace(/<\/?[^>]+>/g, ' ');
  return sanitizeWhitespace(decodeEntities(withoutTags));
}

function extractTagContent(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  return decodeEntities(stripHtml(match[1]));
}

function extractLinkHref(xml: string) {
  const linkMatch =
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*>/i.exec(xml) ||
    /<link[^>]*href=["']([^"']+)["'][^>]*>/i.exec(xml);
  return linkMatch ? linkMatch[1] : '';
}

function truncate(value: string, max = 400) {
  const clean = sanitizeWhitespace(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function firstNameFrom(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

function logEvent(controller: ReadableStreamDefaultController, message: string, level: LogLevel = 'info') {
  sendEvent(controller, 'log', { message, level });
}

function sendEvent(controller: ReadableStreamDefaultController, type: string, data: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      'User-Agent': 'NeuralFeed/0.1 (https://github.com/jianingqi/neural-feed)',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let debug = '';
    try {
      debug = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`HTTP ${res.status} for ${url}${debug ? ` — ${debug.slice(0, 280)}` : ''}`);
  }
  return (await res.json()) as T;
}

async function fetchText(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      'User-Agent': 'NeuralFeed/0.1 (https://github.com/jianingqi/neural-feed)',
      Accept: 'text/html,application/xhtml+xml',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function fallbackCandidates(name: string): CandidateProfile[] {
  const base = name.toLowerCase().replace(/\s+/g, '-');
  const initials = name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2);
  return [
    {
      id: `${base}-gh`,
      displayName: `${name} (GitHub)`,
      source: 'github',
      summary: 'Fallback GitHub guess derived from the entered name.',
      avatarUrl: `https://avatar.vercel.sh/${encodeURIComponent(name)}.png?text=${encodeURIComponent(initials)}`,
      profileUrl: `https://github.com/${base}`,
      supportUrls: [`https://github.com/${base}`],
    },
    {
      id: `${base}-site`,
      displayName: `${name} (Website)`,
      source: 'site',
      summary: 'Fallback personal site guess derived from the entered name.',
      avatarUrl: `https://avatar.vercel.sh/${encodeURIComponent(`${name}-site`)}.png?text=${encodeURIComponent(initials)}`,
      profileUrl: `https://${base}.com`,
      supportUrls: [`https://${base}.com`],
    },
  ];
}

async function fetchSearchResults(name: string): Promise<SearchResult[]> {
  if (!env.googleSearchKey || !env.googleSearchCx) {
    console.warn('[discovery] Google Search API key or CX missing; falling back.');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', env.googleSearchKey);
    url.searchParams.set('cx', env.googleSearchCx);
    url.searchParams.set('q', name);
    url.searchParams.set('num', '10');
    url.searchParams.set('safe', 'off');

    const response = await fetchJson<{
      items?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    }>(url.toString());

    const results = response.items ?? [];
    const unique = new Map<string, SearchResult>();
    for (const result of results) {
      if (!result.link) continue;
      try {
        const normalized = new URL(result.link).toString();
        if (normalized.includes('linkedin.com')) {
          continue;
        }
        if (!unique.has(normalized)) {
          unique.set(normalized, {
            title: result.title ?? normalized,
            url: normalized,
            description: result.snippet ?? '',
          });
        }
      } catch {
        continue;
      }
      if (unique.size >= 12) break;
    }
    return Array.from(unique.values());
  } catch (error) {
    console.error('[discovery] fetchSearchResults failed', error);
    return [];
  }
}

function tagForUrl(url: string): CandidateSource {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('github.com')) {
      return 'github';
    }
  } catch {
    // ignore
  }
  return 'site';
}

function avatarForUrl(name: string, url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('github.com')) {
      const [username] = new URL(url).pathname.split('/').filter(Boolean);
      if (username) {
        return `https://avatars.githubusercontent.com/${username}`;
      }
    }
  } catch {
    // ignore
  }

  const initials = name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2);
  return `https://avatar.vercel.sh/${encodeURIComponent(name)}.png?text=${encodeURIComponent(initials)}`;
}

function dedupeCandidates(candidates: CandidateProfile[]): CandidateProfile[] {
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const unique: CandidateProfile[] = [];

  for (const candidate of candidates) {
    const urlKey = candidate.profileUrl.toLowerCase();
    if (seenUrls.has(urlKey)) {
      continue;
    }
    let id = candidate.id;
    let suffix = 1;
    while (seenIds.has(id)) {
      suffix += 1;
      id = `${candidate.id}-${suffix}`;
    }
    seenUrls.add(urlKey);
    seenIds.add(id);
    unique.push({ ...candidate, id });
  }

  return unique;
}

function dedupeStrings(values: string[], limit?: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (limit && result.length >= limit) {
      break;
    }
  }
  return result;
}

function computeSourceSignals(snippets: HarvestSnippet[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const snippet of snippets) {
    const key = snippet.source.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    normalized[key] = Number((value / total).toFixed(3));
  }
  return normalized;
}

function computeKeywordCounts(keywords: string[], snippets: HarvestSnippet[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const keyword of keywords) {
    counts[keyword] = 0;
  }
  for (const snippet of snippets) {
    const text = `${snippet.title} ${snippet.snippet}`.toLowerCase();
    for (const keyword of keywords) {
      if (!keyword) continue;
      const normalized = keyword.toLowerCase();
      if (text.includes(normalized)) {
        counts[keyword] = (counts[keyword] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function defaultKeywordWeighting(
  profile: ProfileCardData,
  keywordCounts: Record<string, number>,
): Array<{ keyword: string; weight: number }> {
  const entries = profile.keywords.map(keyword => {
    const count = keywordCounts[keyword] ?? 0;
    return { keyword, count };
  });
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total > 0) {
    return entries.map(entry => ({
      keyword: entry.keyword,
      weight: Number(((entry.count || 0) / total).toFixed(3)),
    }));
  }
  const uniformWeight = entries.length > 0 ? Number((1 / entries.length).toFixed(3)) : 0;
  return entries.map(entry => ({ keyword: entry.keyword, weight: uniformWeight }));
}

interface ProfileSignalAugmentation {
  keywordWeights: Array<{ keyword: string; weight: number; rationale?: string }>;
  additionalQueries: string[];
  preferenceNotes?: string;
  sourceFocus: Record<string, number>;
  mode: 'llm' | 'fallback';
}

function normalizeKeywordWeights(
  weights: Array<{ keyword: string; weight: number; rationale?: string }>,
  fallbackKeywords: string[],
): Array<{ keyword: string; weight: number; rationale?: string }> {
  if (!weights || weights.length === 0) {
    return fallbackKeywords.map(keyword => ({ keyword, weight: Number((1 / fallbackKeywords.length).toFixed(3)) }));
  }
  const filtered = weights.filter(entry => entry.keyword && Number.isFinite(entry.weight));
  if (filtered.length === 0) {
    return fallbackKeywords.map(keyword => ({ keyword, weight: Number((1 / fallbackKeywords.length).toFixed(3)) }));
  }
  const total = filtered.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return filtered.map(entry => ({
    keyword: entry.keyword,
    weight: Number((entry.weight / total).toFixed(3)),
    rationale: entry.rationale,
  }));
}

function uniqueStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function defaultSourceQueries(profile: ProfileCardData): PlanResult {
  const weighted = profile.keywordWeights && profile.keywordWeights.length > 0
    ? [...profile.keywordWeights].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    : profile.keywords.map(keyword => ({ keyword, weight: 1 }));
  const topKeywords = weighted.map(entry => entry.keyword).slice(0, 6);
  const queryHints = profile.queries.slice(0, 6);
  const primary = topKeywords.length > 0 ? topKeywords : [profile.summary];

  const arxiv = uniqueStrings(
    primary.map(keyword => `${keyword} arxiv`).concat(queryHints.map(q => `${q} paper`)),
    4,
  );
  const hn = uniqueStrings(
    primary.map(keyword => `${keyword} discussion`).concat(queryHints.map(q => `${q} project news`)),
    4,
  );
  const news = uniqueStrings(
    primary.map(keyword => `${keyword} interview`).concat(queryHints.map(q => `${q} blog post`)),
    4,
  );

  return {
    plan: {
      arxiv,
      hn,
      news,
    },
    mode: 'fallback',
  };
}

async function generateSourceQueries(profile: ProfileCardData): Promise<PlanResult> {
  if (!openaiClient) {
    return defaultSourceQueries(profile);
  }

  const profileContext = JSON.stringify(
    {
      summary: profile.summary,
      keywords: profile.keywords,
      preferences: profile.preferences,
      evidence: profile.evidence?.slice(0, 4) ?? [],
    },
    null,
    2,
  );

  const template = `{
  "arxiv": ["..."],
  "hn": ["..."],
  "news": ["..."]
}`;

  const userPrompt = `Given the profile below, craft focused search queries for each source so we retrieve high-signal items. Keep each array to at most 4 entries. Return JSON only in the schema:
${template}

Profile:
${profileContext}`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelRank,
      temperature: 0.2,
      input: [
        {
          role: 'system',
          content:
            'You generate targeted search queries for different content sources (arxiv, hn, github, news) based on a profile.',
        },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Query plan JSON not found.');
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Partial<SourceQueryPlan>;
    return {
      plan: {
        arxiv: uniqueStrings(parsed.arxiv ?? [], 4),
        hn: uniqueStrings(parsed.hn ?? [], 4),
        news: uniqueStrings(parsed.news ?? [], 4),
      },
      mode: 'llm',
    };
  } catch (error) {
    console.error('[discovery] generateSourceQueries failed', error);
    return defaultSourceQueries(profile);
  }
}

interface ClusterSummary {
  merged: CandidateProfile[];
  clusters: number;
}

async function clusterSearchResults(name: string, results: SearchResult[]): Promise<CandidateCluster[]> {
  if (!openaiClient || results.length === 0) {
    return [];
  }

  const snippets = results
    .map(
      (result, index) =>
        `Result ${index + 1}:\nTitle: ${result.title}\nURL: ${result.url}\nSnippet: ${result.description ?? ''}`,
    )
    .join('\n\n');

  const userPrompt = `You are helping cluster search results for the person named "${name}". Group the URLs that appear to describe the same individual. If the results obviously belong to different people, create separate entries. Prefer GitHub or personal sites as primary URLs. Output up to 6 candidates.

Return JSON ONLY in the form:
{
  "candidates": [
    {
      "display_name": "...",
      "primary_url": "...",
      "summary": "short factual summary <=30 words",
      "support_urls": ["...", "..."]
    }
  ]
}

Use only URLs from the list. Discard LinkedIn URLs in the output.`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelProfile,
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content:
            'You cluster search results referring to the same individual. Provide concise factual summaries and ensure URLs remain accurate.',
        },
        { role: 'user', content: `${snippets}\n\n${userPrompt}` },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Candidate JSON not found.');
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { candidates?: CandidateCluster[] };
    return parsed.candidates?.filter(candidate => candidate.primary_url) ?? [];
  } catch (error) {
    console.error('[discovery] clusterSearchResults failed', error);
    return [];
  }
}

type DiscoveryMode = 'cluster' | 'heuristic' | 'fallback';

interface CandidateDiscovery {
  candidates: CandidateProfile[];
  mode: DiscoveryMode;
  searchResults: number;
  clusterCount?: number;
}

async function discoverCandidates(name: string): Promise<CandidateDiscovery> {
  const results = await fetchSearchResults(name);

  if (results.length === 0) {
    return {
      candidates: fallbackCandidates(name),
      mode: 'fallback',
      searchResults: 0,
    };
  }

  try {
    const clusters = await clusterSearchResults(name, results);
    if (clusters.length > 0) {
      const mapped = clusters.map(cluster => {
        const source = tagForUrl(cluster.primary_url);
        const display =
          cluster.display_name ||
          `${firstNameFrom(name)} (${source === 'github' ? 'GitHub' : 'Site'})`;
        const support = (cluster.support_urls ?? []).filter(url => !url.includes('linkedin.com'));
        return {
          id: `${Buffer.from(cluster.primary_url).toString('base64').slice(0, 10)}-${source}`,
          displayName: display,
          source,
          summary: truncate(cluster.summary ?? '', 240),
          avatarUrl: avatarForUrl(display, cluster.primary_url),
          profileUrl: cluster.primary_url,
          supportUrls: [cluster.primary_url, ...support.filter(url => url !== cluster.primary_url)].slice(0, 6),
          mergedFrom: [
            {
              url: cluster.primary_url,
              title: cluster.summary,
            },
            ...support.map(url => ({ url })),
          ],
        };
      });
      return {
        candidates: dedupeCandidates(mapped),
        mode: 'cluster',
        searchResults: results.length,
        clusterCount: clusters.length,
      };
    }
  } catch {
    // fall through to heuristics below
  }

  const heuristics: CandidateProfile[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const url = result.url;
    if (seen.has(url)) continue;
    const source = tagForUrl(url);
    const display =
      source === 'github'
        ? `${new URL(url).pathname.split('/').filter(Boolean)[0] ?? name} (GitHub)`
        : result.title ?? `${name} (Site)`;
    heuristics.push({
      id: `${Buffer.from(url).toString('base64').slice(0, 10)}-${source}`,
      displayName: display,
      source,
      summary: truncate(result.description ?? '', 220),
      avatarUrl: avatarForUrl(display, url),
      profileUrl: url,
      supportUrls: [url],
    });
    seen.add(url);
    if (heuristics.length >= 6) break;
  }

  if (heuristics.length === 0) {
    return {
      candidates: fallbackCandidates(name),
      mode: 'fallback',
      searchResults: results.length,
      clusterCount: 0,
    };
  }

  if (!openaiClient) {
    return {
      candidates: dedupeCandidates(heuristics),
      mode: 'heuristic',
      searchResults: results.length,
      clusterCount: 0,
    };
  }

  const heuristicsSummary = heuristics
    .map((candidate, index) => {
      const merged = candidate.mergedFrom ?? [];
      const extras = merged.map(entry => entry.url).filter(Boolean);
      return `Candidate ${index + 1}:
Primary: ${candidate.profileUrl}
Source: ${candidate.source}
Summary: ${candidate.summary ?? candidate.displayName}
Support URLs: ${JSON.stringify(extras)}`;
    })
    .join('\n\n');

  const mergePrompt = `You will merge candidate profiles that refer to the same person named "${name}".
The candidates come from web search results. Merge those that clearly describe the same individual and retain distinct ones otherwise.
Return JSON only:
{
  "candidates": [
    {
      "display_name": "...",
      "primary_url": "...",
      "summary": "short summary",
      "support_urls": ["..."],
      "source": "github|site"
    }
  ]
}
Prefer GitHub URLs as primary when present. Include all distinct support URLs.`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelProfile,
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content: 'You merge candidate web identities into distinct people with concise factual summaries.',
        },
        {
          role: 'user',
          content: `${heuristicsSummary}\n\n${mergePrompt}`,
        },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Merge JSON not found.');
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { candidates?: Array<{
      display_name: string;
      primary_url: string;
      summary?: string;
      support_urls?: string[];
      source?: CandidateSource;
    }>; };

    const merged = (parsed.candidates ?? []).map(entry => {
      const source = entry.source ?? tagForUrl(entry.primary_url);
      return {
        id: `${Buffer.from(entry.primary_url).toString('base64').slice(0, 10)}-${source}`,
        displayName: entry.display_name || `${firstNameFrom(name)} (${source === 'github' ? 'GitHub' : 'Site'})`,
        source,
        summary: truncate(entry.summary ?? '', 240),
        avatarUrl: avatarForUrl(entry.display_name || name, entry.primary_url),
        profileUrl: entry.primary_url,
        supportUrls: [entry.primary_url, ...(entry.support_urls ?? [])].filter(Boolean),
        mergedFrom: [entry.primary_url, ...(entry.support_urls ?? [])]
          .filter(Boolean)
          .map(url => ({ url })),
      } satisfies CandidateProfile;
    });

    if (merged.length > 0) {
      return {
        candidates: dedupeCandidates(merged),
        mode: 'heuristic',
        searchResults: results.length,
        clusterCount: merged.length,
      };
    }
  } catch (error) {
    console.error('[discovery] merge heuristic candidates failed', error);
  }

  return {
    candidates: dedupeCandidates(heuristics),
    mode: 'heuristic',
    searchResults: results.length,
    clusterCount: heuristics.length,
  };
}

async function resolveIdentities(profileUrl: string): Promise<IdentityResult> {
  try {
    const html = await fetchText(profileUrl);
    const links = new Set<string>();
    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html))) {
      const href = match[1];
      try {
        const normalized = new URL(href, profileUrl).toString();
        const host = new URL(normalized).hostname.toLowerCase();
        if (
          host.includes('github.com') ||
          host.includes('linkedin.com') ||
          host.includes('scholar.google.com') ||
          host.includes('twitter.com') ||
          host.includes('x.com') ||
          host.includes('medium.com') ||
          host.includes('substack.com')
        ) {
          links.add(normalized);
        }
      } catch {
        continue;
      }
    }

    return {
      core: profileUrl,
      identities: Array.from(links).slice(0, 12),
    };
  } catch {
    return {
      core: profileUrl,
      identities: [profileUrl],
    };
  }
}

function cutText(content: string, maxChars: number) {
  const text = sanitizeWhitespace(content);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

async function extractReadableContent(url: string) {
  try {
    const html = await fetchText(url);
    const text = stripHtml(html);
    return truncate(text, 1200);
  } catch {
    return '';
  }
}

async function harvestGitHub(url: string): Promise<HarvestSnippet[]> {
  try {
    const parsed = new URL(url);
    const [username] = parsed.pathname.split('/').filter(Boolean);
    if (!username) return [];

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'NeuralFeed/0.1',
    };
    if (env.githubToken) {
      headers.Authorization = `Bearer ${env.githubToken}`;
    }

    const user = await fetchJson<{
      name?: string;
      bio?: string;
      location?: string;
      blog?: string;
      followers?: number;
      following?: number;
      public_repos?: number;
    }>(`https://api.github.com/users/${username}`, { headers });

    const repos = await fetchJson<
      Array<{
        name: string;
        description?: string;
        stargazers_count: number;
        language?: string;
        html_url: string;
        updated_at: string;
      }>
    >(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`, { headers });

    const snippets: HarvestSnippet[] = [];

    snippets.push({
      source: 'github',
      title: `${user.name ?? username} GitHub overview`,
      snippet: truncate(
        `Bio: ${user.bio ?? 'n/a'} • Location: ${user.location ?? 'n/a'} • Followers: ${user.followers ?? 0} • Repos: ${
          user.public_repos ?? 0
        }`,
        320,
      ),
      url: `https://github.com/${username}`,
    });

    for (const repo of repos) {
      snippets.push({
        source: 'github',
        title: repo.name,
        snippet: truncate(
          `${repo.description ?? 'No description'} • Stars: ${repo.stargazers_count} • Language: ${repo.language ?? 'n/a'}`,
          320,
        ),
        url: repo.html_url,
      });
    }

    return snippets;
  } catch {
    return [];
  }
}

async function harvestWebsite(url: string): Promise<HarvestSnippet[]> {
  const content = await extractReadableContent(url);
  if (!content) return [];
  return [
    {
      source: 'website',
      title: `Website: ${new URL(url).hostname}`,
      snippet: truncate(content, 700),
      url,
    },
  ];
}

async function harvestNews(name: string): Promise<HarvestSnippet[]> {
  try {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', `${name} when:6m`);
    url.searchParams.set('hl', 'en-US');
    url.searchParams.set('gl', 'US');
    url.searchParams.set('ceid', 'US:en');

    const xml = await fetchText(url.toString(), {
      headers: {
        Accept: 'application/rss+xml,text/xml',
      },
    });

    const snippets: HarvestSnippet[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml))) {
      const block = match[1];
      const linkMatch = /<link>([^<]+)<\/link>/i.exec(block);
      const urlValue = linkMatch ? decodeEntities(linkMatch[1]) : '';
      if (!urlValue) continue;
      snippets.push({
        source: 'news',
        title: extractTagContent(block, 'title') || 'News mention',
        snippet: truncate(extractTagContent(block, 'description') || '', 320),
        url: urlValue,
      });
      if (snippets.length >= 6) break;
    }
    return snippets;
  } catch (error) {
    console.error('[harvest] harvestNews failed', error);
    return [];
  }
}

async function harvestIdentities(name: string, identities: string[]): Promise<HarvestSnippet[]> {
  const snippets: HarvestSnippet[] = [];
  const seen = new Set<string>();

  for (const identity of identities) {
    try {
      const host = new URL(identity).hostname.toLowerCase();
      let harvested: HarvestSnippet[] = [];
      if (host.includes('github.com')) {
        harvested = await harvestGitHub(identity);
      } else if (host.includes('linkedin.com')) {
        // Temporarily skip LinkedIn harvesting due to access limitations.
        continue;
      } else {
        harvested = await harvestWebsite(identity);
      }

      for (const snippet of harvested) {
        if (!seen.has(snippet.url)) {
          snippets.push(snippet);
          seen.add(snippet.url);
        }
      }
    } catch {
      continue;
    }
  }

  const news = await harvestNews(name);
  for (const snippet of news) {
    if (!seen.has(snippet.url)) {
      snippets.push(snippet);
      seen.add(snippet.url);
    }
  }

  return snippets.slice(0, MAX_DOC_SNIPPETS);
}

function buildFallbackProfile(name: string, docs: HarvestSnippet[]): ProfileCardData {
  const keywords = Array.from(
    new Set(
      docs
        .flatMap(doc => doc.snippet.split(/\W+/))
        .filter(word => word.length > 4)
        .map(word => word.toLowerCase()),
    ),
  )
    .slice(0, 8)
    .map(word => word.replace(/_/g, ' '));

  return {
    summary: cutText(
      `${name} has public activity across ${docs.map(doc => doc.source).join(', ')}. This profile is built from harvested public documents and may require manual refinement.`,
      280,
    ),
    keywords,
    queries: [
      `${name} latest`,
      `${name} interview`,
      `${name} github`,
    ],
    preferences: {
      depth: 'mixed',
      format: 'mixed',
      novelty: 'medium',
    },
    evidence: docs.slice(0, 3).map(doc => ({
      claim: truncate(doc.title, 90),
      support_url: doc.url,
    })),
  };
}

async function buildProfileCard(name: string, docs: HarvestSnippet[]): Promise<ProfileCardData> {
  if (!openaiClient) {
    return buildFallbackProfile(name, docs);
  }

  const docBlocks = docs
    .map(
      (doc, index) =>
        `### Document ${index + 1}\nSource: ${doc.source}\nTitle: ${doc.title}\nURL: ${doc.url}\nSnippet: ${doc.snippet}`,
    )
    .join('\n\n');

  const systemPrompt =
    // 'You are an analyst turning harvested public data into a concise profile card. Be factual, avoid speculation, and respect the schema exactly.';
    'You are an analyst turning harvested public data into a psychological profile card. The profile card should be a deep dive into the person\'s psychology, their motivations, their goals, and their interests.';
  // "summary": "string<=80w",

  const schema = `{
  "summary": "string. a comprehensive paragraph",
  "keywords": ["k1","k2","k3"],
  "queries": ["q1","q2","q3"],
  "preferences": {"depth":"theory|practice|mixed","format":"code|essay|video|mixed","novelty":"low|medium|high"},
  "evidence": [{"claim":"string","support_url":"url"}]
}`;

  const userPrompt = `Build a profile card for "${name}" using the harvested documents below. Return JSON only, no commentary. Respect the schema:
${schema}

Documents:
${docBlocks}`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelProfile,
      temperature: 0.5,
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Profile JSON not found.');
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as ProfileCardData;
    return parsed;
  } catch {
    return buildFallbackProfile(name, docs);
  }
}

async function augmentProfileSignals(
  name: string,
  profile: ProfileCardData,
  docs: HarvestSnippet[],
  sourceSignals: Record<string, number>,
): Promise<ProfileSignalAugmentation> {
  const keywordCounts = computeKeywordCounts(profile.keywords, docs);
  if (!openaiClient) {
    return {
      keywordWeights: defaultKeywordWeighting(profile, keywordCounts),
      additionalQueries: dedupeStrings(profile.queries, 6),
      preferenceNotes: undefined,
      sourceFocus: sourceSignals,
      mode: 'fallback',
    };
  }

  const docDigest = docs.slice(0, 6)
    .map(
      (doc, index) =>
        `Doc ${index + 1}: [${doc.source}] ${doc.title}\nSnippet: ${truncate(doc.snippet, 260)}\nURL: ${doc.url}`,
    )
    .join('\n\n');

  const signalContext = {
    existing_keywords: profile.keywords,
    existing_queries: profile.queries,
    keyword_counts: keywordCounts,
    source_focus: sourceSignals,
  };

  const schema = `{
  "keyword_weights": [{"keyword": "...", "weight": 0.32, "rationale": "..."}],
  "additional_queries": ["..."],
  "preference_notes": "..."
}`;

  const userPrompt = `Expand the interest signals for ${name}. Use the documents and current profile to assign weights to keywords (normalized 0-1), recommend up to 4 fresh queries, and capture any preference notes. Return JSON exactly matching:
${schema}

Documents:
${docDigest}

Current signals:
${JSON.stringify(signalContext, null, 2)}

Profile summary:
${profile.summary}`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelProfile,
      temperature: 0.2,
      input: [
        {
          role: 'system',
          content: 'You synthesize profile signals, outputting strict JSON with weighted keywords and concise notes.',
        },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Augmentation JSON not found.');
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      keyword_weights?: Array<{ keyword: string; weight: number; rationale?: string }>;
      additional_queries?: string[];
      preference_notes?: string;
    };

    return {
      keywordWeights: normalizeKeywordWeights(parsed.keyword_weights ?? [], profile.keywords),
      additionalQueries: dedupeStrings([...profile.queries, ...(parsed.additional_queries ?? [])], 8),
      preferenceNotes: parsed.preference_notes,
      sourceFocus: sourceSignals,
      mode: 'llm',
    };
  } catch (error) {
    console.error('[profile] augmentProfileSignals failed', error);
    return {
      keywordWeights: defaultKeywordWeighting(profile, keywordCounts),
      additionalQueries: dedupeStrings(profile.queries, 6),
      preferenceNotes: undefined,
      sourceFocus: sourceSignals,
      mode: 'fallback',
    };
  }
}

async function fetchArxiv(query: string, count = 5): Promise<CandidateContent[]> {
  try {
    const url = new URL('https://export.arxiv.org/api/query');
    url.searchParams.set('search_query', `all:${query}`);
    url.searchParams.set('start', '0');
    url.searchParams.set('max_results', String(count));

    const response = await fetchText(url.toString(), {
      headers: {
        Accept: 'application/atom+xml',
      },
    });

    const entries: CandidateContent[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(response))) {
      const block = match[1];
      const id = extractTagContent(block, 'id') || extractLinkHref(block) || `arxiv-${Math.random().toString(16).slice(2)}`;
      const title = extractTagContent(block, 'title') || 'arXiv entry';
      const summary = extractTagContent(block, 'summary');
      const updated = extractTagContent(block, 'updated');
      const link = extractLinkHref(block) || id;
      entries.push({
        id,
        source: 'arxiv',
        title,
        snippet: truncate(summary || title, 360),
        url: link,
        date: updated ? updated.slice(0, 10) : new Date().toISOString().slice(0, 10),
      });
      if (entries.length >= count) break;
    }

    return entries;
  } catch {
    return [];
  }
}

async function fetchHackerNews(query: string, count = 5): Promise<CandidateContent[]> {
  if (!env.googleSearchKey || !env.googleSearchCx) {
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', env.googleSearchKey);
    url.searchParams.set('cx', env.googleSearchCx);
    url.searchParams.set('q', `site:news.ycombinator.com ${query}`);
    url.searchParams.set('num', String(Math.min(count * 2, 10)));
    url.searchParams.set('safe', 'off');

    const response = await fetchJson<{
      items?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    }>(url.toString());

    const results = response.items ?? [];
    const candidates: CandidateContent[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      if (!result.link) continue;
      try {
        const normalized = new URL(result.link).toString();
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const content = await extractReadableContent(normalized);
        candidates.push({
          id: `hn-${Buffer.from(normalized).toString('base64').slice(0, 10)}`,
          source: 'hn',
          title: result.title ?? normalized,
          snippet: truncate((content || result.snippet) ?? '', 320),
          url: normalized,
          date: new Date().toISOString().slice(0, 10),
        });
        if (candidates.length >= count) break;
      } catch {
        continue;
      }
    }

    return candidates;
  } catch (error) {
    console.error('[feed] fetchHackerNews failed', error);
    return [];
  }
}

async function fetchNewsArticles(query: string, count = 5): Promise<CandidateContent[]> {
  try {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', `${query} when:7d`);
    url.searchParams.set('hl', 'en-US');
    url.searchParams.set('gl', 'US');
    url.searchParams.set('ceid', 'US:en');

    const xml = await fetchText(url.toString(), {
      headers: {
        Accept: 'application/rss+xml,text/xml',
      },
    });

    const items: CandidateContent[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml))) {
      const block = match[1];
      const linkMatch = /<link>([^<]+)<\/link>/i.exec(block);
      const title = extractTagContent(block, 'title') || 'News article';
      const description = extractTagContent(block, 'description');
      const pubDate = extractTagContent(block, 'pubDate');
      const urlValue = linkMatch ? decodeEntities(linkMatch[1]) : '';
      if (!urlValue) continue;
      items.push({
        id: `news-${Buffer.from(urlValue).toString('base64').slice(0, 12)}`,
        source: 'news',
        title: title,
        snippet: truncate(description || title, 260),
        url: urlValue,
        date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      });
      if (items.length >= count) break;
    }
    return items;
  } catch (error) {
    console.error('[feed] fetchNewsArticles failed', error);
    return [];
  }
}

interface CandidateContentResult {
  items: CandidateContent[];
  plan: SourceQueryPlan;
  mode: 'llm' | 'fallback';
}

interface RankingResult {
  exploitation: FeedItem[];
  leftovers: FeedItem[];
}

async function gatherCandidateContent(profile: ProfileCardData): Promise<CandidateContentResult> {
  const planResult = await generateSourceQueries(profile);
  const plan = planResult.plan;

  const collectors: Promise<CandidateContent[]>[] = [];

  for (const query of plan.arxiv.slice(0, 4)) {
    collectors.push(fetchArxiv(query, 3));
  }
  for (const query of plan.hn.slice(0, 4)) {
    collectors.push(fetchHackerNews(query, 3));
  }
  for (const query of plan.news.slice(0, 4)) {
    collectors.push(fetchNewsArticles(query, 3));
  }

  const results = await Promise.allSettled(collectors);
  const items: CandidateContent[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (!seen.has(item.id)) {
          items.push(item);
          seen.add(item.id);
        }
      }
    }
  }

  return {
    items: items.slice(0, CANDIDATE_TARGET),
    plan,
    mode: planResult.mode,
  };
}

function rebalanceFeed(
  items: FeedItem[],
  sources: FeedItem['source'][] = ['arxiv', 'hn', 'news'],
  perSourceCap = 3,
): FeedItem[] {
  const buckets = new Map<FeedItem['source'], FeedItem[]>();
  const overflow: FeedItem[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    buckets.set(source, []);
  }

  for (const item of items) {
    if (seen.has(item.id)) continue;
    const bucket = buckets.get(item.source);
    if (bucket) {
      bucket.push(item);
      seen.add(item.id);
    } else {
      overflow.push(item);
      seen.add(item.id);
    }
  }

  const balanced: FeedItem[] = [];
  const added = new Set<string>();
  for (const source of sources) {
    const bucket = buckets.get(source) ?? [];
    const slice = bucket.slice(0, perSourceCap);
    for (const item of slice) {
      if (!added.has(item.id)) {
        balanced.push(item);
        added.add(item.id);
      }
    }
  }

  for (const source of sources) {
    const bucket = buckets.get(source) ?? [];
    for (const item of bucket.slice(perSourceCap)) {
      if (!added.has(item.id)) {
        balanced.push(item);
        added.add(item.id);
      }
    }
  }

  for (const item of overflow) {
    if (!added.has(item.id)) {
      balanced.push(item);
      added.add(item.id);
    }
  }

  const chunkSize = Math.max(1, sources.length * perSourceCap);
  return balanced.slice(0, chunkSize);
}

function buildFallbackFeed(profile: ProfileCardData, items: CandidateContent[], name: string): FeedItem[] {
  const selected = items.slice(0, CANDIDATE_TARGET);
  const feed = selected.map(item => ({
    id: item.id,
    source: item.source,
    title: item.title,
    summary: item.snippet,
    because: `Matches ${firstNameFrom(name)}'s interest in ${profile.keywords[0] ?? 'the topic'}.`,
    url: item.url,
    date: item.date,
  }));
  return rebalanceFeed(feed);
}

async function rankFeedItems(
  name: string,
  profile: ProfileCardData,
  items: CandidateContent[],
): Promise<RankingResult> {
  if (!openaiClient) {
    const exploitation = buildFallbackFeed(profile, items, name);
    const exploitationIds = new Set(exploitation.map(item => item.id));
    const leftovers = items
      .filter(candidate => !exploitationIds.has(candidate.id))
      .map(candidate => ({
        id: candidate.id,
        source: candidate.source,
        title: candidate.title,
        summary: candidate.snippet,
        because: `Candidate from ${candidate.source}.`,
        url: candidate.url,
        date: candidate.date,
      }));
    return { exploitation, leftovers };
  }

  const systemPrompt =
    'You are ranking candidate content for a personalized AI feed. Return JSON with the schema {"top":[{"id":"","score":0.0,"novelty":"","summary":"","because":""}]} using only provided candidates.';

  const profileBlock = JSON.stringify(profile, null, 2);
  const keywordWeights = profile.keywordWeights && profile.keywordWeights.length > 0
    ? profile.keywordWeights
    : profile.keywords.map(keyword => ({ keyword, weight: Number((1 / Math.max(profile.keywords.length, 1)).toFixed(3)) }));
  const interestSignals = {
    keyword_weights: keywordWeights,
    source_focus: profile.sourceFocus ?? {},
    preferences: profile.preferences,
    preference_notes: profile.preferenceNotes ?? '',
  };
  const candidatesBlock = items
    .map(
      item =>
        `ID: ${item.id}\nSource: ${item.source}\nTitle: ${item.title}\nSnippet: ${item.snippet}\nURL: ${item.url}\nDate: ${item.date}`,
    )
    .join('\n\n');

  const userPrompt = `Profile card:
${profileBlock}

Candidates:
${candidatesBlock}

Interest signals:
${JSON.stringify(interestSignals, null, 2)}

Select up to 10 items aligned with the profile. Weight keyword matches by their weights and consider how frequently sources appear in the profile. Provide brief summaries (<=25 words) and "because" lines (<=18 words). Limit to at most three items per source and include every available source if quality permits. Use "stretch" or "core" or "comfort" for novelty. Return JSON only.`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelRank,
      temperature: 0.5,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Ranking JSON not found.');
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      top: Array<{ id: string; summary: string; because: string }>;
    };

    const map = new Map(items.map(item => [item.id, item]));
    const ranked: FeedItem[] = [];
    for (const entry of parsed.top) {
      const item = map.get(entry.id);
      if (!item) continue;
      ranked.push({
        id: item.id,
        source: item.source,
        title: item.title,
        summary: truncate(entry.summary ?? item.snippet, 200),
        because: truncate(
          entry.because ?? `Matches ${firstNameFrom(name)}'s priorities.`,
          120,
        ),
        url: item.url,
        date: item.date,
      });
      if (ranked.length >= 10) break;
    }

    const balanced = rebalanceFeed(ranked);
    if (balanced.length === 0) {
      const exploitationFallback = buildFallbackFeed(profile, items, name);
      const fallbackIds = new Set(exploitationFallback.map(item => item.id));
      const leftoversFallback = items
        .filter(candidate => !fallbackIds.has(candidate.id))
        .map(candidate => ({
          id: candidate.id,
          source: candidate.source,
          title: candidate.title,
          summary: candidate.snippet,
          because: `Candidate from ${candidate.source}.`,
          url: candidate.url,
          date: candidate.date,
        }));
      return {
        exploitation: exploitationFallback,
        leftovers: leftoversFallback,
      };
    }

    const exploitationIds = new Set(balanced.map(item => item.id));
    const leftovers = items
      .filter(candidate => !exploitationIds.has(candidate.id))
      .map(candidate => ({
        id: candidate.id,
        source: candidate.source,
        title: candidate.title,
        summary: candidate.snippet,
        because: `Candidate from ${candidate.source}.`,
        url: candidate.url,
        date: candidate.date,
      }));

    return {
      exploitation: balanced,
      leftovers,
    };
  } catch (error) {
    console.error('[feed] rankFeedItems failed', error);
    const exploitation = buildFallbackFeed(profile, items, name);
    const exploitationIds = new Set(exploitation.map(item => item.id));
    const leftovers = items
      .filter(candidate => !exploitationIds.has(candidate.id))
      .map(candidate => ({
        id: candidate.id,
        source: candidate.source,
        title: candidate.title,
        summary: candidate.snippet,
        because: `Candidate from ${candidate.source}.`,
        url: candidate.url,
        date: candidate.date,
      }));
    return { exploitation, leftovers };
  }
}

async function createDeepenDigest(profile: ProfileCardData, item: FeedItem, name: string): Promise<DeepenDigest> {
  if (!openaiClient) {
    return {
      tldr: cutText(`${item.title}: ${item.summary}`, 160),
      why_me: `It aligns with ${firstNameFrom(name)}'s profile.`,
      next_actions: [
        'Skim the linked resource.',
        'Capture one actionable takeaway.',
        'Flag anything to revisit in the next refresh.',
      ],
    };
  }

  const userPrompt = `Profile card:
${JSON.stringify(profile, null, 2)}

Feed item:
${JSON.stringify(item, null, 2)}

Produce JSON with keys tldr (<=40 words), why_me (<=20 words), next_actions (3 concise imperatives).`;

  try {
    const response = await openaiClient.responses.create({
      model: env.openaiModelDeepen,
      temperature: 0.2,
      input: [
        {
          role: 'system',
          content: 'You craft tailored digests for the user. Return JSON only, no prose.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });
    const text = response.output_text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Deepen JSON not found.');
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as DeepenDigest;
    return parsed;
  } catch {
    return {
      tldr: cutText(`${item.title}: ${item.summary}`, 160),
      why_me: `It matches ${firstNameFrom(name)}'s stated themes.`,
      next_actions: [
        'Review the key arguments.',
        'Note implementation ideas in your workspace.',
        'Schedule a follow-up to apply insights.',
      ],
    };
  }
}

function cleanupFeedCache() {
  const now = Date.now();
  for (const [key, entry] of feedCache.entries()) {
    if (entry.expires < now) {
      feedCache.delete(key);
    }
  }
}

async function handleDiscover(controller: ReadableStreamDefaultController, name: string) {
  sendEvent(controller, 'stage', { state: 'DiscoverCandidates' satisfies AgentState });
  logEvent(controller, `Searching public web for "${name}"…`, 'info');

  const discovery = await discoverCandidates(name);
  const modeLabel =
    discovery.mode === 'cluster'
      ? 'LLM clustering'
      : discovery.mode === 'heuristic'
        ? 'heuristic merge'
        : 'fallback';
  const extra =
    discovery.mode === 'cluster'
      ? ` (${discovery.clusterCount ?? 0} clusters from ${discovery.searchResults} search hits)`
      : discovery.mode === 'heuristic'
        ? ` (${discovery.searchResults} search hits heuristically mapped)`
        : '';
  logEvent(controller, `Found ${discovery.candidates.length} candidate profiles via ${modeLabel}${extra}.`, 'success');
  if (discovery.mode !== 'cluster') {
    logEvent(
      controller,
      'LLM clustering unavailable; showing best-effort matches. Provide a direct URL if these look off.',
      'warning',
    );
  }
  sendEvent(controller, 'candidates', {
    candidates: discovery.candidates,
    meta: {
      mode: discovery.mode,
      searchResults: discovery.searchResults,
      clusterCount: discovery.clusterCount ?? 0,
    },
  });
  sendEvent(controller, 'stage', { state: 'AwaitUserConfirm' satisfies AgentState });
  sendEvent(controller, 'complete', { message: 'Discovery complete.' });
}

async function handleRun(
  controller: ReadableStreamDefaultController,
  name: string,
  candidateId: string | undefined,
) {
  if (!candidateId) {
    sendEvent(controller, 'error', { message: 'Candidate confirmation is required.' });
    return;
  }

  const discovery = await discoverCandidates(name);
  const candidates = discovery.candidates;
  const confirmed = candidates.find(candidate => candidate.id === candidateId) ?? candidates[0];
  if (!confirmed) {
    sendEvent(controller, 'error', { message: 'Unable to confirm candidate. Try the discovery step again.' });
    return;
  }

  const identitySeed = new Set<string>([confirmed.profileUrl, ...(confirmed.supportUrls ?? [])]);

  sendEvent(controller, 'stage', { state: 'ResolveEntities' satisfies AgentState });
  logEvent(controller, `Confirmed ${sourceBadges[confirmed.source]}:${confirmed.profileUrl}.`, 'success');

  logEvent(controller, 'Resolving linked identities (website, Scholar, X)…', 'info');
  const identities = await resolveIdentities(confirmed.profileUrl);
  identities.identities.forEach(url => identitySeed.add(url));
  identitySeed.add(identities.core);
  sendEvent(controller, 'stage', { state: 'HarvestPublicData' satisfies AgentState });
  logEvent(controller, `Collected ${identitySeed.size} linked identities.`, 'info');

  logEvent(controller, 'Harvesting public data…', 'info');
  const snippets = await harvestIdentities(name, Array.from(identitySeed));
  logEvent(controller, `Harvested ${snippets.length} documents.`, 'success');

  sendEvent(controller, 'stage', { state: 'BuildProfile' satisfies AgentState });
  logEvent(controller, 'Summarizing to profile (LLM)…', 'info');
  const profileCard = await buildProfileCard(name, snippets);
  const sourceSignals = computeSourceSignals(snippets);
  const augmentation = await augmentProfileSignals(name, profileCard, snippets, sourceSignals);
  const mergedKeywords = dedupeStrings([
    ...profileCard.keywords,
    ...augmentation.keywordWeights.map(entry => entry.keyword),
  ], 12);
  const enrichedProfile: ProfileCardData = {
    ...profileCard,
    keywords: mergedKeywords,
    keywordWeights: augmentation.keywordWeights,
    sourceFocus: augmentation.sourceFocus,
    preferenceNotes: augmentation.preferenceNotes,
    queries: augmentation.additionalQueries,
  };
  logEvent(
    controller,
    `Profile card ready. Signals enriched via ${augmentation.mode === 'llm' ? 'LLM' : 'heuristic'} augmentation.`,
    'success',
  );
  sendEvent(controller, 'profile', { profileCard: enrichedProfile });

  sendEvent(controller, 'stage', { state: 'FetchCandidates' satisfies AgentState });
  logEvent(controller, 'Fetching candidates (arXiv/HN/News)…', 'info');
  const candidateResult = await gatherCandidateContent(enrichedProfile);
  const candidateContent = candidateResult.items;
  const planPreview = Object.entries(candidateResult.plan)
    .map(([key, value]) => `${key}:${value.slice(0, 2).join(' | ')}`)
    .join(' · ');
  const modeLabel = candidateResult.mode === 'llm' ? 'LLM query plan' : 'keyword fallback plan';
  logEvent(
    controller,
    `Fetched ${candidateContent.length} candidate items via ${modeLabel}${planPreview ? ` (${planPreview})` : ''}.`,
    'info',
  );
  const candidatePoolItems = candidateContent.map(item => ({
    id: item.id,
    source: item.source,
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    date: item.date,
  }));
  sendEvent(controller, 'candidate_pool', {
    items: candidatePoolItems,
    plan: candidateResult.plan,
    mode: candidateResult.mode,
  });

  sendEvent(controller, 'stage', { state: 'RankAndExplain' satisfies AgentState });
  logEvent(controller, 'Ranking & explaining (LLM)…', 'info');
  const ranking = await rankFeedItems(name, enrichedProfile, candidateContent);
  const exploitation = ranking.exploitation.slice(0, 8);
  const exploitationIds = new Set(exploitation.map(item => item.id));
  const explorationCandidates = ranking.leftovers.filter(item => !exploitationIds.has(item.id));
  const exploration = rebalanceFeed(explorationCandidates, ['arxiv', 'hn', 'news'], 1).slice(0, 2);
  const explorationIds = new Set(exploration.map(item => item.id));
  const coreFeedPool = [
    ...exploitation,
    ...explorationCandidates.filter(item => !explorationIds.has(item.id)),
  ];
  const combinedFeed = rebalanceFeed(coreFeedPool, ['arxiv', 'hn', 'news'], 3).slice(0, 10);
  const combinedIds = new Set(combinedFeed.map(item => item.id));
  const remainingPool = ranking.leftovers.filter(
    item => !combinedIds.has(item.id) && !explorationIds.has(item.id),
  );

  logEvent(
    controller,
    `Ranking complete. Exploit ${exploitation.length} + explore ${exploration.length}.`,
    'success',
  );
  sendEvent(controller, 'feed', {
    items: combinedFeed,
    exploitationCount: exploitation.length,
    explorationCount: exploration.length,
    explorationItems: exploration,
    remaining: remainingPool.map(item => ({
      id: item.id,
      source: item.source,
      title: item.title,
      snippet: item.summary,
      url: item.url,
      date: item.date,
    })),
  });

  cleanupFeedCache();
  const expiry = Date.now() + FEED_CACHE_TTL;
  for (const item of [...combinedFeed, ...exploration]) {
    feedCache.set(item.id, { item, profile: enrichedProfile, name, expires: expiry });
  }

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

  const normalizedName = name.trim();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (phase === 'discover') {
          await handleDiscover(controller, normalizedName);
        } else {
          await handleRun(controller, normalizedName, candidateId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendEvent(controller, 'error', { message });
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

  cleanupFeedCache();
  const entry = feedCache.get(itemId);

  if (!entry) {
    return new Response(JSON.stringify({ error: 'Feed item expired or unknown.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const digest = await createDeepenDigest(entry.profile, entry.item, name);
    return new Response(JSON.stringify(digest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Deepen digest failed.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
