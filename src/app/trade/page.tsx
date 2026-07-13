'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { OrderForm } from '@/components/trading/OrderForm';
import { PendingOrders } from '@/components/trading/PendingOrders';

export default function TradePage() {
  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          <OrderForm />
          <PendingOrders />
        </div>
      </main>
    </AuthGuard>
  );
}
