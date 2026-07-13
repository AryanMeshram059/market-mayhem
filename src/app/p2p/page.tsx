'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { P2PProposal } from '@/components/p2p/P2PProposal';

export default function P2PPage() {
  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6 max-w-md">
        <P2PProposal />
      </main>
    </AuthGuard>
  );
}
