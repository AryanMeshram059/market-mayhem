-- Backfill weighted buy prices for holdings that were created before
-- holdings.avg_buy_price and holdings.total_invested were maintained.
WITH buy_costs AS (
  SELECT
    team_id,
    fund_id,
    SUM(quantity) AS total_quantity_bought,
    SUM(total_value) AS total_buy_cost
  FROM executed_orders
  WHERE order_type = 'buy'
    AND status = 'completed'
  GROUP BY team_id, fund_id
)
UPDATE holdings h
SET
  avg_buy_price = CASE
    WHEN buy_costs.total_quantity_bought > 0
    THEN buy_costs.total_buy_cost / buy_costs.total_quantity_bought
    ELSE 0
  END,
  total_invested = CASE
    WHEN buy_costs.total_quantity_bought > 0
    THEN (buy_costs.total_buy_cost / buy_costs.total_quantity_bought) * h.quantity
    ELSE 0
  END,
  quantity_bought = buy_costs.total_quantity_bought,
  last_updated = NOW()
FROM buy_costs
WHERE h.team_id = buy_costs.team_id
  AND h.fund_id = buy_costs.fund_id
  AND h.quantity > 0
  AND (h.avg_buy_price = 0 OR h.total_invested = 0);
