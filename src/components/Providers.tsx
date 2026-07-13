'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { GameStateProvider } from '@/contexts/GameStateContext';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 3, staleTime: 1000 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <GameStateProvider>
        {children}
      </GameStateProvider>
    </QueryClientProvider>
  );
}
