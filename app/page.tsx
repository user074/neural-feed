'use client';

import { useState } from 'react';

interface LogEntry {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: string;
}

interface FeedItem {
  title: string;
  description: string;
  source: string;
  url?: string;
  relevance: string;
}

export default function Home() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState('');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: Date.now(), message, type, timestamp }]);
  };

  const generateFeed = async () => {
    if (!name.trim()) {
      addLog('Please enter a name', 'error');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    setFeedItems([]);
    setProfile('');

    addLog(`Starting feed generation for: ${name}`, 'info');

    try {
      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate feed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'log') {
                addLog(data.message, data.level || 'info');
              } else if (data.type === 'profile') {
                setProfile(data.content);
              } else if (data.type === 'feed') {
                setFeedItems(data.items);
              } else if (data.type === 'complete') {
                addLog('Feed generation complete!', 'success');
              } else if (data.type === 'error') {
                addLog(data.message, 'error');
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Neural Feed</h1>
        <p className="text-gray-400">
          Your own feed curated by AI agents. Enter a name to discover, harvest, summarize, and curate personalized content.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && generateFeed()}
            placeholder="Enter a name (e.g., 'Andrej Karpathy')"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={generateFeed}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Feed'}
          </button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="mb-8 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-xl font-semibold mb-3">Agent Log</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.type}`}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="mb-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-3">Profile Summary</h2>
          <p className="text-gray-300 whitespace-pre-wrap">{profile}</p>
        </div>
      )}

      {feedItems.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Curated Feed</h2>
          <div className="space-y-4">
            {feedItems.map((item, index) => (
              <div key={index} className="border-b border-gray-800 pb-4 last:border-b-0">
                <h3 className="text-lg font-medium text-blue-400 mb-1">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                <p className="text-gray-300 mb-2">{item.description}</p>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>Source: {item.source}</span>
                  <span>•</span>
                  <span>Relevance: {item.relevance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && logs.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <p>Enter a name above to start generating your personalized feed</p>
        </div>
      )}
    </main>
  );
}
