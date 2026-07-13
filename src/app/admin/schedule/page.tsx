'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { ScheduleUploader } from '@/components/admin/ScheduleUploader';

export default function AdminSchedulePage() {
  return (
    <AdminAuthGuard>
      <AdminNav />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h1 className="text-xl font-bold mb-4">NAV Schedule</h1>
        <ScheduleUploader />
      </main>
    </AdminAuthGuard>
  );
}
