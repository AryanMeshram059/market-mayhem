'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-xl font-bold mb-4">Leaderboard</h1>
        <LeaderboardTable />
      </main>
    </AuthGuard>
  );
}
