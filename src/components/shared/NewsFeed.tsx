'use client';

import { useEffect, useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';

export function NewsFeed() {
  const { gameState } = useGameState();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameState) return;

    const fetchNews = async () => {
      try {
        const data = await apiFetch<{ content: string }>(`/api/game/news?round=${gameState.round}`);
        if (data) setContent(data.content);
      } catch {
        setContent('Unable to load news feed.');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [gameState?.round]);

  if (loading) {
    return <div className="rounded-lg border bg-card p-4 animate-pulse h-24" />;
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Market News — Round {gameState?.round}</h3>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}
