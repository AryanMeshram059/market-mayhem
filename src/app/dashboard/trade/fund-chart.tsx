'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fund } from '@/domain/types';

type FundChartProps = {
  fund: Fund;
  round: number;
};

// Mock data - in production this would come from an API
const generateMockData = (startNav: number, round: number) => {
  const data = [];
  for (let i = 1; i <= round; i++) {
    const variance = (Math.random() - 0.5) * 0.1;
    const nav = startNav * (1 + variance * (i / round));
    data.push({
      round: i,
      nav: Math.max(nav, startNav * 0.5),
    });
  }
  return data;
};

export function FundChart({ fund, round }: FundChartProps) {
  const data = generateMockData(fund.current_nav * 0.9, round);

  return (
    <div className="h-64 w-full rounded-lg bg-background/50 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="round" stroke="#999" />
          <YAxis stroke="#999" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1d1c', border: '1px solid #333' }}
            formatter={(value) => `₹${Number(value).toFixed(2)}`}
          />
          <Line 
            type="monotone" 
            dataKey="nav" 
            stroke="#8b5cf6" 
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
