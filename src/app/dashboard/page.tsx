'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { GameClock } from '@/components/shared/GameClock';
import { NewsFeed } from '@/components/shared/NewsFeed';
import { PortfolioSummary } from '@/components/shared/PortfolioSummary';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <GameClock />
        <div className="grid md:grid-cols-2 gap-6">
          <NewsFeed />
          <PortfolioSummary />
        </div>
      </main>
    </AuthGuard>
  );
}
