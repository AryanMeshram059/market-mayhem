'use client';

import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { GameClock } from '@/components/shared/GameClock';

export function RoundControls() {
  const { refresh } = useGameState();

  const adminAction = async (endpoint: string) => {
    try {
      await apiFetch(endpoint, { method: 'POST' }, true);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="space-y-4">
      <GameClock />
      <div className="flex gap-2">
        <Button onClick={() => adminAction('/api/admin/round/advance')}>Advance Phase</Button>
        <Button variant="outline" onClick={() => adminAction('/api/admin/round/pause')}>Pause</Button>
        <Button variant="outline" onClick={() => adminAction('/api/admin/round/resume')}>Resume</Button>
      </div>
    </div>
  );
}
