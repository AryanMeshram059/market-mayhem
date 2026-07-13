'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminToken } from '@/lib/client';
import { Button } from '@/components/ui/button';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? 'Login failed');
        return;
      }
      setAdminToken(data.token);
      router.push('/admin/dashboard');
    } catch {
      setError('Connection failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-bold text-center">Admin Login</h1>
        <input type="text" placeholder="Username" value={username}
          onChange={(e) => setUsername(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" required />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">Sign In</Button>
        <p className="text-xs text-center text-muted-foreground">Default: admin / admin123</p>
      </form>
    </div>
  );
}
