import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SESSION_TTL_SECONDS, STARTING_CAPITAL } from '@/domain/constants';
import type { Team, TokenPayload } from '@/domain/types';
import { requiredEnv } from '@/lib/env';
import { query, transaction } from './db';
import { badRequest, forbidden, unauthorized } from './errors';

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRoll(value: string): string {
  return value.trim().toLowerCase();
}

function buildTeamCode(teamName: string, takenCodes: string[]): string {
  const base = (teamName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'TEAM').slice(0, 12);
  let candidate = `REG_${base}`;
  let suffix = 2;
  while (takenCodes.includes(candidate)) {
    candidate = `REG_${base}_${suffix}`.slice(0, 20);
    suffix += 1;
  }
  return candidate;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${digest}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length === 3 && parts[0] === 'pbkdf2') {
    const [, salt, digest] = parts;
    const candidate = crypto.pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(digest));
  }

  if (parts.length === 2) {
    const [salt, digest] = parts;
    const candidate = crypto.pbkdf2Sync(password, salt, 22_000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(digest));
  }

  return false;
}

function sign(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      ...payload,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    },
    requiredEnv('JWT_SECRET')
  );
}

export function signTeamToken(team: Team): string {
  return sign({
    role: 'team',
    team_id: team.id,
    team_code: team.team_code,
  });
}

export function signAdminToken(username: string): string {
  return sign({ role: 'admin', username });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, requiredEnv('JWT_SECRET')) as TokenPayload;
  } catch {
    unauthorized('Invalid or expired token');
  }
}

export async function createTeamSession(teamId: number, token: string): Promise<void> {
  await query(
    `INSERT INTO sessions (team_id, token_hash, expires_at, is_active, last_activity)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, TRUE, NOW())
     ON CONFLICT (token_hash)
     DO UPDATE SET is_active = TRUE, last_activity = NOW(),
                   expires_at = EXCLUDED.expires_at`,
    [teamId, hash(token), SESSION_TTL_SECONDS]
  );
}

export async function authenticateTeam(auth: string | null): Promise<number> {
  if (!auth?.startsWith('Bearer ')) {
    unauthorized();
  }

  const token = auth.slice('Bearer '.length);
  const payload = verifyToken(token);
  if (payload.role !== 'team' || !payload.team_id) {
    forbidden('Team token required');
  }

  const sessions = await query<{ id: string }>(
    `UPDATE sessions
     SET last_activity = NOW()
     WHERE token_hash = $1
       AND team_id = $2
       AND is_active = TRUE
       AND expires_at > NOW()
     RETURNING id`,
    [hash(token), payload.team_id]
  );

  if (sessions.length === 0) {
    unauthorized('Session expired');
  }

  return payload.team_id;
}

export async function authenticateAdmin(auth: string | null): Promise<string> {
  if (!auth?.startsWith('Bearer ')) {
    unauthorized();
  }

  const payload = verifyToken(auth.slice('Bearer '.length));
  if (payload.role !== 'admin' || !payload.username) {
    forbidden('Admin token required');
  }

  return payload.username;
}

export async function loginTeam(identity: string, password: string): Promise<{
  team: Team;
  token: string;
}> {
  const teams = await query<Team & { password_hash: string }>(
    `SELECT id, team_code, team_name, starting_capital, password_hash
     FROM teams
     WHERE upper(team_code) = upper($1)
        OR upper(team_name) = upper($1)
     ORDER BY CASE WHEN upper(team_name) = upper($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [identity.trim()]
  );

  const team = teams[0];
  if (!team || !verifyPassword(password, team.password_hash)) {
    unauthorized('Invalid team identity or password');
  }

  const publicTeam: Team = {
    id: team.id,
    team_code: team.team_code,
    team_name: team.team_name,
    starting_capital: Number(team.starting_capital),
  };
  const token = signTeamToken(publicTeam);
  await createTeamSession(publicTeam.id, token);
  return { team: publicTeam, token };
}

export async function registerTeam(input: {
  teamName: string;
  password: string;
  captain: {
    name: string;
    email: string;
    rollNumber: string;
    details?: Record<string, unknown>;
  };
  players: Array<{
    name: string;
    email: string;
    rollNumber: string;
    details?: Record<string, unknown>;
  }>;
}): Promise<Team> {
  const teamName = input.teamName.trim();
  const password = input.password.trim();
  const captain = {
    name: input.captain.name.trim(),
    email: normalizeEmail(input.captain.email),
    rollNumber: normalizeRoll(input.captain.rollNumber),
    details: input.captain.details ?? {},
  };
  const players = input.players.map((player) => ({
    name: player.name.trim(),
    email: normalizeEmail(player.email),
    rollNumber: normalizeRoll(player.rollNumber),
    details: player.details ?? {},
  }));

  if (!teamName) badRequest('Team name is required');
  if (password.length < 6) badRequest('Team password must be at least 6 characters long');
  if (!captain.name || !captain.email || !captain.rollNumber) {
    badRequest('Captain name, email, and roll number are required');
  }
  if (players.length !== 4) {
    badRequest('Exactly four additional players are required');
  }
  if (players.some((player) => !player.name || !player.email || !player.rollNumber)) {
    badRequest('Each player must include name, email, and roll number');
  }

  const emails = [captain.email, ...players.map((player) => player.email)];
  const rollNumbers = [captain.rollNumber, ...players.map((player) => player.rollNumber)];
  if (new Set(emails).size !== emails.length) badRequest('Duplicate email found within registration form');
  if (new Set(rollNumbers).size !== rollNumbers.length) badRequest('Duplicate roll number found within registration form');

  return transaction(async (client) => {
    const duplicateTeam = await client.query<{ id: number }>(
      `SELECT id FROM teams WHERE upper(team_name) = upper($1) LIMIT 1`,
      [teamName]
    );
    if (duplicateTeam.rows[0]) {
      badRequest('Team name is already registered');
    }

    const duplicates = await client.query<{ email: string; roll_number: string }>(
      `SELECT email, roll_number
       FROM team_members
       WHERE lower(email) = ANY($1::text[])
          OR lower(roll_number) = ANY($2::text[])`,
      [emails, rollNumbers]
    );
    if (duplicates.rows[0]) {
      badRequest('One or more players are already registered on another team');
    }

    const takenCodes = (
      await client.query<{ team_code: string }>(`SELECT team_code FROM teams WHERE team_code LIKE 'REG_%'`)
    ).rows.map((row) => row.team_code);
    const teamCode = buildTeamCode(teamName, takenCodes);
    const passwordHash = hashPassword(password);

    const createdTeam = await client.query<Team>(
      `INSERT INTO teams (team_code, team_name, password_hash, starting_capital)
       VALUES ($1, $2, $3, $4)
       RETURNING id, team_code, team_name, starting_capital`,
      [teamCode, teamName, passwordHash, STARTING_CAPITAL]
    );
    const team = createdTeam.rows[0];

    await client.query(
      `INSERT INTO portfolios (team_id, cash)
       VALUES ($1, $2)`,
      [team.id, STARTING_CAPITAL]
    );

    const members = [
      { ...captain, role: 'captain' },
      ...players.map((player) => ({ ...player, role: 'player' as const })),
    ];

    for (const member of members) {
      await client.query(
        `INSERT INTO team_members (team_id, member_name, email, roll_number, role, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [team.id, member.name, member.email, member.rollNumber, member.role, JSON.stringify(member.details)]
      );
    }

    return {
      ...team,
      starting_capital: Number(team.starting_capital),
    };
  });
}

export async function logoutToken(token: string): Promise<void> {
  await query(`UPDATE sessions SET is_active = FALSE WHERE token_hash = $1`, [hash(token)]);
}

export async function loginAdmin(username: string, password: string): Promise<string> {
  if (
    username !== (process.env.ADMIN_USERNAME ?? 'admin') ||
    password !== (process.env.ADMIN_PASSWORD ?? 'admin123')
  ) {
    unauthorized('Invalid admin credentials');
  }

  return signAdminToken(username);
}
