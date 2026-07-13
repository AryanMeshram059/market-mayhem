'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { P2PQueue } from '@/components/admin/P2PQueue';

export default function AdminP2PPage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-xl font-bold mb-4">P2P Approval Queue</h1>
        <P2PQueue />
      </main>
    </AdminAuthGuard>
  );
}
