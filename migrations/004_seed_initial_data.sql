  -- ============================================================================
  -- Migration: 004_seed_initial_data.sql
  -- Description: Seed initial funds and game state for Market Mayhem platform
  -- ============================================================================

  -- ============================================================================
  -- SEED FUNDS (11 Investable + 1 Cash)
  -- ============================================================================
  -- Insert 11 investable funds representing different market sectors
  INSERT INTO funds (fund_code, fund_name, is_cash, current_nav) VALUES
    ('TECH', 'Technology Fund', FALSE, 100.00),
    ('PHARMA', 'Pharma & Healthcare Fund', FALSE, 100.00),
    ('ENERGY', 'Energy & Power Fund', FALSE, 100.00),
    ('BANKING', 'Banking & Finance Fund', FALSE, 100.00),
    ('CONSUMER', 'Consumer & Retail Fund', FALSE, 100.00),
    ('AUTO', 'Automobiles & Components Fund', FALSE, 100.00),
    ('INFRA', 'Infrastructure & Construction Fund', FALSE, 100.00),
    ('METALS', 'Metals & Mining Fund', FALSE, 100.00),
    ('TELECOM', 'Telecommunications Fund', FALSE, 100.00),
    ('REALTY', 'Real Estate & REIT Fund', FALSE, 100.00),
    ('FMCG', 'FMCG & Consumer Staples Fund', FALSE, 100.00)
  ON CONFLICT (fund_code) DO NOTHING;

  -- Insert Cash fund (non-investable)
  INSERT INTO funds (fund_code, fund_name, is_cash, current_nav) VALUES
    ('CASH', 'Cash', TRUE, 1.00)
  ON CONFLICT (fund_code) DO NOTHING;

  -- Update NAV update timestamps
  UPDATE funds SET last_nav_update = NOW();

  -- ============================================================================
  -- INITIALIZE GAME STATE
  -- ============================================================================
  -- Insert the single game state row (if not already present)
  INSERT INTO game_state (id, current_round, current_phase, phase_start, phase_duration, is_paused)
  VALUES (1, 1, 'NEWS_REVEAL', NOW(), 60, FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- SEED 80 TEAMS
  -- ============================================================================
  -- This uses a stored procedure approach via CTE to avoid needing temporary data
  -- Note: team_code format is TEAM_001, TEAM_002, ... TEAM_080
  -- Note: password_hash values are PLACEHOLDER MD5 hashes for SQL-only seeding.
  -- For working logins, run: npm run seed (uses PBKDF2 hashes matching the app auth).

  -- Insert 80 teams in a single operation using WITH clause
  WITH team_data AS (
    SELECT 
      'TEAM_' || LPAD(seq::text, 3, '0') AS team_code,
      'Team ' || seq AS team_name,
      substring(md5(('password_' || seq)::text), 1, 32) AS password_hash,
      100000000::NUMERIC(15,2) AS starting_capital,
      seq
    FROM generate_series(1, 80) AS seq
  )
  INSERT INTO teams (team_code, team_name, password_hash, starting_capital)
  SELECT team_code, team_name, password_hash, starting_capital
  FROM team_data
  ON CONFLICT (team_code) DO NOTHING;

  -- ============================================================================
  -- INITIALIZE PORTFOLIOS FOR ALL 80 TEAMS
  -- ============================================================================
  -- Create portfolio records with starting capital of ₹100 Crores for each team
  INSERT INTO portfolios (team_id, cash, last_updated)
  SELECT 
    id,
    100000000::NUMERIC(15,2),  -- ₹100 Crores
    NOW()
  FROM teams
  ON CONFLICT (team_id) DO NOTHING;

  -- ============================================================================
  -- VERIFY SEED DATA
  -- ============================================================================
  -- Verification queries (uncomment to check after import)

  -- Check funds count (should be 12: 11 investable + 1 cash)
  -- SELECT COUNT(*) as total_funds, SUM(CASE WHEN is_cash THEN 1 ELSE 0 END) as cash_funds FROM funds;

  -- Check teams count (should be 80)
  -- SELECT COUNT(*) as total_teams FROM teams;

  -- Check portfolios count (should be 80)
  -- SELECT COUNT(*) as total_portfolios, SUM(cash)::NUMERIC as total_capital FROM portfolios;

  -- Check game state is initialized
  -- SELECT * FROM game_state WHERE id = 1;

  -- ============================================================================
  -- SECURITY NOTE
  -- ============================================================================
  -- IMPORTANT: The password hashes in this seed file are placeholders using MD5.
  -- In production:
  -- 1. Use proper bcrypt hashing with cost factor 12
  -- 2. Generate unique passwords for each team or use random initial passwords
  -- 3. Require teams to change passwords on first login
  -- 4. Never store plaintext passwords
  -- 5. Consider using a dedicated password management service

  -- ============================================================================
  -- TEAM PASSWORD REFERENCE (for development only)
  -- ============================================================================
  -- Team Code: TEAM_001, Password: password_1
  -- Team Code: TEAM_002, Password: password_2
  -- ... and so on
  -- 
  -- Format: TEAM_NNN has initial password: password_NNN
  -- 
  -- NEVER use these in production!
  -- ALWAYS hash passwords properly before storage!
