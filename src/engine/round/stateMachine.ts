import { PHASE_DURATIONS, TOTAL_ROUNDS } from '@/constants/game';
import { executeAllPendingOrders } from '@/engine/trading/orderExecutor';
import { executeApprovedP2PTrades } from '@/engine/trading/p2pExecutor';
import { updateNAVsForRound } from '@/engine/pricing/scheduleManager';
import { calculateFinalScore } from '@/engine/scoring/finalScore';
import { auditLog } from '@/services/auditLog';
import { withTransaction, queryAsGameEngine, type PoolClient } from '@/lib/db';
import type { GameState, Phase } from '@/types';

interface DbGameState {
  current_round: number;
  current_phase: Phase;
  phase_start: Date;
  phase_duration: number;
  is_paused: boolean;
  paused_at: Date | null;
  remaining_time: number | null;
}

function toGameState(row: DbGameState): GameState {
  const phaseStart = new Date(row.phase_start).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - phaseStart) / 1000);
  const timeRemaining = row.is_paused
    ? (row.remaining_time ?? 0)
    : Math.max(0, row.phase_duration - elapsed);

  return {
    round: row.current_round,
    phase: row.current_phase,
    phase_start: phaseStart,
    phase_duration: row.phase_duration,
    time_remaining: timeRemaining,
    is_paused: row.is_paused,
  };
}

function getNextPhase(
  currentPhase: Phase,
  currentRound: number
): { phase: Phase; round: number; duration: number } | null {
  switch (currentPhase) {
    case 'NEWS_REVEAL':
      return { phase: 'TRADING_OPEN', round: currentRound, duration: PHASE_DURATIONS.TRADING_OPEN };
    case 'TRADING_OPEN':
      return { phase: 'ORDER_LOCK', round: currentRound, duration: PHASE_DURATIONS.ORDER_LOCK };
    case 'ORDER_LOCK':
      return { phase: 'RESULTS_DISPLAY', round: currentRound, duration: PHASE_DURATIONS.RESULTS_DISPLAY };
    case 'RESULTS_DISPLAY':
      if (currentRound >= TOTAL_ROUNDS) {
        return null;
      }
      return {
        phase: 'NEWS_REVEAL',
        round: currentRound + 1,
        duration: PHASE_DURATIONS.NEWS_REVEAL,
      };
    default:
      return null;
  }
}

async function runPhaseTransitionActions(
  fromPhase: Phase,
  toPhase: Phase,
  round: number
): Promise<void> {
  if (toPhase === 'ORDER_LOCK') {
    await executeAllPendingOrders(round);
    await executeApprovedP2PTrades();
  }

  if (fromPhase === 'RESULTS_DISPLAY' && toPhase === 'NEWS_REVEAL') {
    await updateNAVsForRound(round);
  }

  if (fromPhase === 'RESULTS_DISPLAY' && round >= TOTAL_ROUNDS) {
    const teams = await queryAsGameEngine(`SELECT id FROM teams`);
    for (const team of teams) {
      const finalScore = await calculateFinalScore(team.id);
      await auditLog('final_scores', {
        teamId: team.id,
        round: TOTAL_ROUNDS,
        details: {
          final_portfolio_value: finalScore.total_value,
          eroded_cash: finalScore.cash,
        },
      });
    }
  }
}

export async function getGameState(): Promise<GameState> {
  const rows = await queryAsGameEngine(`SELECT * FROM game_state WHERE id = 1`);
  if (rows.length === 0) {
    throw new Error('Game state not initialized');
  }
  return toGameState(rows[0] as DbGameState);
}

export async function checkAndTransition(): Promise<GameState> {
  return withTransaction(async (client: PoolClient) => {
    const result = await client.query(
      `SELECT * FROM game_state WHERE id = 1 FOR UPDATE`
    );
    const state = result.rows[0] as DbGameState;

    if (state.is_paused) {
      return toGameState(state);
    }

    const now = Date.now();
    const phaseStart = new Date(state.phase_start).getTime();
    const expiresAt = phaseStart + state.phase_duration * 1000;

    if (now < expiresAt) {
      return toGameState(state);
    }

    const next = getNextPhase(state.current_phase, state.current_round);
    if (!next) {
      return toGameState(state);
    }

    await runPhaseTransitionActions(state.current_phase, next.phase, next.round);

    const newPhaseStart = new Date();
    await client.query(
      `UPDATE game_state SET
         current_round = $1,
         current_phase = $2,
         phase_start = $3,
         phase_duration = $4,
         is_paused = FALSE,
         paused_at = NULL,
         remaining_time = NULL
       WHERE id = 1`,
      [next.round, next.phase, newPhaseStart.toISOString(), next.duration]
    );

    await auditLog('phase_transition', {
      round: next.round,
      details: {
        from_phase: state.current_phase,
        from_round: state.current_round,
        to_phase: next.phase,
        to_round: next.round,
      },
    });

    const updated = await client.query(`SELECT * FROM game_state WHERE id = 1`);
    return toGameState(updated.rows[0] as DbGameState);
  });
}

export async function forceAdvancePhase(adminUsername: string): Promise<GameState> {
  return withTransaction(async (client: PoolClient) => {
    const result = await client.query(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const state = result.rows[0] as DbGameState;

    const next = getNextPhase(state.current_phase, state.current_round);
    if (!next) {
      return toGameState(state);
    }

    await runPhaseTransitionActions(state.current_phase, next.phase, next.round);

    await client.query(
      `UPDATE game_state SET
         current_round = $1,
         current_phase = $2,
         phase_start = NOW(),
         phase_duration = $3,
         is_paused = FALSE,
         paused_at = NULL,
         remaining_time = NULL
       WHERE id = 1`,
      [next.round, next.phase, next.duration]
    );

    await auditLog('admin_action', {
      adminUsername,
      round: next.round,
      details: { action: 'force_advance', to_phase: next.phase },
    });

    const updated = await client.query(`SELECT * FROM game_state WHERE id = 1`);
    return toGameState(updated.rows[0] as DbGameState);
  });
}

export async function pauseGame(adminUsername: string): Promise<GameState> {
  return withTransaction(async (client: PoolClient) => {
    const result = await client.query(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const state = result.rows[0] as DbGameState;

    if (state.is_paused) {
      return toGameState(state);
    }

    const phaseStart = new Date(state.phase_start).getTime();
    const elapsed = Math.floor((Date.now() - phaseStart) / 1000);
    const remaining = Math.max(0, state.phase_duration - elapsed);

    await client.query(
      `UPDATE game_state SET is_paused = TRUE, paused_at = NOW(), remaining_time = $1 WHERE id = 1`,
      [remaining]
    );

    await auditLog('admin_action', {
      adminUsername,
      round: state.current_round,
      details: { action: 'pause', remaining_time: remaining },
    });

    const updated = await client.query(`SELECT * FROM game_state WHERE id = 1`);
    return toGameState(updated.rows[0] as DbGameState);
  });
}

export async function resumeGame(adminUsername: string): Promise<GameState> {
  return withTransaction(async (client: PoolClient) => {
    const result = await client.query(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const state = result.rows[0] as DbGameState;

    if (!state.is_paused) {
      return toGameState(state);
    }

    const remaining = state.remaining_time ?? state.phase_duration;
    const newStart = new Date(Date.now() - (state.phase_duration - remaining) * 1000);

    await client.query(
      `UPDATE game_state SET
         is_paused = FALSE,
         paused_at = NULL,
         remaining_time = NULL,
         phase_start = $1
       WHERE id = 1`,
      [newStart.toISOString()]
    );

    await auditLog('admin_action', {
      adminUsername,
      round: state.current_round,
      details: { action: 'resume', remaining_time: remaining },
    });

    const updated = await client.query(`SELECT * FROM game_state WHERE id = 1`);
    return toGameState(updated.rows[0] as DbGameState);
  });
}
