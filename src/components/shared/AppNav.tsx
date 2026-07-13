'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getTeamInfo } from '@/lib/client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trade', label: 'Trade' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/p2p', label: 'P2P' },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setTeam(getTeamInfo());
  }, []);

  const handleLogout = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('mm_token') : null;
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { /* ignore */ }
    clearToken();
    router.push('/login');
  };

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-lg">Market Mayhem</Link>
          <div className="hidden md:flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm ${pathname === item.href ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {team && <span className="text-sm text-muted-foreground">{team.name}</span>}
          <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
