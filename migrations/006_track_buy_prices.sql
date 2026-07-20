-- Add columns to track buy price information for holdings
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS avg_buy_price NUMERIC(15,4) DEFAULT 0 NOT NULL;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS total_invested NUMERIC(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS quantity_bought NUMERIC(15,4) DEFAULT 0 NOT NULL;

-- Update portfolio endpoint to include this data
CREATE OR REPLACE VIEW portfolio_detail AS
SELECT 
  h.team_id,
  h.fund_id,
  f.fund_code,
  f.fund_name,
  h.quantity,
  h.avg_buy_price,
  h.total_invested,
  f.current_nav,
  (h.quantity * f.current_nav) as market_value,
  CASE 
    WHEN h.quantity > 0 THEN ROUND((h.quantity * f.current_nav - h.total_invested) / h.total_invested * 100, 2)
    ELSE 0
  END as return_percentage
FROM holdings h
JOIN funds f ON f.id = h.fund_id
WHERE h.quantity > 0 AND f.is_cash = FALSE;
