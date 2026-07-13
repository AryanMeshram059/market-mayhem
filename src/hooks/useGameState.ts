'use client';

import { useGameStateContext } from '@/contexts/GameStateContext';

export function useGameState() {
  return useGameStateContext();
}
