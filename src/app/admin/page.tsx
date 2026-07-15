'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Clock3, LogOut, Pause, Play, RefreshCw, Shield, SkipForward, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { GameState, PortfolioView } from '@/domain/types';
import { apiRequest } from '@/lib/browserApi';

type AdminTeam = {
  id: number;
  team_code: string;
  team_name: string;
  portfolio: PortfolioView;
};

type P2PTrade = {
  id: string;
  proposer_team_name: string;
  counterparty_team_name: string;
  fund_code: string;
  fund_name: string;
  quantity: string;
  agreed_price: string;
  proposer_direction: string;
  status: string;
};

type AuditRow = {
  id: string;
  event_type: string;
  team_id: number | null;
  admin_username: string | null;
  round: number | null;
  created_at: string;
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [p2p, setP2p] = useState<P2PTrade[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [tradeId, setTradeId] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(localStorage.getItem('admin_token'));
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshAll(token);
  }, [token]);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.portfolio.total_value - a.portfolio.total_value),
    [teams],
  );

  async function run(label: string, fn: () => Promise<void>) {
    setMessage(`${label}...`);
    try {
      await fn();
      setMessage(`${label} done`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  async function refreshAll(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    try {
      const [nextState, nextTeams, nextP2p, nextAudit] = await Promise.all([
        apiRequest<GameState>('/api/game/state'),
        apiRequest<AdminTeam[]>('/api/admin/teams', { token: activeToken }),
        apiRequest<P2PTrade[]>('/api/admin/p2p/pending', { token: activeToken }),
        apiRequest<AuditRow[]>('/api/admin/audit', { token: activeToken }),
      ]);
      setState(nextState);
      setTeams(nextTeams);
      setP2p(nextP2p);
      setAudit(nextAudit);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to load admin data');
    } finally {
      setLoading(false);
    }
  }

  async function post(path: string, label: string) {
    if (!token) return;
    await run(label, async () => {
      setState(await apiRequest<GameState>(path, { method: 'POST', token }));
      await refreshAll(token);
    });
  }

  async function uploadSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    await run('Upload schedule', async () => {
      await apiRequest('/api/admin/schedule/upload', {
        method: 'POST',
        token,
        body: JSON.parse(scheduleText),
      });
      setScheduleText('');
    });
  }

  async function p2pAction(action: 'approve' | 'reject', id = tradeId) {
    if (!token || !id) return;
    await run(`${action} P2P`, async () => {
      await apiRequest(`/api/admin/p2p/${action}/${id}`, { method: 'POST', token });
      setTradeId('');
      await refreshAll(token);
    });
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (!token) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-mono">Admin Login Required</CardTitle>
            <CardDescription>Sign in before managing the game.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="buttonLink w-full" href="/admin/login">
              Go to Admin Login
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
            <p className="text-sm text-muted-foreground">Admin console</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {state ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                <Clock3 className="size-4 text-primary" />
                <span>Round {state.round}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{state.phase}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{formatTime(state.time_remaining)}</span>
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

      <main className="mx-auto grid max-w-7xl gap-5 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          {message ? <div className="notice font-mono text-sm">{message}</div> : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <Shield className="size-5 text-primary" />
                Teams
              </CardTitle>
              <CardDescription>Portfolio standings from the backend.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading teams...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Assets</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTeams.map((team) => {
                      const assetValue = team.portfolio.total_value - team.portfolio.cash;
                      return (
                        <TableRow key={team.id}>
                          <TableCell>
                            <p className="font-medium">{team.team_name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{team.team_code}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono">{money(team.portfolio.cash)}</TableCell>
                          <TableCell className="text-right font-mono">{money(assetValue)}</TableCell>
                          <TableCell className="text-right font-mono text-primary">{money(team.portfolio.total_value)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono">P2P Approvals</CardTitle>
              <CardDescription>Approve or reject pending team-to-team trades.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {p2p.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No pending P2P trades.</div>
              ) : (
                p2p.map((trade) => (
                  <div key={trade.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{trade.fund_code}</p>
                          <Badge variant="outline">{trade.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trade.proposer_team_name} to {trade.counterparty_team_name}
                        </p>
                        <p className="mt-2 font-mono text-sm">
                          {units(trade.quantity)} units at {money(trade.agreed_price)}
                        </p>
                      </div>
                      {trade.status === 'awaiting_approval' ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => p2pAction('approve', trade.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => p2pAction('reject', trade.id)}>
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono">Round Controls</CardTitle>
              <CardDescription>Move the current game phase.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button onClick={() => post('/api/admin/round/advance', 'Advance')}>
                <SkipForward />
                Advance
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => post('/api/admin/round/pause', 'Pause')}>
                  <Pause />
                  Pause
                </Button>
                <Button variant="outline" onClick={() => post('/api/admin/round/resume', 'Resume')}>
                  <Play />
                  Resume
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono">Upload Schedule</CardTitle>
              <CardDescription>Paste the round schedule JSON from your prepared source.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={uploadSchedule}>
                <textarea
                  value={scheduleText}
                  onChange={(event) => setScheduleText(event.target.value)}
                  className="min-h-64 w-full rounded-md border bg-background p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="Paste schedule JSON"
                  required
                />
                <Button type="submit" className="w-full">
                  <Upload />
                  Upload JSON
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono">Recent Activity</CardTitle>
              <CardDescription>Latest backend audit events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {audit.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm">{row.event_type}</p>
                    {row.round ? <Badge variant="outline">R{row.round}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                </div>
              ))}
              {audit.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
            </CardContent>
          </Card>
        </aside>
      </main>
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
