ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS avg_buy_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invested numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_bought numeric NOT NULL DEFAULT 0;
