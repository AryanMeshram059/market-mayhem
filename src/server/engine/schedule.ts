import crypto from 'crypto';
import { INVESTABLE_FUNDS, MAX_NAV_CHANGE, TOTAL_ROUNDS } from '@/domain/constants';
import type { SchedulePayload } from '@/domain/types';
import { requiredEnv } from '@/lib/env';
import { audit } from '../audit';
import { query, type PoolClient } from '../db';
import { badRequest } from '../errors';

function key(): Buffer {
  const raw = requiredEnv('SCHEDULE_KEY');
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSchedule(schedule: SchedulePayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(schedule), 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSchedule(value: string): SchedulePayload {
  const [ivRaw, tagRaw, dataRaw] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as SchedulePayload;
}

export function validateSchedule(schedule: SchedulePayload): void {
  if (!Array.isArray(schedule.funds) || schedule.funds.length !== INVESTABLE_FUNDS) {
    badRequest(`Schedule must contain ${INVESTABLE_FUNDS} investable funds`);
  }

  for (const fund of schedule.funds) {
    if (!fund.fund_code || fund.navValues.length !== TOTAL_ROUNDS) {
      badRequest(`Fund ${fund.fund_code || '<missing>'} must have ${TOTAL_ROUNDS} NAV values`);
    }
    const base = fund.navValues[0];
    for (const [index, nav] of fund.navValues.entries()) {
      if (!Number.isFinite(nav) || nav <= 0) {
        badRequest(`Invalid NAV for ${fund.fund_code} round ${index + 1}`);
      }
      if (Math.abs((nav - base) / base) > MAX_NAV_CHANGE) {
        badRequest(`${fund.fund_code} breaches +/-60% cumulative NAV cap`);
      }
    }
  }
}

export async function storeSchedule(schedule: SchedulePayload, uploadedBy: string): Promise<string> {
  validateSchedule(schedule);
  const codes = await query<{ fund_code: string }>(
    `SELECT fund_code FROM funds WHERE is_cash = FALSE`
  );
  const validCodes = new Set(codes.map((row) => row.fund_code));
  for (const fund of schedule.funds) {
    if (!validCodes.has(fund.fund_code)) {
      badRequest(`Unknown fund code in schedule: ${fund.fund_code}`);
    }
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO schedules (encrypted_data, locked, uploaded_by)
     VALUES ($1, TRUE, $2)
     RETURNING id`,
    [encryptSchedule(schedule), uploadedBy]
  );
  await audit({ event_type: 'schedule_uploaded', admin_username: uploadedBy, event_data: { schedule_id: rows[0].id } });
  return rows[0].id;
}

export async function latestSchedule(): Promise<SchedulePayload | null> {
  const rows = await query<{ encrypted_data: string }>(
    `SELECT encrypted_data FROM schedules ORDER BY created_at DESC LIMIT 1`
  );
  return rows[0] ? decryptSchedule(rows[0].encrypted_data) : null;
}

export async function applyRoundNavs(client: PoolClient, round: number): Promise<void> {
  const schedule = await latestSchedule();
  if (!schedule) {
    return;
  }

  for (const item of schedule.funds) {
    const nav = item.navValues[round - 1];
    await client.query(
      `UPDATE funds
       SET current_nav = $1, last_nav_update = NOW()
       WHERE fund_code = $2 AND is_cash = FALSE`,
      [nav, item.fund_code]
    );
  }
}
