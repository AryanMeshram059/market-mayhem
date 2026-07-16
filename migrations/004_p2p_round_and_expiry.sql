ALTER TABLE p2p_trades
  ADD COLUMN IF NOT EXISTS round INTEGER CHECK (round BETWEEN 1 AND 15),
  ADD COLUMN IF NOT EXISTS accepted_by_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE p2p_trades
  DROP CONSTRAINT IF EXISTS p2p_trades_status_check;

ALTER TABLE p2p_trades
  ADD CONSTRAINT p2p_trades_status_check
  CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'completed', 'failed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_p2p_trades_round_status ON p2p_trades(round, status);
