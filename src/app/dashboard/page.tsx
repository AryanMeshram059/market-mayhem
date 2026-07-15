'use client';

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Clock3,
  LogOut,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Fund, GameState, HoldingView, PortfolioView } from '@/domain/types';
import { apiRequest } from '@/lib/browserApi';
import { cn } from '@/lib/utils';

type OrderType = 'buy' | 'sell';

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [funds, setFunds] = useState<Fund[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioView | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('buy');
  const [quantity, setQuantity] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('team_token');
    setToken(storedToken);
    setTeamName(localStorage.getItem('team_name') || '');
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshAll(token);
  }, [token]);

  const tradableFunds = useMemo(() => funds.filter((fund) => !fund.is_cash), [funds]);
  const visibleFunds = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tradableFunds;
    return tradableFunds.filter((fund) =>
      `${fund.fund_code} ${fund.fund_name}`.toLowerCase().includes(term),
    );
  }, [query, tradableFunds]);

  const selectedHolding = selectedFund && portfolio
    ? portfolio.holdings.find((holding) => holding.fund_id === selectedFund.id) ?? null
    : null;

  const estimatedValue = selectedFund && Number(quantity) > 0
    ? Number(quantity) * Number(selectedFund.current_nav)
    : 0;

  async function refreshAll(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    setMessage('');
    try {
      const [nextFunds, nextPortfolio, nextState] = await Promise.all([
        apiRequest<Fund[]>('/api/funds'),
        apiRequest<PortfolioView>('/api/portfolio', { token: activeToken }),
        apiRequest<GameState>('/api/game/state'),
      ]);
      setFunds(nextFunds);
      setPortfolio(nextPortfolio);
      setGameState(nextState);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to load market data');
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFund) return;
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest('/api/order/submit', {
        method: 'POST',
        token,
        body: {
          fund_id: selectedFund.id,
          type: orderType,
          quantity: Number(quantity),
        },
      });
      setSelectedFund(null);
      setQuantity('');
      setMessage(`${orderType === 'buy' ? 'Buy' : 'Sell'} order submitted for ${selectedFund.fund_code}`);
      await refreshAll(token);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }

  function openFund(fund: Fund) {
    setSelectedFund(fund);
    setOrderType('buy');
    setQuantity('');
    setMessage('');
  }

  function logout() {
    localStorage.removeItem('team_token');
    localStorage.removeItem('team_name');
    setToken(null);
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-mono">Team Login Required</CardTitle>
            <CardDescription>Sign in to view your market and portfolio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="buttonLink w-full" href="/login">
              Go to Login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b bg-[#0b0d0c] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-mono text-2xl font-black tracking-tight text-primary">
              MARKET_MAYHEM
            </Link>
            <p className="text-sm text-muted-foreground">{teamName || 'Team dashboard'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {gameState ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                <Clock3 className="size-4 text-primary" />
                <span>Round {gameState.round}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{gameState.phase}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{formatTime(gameState.time_remaining)}</span>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => refreshAll()}>
              <RefreshCw />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <Card>
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="font-mono">Market</CardTitle>
                <CardDescription>Select a fund to view details and place an order.</CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search funds"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {message ? <div className="notice mb-4 font-mono text-sm">{message}</div> : null}
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading market data...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Fund</TableHead>
                      <TableHead className="text-right">Current NAV</TableHead>
                      <TableHead className="text-right">Your Units</TableHead>
                      <TableHead className="text-right">Your Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleFunds.map((fund) => {
                      const holding = portfolio?.holdings.find((item) => item.fund_id === fund.id);
                      return (
                        <TableRow
                          key={fund.id}
                          className="cursor-pointer"
                          onClick={() => openFund(fund)}
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') openFund(fund);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-md border bg-muted font-mono text-xs text-primary">
                                {fund.fund_code.slice(0, 3)}
                              </div>
                              <div>
                                <p className="font-medium">{fund.fund_name}</p>
                                <p className="font-mono text-xs text-muted-foreground">{fund.fund_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{money(fund.current_nav)}</TableCell>
                          <TableCell className="text-right font-mono">{holding ? units(holding.quantity) : '0'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {holding ? money(holding.market_value) : money(0)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visibleFunds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                          No funds found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <PortfolioPanel portfolio={portfolio} loading={loading} />
      </main>

      <Dialog open={Boolean(selectedFund)} onOpenChange={(open) => !open && setSelectedFund(null)}>
        {selectedFund ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-mono">{selectedFund.fund_code}</DialogTitle>
              <DialogDescription>{selectedFund.fund_name}</DialogDescription>
            </DialogHeader>
            <form className="space-y-5 p-5" onSubmit={submitOrder}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Current NAV" value={money(selectedFund.current_nav)} />
                <Info label="Your Units" value={selectedHolding ? units(selectedHolding.quantity) : '0'} />
                <Info label="Your Value" value={selectedHolding ? money(selectedHolding.market_value) : money(0)} />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Action</span>
                  <Select value={orderType} onChange={(event) => setOrderType(event.target.value as OrderType)}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </Select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Quantity</span>
                  <Input
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    type="number"
                    min="0"
                    step="0.0001"
                    required
                    autoFocus
                  />
                </label>
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated order value</span>
                  <span className="font-mono">{money(estimatedValue)}</span>
                </div>
                {orderType === 'sell' && selectedHolding ? (
                  <p className="mt-2 text-xs text-muted-foreground">Available to sell: {units(selectedHolding.quantity)} units</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedFund(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || Number(quantity) <= 0 || (orderType === 'sell' && Number(quantity) > (selectedHolding?.quantity ?? 0))}
                >
                  {orderType === 'buy' ? <ArrowDownLeft /> : <ArrowUpRight />}
                  {submitting ? 'Submitting...' : `${orderType === 'buy' ? 'Buy' : 'Sell'} Fund`}
                </Button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function PortfolioPanel({ portfolio, loading }: { portfolio: PortfolioView | null; loading: boolean }) {
  return (
    <aside className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono">
            <Wallet className="size-5 text-primary" />
            Portfolio
          </CardTitle>
          <CardDescription>Your current cash and fund holdings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading portfolio...</div>
          ) : portfolio ? (
            <>
              <div className="rounded-lg border bg-primary/10 p-4">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total Valuation</p>
                <p className="mt-1 text-3xl font-semibold text-primary">{money(portfolio.total_value)}</p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Banknote className="size-4" />
                  Current Cash
                </div>
                <p className="font-mono text-xl">{money(portfolio.cash)}</p>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="size-4 text-primary" />
                  Assets
                </div>
                <div className="space-y-2">
                  {portfolio.holdings.map((holding) => (
                    <div key={holding.fund_id} className="rounded-md border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{holding.fund_code}</p>
                          <p className="text-xs text-muted-foreground">{holding.fund_name}</p>
                        </div>
                        <Badge variant="outline">{units(holding.quantity)}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between font-mono text-sm">
                        <span className="text-muted-foreground">Value</span>
                        <span>{money(holding.market_value)}</span>
                      </div>
                    </div>
                  ))}
                  {portfolio.holdings.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No fund holdings yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">Portfolio unavailable.</div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

function money(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function units(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}
