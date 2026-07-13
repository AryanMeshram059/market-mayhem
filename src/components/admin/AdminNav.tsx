'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAdminToken } from '@/lib/client';

const adminNav = [
  { href: '/admin/dashboard', label: 'Teams' },
  { href: '/admin/control', label: 'Control' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/p2p', label: 'P2P' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/audit', label: 'Audit' },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="font-bold text-lg">Admin Console</Link>
          <div className="flex gap-4">
            {adminNav.map((item) => (
              <Link key={item.href} href={item.href}
                className={`text-sm ${pathname === item.href ? 'font-semibold' : 'text-muted-foreground'}`}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <button onClick={() => { clearAdminToken(); router.push('/admin/login'); }}
          className="text-sm text-muted-foreground">Logout</button>
      </div>
    </nav>
  );
}
