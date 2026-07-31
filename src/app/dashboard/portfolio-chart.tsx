'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiRequest } from '@/lib/browserApi';

type PortfolioPoint = {
  round: number;
  value: number;
};

export function PortfolioChart({ token }: { token: string | null }) {
  const [data, setData] = useState<PortfolioPoint[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const history = await apiRequest<PortfolioPoint[]>('/api/portfolio/history', { token });
        if (!cancelled) {
          setData(history);
        }
      } catch {
        if (!cancelled) {
          setData([]);
        }
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="h-64 w-full rounded-lg bg-background/50 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="round" stroke="#999" allowDecimals={false} />
          <YAxis stroke="#999" domain={['dataMin - 10000000', 'dataMax + 10000000']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1d1c', border: '1px solid #333' }}
            formatter={(value) =>
              new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
              }).format(Number(value))
            }
            labelFormatter={(label) => `Round ${label}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={2}
            dot
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
