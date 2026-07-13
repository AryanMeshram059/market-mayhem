'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

export function DisputeForm() {
  const [teamId, setTeamId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'cash' | 'fund'>('cash');
  const [fundId, setFundId] = useState('');
  const [amount, setAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const result = await apiFetch<{ success: boolean; new_balance: number }>(
        '/api/admin/dispute/adjust',
        {
          method: 'POST',
          body: JSON.stringify({
            team_id: parseInt(teamId),
            adjustment_type: adjustmentType,
            fund_id: adjustmentType === 'fund' ? parseInt(fundId) : undefined,
            amount: parseFloat(amount),
            justification,
          }),
        },
        true
      );
      setMessage(`Adjustment applied. New balance: ${result.new_balance}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Dispute Resolution</h3>
      <input type="number" placeholder="Team ID" value={teamId} onChange={(e) => setTeamId(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm" required />
      <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as 'cash' | 'fund')}
        className="w-full rounded-md border px-3 py-2 text-sm">
        <option value="cash">Cash Adjustment</option>
        <option value="fund">Fund Holdings Adjustment</option>
      </select>
      {adjustmentType === 'fund' && (
        <input type="number" placeholder="Fund ID" value={fundId} onChange={(e) => setFundId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm" />
      )}
      <input type="number" placeholder="Amount (+ or -)" value={amount} onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm" required />
      <textarea placeholder="Justification (required)" value={justification}
        onChange={(e) => setJustification(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm" rows={3} required />
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit">Apply Adjustment</Button>
    </form>
  );
}
