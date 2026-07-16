'use client';

import Link from 'next/link';
import { FormEvent, startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/browserApi';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
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
    <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Shield className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-white">Admin Login</CardTitle>
              <CardDescription>Dedicated fallback access for the control room.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Username</span>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
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
              {loading ? 'Logging in...' : 'Enter admin dashboard'}
            </Button>
            <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" href="/login">
              <ArrowLeft className="size-4" />
              Back to shared login
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
