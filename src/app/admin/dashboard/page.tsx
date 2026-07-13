'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { TeamGrid } from '@/components/admin/TeamGrid';

export default function AdminDashboardPage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">Live Team Monitor</h1>
        <TeamGrid />
      </main>
    </AdminAuthGuard>
  );
}
