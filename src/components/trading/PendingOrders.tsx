'use client';

import { useEffect, useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

interface PendingOrder {
  order_id: string;
  fund_code: string;
  fund_name: string;
  type: string;
  quantity: number;
}

export function PendingOrders() {
  const { gameState } = useGameState();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const isTradingOpen = gameState?.phase === 'TRADING_OPEN';

  const fetchOrders = async () => {
    try {
      const data = await apiFetch<PendingOrder[]>('/api/order/pending');
      if (data) setOrders(data);
    } catch {
      setOrders([]);
    }
  };

  useEffect(() => { fetchOrders(); }, [gameState?.phase]);

  const handleCancel = async (orderId: string) => {
    try {
      await apiFetch(`/api/order/cancel/${orderId}`, { method: 'DELETE' });
      fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <h3 className="font-semibold">Pending Orders</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending orders</p>
      ) : (
        orders.map((order) => (
          <div key={order.order_id} className="flex items-center justify-between text-sm border-b pb-2">
            <div>
              <span className="font-medium uppercase">{order.type}</span>{' '}
              {order.quantity} × {order.fund_code}
            </div>
            <Button size="sm" variant="outline" disabled={!isTradingOpen}
              onClick={() => handleCancel(order.order_id)}>Cancel</Button>
          </div>
        ))
      )}
    </div>
  );
}
