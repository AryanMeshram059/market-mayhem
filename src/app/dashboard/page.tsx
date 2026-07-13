'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { GameClock } from '@/components/shared/GameClock';
import { NewsFeed } from '@/components/shared/NewsFeed';
import { PortfolioSummary } from '@/components/shared/PortfolioSummary';
import { useGameState } from '@/hooks/useGameState';

export default function DashboardPage() {
  const { error } = useGameState();

  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Unable to load live market data yet. Please wait a moment or refresh if the issue continues.
          </div>
        )}
        <GameClock />
        <div className="grid md:grid-cols-2 gap-6">
          <NewsFeed />
          <PortfolioSummary />
        </div>
      </main>
    </AuthGuard>
  );
}
