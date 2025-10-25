import { NextRequest } from 'next/server';

// Type definitions
interface GithubRepo {
  name: string;
  stars: number;
  description: string;
}

interface GithubData {
  repos: GithubRepo[];
  activity: string;
}

interface LinkedInData {
  currentRole: string;
  company: string;
  interests: string[];
}

// Mock data sources - in a real implementation, these would call actual APIs
const mockSearchResults = (name: string) => ({
  github: `https://github.com/${name.toLowerCase().replace(/\s+/g, '-')}`,
  linkedin: `https://linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '-')}`,
  website: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
});

const mockGithubData = (name: string): GithubData => ({
  repos: [
    { name: 'neural-networks', stars: 1234, description: 'Deep learning implementations' },
    { name: 'ml-toolkit', stars: 567, description: 'Machine learning utilities' },
  ],
  activity: 'Active contributor with focus on AI/ML projects',
});

const mockLinkedInData = (name: string): LinkedInData => ({
  currentRole: 'AI Research Scientist',
  company: 'Tech Company',
  interests: ['Machine Learning', 'Neural Networks', 'Computer Vision'],
});

const mockPapers = (interests: string[]) => [
  {
    title: 'Attention Is All You Need',
    description: 'Transformers architecture for sequence modeling',
    source: 'arXiv',
    url: 'https://arxiv.org/abs/1706.03762',
    relevance: 'Foundational work in neural networks architecture',
  },
  {
    title: 'Deep Residual Learning for Image Recognition',
    description: 'ResNet architecture for computer vision tasks',
    source: 'arXiv',
    url: 'https://arxiv.org/abs/1512.03385',
    relevance: 'Key paper in computer vision deep learning',
  },
];

const mockRepos = (interests: string[]) => [
  {
    title: 'pytorch/pytorch',
    description: 'Tensors and Dynamic neural networks in Python',
    source: 'GitHub',
    url: 'https://github.com/pytorch/pytorch',
    relevance: 'Essential framework for ML research',
  },
  {
    title: 'tensorflow/tensorflow',
    description: 'End-to-end open source platform for machine learning',
    source: 'GitHub',
    url: 'https://github.com/tensorflow/tensorflow',
    relevance: 'Comprehensive ML framework',
  },
];

const mockNews = (interests: string[]) => [
  {
    title: 'Latest Advances in Transformer Models',
    description: 'Recent breakthroughs in attention mechanisms',
    source: 'AI News',
    url: 'https://example.com/news/transformers',
    relevance: 'Aligned with neural network interests',
  },
  {
    title: 'Computer Vision Trends 2024',
    description: 'New developments in vision models',
    source: 'Tech Blog',
    url: 'https://example.com/news/vision',
    relevance: 'Relevant to computer vision focus',
  },
];

// Simulated LLM profile generation
const generateProfile = (name: string, githubData: GithubData, linkedInData: LinkedInData): string => {
  return `${name} is an ${linkedInData.currentRole} at ${linkedInData.company} with a strong focus on ${linkedInData.interests.join(', ')}. 

Active on GitHub with notable projects including ${githubData.repos.map(r => r.name).join(' and ')}, showing ${githubData.activity}. 

Key interests span ${linkedInData.interests.join(', ')}, with particular emphasis on practical implementations and research applications.`;
};

// Helper function to send SSE events
function sendEvent(controller: ReadableStreamDefaultController, type: string, data: any) {
  const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

// Simulate async delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const { name } = await request.json();

  if (!name) {
    return new Response(JSON.stringify({ error: 'Name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create a readable stream for server-sent events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Search and identify user
        sendEvent(controller, 'log', { message: '🔍 Searching the web to identify user...', level: 'info' });
        await delay(1000);
        const searchResults = mockSearchResults(name);
        sendEvent(controller, 'log', { message: `✓ Found potential profiles: GitHub, LinkedIn, personal website`, level: 'success' });

        // Step 2: Gather GitHub data
        await delay(800);
        sendEvent(controller, 'log', { message: '📊 Harvesting GitHub data...', level: 'info' });
        await delay(1200);
        const githubData = mockGithubData(name);
        sendEvent(controller, 'log', { message: `✓ Gathered ${githubData.repos.length} repositories and activity data`, level: 'success' });

        // Step 3: Gather LinkedIn data
        await delay(800);
        sendEvent(controller, 'log', { message: '💼 Harvesting LinkedIn data...', level: 'info' });
        await delay(1000);
        const linkedInData = mockLinkedInData(name);
        sendEvent(controller, 'log', { message: `✓ Retrieved professional profile and interests`, level: 'success' });

        // Step 4: Generate LLM-based profile
        await delay(800);
        sendEvent(controller, 'log', { message: '🤖 Generating AI profile summary...', level: 'info' });
        await delay(1500);
        const profile = generateProfile(name, githubData, linkedInData);
        sendEvent(controller, 'profile', { content: profile });
        sendEvent(controller, 'log', { message: '✓ Profile summary generated', level: 'success' });

        // Step 5: Fetch relevant papers
        await delay(800);
        sendEvent(controller, 'log', { message: '📚 Fetching relevant academic papers...', level: 'info' });
        await delay(1200);
        const papers = mockPapers(linkedInData.interests);
        sendEvent(controller, 'log', { message: `✓ Found ${papers.length} relevant papers`, level: 'success' });

        // Step 6: Fetch relevant repositories
        await delay(800);
        sendEvent(controller, 'log', { message: '🗂️ Discovering relevant repositories...', level: 'info' });
        await delay(1000);
        const repos = mockRepos(linkedInData.interests);
        sendEvent(controller, 'log', { message: `✓ Found ${repos.length} relevant repositories`, level: 'success' });

        // Step 7: Fetch relevant news
        await delay(800);
        sendEvent(controller, 'log', { message: '📰 Gathering latest news articles...', level: 'info' });
        await delay(1000);
        const news = mockNews(linkedInData.interests);
        sendEvent(controller, 'log', { message: `✓ Found ${news.length} relevant news items`, level: 'success' });

        // Step 8: Rank and curate feed
        await delay(800);
        sendEvent(controller, 'log', { message: '⚡ Ranking and curating feed with AI...', level: 'info' });
        await delay(1500);
        
        const feedItems = [...papers, ...repos, ...news];
        sendEvent(controller, 'feed', { items: feedItems });
        sendEvent(controller, 'log', { message: `✓ Curated ${feedItems.length} items in your personalized feed`, level: 'success' });

        // Complete
        await delay(500);
        sendEvent(controller, 'complete', { message: 'Feed generation complete' });

        controller.close();
      } catch (error) {
        sendEvent(controller, 'error', { 
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
