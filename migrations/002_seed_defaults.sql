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
