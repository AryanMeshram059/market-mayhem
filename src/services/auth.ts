import jwt from 'jsonwebtoken';
import { SESSION_TIMEOUT_SECONDS } from '@/constants/game';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { hashToken, verifyPassword } from '@/lib/password';
import { queryAsGameEngine } from '@/lib/db';
import type { JWTPayload, Team, TeamId } from '@/types';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export function generateTeamToken(team: Team): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    team_id: team.id,
    team_code: team.team_code,
    role: 'team',
    iat: now,
    exp: now + SESSION_TIMEOUT_SECONDS,
  };
  return jwt.sign(payload, getJwtSecret());
}

export function generateAdminToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    role: 'admin',
    username,
    iat: now,
    exp: now + SESSION_TIMEOUT_SECONDS,
  };
  return jwt.sign(payload, getJwtSecret());
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}

export async function authenticateTeamRequest(
  authHeader: string | null
): Promise<TeamId> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing authorization token');
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (payload.role !== 'team' || !payload.team_id) {
    throw new AuthorizationError('Team access required');
  }

  const sessions = await queryAsGameEngine(
    `SELECT is_active, expires_at FROM sessions
     WHERE token_hash = $1 AND is_active = TRUE`,
    [hashToken(token)]
  );

  if (sessions.length === 0) {
    throw new AuthenticationError('Session expired or invalid');
  }

  const session = sessions[0];
  if (new Date(session.expires_at) < new Date()) {
    throw new AuthenticationError('Session expired');
  }

  await queryAsGameEngine(
    `UPDATE sessions SET last_activity = NOW() WHERE token_hash = $1`,
    [hashToken(token)]
  );

  return payload.team_id;
}

export async function authenticateAdminRequest(
  authHeader: string | null
): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing authorization token');
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (payload.role !== 'admin' || !payload.username) {
    throw new AuthorizationError('Admin access required');
  }

  return payload.username;
}

export async function validateTeamCredentials(
  teamCode: string,
  password: string
): Promise<Team | null> {
  const teams = await queryAsGameEngine(
    `SELECT id, team_code, team_name, starting_capital, password_hash
     FROM teams WHERE team_code = $1`,
    [teamCode.toUpperCase()]
  );

  if (teams.length === 0) {
    return null;
  }

  const team = teams[0];
  if (!verifyPassword(password, team.password_hash)) {
    return null;
  }

  return {
    id: team.id,
    team_code: team.team_code,
    team_name: team.team_name,
    starting_capital: Number(team.starting_capital),
  };
}

export async function validateAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

  return username === adminUsername && password === adminPassword;
}

export async function createSession(teamId: TeamId, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_SECONDS * 1000);

  await queryAsGameEngine(
    `UPDATE sessions SET is_active = FALSE WHERE team_id = $1 AND is_active = TRUE`,
    [teamId]
  );

  await queryAsGameEngine(
    `INSERT INTO sessions (team_id, token_hash, expires_at, is_active)
     VALUES ($1, $2, $3, TRUE)`,
    [teamId, tokenHash, expiresAt.toISOString()]
  );
}

export async function invalidateSession(token: string): Promise<void> {
  await queryAsGameEngine(
    `UPDATE sessions SET is_active = FALSE WHERE token_hash = $1`,
    [hashToken(token)]
  );
}

export async function extendSession(token: string): Promise<string> {
  const payload = verifyToken(token);
  if (payload.role !== 'team' || !payload.team_id) {
    throw new AuthorizationError('Team session required');
  }

  const teams = await queryAsGameEngine(
    `SELECT id, team_code, team_name, starting_capital FROM teams WHERE id = $1`,
    [payload.team_id]
  );

  if (teams.length === 0) {
    throw new AuthenticationError('Team not found');
  }

  const newToken = generateTeamToken(teams[0]);
  await invalidateSession(token);
  await createSession(payload.team_id, newToken);
  return newToken;
}
