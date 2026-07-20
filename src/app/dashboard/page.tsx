'use client';

import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  PortfolioPanel,
  StatCard,
  TeamAccessGate,
  TeamPageHeader,
  money,
  useTeamDashboardData,
} from '@/components/team-dashboard';

export default function DashboardPage() {
  const { token, teamName, portfolio, gameState, loading, logout, tradableFunds, status, news } =
    useTeamDashboardData();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const deferredQuery = useDeferredValue(query);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const tradableNow = mounted && gameState?.phase === 'TRADING_OPEN' && !gameState.is_paused && gameState.time_remaining > 0;

  const visibleFunds = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return tradableFunds;
    return tradableFunds.filter((fund) =>
      `${fund.fund_code} ${fund.fund_name}`.toLowerCase().includes(term),
    );
  }, [deferredQuery, tradableFunds]);

  if (!token) {
    return <TeamAccessGate token={token} />;
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <TeamPageHeader teamName={teamName} gameState={gameState} onLogout={logout} />

      <main className="mx-auto grid max-w-7xl gap-5 p-4 md:p-8 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <section className="space-y-5">

          {gameState?.phase !== 'IDLE' && news?.news ? (
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-white">Current round news</CardTitle>
                <CardDescription>Round {news.news.round} predefined news for this trading window.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm leading-7 text-foreground">
                  {news.news.content}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-white">Quick access</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {tradableNow ? (
                <Link href="/dashboard/trade" className="block">
                  <Button className="w-full justify-between" size="lg">
                    Trade
                    <ArrowRight />
                  </Button>
                </Link>
              ) : (
                <Button className="w-full justify-between" size="lg" disabled>
                  Trade opens during the 5 min trading window
                  <ArrowRight />
                </Button>
              )}
              <Link href="/dashboard/leaderboard" className="block">
                <Button className="w-full justify-between" size="lg" variant="outline">
                  Leaderboard
                  <ArrowRight />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {status ? <div className="notice font-mono text-sm">{status}</div> : null}

          <Card className="border-border/70 bg-card/95">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-white">Market</CardTitle>
                </div>
                <div className="relative min-w-0 lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search funds"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Fund</TableHead>
                    <TableHead className="text-right">Current price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-12 text-center text-sm text-muted-foreground">
                        Loading market data...
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && visibleFunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-12 text-center text-sm text-muted-foreground">
                        No funds found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading
                    ? visibleFunds.map((fund) => (
                        <TableRow key={fund.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs text-primary">
                                {fund.fund_code.slice(0, 3)}
                              </div>
                              <div>
                                <p className="font-medium text-white">{fund.fund_name}</p>
                                <p className="font-mono text-xs text-muted-foreground">{fund.fund_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{money(fund.current_nav)}</TableCell>
                        </TableRow>
                      ))
                    : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <aside>
          <PortfolioPanel portfolio={portfolio} loading={loading} />
        </aside>
      </main>
    </div>
  );
}
