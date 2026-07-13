'use client';

import { useEffect, useState } from 'react';
import { apiFetch, getTeamInfo } from '@/lib/client';
import { formatCurrency } from '@/lib/format';
import type { LeaderboardEntry } from '@/types';

export function LeaderboardTable() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);

  useEffect(() => {
    const team = getTeamInfo();
    setTeamId(team?.id ?? null);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await apiFetch<LeaderboardEntry[]>('/api/game/leaderboard');
        if (data) setEntries(data);
      } catch { /* ignore */ }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left">Rank</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Portfolio Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.team_id}
              className={entry.team_id === teamId ? 'bg-primary/10 font-medium' : 'border-t'}
            >
              <td className="px-4 py-2">#{entry.rank}</td>
              <td className="px-4 py-2">{entry.team_name}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(entry.portfolio_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
