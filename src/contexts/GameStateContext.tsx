'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { apiFetch } from '@/lib/client';
import type { GameState } from '@/types';
import { POLL_INTERVAL_GAME_STATE_MS } from '@/constants/game';

interface GameStateContextValue {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const GameStateContext = createContext<GameStateContextValue>({
  gameState: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<GameState>('/api/game/state');
      if (data) setGameState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch game state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const jitter = Math.random() * 1000;
    const interval = setInterval(refresh, POLL_INTERVAL_GAME_STATE_MS + jitter);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <GameStateContext.Provider value={{ gameState, loading, error, refresh }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameStateContext() {
  return useContext(GameStateContext);
}
