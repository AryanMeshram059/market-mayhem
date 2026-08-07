ALTER TABLE teams
  ALTER COLUMN starting_capital SET DEFAULT 100000;

ALTER TABLE portfolios
  ALTER COLUMN cash SET DEFAULT 100000;

UPDATE teams
SET starting_capital = 100000;

UPDATE portfolios
SET cash = 100000,
    last_updated = NOW();
