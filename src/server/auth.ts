import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SESSION_TTL_SECONDS } from '@/domain/constants';
import type { Team, TokenPayload } from '@/domain/types';
import { requiredEnv } from '@/lib/env';
import { query } from './db';
import { forbidden, unauthorized } from './errors';

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
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

export async function loginTeam(teamCode: string, password: string): Promise<{
  team: Team;
  token: string;
}> {
  const teams = await query<Team & { password_hash: string }>(
    `SELECT id, team_code, team_name, starting_capital, password_hash
     FROM teams
     WHERE upper(team_code) = upper($1)`,
    [teamCode]
  );

  const team = teams[0];
  if (!team || !verifyPassword(password, team.password_hash)) {
    unauthorized('Invalid team code or password');
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
