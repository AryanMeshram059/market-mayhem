'use client';

import Link from 'next/link';
import { Lock, Search, RefreshCw } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  TeamAccessGate,
  TeamPageHeader,
  money,
  units,
  useTeamDashboardData,
} from '@/components/team-dashboard';
import type { Fund } from '@/domain/types';
import { apiRequest } from '@/lib/browserApi';
import { ExpandableFund } from './expandable-fund';

type Offer = {
  id: string;
  proposer_team_id: number;
  counterparty_team_id: number;
  proposer_team_name: string;
  counterparty_team_name: string;
  fund_code: string;
  fund_name: string;
  quantity: string;
  agreed_price: string;
  proposer_direction: 'buy' | 'sell';
  status: string;
  round: number;
  created_at: string;
};

export default function TradePage() {
  const {
    token,
    teamName,
    teamId,
    portfolio,
    gameState,
    leaderboard,
    news,
    pendingOrders,
    tradableFunds,
    status,
    setStatus,
    loading,
    loadDashboard,
    logout,
  } = useTeamDashboardData();

  const [query, setQuery] = useState('');
  const [expandedFundId, setExpandedFundId] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [mounted, setMounted] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleFunds = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return tradableFunds;
    return tradableFunds.filter((fund) =>
      `${fund.fund_code} ${fund.fund_name}`.toLowerCase().includes(term),
    );
  }, [deferredQuery, tradableFunds]);

  const phaseEndsAtMs = gameState?.phase_ends_at ? new Date(gameState.phase_ends_at).getTime() : 0;
  const tradableNow =
    mounted &&
    gameState?.phase === 'TRADING_OPEN' &&
    !gameState.is_paused &&
    phaseEndsAtMs > 0 &&
    (now > 0 ? phaseEndsAtMs > now : gameState.time_remaining > 0);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleBuySell = async (fund: Fund, orderType: 'buy' | 'sell', quantity: number) => {
    if (!token) return;
    setStatus('');
    try {
      const result = await apiRequest<{ accepted_quantity: number; requested_quantity: number; clipped: boolean }>(
        '/api/order/submit',
        {
          method: 'POST',
          token,
          body: {
            fund_id: fund.id,
            type: orderType,
            quantity,
          },
        },
      );
      setStatus(
        result.clipped
          ? `${fund.fund_code} clipped to ${result.accepted_quantity.toFixed(4)} units based on available cash.`
          : `${orderType === 'buy' ? 'Buy' : 'Sell'} order queued for ${fund.fund_code}`,
      );
      await loadDashboard(token);
      setExpandedFundId(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Order failed');
    }
  };

  if (!token) {
    return <TeamAccessGate token={token} />;
  }

  if (!gameState || !tradableNow) {
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
        <main className="mx-auto flex max-w-3xl items-center justify-center p-4 py-16 md:p-8">
          <Card className="w-full border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Lock className="size-5 text-primary" />
                Trading window closed
              </CardTitle>
              <CardDescription>
                The trade page opens only during the active 5-minute round timer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                Current round: <span className="font-mono text-foreground">{gameState ? `Round ${gameState.round}` : 'Loading'}</span>
              </div>
              <Link href="/dashboard" className="block">
                <Button className="w-full">Back to dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
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

      <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              Overview
            </Button>
          </Link>
        </div>

        {status ? <div className="notice font-mono text-sm">{status}</div> : null}

        {/* Portfolio Summary Cards - Fixed Height */}
        {portfolio ? (
          <div className="grid gap-4 sm:grid-cols-3 h-32">
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6 h-full flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Available Cash</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400">{money(portfolio.cash)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="pt-6 h-full flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Holdings Value</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-blue-400">
                  {money(portfolio.holdings.reduce((sum, h) => sum + h.market_value, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="pt-6 h-full flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Total Portfolio</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-amber-400">{money(portfolio.total_value)}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {news?.news ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-white">Current event</CardTitle>
              <CardDescription>Round {news.news.round} market context for the active cycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm leading-7 text-foreground">
                {news.news.content}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Main Two-Column Layout */}
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Left Column: Market Funds (Full Width Center) */}
          <Card className="border-border/70 bg-card/95 lg:order-1 min-h-96">
            <CardHeader>
              <div className="space-y-3">
                <div>
                  <CardTitle className="text-white">Market Funds</CardTitle>
                  <CardDescription>Click to expand fund details and trade.</CardDescription>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search funds..."
                    className="pl-9 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading market data...</div>
              ) : null}
              {!loading && visibleFunds.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No funds found.</div>
              ) : null}
              {visibleFunds.map((fund) => {
                const holding = portfolio?.holdings.find((h) => h.fund_id === fund.id);
                return (
                  <ExpandableFund
                    key={fund.id}
                    fund={fund}
                    holding={holding || null}
                    portfolio={portfolio}
                    gameState={gameState}
                    tradableNow={tradableNow}
                    isExpanded={expandedFundId === fund.id}
                    onToggle={() => setExpandedFundId(expandedFundId === fund.id ? null : fund.id)}
                    onBuySell={handleBuySell}
                    submitting={false}
                    round={gameState?.round || 1}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Right Column: Portfolio and Pending Orders */}
          <div className="space-y-5 lg:order-2">
            {/* Portfolio Card */}
            <Card className="border-border/70 bg-card/95 min-h-fit">
              <CardHeader>
                <CardTitle className="text-white">Your Portfolio</CardTitle>
                <CardDescription>Current holdings and returns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {portfolio && portfolio.holdings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">
                    No holdings yet. Buy funds to start trading.
                  </div>
                ) : null}
                {portfolio?.holdings.map((holding) => {
                  const returnColor = holding.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400';
                  return (
                    <div key={holding.fund_id} className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-white text-sm">{holding.fund_code}</p>
                          <p className="text-xs text-muted-foreground mt-1">{units(holding.quantity)} units</p>
                        </div>
                        <Badge variant="outline" className={`text-xs ${returnColor}`}>
                          {holding.return_percentage > 0 ? '+' : ''}{holding.return_percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid gap-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Buy:</span>
                          <span className="font-mono text-cyan-400">{money(holding.avg_buy_price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current:</span>
                          <span className="font-mono text-emerald-400">{money(holding.current_nav)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Value:</span>
                          <span className="font-mono text-blue-400">{money(holding.market_value)}</span>
                        </div>
                        <div className="flex justify-between mt-1 pt-1 border-t border-border/50">
                          <span className="text-muted-foreground">Return:</span>
                          <span className={`font-mono ${returnColor}`}>{money(holding.total_return)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Pending Orders Card */}
            <Card className="border-border/70 bg-card/95 min-h-fit">
              <CardHeader>
                <CardTitle className="text-white">Pending Orders</CardTitle>
                <CardDescription>Orders cancelable until round closes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-72 overflow-y-auto">
                {pendingOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">
                    No pending orders right now.
                  </div>
                ) : null}
                {pendingOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/45 px-3 py-3"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{order.fund_code}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{order.type.toUpperCase()}</Badge>
                        <Badge variant="outline" className="text-xs">R{order.round}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {units(order.quantity)} units
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      disabled={!tradableNow}
                      onClick={async () => {
                        try {
                          await apiRequest(`/api/order/cancel/${order.order_id}`, {
                            method: 'DELETE',
                            token,
                          });
                          setStatus('Pending order canceled.');
                          await loadDashboard(token);
                        } catch (err) {
                          setStatus(err instanceof Error ? err.message : 'Unable to cancel order');
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
