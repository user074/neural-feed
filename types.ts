export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  message: string;
  level: LogLevel;
  timestamp: string;
}

export interface CandidateProfile {
  id: string;
  displayName: string;
  source: 'github' | 'linkedin' | 'site';
  headline: string;
  location: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface ProfileCardData {
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

export type FeedSource = 'arxiv' | 'hn' | 'github' | 'news';

export interface FeedItem {
  id: string;
  source: FeedSource;
  title: string;
  summary: string;
  because: string;
  url: string;
  date: string;
}

export interface DeepenDigest {
  tldr: string;
  why_me: string;
  next_actions: string[];
}

export type AgentState =
  | 'DiscoverCandidates'
  | 'AwaitUserConfirm'
  | 'ResolveEntities'
  | 'HarvestPublicData'
  | 'BuildProfile'
  | 'FetchCandidates'
  | 'RankAndExplain';
