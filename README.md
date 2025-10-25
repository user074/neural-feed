# Neural Feed

Your own feed curated by AI agents. Enter a name, and watch as autonomous agents discover, harvest, summarize, curate, and explain — all visible through a streaming log, with minimal UI and maximum content value.

## Overview

Neural Feed is a web-based autonomous agent system that builds a personalized content feed from a single name. It:

1. **Searches** the open web to identify the user
2. **Gathers** public data from GitHub, LinkedIn, websites, and news sources
3. **Summarizes** the data into an LLM-based profile
4. **Fetches** and ranks current papers, discussions, and news/blogs using AI
5. **Delivers** an evolving, explainable feed — your daily, AI-curated window into the world

## Features

- 🔍 **Autonomous Discovery**: Automatically identifies and researches individuals
- 📊 **Multi-Source Harvesting**: Gathers data from GitHub, LinkedIn, websites, and news
- 🤖 **AI-Powered Profiling**: Creates intelligent summaries using LLM technology
- 📚 **Content Curation**: Finds and ranks papers, community discussions, and news/blog articles
- 🎯 **Explainable Results**: Each item includes relevance explanations
- 🎛️ **Weighted Personalization**: Learns keyword and source emphasis from harvested evidence
- 📡 **Real-time Streaming**: Watch the agent work through a live activity log
- 🎨 **Minimal UI**: Clean, focused interface with maximum content value

## Getting Started

### Prerequisites

- Node.js 20.17.0 (see `.nvmrc`) and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/user074/neural-feed.git
cd neural-feed
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys (see table below)
```

4. Run the development server:

```bash
nvm use
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. Enter a name in the input field (e.g., "Andrej Karpathy")
2. Click "Find me" or press Enter
3. Watch the agent log as it:
   - Searches and identifies the person
   - Harvests data from multiple sources
   - Generates an AI profile summary
   - Curates relevant papers, repositories, and news
4. Explore the personalized feed with explanations for each item

## Architecture

### Frontend
- **Next.js 15** with App Router
- **React** for UI components
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Server-Sent Events (SSE)** for real-time streaming

### Backend
- **Next.js API Routes** for serverless functions
- **Streaming responses** for real-time updates
- **Agent system** with multiple specialized agents:
  - User Discovery Agent
  - Data Harvesting Agent
  - Profile Summarization Agent
  - Content Curation Agent
  - Ranking & Explanation Agent

### Current Implementation

The agent now connects to live services end-to-end:
- **Google Custom Search API** – identity discovery across the open web
- **GitHub REST API** – public profile context and repository stats
- **OpenAI Responses API** – profile synthesis, feed ranking, and deepen digests
- **arXiv Atom**, **HN Algolia**, and **Google News/blog queries** – candidate feed items

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SEARCH_API_KEY` | Yes | Google Custom Search API key for candidate discovery. |
| `GOOGLE_SEARCH_CX` | Yes | Search engine identifier (CX) for Custom Search. |
| `OPENAI_API_KEY` | Yes (for profile, ranking, deepen) | OpenAI API key with access to the Responses API. |
| `GITHUB_TOKEN` | Optional | GitHub personal access token for higher rate limits during harvesting and repo search. |

When a key is omitted, the agent falls back to deterministic heuristics for that capability.

## Future Enhancements

- [ ] Enriched LinkedIn parsing with resilient fetch
- [ ] User authentication and saved feeds
- [ ] Feed history and evolution tracking
- [ ] Customizable sources and preferences
- [ ] RSS/Email feed delivery
- [ ] Advanced filtering and search
- [ ] Mobile app

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
