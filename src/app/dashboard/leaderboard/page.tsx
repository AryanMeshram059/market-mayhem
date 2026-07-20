'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TeamAccessGate, TeamPageHeader, money, useTeamDashboardData } from '@/components/team-dashboard';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function LeaderboardPage() {
  const { token, teamName, teamId, leaderboard, gameState, loading, logout } = useTeamDashboardData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tradableNow = mounted && gameState?.phase === 'TRADING_OPEN' && !gameState.is_paused && gameState.time_remaining > 0;

  if (!token) {
    return <TeamAccessGate token={token} />;
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <TeamPageHeader
        teamName={teamName}
        gameState={gameState}
        onLogout={logout}
        actions={
          <Link href="/dashboard" className="block">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="grid gap-3 md:grid-cols-[auto_auto_1fr]">
          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              Overview
            </Button>
          </Link>
          {tradableNow ? (
            <Link href="/dashboard/trade" className="block">
              <Button variant="outline" className="w-full">
                Trade
              </Button>
            </Link>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              Trade locked
            </Button>
          )}
        </div>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="size-5 text-primary" />
              Leaderboard
            </CardTitle>
            <CardDescription>Rankings are moved here so the main dashboard stays compact.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Portfolio value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                      Loading leaderboard...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                      No leaderboard data available.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading
                  ? leaderboard.map((entry) => (
                      <TableRow key={entry.team_id} className={cn(entry.team_id === teamId && 'bg-primary/10')}>
                        <TableCell>
                          <Badge variant="outline">#{entry.rank}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-white">{entry.team_name}</p>
                          {entry.team_id === teamId ? <p className="text-xs text-primary">Your team</p> : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">{money(entry.portfolio_value)}</TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
