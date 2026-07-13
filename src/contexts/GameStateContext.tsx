'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { apiFetch, getToken } from '@/lib/client';
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
    const token = getToken();
    if (!token) {
      setGameState(null);
      setError(null);
      setLoading(false);
      return;
    }

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
    const syncAuth = () => {
      void refresh();
    };

    syncAuth();

    const handleAuthChange = () => {
      void refresh();
    };

    window.addEventListener('mm-auth', handleAuthChange);

    const jitter = Math.random() * 1000;
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_GAME_STATE_MS + jitter);

    return () => {
      window.removeEventListener('mm-auth', handleAuthChange);
      clearInterval(interval);
    };
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
