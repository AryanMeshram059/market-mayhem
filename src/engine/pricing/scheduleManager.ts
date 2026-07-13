import crypto from 'crypto';
import {
  INVESTABLE_FUNDS,
  MAX_NAV_CHANGE,
  TOTAL_ROUNDS,
} from '@/constants/game';
import { auditLog } from '@/services/auditLog';
import { queryAsGameEngine, withTransaction, type PoolClient } from '@/lib/db';
import type { Schedule, ScheduleFund, ValidationResult } from '@/types';

function getScheduleKey(): Buffer {
  const keyHex = process.env.SCHEDULE_KEY;
  if (!keyHex) {
    throw new Error('SCHEDULE_KEY environment variable is required');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptSchedule(schedule: Schedule): string {
  const json = JSON.stringify(schedule);
  const key = getScheduleKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptSchedule(encrypted: string): Schedule {
  const [ivHex, encryptedData] = encrypted.split(':');
  const key = getScheduleKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted) as Schedule;
}

export function validateSchedule(csv: string): ValidationResult {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { valid: false, error: 'CSV must contain a header row and data rows' };
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const roundColumns = header.slice(1);

  if (roundColumns.length !== TOTAL_ROUNDS) {
    return {
      valid: false,
      error: `Expected ${TOTAL_ROUNDS} round columns, got ${roundColumns.length}`,
    };
  }

  const dataRows = lines.slice(1);
  if (dataRows.length !== INVESTABLE_FUNDS) {
    return {
      valid: false,
      error: `Expected ${INVESTABLE_FUNDS} fund rows, got ${dataRows.length}`,
    };
  }

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const cols = dataRows[rowIdx].split(',').map((c) => c.trim());
    const fundCode = cols[0];

    if (cols.length !== TOTAL_ROUNDS + 1) {
      return {
        valid: false,
        error: `Fund ${fundCode}: expected ${TOTAL_ROUNDS} NAV values, got ${cols.length - 1}`,
        details: { row: rowIdx + 2, fund: fundCode },
      };
    }

    const initialNav = parseFloat(cols[1]);
    if (isNaN(initialNav) || initialNav <= 0) {
      return {
        valid: false,
        error: `Fund ${fundCode}, Round 1: NAV must be positive, got ${cols[1]}`,
        details: { row: rowIdx + 2, column: 2, fund: fundCode },
      };
    }

    for (let roundIdx = 1; roundIdx < cols.length; roundIdx++) {
      const nav = parseFloat(cols[roundIdx]);
      if (isNaN(nav) || nav <= 0) {
        return {
          valid: false,
          error: `Fund ${fundCode}, Round ${roundIdx}: NAV must be positive, got ${cols[roundIdx]}`,
          details: { row: rowIdx + 2, column: roundIdx + 1, fund: fundCode },
        };
      }

      const cumulativeChange = (nav - initialNav) / initialNav;
      if (Math.abs(cumulativeChange) > MAX_NAV_CHANGE) {
        return {
          valid: false,
          error: `Fund ${fundCode}, Round ${roundIdx}: cumulative change ${(cumulativeChange * 100).toFixed(1)}% exceeds ±60% limit`,
          details: { row: rowIdx + 2, column: roundIdx + 1, fund: fundCode },
        };
      }
    }
  }

  return { valid: true };
}

export function parseScheduleCsv(csv: string): Schedule {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
  const dataRows = lines.slice(1);

  const funds: ScheduleFund[] = dataRows.map((row) => {
    const cols = row.split(',').map((c) => c.trim());
    const fundCode = cols[0];
    const navValues = cols.slice(1).map((v) => parseFloat(v));
    return { id: 0, fund_code: fundCode, navValues };
  });

  return { funds };
}

export async function storeSchedule(
  schedule: Schedule,
  uploadedBy: string
): Promise<string> {
  const funds = await queryAsGameEngine(
    `SELECT id, fund_code FROM funds WHERE is_cash = FALSE ORDER BY id`
  );

  const fundCodeToId = new Map(funds.map((f) => [f.fund_code, f.id]));
  const enrichedSchedule: Schedule = {
    funds: schedule.funds.map((f) => ({
      ...f,
      id: fundCodeToId.get(f.fund_code) ?? 0,
    })),
  };

  const encrypted = encryptSchedule(enrichedSchedule);
  const result = await queryAsGameEngine(
    `INSERT INTO schedules (encrypted_data, locked, uploaded_by)
     VALUES ($1, TRUE, $2) RETURNING id`,
    [encrypted, uploadedBy]
  );

  return result[0].id;
}

export async function getDecryptedSchedule(): Promise<Schedule | null> {
  const rows = await queryAsGameEngine(
    `SELECT encrypted_data FROM schedules ORDER BY created_at DESC LIMIT 1`
  );

  if (rows.length === 0) return null;
  return decryptSchedule(rows[0].encrypted_data);
}

export async function updateNAVsForRound(round: number): Promise<void> {
  const schedule = await getDecryptedSchedule();
  if (!schedule) return;

  await withTransaction(async (client: PoolClient) => {
    for (const fund of schedule.funds) {
      const newNav = fund.navValues[round - 1];
      await client.query(
        `UPDATE funds SET current_nav = $1, last_nav_update = NOW() WHERE id = $2`,
        [newNav, fund.id]
      );
    }
  });

  await auditLog('nav_update', {
    round,
    details: { round, nav_count: schedule.funds.length },
  });
}
