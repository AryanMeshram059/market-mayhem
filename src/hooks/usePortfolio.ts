'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/client';
import { useGameState } from '@/hooks/useGameState';
import type { Holding } from '@/types';

interface PortfolioData {
  cash: number;
  holdings: Holding[];
  total_value: number;
}

export function usePortfolio() {
  const { gameState } = useGameState();
  const isTradingOpen = gameState?.phase === 'TRADING_OPEN';

  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiFetch<PortfolioData>('/api/portfolio'),
    refetchInterval: isTradingOpen ? 2500 : false,
    enabled: !!gameState,
  });
}
