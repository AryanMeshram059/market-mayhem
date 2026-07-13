'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';

interface TeamSummary {
  team_id: number;
  team_name: string;
  portfolio_value: number;
  rank: number;
  pending_orders: number;
  error_state: boolean;
}

export function TeamGrid() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await apiFetch<TeamSummary[]>('/api/admin/teams', {}, true);
        if (data) setTeams(data);
      } catch { /* ignore */ }
    };
    fetchTeams();
    const interval = setInterval(fetchTeams, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {teams.map((team) => (
        <div
          key={team.team_id}
          className={`rounded-lg border p-3 text-xs ${team.error_state ? 'border-red-500 bg-red-50' : 'bg-card'}`}
        >
          <p className="font-semibold truncate">{team.team_name}</p>
          <p>#{team.rank} · {formatCurrency(team.portfolio_value)}</p>
          <p className="text-muted-foreground">{team.pending_orders} pending</p>
        </div>
      ))}
    </div>
  );
}
