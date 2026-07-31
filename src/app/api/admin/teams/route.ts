export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    await authenticateAdmin(authHeader(request));
    const teams = await query<{ id: number; team_code: string; team_name: string }>(
      `SELECT id, team_code, team_name FROM teams ORDER BY id`
    );

    // Fetch all portfolios in one query
    const portfolios = await query<{
      team_id: number;
      cash: string;
    }>(
      `SELECT team_id, cash FROM portfolios ORDER BY team_id`
    );

    // Fetch all holdings with fund data in one query
    const holdings = await query<{
      team_id: number;
      fund_id: number;
      fund_code: string;
      fund_name: string;
      quantity: string;
      current_nav: string;
      avg_buy_price?: string;
      total_invested?: string;
    }>(
      `SELECT h.team_id, h.fund_id, f.fund_code, f.fund_name, h.quantity, f.current_nav,
              COALESCE(h.avg_buy_price, 0) as avg_buy_price,
              COALESCE(h.total_invested, 0) as total_invested
       FROM holdings h
       JOIN funds f ON f.id = h.fund_id
       WHERE h.quantity > 0 AND f.is_cash = FALSE
       ORDER BY h.team_id, f.fund_code`
    ).catch(async () => {
      // Fallback if columns don't exist
      return query<{
        team_id: number;
        fund_id: number;
        fund_code: string;
        fund_name: string;
        quantity: string;
        current_nav: string;
      }>(
        `SELECT h.team_id, h.fund_id, f.fund_code, f.fund_name, h.quantity, f.current_nav
         FROM holdings h
         JOIN funds f ON f.id = h.fund_id
         WHERE h.quantity > 0 AND f.is_cash = FALSE
         ORDER BY h.team_id, f.fund_code`
      );
    });

    // Build maps for quick lookup
    const portfolioMap = new Map(portfolios.map(p => [p.team_id, p]));
    const holdingsByTeam = new Map<number, typeof holdings>();
    holdings.forEach(h => {
      if (!holdingsByTeam.has(h.team_id)) {
        holdingsByTeam.set(h.team_id, []);
      }
      holdingsByTeam.get(h.team_id)!.push(h);
    });

    // Build portfolio objects
    const data = teams.map((team) => {
      const portfolio = portfolioMap.get(team.id);
      const teamHoldings = holdingsByTeam.get(team.id) || [];
      const cash = portfolio ? Number(portfolio.cash) : 0;

      const mapped = teamHoldings.map((row: any) => {
        const qty = Number(row.quantity);
        const nav = Number(row.current_nav);
        const avgBuyPrice = row.avg_buy_price ? Number(row.avg_buy_price) : 0;
        const totalInvested = row.total_invested ? Number(row.total_invested) : 0;
        const marketValue = qty * nav;
        const totalReturn = totalInvested > 0 ? marketValue - totalInvested : 0;
        const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

        return {
          fund_id: row.fund_id,
          fund_code: row.fund_code,
          fund_name: row.fund_name,
          quantity: qty,
          current_nav: nav,
          market_value: marketValue,
          avg_buy_price: avgBuyPrice,
          total_invested: totalInvested,
          total_return: totalReturn,
          return_percentage: returnPercentage,
        };
      });

      return {
        ...team,
        portfolio: {
          team_id: team.id,
          cash,
          holdings: mapped,
          total_value: cash + mapped.reduce((sum, h) => sum + h.market_value, 0),
          last_updated: null,
        },
      };
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
