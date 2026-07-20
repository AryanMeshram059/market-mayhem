'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ListOrdered, Lock, RefreshCw, Search, Users } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Info,
  type MarketOrderType,
  TeamAccessGate,
  TeamPageHeader,
  type TradeMode,
  TradeToggle,
  money,
  units,
  useTeamDashboardData,
} from '@/components/team-dashboard';
import type { Fund } from '@/domain/types';
import { apiRequest } from '@/lib/browserApi';

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
  proposer_direction: MarketOrderType;
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
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [orderType, setOrderType] = useState<MarketOrderType>('buy');
  const [quantity, setQuantity] = useState('');
  const [query, setQuery] = useState('');
  const [tradeMode, setTradeMode] = useState<TradeMode>('market');
  const [counterpartyTeamId, setCounterpartyTeamId] = useState('');
  const [p2pFundId, setP2pFundId] = useState('');
  const [p2pDirection, setP2pDirection] = useState<MarketOrderType>('buy');
  const [p2pQuantity, setP2pQuantity] = useState('');
  const [p2pPrice, setP2pPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [acceptingTradeId, setAcceptingTradeId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const visibleFunds = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return tradableFunds;
    return tradableFunds.filter((fund) =>
      `${fund.fund_code} ${fund.fund_name}`.toLowerCase().includes(term),
    );
  }, [deferredQuery, tradableFunds]);
  const selectedHolding =
    selectedFund && portfolio
      ? portfolio.holdings.find((holding) => holding.fund_id === selectedFund.id) ?? null
      : null;
  const estimatedValue =
    selectedFund && Number(quantity) > 0 ? Number(quantity) * Number(selectedFund.current_nav) : 0;
  const phaseEndsAtMs = gameState?.phase_ends_at ? new Date(gameState.phase_ends_at).getTime() : 0;
  const tradableNow =
    gameState?.phase === 'TRADING_OPEN' &&
    !gameState.is_paused &&
    phaseEndsAtMs > 0 &&
    (now > 0 ? phaseEndsAtMs > now : gameState.time_remaining > 0);
  const teamChoices = leaderboard.filter((entry) => entry.team_id !== teamId);
  const buyOffers = offers.filter((offer) => offer.proposer_direction === 'buy');
  const sellOffers = offers.filter((offer) => offer.proposer_direction === 'sell');

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Auto-refresh portfolio during trading window
  useEffect(() => {
    if (!token || !tradableNow) return;
    
    const refreshInterval = window.setInterval(() => {
      void loadDashboard(token);
    }, 3000); // Refresh every 3 seconds during trading
    
    return () => window.clearInterval(refreshInterval);
  }, [token, tradableNow, loadDashboard]);

  const refreshOffers = useCallback(async () => {
    if (!token) return;
    setOffersLoading(true);
    try {
      setOffers(await apiRequest<Offer[]>('/api/p2p/offers', { token }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load offers');
    } finally {
      setOffersLoading(false);
    }
  }, [token, setStatus]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadInitialOffers() {
      try {
        const nextOffers = await apiRequest<Offer[]>('/api/p2p/offers', { token });
        if (!cancelled) {
          setOffers(nextOffers);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Unable to load offers');
        }
      }
    }

    void loadInitialOffers();

    return () => {
      cancelled = true;
    };
  }, [token, setStatus]);

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFund) return;
    setSubmitting(true);
    setStatus('');
    try {
      const result = await apiRequest<{ accepted_quantity: number; requested_quantity: number; clipped: boolean }>(
        '/api/order/submit',
        {
          method: 'POST',
          token,
          body: {
            fund_id: selectedFund.id,
            type: orderType,
            quantity: Number(quantity),
          },
        },
      );
      setSelectedFund(null);
      setQuantity('');
      setStatus(
        result.clipped
          ? `${selectedFund.fund_code} clipped to ${result.accepted_quantity.toFixed(4)} units based on available cash.`
          : `${orderType === 'buy' ? 'Buy' : 'Sell'} order queued for ${selectedFund.fund_code}`,
      );
      await loadDashboard(token);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitP2P(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setStatus('');
    try {
      await apiRequest('/api/p2p/propose', {
        method: 'POST',
        token,
        body: {
          counterparty_team_id: Number(counterpartyTeamId),
          fund_id: Number(p2pFundId),
          quantity: Number(p2pQuantity),
          price_per_unit: Number(p2pPrice),
          direction: p2pDirection,
        },
      });
      setCounterpartyTeamId('');
      setP2pFundId('');
      setP2pDirection('buy');
      setP2pQuantity('');
      setP2pPrice('');
      setStatus('Direct team offer posted and the required cash or units are now locked.');
      await loadDashboard(token);
      await refreshOffers();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'P2P proposal failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptOffer(tradeId: string) {
    if (!token) return;
    setAcceptingTradeId(tradeId);
    setStatus('');
    try {
      await apiRequest(`/api/p2p/accept/${tradeId}`, {
        method: 'POST',
        token,
      });
      setStatus('Offer accepted successfully.');
      await loadDashboard(token);
      await refreshOffers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to accept offer');
    } finally {
      setAcceptingTradeId(null);
    }
  }

  async function cancelPendingOrder(orderId: string) {
    if (!token) return;
    setStatus('');
    try {
      await apiRequest(`/api/order/cancel/${orderId}`, {
        method: 'DELETE',
        token,
      });
      setStatus('Pending order canceled.');
      await loadDashboard(token);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to cancel order');
    }
  }

  function openFund(fund: Fund) {
    setSelectedFund(fund);
    setOrderType('buy');
    setQuantity('');
    setStatus('');
  }

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
        <div className="grid gap-3 md:grid-cols-[auto_auto_1fr]">
          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              Overview
            </Button>
          </Link>
        </div>

        {status ? <div className="notice font-mono text-sm">{status}</div> : null}

        {portfolio ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Available Cash</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400">{money(portfolio.cash)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Holdings Value</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-blue-400">
                  {money(portfolio.holdings.reduce((sum, h) => sum + h.market_value, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="pt-6">
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

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-white">Trade</CardTitle>
                <CardDescription>
                  Use the focused trade page for market orders and direct team offers.
                </CardDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] lg:w-auto">
                <div className="relative min-w-0 lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tradable funds"
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-background/60 p-1">
                  <TradeToggle active={tradeMode === 'market'} label="Market" onClick={() => setTradeMode('market')} />
                  <TradeToggle active={tradeMode === 'intra'} label="Intra" onClick={() => setTradeMode('intra')} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {tradeMode === 'market' ? (
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-border/70 bg-background/55">
                  <CardHeader>
                    <CardTitle className="text-white">Market order board</CardTitle>
                    <CardDescription>Select a fund to place a buy or sell order.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Fund</TableHead>
                          <TableHead className="text-right">Current NAV</TableHead>
                          <TableHead className="text-right">Your units</TableHead>
                          <TableHead className="text-right">Your value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                              Loading market data...
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {!loading && visibleFunds.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                              No funds found.
                            </TableCell>
                          </TableRow>
                        ) : null}
                        {!loading
                          ? visibleFunds.map((fund) => {
                              const holding = portfolio?.holdings.find((item) => item.fund_id === fund.id);
                              return (
                                <TableRow key={fund.id} className="cursor-pointer" onClick={() => openFund(fund)}>
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
                                  <TableCell className="text-right font-mono">{holding ? units(holding.quantity) : '0'}</TableCell>
                                  <TableCell className="text-right font-mono">{money(holding?.market_value ?? 0)}</TableCell>
                                </TableRow>
                              );
                            })
                          : null}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-background/55">
                  <CardHeader>
                    <CardTitle className="text-white">Pending market orders</CardTitle>
                    <CardDescription>Orders remain cancelable until the trading phase closes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pendingOrders.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">
                        No pending orders right now.
                      </div>
                    ) : null}
                    {pendingOrders.map((order) => (
                      <div
                        key={order.order_id}
                        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/45 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">{order.fund_code}</p>
                            <Badge variant="outline">{order.type.toUpperCase()}</Badge>
                            <Badge variant="outline">Round {order.round}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.fund_name} - {units(order.quantity)} units
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!tradableNow}
                          onClick={() => void cancelPendingOrder(order.order_id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-5">
                  <Card className="border-border/70 bg-background/55">
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <ListOrdered className="size-5 text-primary" />
                        Incoming sell offers
                      </CardTitle>
                      <Button type="button" size="sm" variant="outline" onClick={() => void refreshOffers()} disabled={offersLoading}>
                        <RefreshCw />
                        Refresh
                      </Button>
                    </div>
                    <CardDescription>These teams are offering to sell units to you at the listed price.</CardDescription>
                  </CardHeader>
                    <CardContent className="space-y-3">
                      {offersLoading ? <div className="text-sm text-muted-foreground">Loading offers...</div> : null}
                      {!offersLoading && sellOffers.length === 0 ? <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No incoming sell offers right now.</div> : null}
                      {sellOffers.map((offer) => (
                        <OfferCard key={offer.id} offer={offer} actionLabel="Accept sell offer" onAccept={() => void acceptOffer(offer.id)} accepting={acceptingTradeId === offer.id || !tradableNow} />
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-background/55">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Users className="size-5 text-primary" />
                        Incoming buy offers
                      </CardTitle>
                      <CardDescription>These teams want to buy units from you at the listed price.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!offersLoading && buyOffers.length === 0 ? <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No incoming buy offers right now.</div> : null}
                      {buyOffers.map((offer) => (
                        <OfferCard key={offer.id} offer={offer} actionLabel="Accept buy offer" onAccept={() => void acceptOffer(offer.id)} accepting={acceptingTradeId === offer.id || !tradableNow} />
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/70 bg-background/55">
                  <CardHeader>
                    <CardTitle className="text-white">Post a direct offer</CardTitle>
                    <CardDescription>
                      Posting an offer now locks the required cash or units until the counterparty accepts it or the round closes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={submitP2P}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm font-medium">
                          <span>Counterparty team</span>
                          <Select value={counterpartyTeamId} onChange={(event) => setCounterpartyTeamId(event.target.value)} required>
                            <option value="">Select a team</option>
                            {teamChoices.map((entry) => (
                              <option key={entry.team_id} value={entry.team_id}>
                                {entry.team_name}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="space-y-1.5 text-sm font-medium">
                          <span>Direction</span>
                          <Select value={p2pDirection} onChange={(event) => setP2pDirection(event.target.value as MarketOrderType)}>
                            <option value="buy">Buy offer</option>
                            <option value="sell">Sell offer</option>
                          </Select>
                        </label>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="space-y-1.5 text-sm font-medium">
                          <span>Fund</span>
                          <Select value={p2pFundId} onChange={(event) => setP2pFundId(event.target.value)} required>
                            <option value="">Select fund</option>
                            {tradableFunds.map((fund) => (
                              <option key={fund.id} value={fund.id}>
                                {fund.fund_code}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="space-y-1.5 text-sm font-medium">
                          <span>Quantity</span>
                          <Input value={p2pQuantity} onChange={(event) => setP2pQuantity(event.target.value)} type="number" min="0" step="0.0001" required />
                        </label>
                        <label className="space-y-1.5 text-sm font-medium">
                          <span>Price per unit</span>
                          <Input value={p2pPrice} onChange={(event) => setP2pPrice(event.target.value)} type="number" min="0" step="0.01" required />
                        </label>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                        Offer price must stay within +/-3% of the current NAV, and total offer size must stay under Rs 10 Cr.
                      </div>
                      <Button type="submit" className="w-full" disabled={!tradableNow || submitting}>
                        {submitting ? 'Submitting...' : 'Send direct offer'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
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
                <Info label="Your units" value={selectedHolding ? units(selectedHolding.quantity) : '0'} />
                <Info label="Your value" value={selectedHolding ? money(selectedHolding.market_value) : money(0)} />
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Action</span>
                  <Select value={orderType} onChange={(event) => setOrderType(event.target.value as MarketOrderType)}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </Select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Quantity</span>
                  <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="0.0001" required autoFocus />
                </label>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated order value</span>
                  <span className="font-mono">{money(estimatedValue)}</span>
                </div>
                {orderType === 'sell' && selectedHolding ? <p className="mt-2 text-xs text-muted-foreground">Available to sell: {units(selectedHolding.quantity)} units</p> : null}
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
                The backend only accepts orders during <span className="font-mono text-foreground">TRADING_OPEN</span>. Freeze behavior still happens server-side even if your dialog is open.
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedFund(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!tradableNow || submitting || Number(quantity) <= 0 || (orderType === 'sell' && Number(quantity) > (selectedHolding?.quantity ?? 0))}>
                  {orderType === 'buy' ? <ArrowDownLeft /> : <ArrowUpRight />}
                  {submitting ? 'Submitting...' : `${orderType === 'buy' ? 'Buy' : 'Sell'} fund`}
                </Button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function OfferCard({ offer, actionLabel, onAccept, accepting }: { offer: Offer; actionLabel: string; onAccept: () => void; accepting: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-white">{offer.fund_code}</p>
        <Badge variant="outline">{offer.proposer_direction.toUpperCase()}</Badge>
        <Badge variant="outline">Round {offer.round}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {offer.proposer_team_name} {'->'} {offer.counterparty_team_name}
      </p>
      <p className="mt-1 font-mono text-sm">
        {units(offer.quantity)} units at {money(offer.agreed_price)}
      </p>
      <Button className="mt-4 w-full" onClick={onAccept} disabled={accepting}>
        {accepting ? 'Processing...' : actionLabel}
      </Button>
    </div>
  );
}
