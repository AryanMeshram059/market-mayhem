'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

interface Fund {
  id: number;
  fund_code: string;
  fund_name: string;
}

export function OrderForm() {
  const { gameState } = useGameState();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [fundId, setFundId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTradingOpen = gameState?.phase === 'TRADING_OPEN';

  useEffect(() => {
    apiFetch<Fund[]>('/api/funds').catch(() => {
      setFunds([
        { id: 1, fund_code: 'TECH', fund_name: 'Technology Fund' },
        { id: 2, fund_code: 'PHARMA', fund_name: 'Pharma Fund' },
      ]);
    }).then((data) => {
      if (data) setFunds(data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isTradingOpen) {
      setError('Trading is only available during TRADING_OPEN phase');
      return;
    }

    const qty = parseFloat(quantity);
    if (!fundId || isNaN(qty) || qty <= 0) {
      setError('Please enter a valid fund and positive quantity');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/order/submit', {
        method: 'POST',
        body: JSON.stringify({ fund_id: parseInt(fundId), type, quantity: qty }),
      });
      setSuccess('Order submitted successfully!');
      setQuantity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <h3 className="font-semibold">Place Order</h3>

      <div className="flex gap-2">
        <Button type="button" variant={type === 'buy' ? 'default' : 'outline'} size="sm"
          onClick={() => setType('buy')} disabled={!isTradingOpen}>Buy</Button>
        <Button type="button" variant={type === 'sell' ? 'default' : 'outline'} size="sm"
          onClick={() => setType('sell')} disabled={!isTradingOpen}>Sell</Button>
      </div>

      <select
        value={fundId}
        onChange={(e) => setFundId(e.target.value)}
        disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
      >
        <option value="">Select Fund</option>
        {funds.map((f) => (
          <option key={f.id} value={f.id}>{f.fund_code} — {f.fund_name}</option>
        ))}
      </select>

      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Quantity"
        disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        min="0"
        step="any"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Button type="submit" disabled={!isTradingOpen || submitting} className="w-full">
        {submitting ? 'Submitting...' : `${type === 'buy' ? 'Buy' : 'Sell'} Order`}
      </Button>
    </form>
  );
}
