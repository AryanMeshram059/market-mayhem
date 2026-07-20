'use client';

import Link from 'next/link';
import { Clock3, LogOut, Wallet } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Fund, GameState, HoldingView, PortfolioView } from '@/domain/types';
import { apiRequest } from '@/lib/browserApi';
import { cn } from '@/lib/utils';

export type MarketOrderType = 'buy' | 'sell';
export type TradeMode = 'market' | 'intra';

export type LeaderboardEntry = {
  rank: number;
  team_id: number;
  team_name: string;
  portfolio_value: number;
};

export type NewsPayload = {
  round: number;
  news: {
    round: number;
    content: string;
    created_at: string;
  } | null;
};

export type PendingOrder = {
  order_id: string;
  fund_id: number;
  fund_code: string;
  fund_name: string;
  type: MarketOrderType;
  quantity: string;
  created_at: string;
  round: number;
};

export function readTeamSession() {
  if (typeof window === 'undefined') {
    return { token: null as string | null, teamName: '', teamId: null as number | null };
  }

  const token = localStorage.getItem('team_token');
  const teamName = localStorage.getItem('team_name') || '';
  const rawTeamId = Number(localStorage.getItem('team_id'));
  return { token, teamName, teamId: Number.isFinite(rawTeamId) ? rawTeamId : null };
}

export function useTeamDashboardData() {
  const session = readTeamSession();
  const [token, setToken] = useState<string | null>(session.token);
  const [teamName] = useState(session.teamName);
  const [teamId] = useState<number | null>(session.teamId);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioView | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [news, setNews] = useState<NewsPayload | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(Boolean(session.token));

  const fetchDashboardData = useCallback(async (activeToken: string) => {
    const [nextFunds, nextPortfolio, nextState, nextNews, nextLeaderboard, nextPending] = await Promise.all([
      apiRequest<Fund[]>('/api/funds'),
      apiRequest<PortfolioView>('/api/portfolio', { token: activeToken }),
      apiRequest<GameState>('/api/game/state'),
      apiRequest<NewsPayload>('/api/game/news'),
      apiRequest<LeaderboardEntry[]>('/api/game/leaderboard'),
      apiRequest<PendingOrder[]>('/api/order/pending', { token: activeToken }),
    ]);

    return {
      nextFunds,
      nextPortfolio,
      nextState,
      nextNews,
      nextLeaderboard,
      nextPending,
    };
  }, []);

  const loadDashboard = useCallback(async (activeToken: string) => {
    setLoading(true);
    try {
      const data = await fetchDashboardData(activeToken);
      setFunds(data.nextFunds);
      setPortfolio(data.nextPortfolio);
      setGameState(data.nextState);
      setNews(data.nextNews);
      setLeaderboard(data.nextLeaderboard);
      setPendingOrders(data.nextPending);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to load game data');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!token) return;

    const activeToken = token;
    let cancelled = false;

    async function syncDashboard() {
      setLoading(true);
      try {
        const data = await fetchDashboardData(activeToken);
        if (cancelled) return;
        setFunds(data.nextFunds);
        setPortfolio(data.nextPortfolio);
        setGameState(data.nextState);
        setNews(data.nextNews);
        setLeaderboard(data.nextLeaderboard);
        setPendingOrders(data.nextPending);
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Unable to load game data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncDashboard();

    return () => {
      cancelled = true;
    };
  }, [token, fetchDashboardData, loadDashboard]);

  const tradableFunds = useMemo(() => funds.filter((fund) => !fund.is_cash), [funds]);

  function logout() {
    localStorage.removeItem('team_token');
    localStorage.removeItem('team_name');
    localStorage.removeItem('team_id');
    setToken(null);
    window.location.href = '/login';
  }

  return {
    token,
    teamName,
    teamId,
    tradableFunds,
    portfolio,
    gameState,
    leaderboard,
    news,
    pendingOrders,
    status,
    setStatus,
    loading,
    loadDashboard,
    logout,
  };
}

export function TeamAccessGate({ token }: { token: string | null }) {
  if (token) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-mono">Team Login Required</CardTitle>
          <CardDescription>Sign in to continue to the team console.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="block" href="/login">
            <Button className="w-full">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export function TeamPageHeader({
  teamName,
  gameState,
  actions,
  onLogout,
}: {
  teamName: string;
  gameState: GameState | null;
  actions?: ReactNode;
  onLogout: () => void;
}) {
  const [displayTimeRemaining, setDisplayTimeRemaining] = useState(gameState?.time_remaining ?? 0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Update clock every second
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Calculate time remaining from phase_ends_at
    if (!gameState || gameState.is_paused || !gameState.phase_ends_at) {
      setDisplayTimeRemaining(gameState?.time_remaining ?? 0);
      return;
    }

    const timeRemaining = Math.max(0, Math.ceil((new Date(gameState.phase_ends_at).getTime() - now) / 1000));
    setDisplayTimeRemaining(timeRemaining);
  }, [gameState, now]);

  return (
    <header className="border-b border-border/70 bg-[#0b0d0c] px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="font-mono text-2xl font-black tracking-tight text-primary">
            MARKET_MAYHEM
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{teamName || 'Team dashboard'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {gameState ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-2 font-mono text-xs">
              <Clock3 className="size-4 text-primary" />
              <span>Round {gameState.round}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{phaseLabel(gameState)}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{formatTime(displayTimeRemaining)}</span>
            </div>
          ) : null}
          {actions}
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PortfolioPanel({
  portfolio,
  loading,
}: {
  portfolio: PortfolioView | null;
  loading: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Wallet className="size-7 text-primary" />
          Portfolio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading portfolio...</div> : null}
        {!loading && portfolio ? (
          <>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total valuation</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{money(portfolio.total_value)}</p>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-sm text-muted-foreground">Cash remaining</p>
              <p className="mt-1 font-mono text-xl text-white">{money(portfolio.cash)}</p>
            </div>
            <div className="space-y-2">
              {portfolio.holdings.map((holding) => (
                <HoldingCard key={holding.fund_id} holding={holding} totalValue={portfolio.total_value} />
              ))}
              {portfolio.holdings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  No fund holdings yet.
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {!loading && !portfolio ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Portfolio unavailable.</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HoldingCard({ holding, totalValue }: { holding: HoldingView; totalValue: number }) {
  const share = totalValue > 0 ? (holding.market_value / totalValue) * 100 : 0;
  const returnColor = holding.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400';
  
  return (
    <div className="rounded-lg border border-border/70 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{holding.fund_code}</p>
          <p className="text-xs text-muted-foreground">{holding.fund_name}</p>
        </div>
        <Badge variant="outline">{units(holding.quantity)} units </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Buy Price</span>
          <span className="font-mono text-cyan-400">{money(holding.avg_buy_price)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current NAV</span>
          <span className="font-mono text-emerald-400">{money(holding.current_nav)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Market Value</span>
          <span className="font-mono text-blue-400">{money(holding.market_value)}</span>
        </div>
        <div className={`flex items-center justify-between`}>
          <span className="text-muted-foreground">Total Return</span>
          <span className={`font-mono ${returnColor}`}>
            {money(holding.total_return)} ({holding.return_percentage.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  accent = 'text-primary',
}: {
  title: string;
  value: string;
  subtitle: string;
  accent?: string;
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn('text-2xl', accent)}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{subtitle}</CardContent>
    </Card>
  );
}

export function TradeToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

export function money(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

export function units(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(Number.isFinite(number) ? number : 0);
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export function phaseLabel(state: GameState) {
  if (state.is_paused) return 'Paused';
  switch (state.phase) {
    case 'IDLE':
      return 'Waiting to start';
    case 'SETUP_OPEN':
      return 'Setup window';
    case 'NEWS_REVEAL':
      return 'Read window';
    case 'TRADING_OPEN':
      return 'Trade window';
    case 'ORDER_LOCK':
      return 'Freeze / compute';
    case 'RESULTS_DISPLAY':
      return 'Leaderboard update';
    default:
      return state.phase;
  }
}
