ALTER TABLE game_state
  DROP CONSTRAINT IF EXISTS game_state_current_round_check;

ALTER TABLE game_state
  ADD CONSTRAINT game_state_current_round_check
  CHECK (current_round BETWEEN 1 AND 15);

ALTER TABLE pending_orders
  DROP CONSTRAINT IF EXISTS pending_orders_round_check;

ALTER TABLE pending_orders
  ADD CONSTRAINT pending_orders_round_check
  CHECK (round BETWEEN 1 AND 15);

ALTER TABLE executed_orders
  DROP CONSTRAINT IF EXISTS executed_orders_round_check;

ALTER TABLE executed_orders
  ADD CONSTRAINT executed_orders_round_check
  CHECK (round BETWEEN 1 AND 15);

ALTER TABLE p2p_trades
  DROP CONSTRAINT IF EXISTS p2p_trades_round_check;

ALTER TABLE p2p_trades
  ADD CONSTRAINT p2p_trades_round_check
  CHECK (round BETWEEN 1 AND 15);

ALTER TABLE news_feed
  DROP CONSTRAINT IF EXISTS news_feed_round_check;

ALTER TABLE news_feed
  ADD CONSTRAINT news_feed_round_check
  CHECK (round BETWEEN 1 AND 15);

ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_round_check;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_round_check
  CHECK (round IS NULL OR round BETWEEN 1 AND 15);

UPDATE funds
SET fund_code = 'TMP_' || id::text
WHERE is_cash = FALSE;

WITH ranked_funds AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) AS target_position
  FROM funds
  WHERE is_cash = FALSE
),
final_funds(target_position, fund_code, fund_name) AS (
  VALUES
    (1, 'TECH', 'Technology'),
    (2, 'BANKING', 'Banking'),
    (3, 'AUTO', 'Automobile'),
    (4, 'FMCG', 'FMCG'),
    (5, 'PHARMA', 'Pharma'),
    (6, 'ENERGY', 'Energy'),
    (7, 'GOLD', 'Gold'),
    (8, 'OIL', 'Oil'),
    (9, 'AGRI', 'Agriculture'),
    (10, 'GOVBOND', 'Government Bond'),
    (11, 'PROPERTY', 'Commercial Property')
)
UPDATE funds
SET fund_code = final_funds.fund_code,
    fund_name = final_funds.fund_name,
    current_nav = 100,
    last_nav_update = NOW()
FROM ranked_funds
JOIN final_funds ON final_funds.target_position = ranked_funds.target_position
WHERE funds.id = ranked_funds.id;

INSERT INTO funds (fund_code, fund_name, is_cash, current_nav, last_nav_update)
VALUES
  ('TECH', 'Technology', FALSE, 100, NOW()),
  ('BANKING', 'Banking', FALSE, 100, NOW()),
  ('AUTO', 'Automobile', FALSE, 100, NOW()),
  ('FMCG', 'FMCG', FALSE, 100, NOW()),
  ('PHARMA', 'Pharma', FALSE, 100, NOW()),
  ('ENERGY', 'Energy', FALSE, 100, NOW()),
  ('GOLD', 'Gold', FALSE, 100, NOW()),
  ('OIL', 'Oil', FALSE, 100, NOW()),
  ('AGRI', 'Agriculture', FALSE, 100, NOW()),
  ('GOVBOND', 'Government Bond', FALSE, 100, NOW()),
  ('PROPERTY', 'Commercial Property', FALSE, 100, NOW()),
  ('CASH', 'Cash Fund', TRUE, 1, NOW())
ON CONFLICT (fund_code) DO UPDATE
SET fund_name = EXCLUDED.fund_name,
    is_cash = EXCLUDED.is_cash,
    current_nav = EXCLUDED.current_nav,
    last_nav_update = EXCLUDED.last_nav_update;
