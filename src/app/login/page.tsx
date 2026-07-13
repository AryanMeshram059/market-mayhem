'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/client';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_code: teamCode, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? 'Login failed');
        return;
      }

      setToken(data.token, { id: data.team_id, name: data.team_name });
      router.push('/dashboard');
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Market Mayhem</h1>
          <p className="text-sm text-muted-foreground mt-1">Team Login</p>
        </div>

        <input
          type="text"
          placeholder="Team Code (e.g. TEAM_001)"
          value={teamCode}
          onChange={(e) => setTeamCode(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Default: TEAM_001 / team_001123
        </p>
      </form>
    </div>
  );
}
