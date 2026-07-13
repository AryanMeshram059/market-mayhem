import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateTeamRequest, generateTeamToken } from '../services/auth';
import { queryAsAuth } from '../lib/db';

vi.mock('../lib/db', () => ({
  queryAsAuth: vi.fn(),
}));

const mockedQueryAsAuth = vi.mocked(queryAsAuth);

describe('authenticateTeamRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('accepts a valid team token when no session row exists yet', async () => {
    mockedQueryAsAuth.mockResolvedValue([]);

    const team = {
      id: 7,
      team_code: 'TEAM_007',
      team_name: 'Team 7',
      starting_capital: 100000000,
    };

    const token = generateTeamToken(team);

    await expect(authenticateTeamRequest(`Bearer ${token}`)).resolves.toBe(team.id);
  });

  it('accepts a valid team token when the stored session already expired', async () => {
    mockedQueryAsAuth.mockResolvedValue([{ is_active: true, expires_at: new Date(Date.now() - 60_000).toISOString() }]);

    const team = {
      id: 8,
      team_code: 'TEAM_008',
      team_name: 'Team 8',
      starting_capital: 100000000,
    };

    const token = generateTeamToken(team);

    await expect(authenticateTeamRequest(`Bearer ${token}`)).resolves.toBe(team.id);
  });
});
