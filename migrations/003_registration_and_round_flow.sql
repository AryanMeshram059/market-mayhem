CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  roll_number VARCHAR(60) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('captain', 'player')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email),
  UNIQUE(roll_number)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_team_members_roll ON team_members(LOWER(roll_number));

ALTER TABLE game_state DROP CONSTRAINT IF EXISTS game_state_current_phase_check;
ALTER TABLE game_state
  ADD CONSTRAINT game_state_current_phase_check
  CHECK (current_phase IN ('IDLE', 'SETUP_OPEN', 'NEWS_REVEAL', 'TRADING_OPEN', 'ORDER_LOCK', 'RESULTS_DISPLAY'));
