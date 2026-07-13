'use client';

import { useGameState } from '@/hooks/useGameState';
import { formatTimeRemaining, phaseDisplayName } from '@/lib/format';

export function GameClock() {
  const { gameState, loading } = useGameState();

  if (loading || !gameState) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Round {gameState.round} / 15</p>
          <p className="text-lg font-semibold">{phaseDisplayName(gameState.phase)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Time Remaining</p>
          <p className="text-2xl font-mono font-bold tabular-nums">
            {gameState.is_paused ? 'PAUSED' : formatTimeRemaining(gameState.time_remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}
