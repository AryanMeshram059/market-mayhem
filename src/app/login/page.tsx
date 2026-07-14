'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/browserApi';

export default function TeamLoginPage() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('TEAM_001');
  const [password, setPassword] = useState('team_001123');
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
    <main>
      <section className="panel narrow">
        <h1>Team Login</h1>
        <form onSubmit={submit} className="stack">
          <label>
            Team code
            <input value={teamCode} onChange={(e) => setTeamCode(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
