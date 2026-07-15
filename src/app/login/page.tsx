'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/browserApi';

export default function TeamLoginPage() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{
        token: string;
        team_id: number;
        team_name: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: { team_code: teamCode, password },
      });
      localStorage.setItem('team_token', data.token);
      localStorage.setItem('team_name', data.team_name);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-mono">Team Login</CardTitle>
          <CardDescription>Use the team code and password assigned for the game.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Team code</span>
              <Input value={teamCode} onChange={(event) => setTeamCode(event.target.value)} autoComplete="username" required />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="error text-sm">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            <Link className="block text-center text-sm text-muted-foreground hover:text-foreground" href="/">
              Back to role selection
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
