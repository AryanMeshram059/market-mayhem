import { PHASE_DURATIONS, TOTAL_ROUNDS } from '@/domain/constants';
import type { GamePhase, GameState } from '@/domain/types';
import { audit } from '../audit';
import { query, transaction, type PoolClient } from '../db';
import { badRequest } from '../errors';
import { applyRoundNavs } from './schedule';
import { executePendingOrders } from './orders';
import { expireOpenP2P } from './p2p';

interface GameStateRow {
  current_round: number;
  current_phase: GamePhase;
  phase_start: Date | string;
  phase_duration: number;
  is_paused: boolean;
  remaining_time: number | null;
}

function phaseEndsAt(row: GameStateRow): Date | null {
  if (row.current_phase === 'IDLE') return null;
  return new Date(new Date(row.phase_start).getTime() + row.phase_duration * 1000);
}

function serializeState(row: GameStateRow): GameState {
  const endsAt = phaseEndsAt(row);
  const remaining = row.is_paused
    ? row.remaining_time ?? 0
    : endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000))
      : 0;

  return {
    round: Number(row.current_round),
    phase: row.current_phase,
    phase_start: new Date(row.phase_start).toISOString(),
    phase_duration: Number(row.phase_duration),
    phase_ends_at: endsAt?.toISOString() ?? null,
    time_remaining: remaining,
    is_paused: Boolean(row.is_paused),
  };
}

function nextPhase(row: GameStateRow): { phase: GamePhase; round: number; duration: number } | null {
  switch (row.current_phase) {
    case 'IDLE':
      return { phase: 'SETUP_OPEN', round: 1, duration: PHASE_DURATIONS.SETUP_OPEN };
    case 'SETUP_OPEN':
      return { phase: 'NEWS_REVEAL', round: 1, duration: PHASE_DURATIONS.NEWS_REVEAL };
    case 'NEWS_REVEAL':
      return { phase: 'TRADING_OPEN', round: row.current_round, duration: PHASE_DURATIONS.TRADING_OPEN };
    case 'TRADING_OPEN':
      return { phase: 'ORDER_LOCK', round: row.current_round, duration: PHASE_DURATIONS.ORDER_LOCK };
    case 'ORDER_LOCK':
      return { phase: 'RESULTS_DISPLAY', round: row.current_round, duration: PHASE_DURATIONS.RESULTS_DISPLAY };
    case 'RESULTS_DISPLAY':
      if (row.current_round >= TOTAL_ROUNDS) return null;
      return { phase: 'NEWS_REVEAL', round: row.current_round + 1, duration: PHASE_DURATIONS.NEWS_REVEAL };
  }
}

async function transitionSideEffects(client: PoolClient, from: GamePhase, round: number): Promise<void> {
  if (from === 'TRADING_OPEN') {
    await executePendingOrders(client, round);
    await expireOpenP2P(client, round);
    await client.query(
      `UPDATE portfolios
       SET cash = cash * $1,
           last_updated = NOW()`,
      [0.96],
    );
    await applyRoundNavs(client, round);
    await audit({ event_type: 'cash_eroded', round, event_data: { round, rate: 0.04 } });
    await audit({ event_type: 'round_computed', round, event_data: { round } });
  }
}

export async function getState(): Promise<GameState> {
  const rows = await query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1`);
  if (!rows[0]) {
    throw new Error('game_state row id=1 is missing');
  }
  return serializeState(rows[0]);
}

export async function checkAndTransition(): Promise<GameState> {
  return transaction(async (client) => {
    const result = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const row = result.rows[0];
    if (!row) {
      throw new Error('game_state row id=1 is missing');
    }
    if (row.is_paused) {
      return serializeState(row);
    }

    const endsAt = phaseEndsAt(row);
    if (endsAt && Date.now() < endsAt.getTime()) {
      return serializeState(row);
    }

    const next = nextPhase(row);
    if (!next) {
      return serializeState(row);
    }

    await transitionSideEffects(client, row.current_phase, row.current_round);
    await client.query(
      `UPDATE game_state
       SET current_round = $1,
           current_phase = $2,
           phase_start = NOW(),
           phase_duration = $3,
           is_paused = FALSE,
           paused_at = NULL,
           remaining_time = NULL
       WHERE id = 1`,
      [next.round, next.phase, next.duration],
    );
    await audit({
      event_type: 'phase_transition',
      round: next.round,
      event_data: {
        from_phase: row.current_phase,
        from_round: row.current_round,
        to_phase: next.phase,
        to_round: next.round,
      },
    });

    const updated = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1`);
    return serializeState(updated.rows[0]);
  });
}

export async function forceAdvance(adminUsername: string): Promise<GameState> {
  return transaction(async (client) => {
    const result = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const row = result.rows[0];
    const next = nextPhase(row);
    if (!next) {
      return serializeState(row);
    }
    await transitionSideEffects(client, row.current_phase, row.current_round);
    await client.query(
      `UPDATE game_state
       SET current_round = $1,
           current_phase = $2,
           phase_start = NOW(),
           phase_duration = $3,
           is_paused = FALSE,
           paused_at = NULL,
           remaining_time = NULL
       WHERE id = 1`,
      [next.round, next.phase, next.duration],
    );
    await audit({
      event_type: 'admin_action',
      admin_username: adminUsername,
      round: next.round,
      event_data: { action: 'force_advance', to_phase: next.phase },
    });
    const updated = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1`);
    return serializeState(updated.rows[0]);
  });
}

export async function pause(adminUsername: string): Promise<GameState> {
  return transaction(async (client) => {
    const result = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const row = result.rows[0];
    if (row.is_paused) return serializeState(row);
    const remaining = serializeState(row).time_remaining;
    await client.query(`UPDATE game_state SET is_paused = TRUE, paused_at = NOW(), remaining_time = $1 WHERE id = 1`, [remaining]);
    await audit({ event_type: 'admin_action', admin_username: adminUsername, round: row.current_round, event_data: { action: 'pause' } });
    const updated = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1`);
    return serializeState(updated.rows[0]);
  });
}

export async function resume(adminUsername: string): Promise<GameState> {
  return transaction(async (client) => {
    const result = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1 FOR UPDATE`);
    const row = result.rows[0];
    if (!row.is_paused) return serializeState(row);
    const remaining = row.remaining_time ?? row.phase_duration;
    const startedAt = new Date(Date.now() - (row.phase_duration - remaining) * 1000);
    await client.query(
      `UPDATE game_state
       SET is_paused = FALSE,
           paused_at = NULL,
           remaining_time = NULL,
           phase_start = $1
       WHERE id = 1`,
      [startedAt.toISOString()],
    );
    await audit({ event_type: 'admin_action', admin_username: adminUsername, round: row.current_round, event_data: { action: 'resume' } });
    const updated = await client.query<GameStateRow>(`SELECT * FROM game_state WHERE id = 1`);
    return serializeState(updated.rows[0]);
  });
}

export async function assertTradingOpen(): Promise<{ round: number }> {
  const state = await checkAndTransition();
  if (state.phase !== 'TRADING_OPEN') {
    badRequest(`Trading is closed during ${state.phase}`);
  }
  return { round: state.round };
}
