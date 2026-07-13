'use client';

import { useEffect, useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';

export function NewsFeed() {
  const { gameState, error: gameStateError } = useGameState();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameState) return;

    const fetchNews = async () => {
      try {
        const data = await apiFetch<{ content: string }>(`/api/game/news?round=${gameState.round}`);
        if (data) setContent(data.content);
        setError(null);
      } catch {
        setError('Unable to load the latest market news right now.');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    setError(null);
    fetchNews();
  }, [gameState?.round]);

  if (loading) {
    return <div className="rounded-lg border bg-card p-4 animate-pulse h-24" />;
  }

  if (gameStateError || error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error ?? 'Unable to load the latest market news right now.'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Market News — Round {gameState?.round}</h3>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}
