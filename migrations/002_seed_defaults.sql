INSERT INTO funds (fund_code, fund_name, is_cash, current_nav, last_nav_update)
VALUES
  ('TECH', 'Technology Fund', FALSE, 100, NOW()),
  ('PHARMA', 'Pharmaceutical Fund', FALSE, 100, NOW()),
  ('ENERGY', 'Energy Fund', FALSE, 100, NOW()),
  ('BANKING', 'Banking Fund', FALSE, 100, NOW()),
  ('CONSUMER', 'Consumer Goods Fund', FALSE, 100, NOW()),
  ('AUTO', 'Automobile Fund', FALSE, 100, NOW()),
  ('INFRA', 'Infrastructure Fund', FALSE, 100, NOW()),
  ('METALS', 'Metals and Mining Fund', FALSE, 100, NOW()),
  ('TELECOM', 'Telecommunications Fund', FALSE, 100, NOW()),
  ('REALTY', 'Real Estate Fund', FALSE, 100, NOW()),
  ('FMCG', 'FMCG Fund', FALSE, 100, NOW()),
  ('CASH', 'Cash Fund', TRUE, 1, NOW())
ON CONFLICT (fund_code) DO NOTHING;
