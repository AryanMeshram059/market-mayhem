'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Flag, FolderClock, LogOut, Pause, Play, RefreshCw, SkipForward, Upload, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type NewsPayload = {
  round: number;
  news: {
    round: number;
    content: string;
    created_at: string;
  } | null;
};

function readAdminToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export default function AdminPage() {
  const initialToken = readAdminToken();
  const [token, setToken] = useState<string | null>(initialToken);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [p2p, setP2p] = useState<P2PTrade[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [news, setNews] = useState<NewsPayload | null>(null);
  const [newsDraft, setNewsDraft] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [selectedTeam, setSelectedTeam] = useState<AdminTeam | null>(null);

  const fetchAdminData = useCallback(async (activeToken: string) => {
    const [nextState, nextTeams, nextP2p, nextAudit, nextNews] = await Promise.all([
      apiRequest<GameState>('/api/game/state'),
      apiRequest<AdminTeam[]>('/api/admin/teams', { token: activeToken }),
      apiRequest<P2PTrade[]>('/api/admin/p2p/pending', { token: activeToken }),
      apiRequest<AuditRow[]>('/api/admin/audit', { token: activeToken }),
      apiRequest<NewsPayload>('/api/game/news'),
    ]);

    return {
      nextState,
      nextTeams,
      nextP2p,
      nextAudit,
      nextNews,
    };
  }, []);

  const loadAdmin = useCallback(async (activeToken: string) => {
    setLoading(true);
    try {
      const data = await fetchAdminData(activeToken);
      setState(data.nextState);
      setTeams(data.nextTeams);
      setP2p(data.nextP2p);
      setAudit(data.nextAudit);
      setNews(data.nextNews);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to load admin data');
    } finally {
      setLoading(false);
    }
  }, [fetchAdminData]);

  useEffect(() => {
    if (!token) return;

    const activeToken = token;
    let cancelled = false;

    async function syncAdmin() {
      setLoading(true);
      try {
        const data = await fetchAdminData(activeToken);
        if (cancelled) return;
        setState(data.nextState);
        setTeams(data.nextTeams);
        setP2p(data.nextP2p);
        setAudit(data.nextAudit);
        setNews(data.nextNews);
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Unable to load admin data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncAdmin();
    const intervalId = window.setInterval(() => {
      void loadAdmin(activeToken);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, fetchAdminData, loadAdmin]);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.portfolio.total_value - a.portfolio.total_value || a.id - b.id), [teams]);
  const conductedTrades = useMemo(() => audit.filter((row) => ['order_executed', 'order_failed', 'p2p_executed', 'p2p_failed'].includes(row.event_type)), [audit]);

  async function run(label: string, fn: () => Promise<void>) {
    setMessage(`${label}...`);
    try {
      await fn();
      setMessage(`${label} done`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  async function post(path: string, label: string) {
    if (!token) return;
    await run(label, async () => {
      setState(await apiRequest<GameState>(path, { method: 'POST', token }));
      await loadAdmin(token);
    });
  }

  async function uploadSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    await run('Upload schedule', async () => {
      await apiRequest('/api/admin/schedule/upload', {
        method: 'POST',
        token,
        body: JSON.parse(scheduleText),
      });
      setScheduleText('');
      await loadAdmin(token);
    });
  }

  async function publishNewsItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    await run('Publish news', async () => {
      await apiRequest('/api/admin/news/publish', {
        method: 'POST',
        token,
        body: { content: newsDraft },
      });
      setNewsDraft('');
      await loadAdmin(token);
    });
  }

  async function p2pAction(action: 'approve' | 'reject', id: string) {
    if (!token) return;
    await run(`${action} P2P`, async () => {
      await apiRequest(`/api/admin/p2p/${action}/${id}`, { method: 'POST', token });
      await loadAdmin(token);
    });
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
    window.location.href = '/login';
  }

  if (!token) {
    return <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground"><Card className="w-full max-w-md"><CardHeader><CardTitle className="font-mono">Admin Login Required</CardTitle><CardDescription>Sign in before managing the game.</CardDescription></CardHeader><CardContent><Link className="block" href="/login"><Button className="w-full">Go to shared login</Button></Link></CardContent></Card></main>;
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-[#0b0d0c] px-4 py-4 md:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><Link href="/" className="font-mono text-2xl font-black tracking-tight text-primary">MARKET_MAYHEM</Link><p className="text-sm text-muted-foreground">Admin control room</p></div><div className="flex flex-wrap items-center gap-3">{state ? <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs"><Clock3 className="size-4 text-primary" /><span>Round {state.round}</span><Separator orientation="vertical" className="h-4" /><span>{phaseLabel(state)}</span><Separator orientation="vertical" className="h-4" /><span>{formatTime(state.time_remaining)}</span></div> : null}<Button variant="outline" size="sm" onClick={() => token && void loadAdmin(token)}><RefreshCw />Refresh</Button><Button variant="ghost" size="sm" onClick={logout}><LogOut />Logout</Button></div></div></header>

      <main className="mx-auto grid max-w-7xl gap-5 p-4 md:p-8 xl:grid-cols-[minmax(0,1.3fr)_360px]"><section className="space-y-5">{message ? <div className="notice font-mono text-sm">{message}</div> : null}<div className="grid gap-4 md:grid-cols-3"><SummaryCard title="Current phase" value={state ? phaseLabel(state) : 'Loading'} subtitle="Backend-authoritative phase machine" /><SummaryCard title="Published event" value={news?.news ? `Round ${news.news.round}` : 'None'} subtitle={news?.news ? 'Latest broadcast to teams' : 'No current event released'} /><SummaryCard title="Open offers" value={String(p2p.length)} subtitle="Direct team offers currently awaiting a team response" /></div>

      <Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><Flag className="size-5 text-primary" />Event and round operations</CardTitle><CardDescription>The current backend exposes phase advancement, pause, resume, and schedule upload. This panel keeps those controls beside the published news.</CardDescription></CardHeader><CardContent className="grid gap-5 xl:grid-cols-[1fr_0.95fr]"><div className="space-y-4 rounded-xl border border-border/70 bg-background/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Current release</p><h3 className="text-lg font-semibold text-white">{news?.news ? `Round ${news.news.round}` : 'No active news item'}</h3></div>{state ? <Badge variant="outline">{phaseLabel(state)}</Badge> : null}</div><p className="text-sm leading-7 text-muted-foreground">{news?.news?.content ?? 'No news content is attached to the current round yet.'}</p>{news?.news ? <p className="text-xs text-muted-foreground">Published {new Date(news.news.created_at).toLocaleString()}</p> : null}</div><div className="space-y-4"><div className="grid gap-2"><Button onClick={() => void post('/api/admin/round/advance', 'Advance')}><SkipForward />Advance phase</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => void post('/api/admin/round/pause', 'Pause')}><Pause />Pause</Button><Button variant="outline" onClick={() => void post('/api/admin/round/resume', 'Resume')}><Play />Resume</Button></div></div><form className="space-y-3" onSubmit={publishNewsItem}><label className="block text-sm font-medium">Push news<textarea value={newsDraft} onChange={(event) => setNewsDraft(event.target.value)} className="mt-2 min-h-32 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" placeholder="Write the round news to release to all teams" required /></label><Button type="submit" className="w-full"><Flag />Push news</Button></form><form className="space-y-3" onSubmit={uploadSchedule}><label className="block text-sm font-medium">Schedule JSON<textarea value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} className="mt-2 min-h-52 w-full rounded-md border bg-background p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" placeholder="Paste schedule JSON" required /></label><Button type="submit" className="w-full"><Upload />Upload schedule</Button></form></div></CardContent></Card>

      <Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><Users className="size-5 text-primary" />Individual team portfolios</CardTitle><CardDescription>Open any team to inspect cash, holdings, and total valuation.</CardDescription></CardHeader><CardContent>{loading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading teams...</div> : <Table><TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHead>Team</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">Assets</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">View</TableHead></TableRow></TableHeader><TableBody>{sortedTeams.map((team) => { const assetValue = team.portfolio.total_value - team.portfolio.cash; return <TableRow key={team.id}><TableCell><p className="font-medium text-white">{team.team_name}</p><p className="font-mono text-xs text-muted-foreground">{team.team_code}</p></TableCell><TableCell className="text-right font-mono">{money(team.portfolio.cash)}</TableCell><TableCell className="text-right font-mono">{money(assetValue)}</TableCell><TableCell className="text-right font-mono text-primary">{money(team.portfolio.total_value)}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelectedTeam(team)}>View</Button></TableCell></TableRow>; })}</TableBody></Table>}</CardContent></Card>

      <Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="text-white">Conducted trade log</CardTitle><CardDescription>Round-by-round execution events drawn from the audit trail.</CardDescription></CardHeader><CardContent className="space-y-3">{conductedTrades.slice(0, 12).map((row) => <div key={row.id} className="rounded-xl border border-border/70 bg-background/45 p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{row.event_type}</Badge>{row.round ? <Badge variant="outline">Round {row.round}</Badge> : null}</div><p className="mt-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p></div>)}{conductedTrades.length === 0 ? <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No conducted trades recorded yet.</div> : null}</CardContent></Card></section>

      <aside className="space-y-5"><Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="text-white">Live leaderboard</CardTitle><CardDescription>Continuously refreshed admin standings.</CardDescription></CardHeader><CardContent className="space-y-2">{sortedTeams.slice(0, 10).map((team, index) => <div key={team.id} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3"><div><p className="font-medium text-white">{team.team_name}</p><p className="font-mono text-xs text-muted-foreground">#{index + 1}</p></div><p className="font-mono text-sm">{money(team.portfolio.total_value)}</p></div>)}</CardContent></Card><Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="text-white">P2P moderation</CardTitle><CardDescription>Admins can reject invalid offers, while the designated counterparty accepts from the team trade page.</CardDescription></CardHeader><CardContent className="space-y-3">{p2p.length === 0 ? <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No pending P2P trades.</div> : p2p.map((trade) => <div key={trade.id} className="rounded-xl border border-border/70 bg-background/45 p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{trade.fund_code}</p><Badge variant="outline">{trade.proposer_direction.toUpperCase()}</Badge><Badge variant="outline">{trade.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{trade.proposer_team_name} to {trade.counterparty_team_name}</p><p className="mt-1 font-mono text-sm">{units(trade.quantity)} units at {money(trade.agreed_price)}</p><div className="mt-4 flex gap-2"><Button size="sm" variant="destructive" onClick={() => void p2pAction('reject', trade.id)}>Reject</Button></div></div>)}</CardContent></Card><Card className="border-border/70 bg-card/95"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><FolderClock className="size-5 text-primary" />Recent activity</CardTitle><CardDescription>Latest backend audit events.</CardDescription></CardHeader><CardContent className="space-y-2">{audit.slice(0, 8).map((row) => <div key={row.id} className="rounded-lg border border-border/70 px-3 py-3"><div className="flex items-center justify-between gap-3"><p className="font-mono text-sm">{row.event_type}</p>{row.round ? <Badge variant="outline">R{row.round}</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p></div>)}</CardContent></Card></aside></main>

      <Dialog open={Boolean(selectedTeam)} onOpenChange={(open) => !open && setSelectedTeam(null)}>{selectedTeam ? <DialogContent><DialogHeader><DialogTitle>{selectedTeam.team_name}</DialogTitle><DialogDescription>{selectedTeam.team_code}</DialogDescription></DialogHeader><div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2"><DetailCard label="Cash" value={money(selectedTeam.portfolio.cash)} /><DetailCard label="Total value" value={money(selectedTeam.portfolio.total_value)} /></div><div className="space-y-2">{selectedTeam.portfolio.holdings.map((holding) => <div key={holding.fund_id} className="rounded-lg border border-border/70 bg-background/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-white">{holding.fund_code}</p><p className="text-xs text-muted-foreground">{holding.fund_name}</p></div><Badge variant="outline">{units(holding.quantity)}</Badge></div><p className="mt-2 font-mono text-sm">{money(holding.market_value)}</p></div>)}{selectedTeam.portfolio.holdings.length === 0 ? <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">This team has no holdings yet.</div> : null}</div></div></DialogContent> : null}</Dialog>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return <Card className="border-border/70 bg-card/95"><CardHeader><CardDescription>{title}</CardDescription><CardTitle className="text-2xl text-white">{value}</CardTitle></CardHeader><CardContent className="pt-0 text-sm text-muted-foreground">{subtitle}</CardContent></Card>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-background/50 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg text-white">{value}</p></div>;
}

function money(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}

function units(value: number | string) {
  const number = Number(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(Number.isFinite(number) ? number : 0);
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function phaseLabel(state: GameState) {
  if (state.is_paused) return 'Paused';
  switch (state.phase) {
    case 'IDLE': return 'Waiting to start';
    case 'SETUP_OPEN': return 'Setup window';
    case 'NEWS_REVEAL': return 'Read window';
    case 'TRADING_OPEN': return 'Trade window';
    case 'ORDER_LOCK': return 'Freeze / compute';
    case 'RESULTS_DISPLAY': return 'Leaderboard update';
    default: return state.phase;
  }
}
