UPDATE game_state
SET current_round = 1,
    current_phase = 'IDLE',
    phase_start = NOW(),
    phase_duration = 0,
    is_paused = FALSE,
    paused_at = NULL,
    remaining_time = NULL
WHERE id = 1
  AND current_round > 10;

DELETE FROM pending_orders WHERE round > 10;
DELETE FROM p2p_trades WHERE round > 10;
DELETE FROM news_feed WHERE round > 10;
UPDATE executed_orders SET round = 10 WHERE round > 10;
UPDATE audit_log SET round = NULL WHERE round > 10;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS game_state_current_round_check;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS valid_round;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS valid_phase;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS game_state_current_phase_check;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS valid_duration;

ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS game_state_phase_duration_check;

ALTER TABLE game_state
  ADD CONSTRAINT game_state_current_round_check
  CHECK (current_round BETWEEN 1 AND 10);

ALTER TABLE game_state
  ADD CONSTRAINT game_state_current_phase_check
  CHECK (current_phase IN ('IDLE', 'SETUP_OPEN', 'NEWS_REVEAL', 'TRADING_OPEN', 'ORDER_LOCK', 'RESULTS_DISPLAY'));

ALTER TABLE game_state
  ADD CONSTRAINT game_state_phase_duration_check
  CHECK (phase_duration >= 0);

ALTER TABLE pending_orders
  DROP CONSTRAINT IF EXISTS pending_orders_round_check;

ALTER TABLE pending_orders
  ADD CONSTRAINT pending_orders_round_check
  CHECK (round BETWEEN 1 AND 10);

ALTER TABLE executed_orders
  DROP CONSTRAINT IF EXISTS executed_orders_round_check;

ALTER TABLE executed_orders
  ADD CONSTRAINT executed_orders_round_check
  CHECK (round BETWEEN 1 AND 10);

ALTER TABLE p2p_trades
  DROP CONSTRAINT IF EXISTS p2p_trades_round_check;

ALTER TABLE p2p_trades
  ADD CONSTRAINT p2p_trades_round_check
  CHECK (round BETWEEN 1 AND 10);

ALTER TABLE news_feed
  DROP CONSTRAINT IF EXISTS news_feed_round_check;

ALTER TABLE news_feed
  ADD CONSTRAINT news_feed_round_check
  CHECK (round BETWEEN 1 AND 10);

ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_round_check;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_round_check
  CHECK (round IS NULL OR round BETWEEN 1 AND 10);
