# Neural Feed

Your own feed curated by AI agents. Enter a name, and watch as autonomous agents discover, harvest, summarize, curate, and explain — all visible through a streaming log, with minimal UI and maximum content value.

## Overview

Neural Feed is a web-based autonomous agent system that builds a personalized content feed from a single name. It:

1. **Searches** the open web to identify the user
2. **Gathers** public data from GitHub, LinkedIn, websites, and news sources
3. **Summarizes** the data into an LLM-based profile
4. **Fetches** and ranks current papers, repositories, and news using AI
5. **Delivers** an evolving, explainable feed — your daily, AI-curated window into the world

## Features

- 🔍 **Autonomous Discovery**: Automatically identifies and researches individuals
- 📊 **Multi-Source Harvesting**: Gathers data from GitHub, LinkedIn, websites, and news
- 🤖 **AI-Powered Profiling**: Creates intelligent summaries using LLM technology
- 📚 **Content Curation**: Finds and ranks papers, repos, and news articles
- 🎯 **Explainable Results**: Each item includes relevance explanations
- 📡 **Real-time Streaming**: Watch the agent work through a live activity log
- 🎨 **Minimal UI**: Clean, focused interface with maximum content value

## Getting Started

### Prerequisites

- Node.js 18+ and npm

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

3. (Optional) Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys if using real API integrations
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. Enter a name in the input field (e.g., "Andrej Karpathy")
2. Click "Generate Feed" or press Enter
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

This version includes a complete mock implementation that demonstrates the full agent workflow. To integrate with real services:

1. Add API keys to `.env.local`:
   - OpenAI API key for LLM features
   - GitHub API token for repository data
   - News API key for news articles
   - ArXiv API for academic papers

2. Replace mock data sources in `/app/api/feed/route.ts` with actual API calls

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

## Future Enhancements

- [ ] Real API integrations (OpenAI, GitHub, LinkedIn, News APIs)
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
