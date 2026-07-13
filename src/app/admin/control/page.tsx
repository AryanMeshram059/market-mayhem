'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { RoundControls } from '@/components/admin/RoundControls';

export default function AdminControlPage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h1 className="text-xl font-bold mb-4">Round Controls</h1>
        <RoundControls />
      </main>
    </AdminAuthGuard>
  );
}
