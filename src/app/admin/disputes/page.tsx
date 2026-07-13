'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { DisputeForm } from '@/components/admin/DisputeForm';

export default function AdminDisputesPage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h1 className="text-xl font-bold mb-4">Dispute Resolution</h1>
        <DisputeForm />
      </main>
    </AdminAuthGuard>
  );
}
