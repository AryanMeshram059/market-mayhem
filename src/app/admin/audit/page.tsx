'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { AuditViewer } from '@/components/admin/AuditViewer';

export default function AdminAuditPage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-xl font-bold mb-4">Audit Log</h1>
        <AuditViewer />
      </main>
    </AdminAuthGuard>
  );
}
