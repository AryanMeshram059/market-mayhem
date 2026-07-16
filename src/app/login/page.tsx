'use client';

import Link from 'next/link';
import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Shield, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/browserApi';
import { cn } from '@/lib/utils';

type LoginMode = 'team' | 'admin';

export default function SharedLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('team');
  const [teamIdentity, setTeamIdentity] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'team') {
        const data = await apiRequest<{
          token: string;
          team_id: number;
          team_code: string;
          team_name: string;
        }>('/api/auth/login', {
          method: 'POST',
          body: { team_identity: teamIdentity, password },
        });
        localStorage.setItem('team_token', data.token);
        localStorage.setItem('team_name', data.team_name);
        localStorage.setItem('team_id', String(data.team_id));
        startTransition(() => {
          router.push('/dashboard');
        });
        return;
      }

      const data = await apiRequest<{ token: string }>('/api/admin/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      localStorage.setItem('admin_token', data.token);
      startTransition(() => {
        router.push('/admin');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-10 md:px-10 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center">
          <div className="max-w-2xl space-y-5">
            <Badge variant="outline" className="w-fit border-primary/35 bg-primary/10 px-3 py-1 font-mono tracking-[0.22em] text-primary">
              SHARED ACCESS
            </Badge>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
              Enter with your team or admin credentials.
            </h1>
            <p className="text-base leading-7 text-muted-foreground md:text-lg">
              Teams can now log in with either the saved team name or the generated team code. Admin access remains available from the same screen.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<TrendingUp className="size-5 text-primary" />}
              title="Team access"
              description="Use the registered team name or team code with the same stored password."
            />
            <FeatureCard
              icon={<Shield className="size-5 text-primary" />}
              title="Admin access"
              description="Use the existing admin credentials to manage rounds, approvals, and leaderboard operations."
            />
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card className="w-full max-w-xl border-border/70 bg-card/95 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <CardHeader className="gap-5">
              <div className="flex items-center gap-2">
                <div className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <LockKeyhole className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-white">Login</CardTitle>
                  <CardDescription>Choose who you are signing in as.</CardDescription>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-background/60 p-1">
                <ModeButton active={mode === 'team'} icon={<TrendingUp className="size-4" />} label="Team" onClick={() => setMode('team')} />
                <ModeButton active={mode === 'admin'} icon={<Shield className="size-4" />} label="Admin" onClick={() => setMode('admin')} />
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                {mode === 'team' ? (
                  <>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Team name or team code</span>
                      <Input
                        value={teamIdentity}
                        onChange={(event) => setTeamIdentity(event.target.value)}
                        autoComplete="username"
                        placeholder="Entry Pass Team or REG_ENTRY_PASS_T"
                        required
                      />
                    </label>
                    <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      The backend now accepts both the stored <span className="font-mono text-foreground">team_name</span> and the generated <span className="font-mono text-foreground">team_code</span>.
                    </p>
                  </>
                ) : (
                  <label className="block space-y-1.5 text-sm font-medium">
                    <span>Admin username</span>
                    <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="admin" required />
                  </label>
                )}

                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Password</span>
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                </label>

                {error ? <p className="error text-sm">{error}</p> : null}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in...' : mode === 'team' ? 'Enter team dashboard' : 'Enter admin dashboard'}
                </Button>

                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-foreground">Back to home</Link>
                  <Link href="/register" className="hover:text-foreground">Go to registration</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
