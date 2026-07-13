'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('mm_admin_token')) {
      router.replace('/admin/login');
    }
  }, [router]);

  return <>{children}</>;
}
