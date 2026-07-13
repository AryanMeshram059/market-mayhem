'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

interface P2PTrade {
  trade_id: string;
  proposer_team: string;
  counterparty_team: string;
  fund_code: string;
  quantity: number;
  price: number;
}

export function P2PQueue() {
  const [trades, setTrades] = useState<P2PTrade[]>([]);

  const fetchTrades = async () => {
    try {
      const data = await apiFetch<P2PTrade[]>('/api/admin/p2p/pending', {}, true);
      if (data) setTrades(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchTrades(); }, []);

  const handleAction = async (tradeId: string, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/api/admin/p2p/${action}/${tradeId}`, { method: 'POST' }, true);
      fetchTrades();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Pending P2P Trades</h3>
      {trades.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending trades</p>
      ) : (
        trades.map((trade) => (
          <div key={trade.trade_id} className="flex items-center justify-between text-sm border-b pb-2">
            <div>
              {trade.proposer_team} → {trade.counterparty_team}: {trade.quantity} × {trade.fund_code} @ ₹{trade.price}
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => handleAction(trade.trade_id, 'approve')}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => handleAction(trade.trade_id, 'reject')}>Reject</Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
