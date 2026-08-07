import { loadEnvConfig } from '@next/env';
import { PHASE_DURATIONS, STARTING_CAPITAL } from '@/domain/constants';
import { PREDEFINED_ROUND_NEWS } from '@/domain/rounds';
import { getPool, transaction } from '@/server/db';
import { seedTeams } from '@/server/services/seed';

loadEnvConfig(process.cwd());

const FINAL_FUNDS = [
  { position: 1, fund_code: 'TECH', fund_name: 'Technology' },
  { position: 2, fund_code: 'BANKING', fund_name: 'Banking' },
  { position: 3, fund_code: 'AUTO', fund_name: 'Automobile' },
  { position: 4, fund_code: 'FMCG', fund_name: 'FMCG' },
  { position: 5, fund_code: 'PHARMA', fund_name: 'Pharma' },
  { position: 6, fund_code: 'ENERGY', fund_name: 'Energy' },
  { position: 7, fund_code: 'GOLD', fund_name: 'Gold' },
  { position: 8, fund_code: 'OIL', fund_name: 'Oil' },
  { position: 9, fund_code: 'AGRI', fund_name: 'Agriculture' },
  { position: 10, fund_code: 'GOVBOND', fund_name: 'Government Bond' },
  { position: 11, fund_code: 'PROPERTY', fund_name: 'Commercial Property' },
] as const;

async function restoreRoundConstraints(): Promise<void> {
  await transaction(async (client) => {
    await client.query(`ALTER TABLE game_state DROP CONSTRAINT IF EXISTS game_state_current_round_check`);
    await client.query(
      `ALTER TABLE game_state ADD CONSTRAINT game_state_current_round_check CHECK (current_round BETWEEN 1 AND 15)`,
    );

    await client.query(`ALTER TABLE pending_orders DROP CONSTRAINT IF EXISTS pending_orders_round_check`);
    await client.query(`ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS reserved_cash NUMERIC(15,4) DEFAULT 0`);
    await client.query(
      `ALTER TABLE pending_orders ADD CONSTRAINT pending_orders_round_check CHECK (round BETWEEN 1 AND 15)`,
    );

    await client.query(`ALTER TABLE executed_orders DROP CONSTRAINT IF EXISTS executed_orders_round_check`);
    await client.query(
      `ALTER TABLE executed_orders ADD CONSTRAINT executed_orders_round_check CHECK (round BETWEEN 1 AND 15)`,
    );

    await client.query(`ALTER TABLE p2p_trades DROP CONSTRAINT IF EXISTS p2p_trades_round_check`);
    await client.query(
      `ALTER TABLE p2p_trades ADD CONSTRAINT p2p_trades_round_check CHECK (round BETWEEN 1 AND 15)`,
    );

    await client.query(`ALTER TABLE news_feed DROP CONSTRAINT IF EXISTS news_feed_round_check`);
    await client.query(
      `ALTER TABLE news_feed ADD CONSTRAINT news_feed_round_check CHECK (round BETWEEN 1 AND 15)`,
    );

    await client.query(`ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_round_check`);
    await client.query(
      `ALTER TABLE audit_log ADD CONSTRAINT audit_log_round_check CHECK (round IS NULL OR round BETWEEN 1 AND 15)`,
    );
  });
}

async function seedFinalGameData(): Promise<void> {
  const fundValues = FINAL_FUNDS.map((fund) => [fund.position, fund.fund_code, fund.fund_name]);
  const newsValues = Object.entries(PREDEFINED_ROUND_NEWS).map(([round, content]) => [
    Number(round),
    content,
  ]);

  await transaction(async (client) => {
    await client.query(`DELETE FROM pending_orders`);
    await client.query(`DELETE FROM p2p_trades`);
    await client.query(`DELETE FROM executed_orders`);
    await client.query(`DELETE FROM holdings`);
    await client.query(`DELETE FROM news_feed`);

    await client.query(
      `UPDATE game_state
       SET current_round = 1,
           current_phase = 'IDLE',
           phase_start = NOW(),
           phase_duration = $1,
           is_paused = FALSE,
           paused_at = NULL,
           remaining_time = NULL
       WHERE id = 1`,
      [PHASE_DURATIONS.IDLE],
    );

    await client.query(
      `UPDATE funds
       SET fund_code = 'TMP_SEED_' || id::text
       WHERE is_cash = FALSE`,
    );

    await client.query(
      `WITH final_funds(target_position, fund_code, fund_name) AS (
         SELECT *
         FROM jsonb_to_recordset($1::jsonb)
           AS item(target_position int, fund_code text, fund_name text)
       ),
       ranked_funds AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS target_position
         FROM funds
         WHERE is_cash = FALSE
         ORDER BY id
         LIMIT 11
       )
       UPDATE funds
       SET fund_code = final_funds.fund_code,
           fund_name = final_funds.fund_name,
           current_nav = 100,
           last_nav_update = NOW()
       FROM ranked_funds
       JOIN final_funds ON final_funds.target_position = ranked_funds.target_position
       WHERE funds.id = ranked_funds.id`,
      [
        JSON.stringify(
          fundValues.map(([target_position, fund_code, fund_name]) => ({
            target_position,
            fund_code,
            fund_name,
          })),
        ),
      ],
    );

    await client.query(
      `INSERT INTO funds (fund_code, fund_name, is_cash, current_nav, last_nav_update)
       SELECT fund_code, fund_name, FALSE, 100, NOW()
       FROM jsonb_to_recordset($1::jsonb) AS item(fund_code text, fund_name text)
       ON CONFLICT (fund_code) DO UPDATE
       SET fund_name = EXCLUDED.fund_name,
           is_cash = FALSE,
           current_nav = 100,
           last_nav_update = NOW()`,
      [JSON.stringify(FINAL_FUNDS)],
    );

    await client.query(
      `DELETE FROM funds
       WHERE is_cash = FALSE
         AND fund_code <> ALL($1::text[])`,
      [FINAL_FUNDS.map((fund) => fund.fund_code)],
    );

    await client.query(
      `INSERT INTO funds (fund_code, fund_name, is_cash, current_nav, last_nav_update)
       VALUES ('CASH', 'Cash Fund', TRUE, 1, NOW())
       ON CONFLICT (fund_code) DO UPDATE
       SET fund_name = EXCLUDED.fund_name,
           is_cash = TRUE,
           current_nav = 1,
           last_nav_update = NOW()`,
    );

    await client.query(
      `INSERT INTO news_feed (round, content)
       SELECT round, content
       FROM jsonb_to_recordset($1::jsonb) AS item(round int, content text)
       ON CONFLICT (round) DO UPDATE
       SET content = EXCLUDED.content,
           created_at = NOW()`,
      [
        JSON.stringify(
          newsValues.map(([round, content]) => ({
            round,
            content,
          })),
        ),
      ],
    );

    await client.query(
      `UPDATE portfolios
       SET cash = $1,
           last_updated = NOW()`,
      [STARTING_CAPITAL],
    );

    await client.query(
      `INSERT INTO portfolios (team_id, cash)
       SELECT id, $1
       FROM teams
       WHERE NOT EXISTS (
         SELECT 1
         FROM portfolios
         WHERE portfolios.team_id = teams.id
       )`,
      [STARTING_CAPITAL],
    );
  });
}

async function main(): Promise<void> {
  await restoreRoundConstraints();
  await seedTeams();
  await seedFinalGameData();

  console.log(`Seeded ${FINAL_FUNDS.length} funds, ${Object.keys(PREDEFINED_ROUND_NEWS).length} news items, and default teams.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
