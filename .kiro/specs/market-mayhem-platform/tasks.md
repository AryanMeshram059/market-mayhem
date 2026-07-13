# Implementation Plan: Market Mayhem Platform

## Overview

This implementation plan breaks down the Market Mayhem platform into discrete, executable coding tasks. The platform consists of three primary surfaces (Team Trading App, Admin Console, Game Engine) running on Vercel Hobby tier with Supabase Free tier PostgreSQL. The implementation follows a bottom-up approach: database → backend services → API routes → frontend components.

**Key Technical Decisions:**
- **Language:** TypeScript (Next.js 15 App Router)
- **Database:** PostgreSQL with Row-Level Security (Supabase)
- **Architecture:** Lazy state machine with HTTP polling (no WebSockets)
- **Testing:** Property-based tests for 23 correctness properties using fast-check
- **Deployment:** Vercel (zero-cost during idle)

## Task Dependency Graph

```
Phase 1 (Foundation):
├─ 1. Database Setup and Core Schema
├─ 2. Core Type Definitions and Constants
└─ 3. Authentication and Security Services

Phase 2 (Game Engine):
├─ 4. Game Engine - Calculation Services (depends on: 2, 3)
├─ 5. Game Engine - Order Validation Service (depends on: 2, 3, 4)
├─ 6. Game Engine - Order Execution Service (depends on: 2, 3, 4, 5)
├─ 7. Game Engine - NAV Schedule Management (depends on: 2, 3, 4)
├─ 8. Game Engine - State Machine Service (depends on: 2, 3, 6, 7)
├─ 9. Game Engine - P2P Trade Execution (depends on: 2, 3, 4, 5, 6)
├─ 10. Game Engine - Leaderboard Service (depends on: 2, 3, 4)
└─ 11. Checkpoint - Core Engine Services Complete

Phase 3 (API Routes):
├─ 12. API Routes - Authentication Endpoints (depends on: 3, 11)
├─ 13. API Routes - Game State Endpoints (depends on: 3, 8, 10, 11)
├─ 14. API Routes - Order Management Endpoints (depends on: 3, 5, 6, 11)
├─ 15. API Routes - Portfolio Endpoints (depends on: 3, 4, 6, 11)
├─ 16. API Routes - P2P Trading Endpoints (depends on: 3, 9, 11)
├─ 17. API Routes - Admin Endpoints (depends on: 3, 7, 8, 9, 11)
└─ 18. Checkpoint - API Routes Complete

Phase 4 (Frontend):
├─ 19. Team Trading App - Core Components (depends on: 18)
├─ 20. Team Trading App - Pages (depends on: 19)
├─ 21. Admin Console - Core Components (depends on: 18)
├─ 22. Admin Console - Pages (depends on: 21)
└─ 23. Checkpoint - Frontend Components Complete

Phase 5 (Polish & Testing):
├─ 24. Error Handling and Resilience (depends on: 23)
├─ 25. Performance Optimization (depends on: 23)
├─ 26. Data Persistence and Recovery (depends on: 11, 18)
├─ 27. Integration Testing (depends on: 23)
├─ 28. Deployment Configuration (depends on: 23)
├─ 29. End-to-End Testing (depends on: 23)
└─ 30. Final Verification and Documentation (depends on: all)
```

## Tasks

- [x] 1. Database Setup and Core Schema
  - [x] 1.1 Create database migration scripts for all tables
    - Create migration files for teams, portfolios, holdings, funds, game_state, pending_orders, executed_orders, p2p_trades, schedules, news_feed, audit_log, sessions tables
    - Include all constraints, indexes, and foreign keys per design specification
    - Add RLS policies for team data isolation
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.4, 20.4_
  
  - [x] 1.2 Implement database connection pooling and RLS helpers
    - Create `src/lib/db.ts` with connection pool configuration
    - Implement `getTeamConnection(teamId)` to set `app.current_team_id` session variable
    - Implement `getGameEngineConnection()` with elevated `app.role`
    - Implement `getAdminConnection()` for admin operations
    - _Requirements: 20.4, 20.5_

  - [x] 1.3 Create seed data for funds and initial teams
    - Create script to seed 11 investable funds + 1 cash fund with fund_codes and names
    - Create script to generate 80 teams with unique team_codes and hashed passwords
    - Initialize portfolios table with ₹100 Crore starting capital for each team
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ]* 1.4 Write property test for Capital Allocation Invariant
    - **Property 4: Capital Allocation Invariant**
    - **Validates: Requirements 2.4**
    - Test that sum of all team cash + holdings market value = ₹8,000 Crores (accounting for fees)
    - Generate arbitrary order sequences and verify invariant holds after execution

- [ ] 2. Core Type Definitions and Constants
  - [ ] 2.1 Define TypeScript types and interfaces
    - Create `src/types/index.ts` with all domain types: TeamId, FundId, OrderId, TradeId, RoundNumber, Phase, OrderType, P2PStatus
    - Define interfaces: GameState, Team, Portfolio, Holding, Fund, Order, ExecutedOrder, P2PTrade, LeaderboardEntry, AuditLogEntry, Schedule
    - Define API request/response types: LoginRequest, LoginResponse, OrderSubmission, OrderResponse, P2PProposal, ValidationResult
    - _Requirements: All (foundational)_
  
  - [ ] 2.2 Define game constants and configuration
    - Create `src/constants/game.ts` with phase durations, brokerage rate (0.002), slippage rate (0.05), slippage threshold (0.25), cash erosion rate (0.995)
    - Define starting capital (₹100 Crore), total teams (80), total rounds (15)
    - _Requirements: 2.1, 4.2, 8.1, 8.2, 8.3, 9.1, 16.2_


- [ ] 3. Authentication and Security Services
  - [ ] 3.1 Implement JWT token generation and validation
    - Create `src/services/auth.ts` with `generateToken(team)` function
    - Implement `authenticateRequest(req)` middleware to validate Bearer tokens
    - Implement token validation with session database checks
    - Update session last_activity on successful validation
    - _Requirements: 1.3, 1.4, 1.8, 28.1_

  - [ ]* 3.2 Write property test for Authentication with Valid Credentials
    - **Property 1: Authentication with Valid Credentials**
    - **Validates: Requirements 1.3, 1.8**
    - Test that any valid team credentials return a valid session token
    - Verify token contains team_id and has correct expiry

  - [ ] 3.3 Implement rate limiting middleware
    - Create `src/services/rateLimit.ts` with token bucket algorithm
    - Implement `checkRateLimit(teamId, cost)` with per-team tracking
    - Configure limits: 100 requests/min general, 10 orders/min, 5 P2P/min
    - _Requirements: 20.10_

  - [ ] 3.4 Implement audit logging service
    - Create `src/services/auditLog.ts` with `auditLog(eventType, data)` function
    - Support all event types: phase_transition, order_submitted, order_executed, order_failed, p2p_proposed, p2p_approved, p2p_rejected, p2p_executed, manual_adjustment, admin_action, nav_update, login, logout
    - Ensure immutable append-only writes to audit_log table
    - _Requirements: 2.3, 7.7, 13.7, 14.6, 16.7, 17.8, 19.7_

  - [ ]* 3.5 Write property test for Audit Log Immutability
    - **Property 20: Audit Log Immutability**
    - **Validates: Requirements 7.7, 13.7, 14.6, 16.7**
    - Test that audit log entries cannot be updated or deleted
    - Verify timestamps are monotonically increasing


- [ ] 4. Game Engine - Calculation Services
  - [ ] 4.1 Implement slippage calculation logic
    - Create `src/engine/pricing/slippage.ts` with `calculateSlippage(orderValue, startingCapital, direction)` function
    - Implement threshold detection (25% of starting capital)
    - Apply 5% penalty to excess amount for buy/sell orders
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ]* 4.2 Write property test for Slippage Threshold Classification
    - **Property 7: Slippage Threshold Classification**
    - **Validates: Requirements 8.1, 8.5**
    - Test that orders ≤25% capital have zero slippage
    - Test that orders >25% capital have correct slippage formula

  - [ ] 4.3 Implement portfolio valuation calculator
    - Create `src/engine/scoring/portfolio.ts` with `calculatePortfolioValue(teamId)` function
    - Compute market value for each holding (quantity × current_NAV)
    - Sum cash + all holdings market values
    - _Requirements: 11.4, 11.5_

  - [ ]* 4.4 Write property test for Portfolio Valuation Formula
    - **Property 10: Portfolio Valuation Formula**
    - **Validates: Requirements 11.4, 11.5**
    - Test that portfolio value = cash + Σ(quantity × NAV) for all holdings
    - Generate arbitrary portfolios and verify calculation

  - [ ] 4.5 Implement final score calculator with cash erosion
    - Create `src/engine/scoring/finalScore.ts` with `calculateFinalScore(teamId)` function
    - Apply 0.995^15 erosion to cash balance
    - Compute final portfolio value with eroded cash
    - _Requirements: 16.2, 16.3, 16.4_

  - [ ]* 4.6 Write property test for Final Score Cash Erosion
    - **Property 19: Final Score Cash Erosion**
    - **Validates: Requirements 16.2, 16.3, 16.4, 16.5, 16.6**
    - Test cash erosion formula: cash × (0.995^15)
    - Verify final portfolio value includes eroded cash + holdings


- [ ] 5. Game Engine - Order Validation Service
  - [ ] 5.1 Implement order validator
    - Create `src/engine/validation/orderValidator.ts` with `validateOrder(order, team)` function
    - Check game phase is TRADING_OPEN
    - Validate fund exists and is tradeable (not cash)
    - Validate quantity is positive
    - For buy orders: check sufficient cash (including worst-case slippage + brokerage)
    - For sell orders: check sufficient holdings
    - Return ValidationResult with descriptive error messages
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.2 Write property test for Order Validation - Sufficient Cash
    - **Property 8: Order Validation - Sufficient Cash**
    - **Validates: Requirements 6.4**
    - Test that buy orders require cash ≥ quantity × NAV × 1.002 × 1.05
    - Verify validation fails with insufficient cash

  - [ ]* 5.3 Write property test for Order Validation - Sufficient Holdings
    - **Property 9: Order Validation - Sufficient Holdings**
    - **Validates: Requirements 6.5**
    - Test that sell orders require holdings ≥ quantity
    - Verify validation fails with insufficient holdings

  - [ ]* 5.4 Write property test for Order Error Messages
    - **Property 21: Order Error Messages**
    - **Validates: Requirements 6.6, 30.1, 30.2**
    - Test that all validation failures return non-empty, human-readable error messages
    - Verify error messages contain specific reasons

- [ ] 6. Game Engine - Order Execution Service
  - [ ] 6.1 Implement order executor for buy orders
    - Create `src/engine/trading/orderExecutor.ts` with `executeBuyOrder(order)` function
    - Calculate effective NAV with slippage
    - Calculate gross cost = quantity × effective_NAV
    - Calculate brokerage fee = 0.002 × gross_cost
    - Deduct total cost from team cash
    - Increase team holdings by quantity
    - _Requirements: 7.2, 7.3, 8.2, 8.5, 9.1, 9.2, 9.5_

  
  - [ ]* 6.2 Write property test for Buy Order Execution Formula
    - **Property 5: Buy Order Execution Formula**
    - **Validates: Requirements 7.2, 7.3, 8.2, 8.5, 9.1, 9.2, 9.5**
    - Test complete buy order formula: effective_NAV, gross_cost, brokerage_fee, total_cost
    - Verify cash decreases by exactly total_cost
    - Verify holdings increase by exactly quantity

  - [ ] 6.3 Implement order executor for sell orders
    - Create `executeSellOrder(order)` function in `orderExecutor.ts`
    - Calculate effective NAV with slippage (downward adjustment)
    - Calculate gross proceeds = quantity × effective_NAV
    - Calculate brokerage fee = 0.002 × gross_proceeds
    - Add net proceeds to team cash
    - Decrease team holdings by quantity
    - _Requirements: 7.4, 7.5, 8.3, 8.5, 9.1, 9.3, 9.5_

  - [ ]* 6.4 Write property test for Sell Order Execution Formula
    - **Property 6: Sell Order Execution Formula**
    - **Validates: Requirements 7.4, 7.5, 8.3, 8.5, 9.1, 9.3, 9.5**
    - Test complete sell order formula: effective_NAV, gross_proceeds, brokerage_fee, net_proceeds
    - Verify cash increases by exactly net_proceeds
    - Verify holdings decrease by exactly quantity

  - [ ] 6.5 Implement batch order execution
    - Create `executeAllPendingOrders()` function in `orderExecutor.ts`
    - Fetch all pending orders for current round
    - Execute each order in database transaction
    - Revalidate holdings/cash at execution time (may have changed)
    - Mark orders as completed or failed with error messages
    - Record all executions in audit log
    - _Requirements: 7.1, 7.8, 8.4_

  - [ ]* 6.6 Write property test for Order Execution Completeness
    - **Property 12: Order Execution Completeness**
    - **Validates: Requirements 7.1, 7.8**
    - Test that all pending orders become either completed or failed
    - Verify no orders remain in pending state after execution


- [ ] 7. Game Engine - NAV Schedule Management
  - [ ] 7.1 Implement schedule validation
    - Create `src/engine/pricing/scheduleManager.ts` with `validateSchedule(csv)` function
    - Parse CSV and validate dimensions: 11 funds × 15 rounds = 165 entries
    - Validate all NAV values are positive
    - Validate no fund's cumulative change exceeds ±60% from initial NAV
    - Return ValidationResult with specific error details (fund, round, value)
    - _Requirements: 10.2, 10.3, 26.5, 26.6, 26.7_

  - [ ]* 7.2 Write property test for NAV Schedule Validation
    - **Property 13: NAV Schedule Validation**
    - **Validates: Requirements 10.2, 10.3**
    - Test that schedules must have exactly 165 entries
    - Test that all NAVs must be positive
    - Test that cumulative changes must be within ±60%

  - [ ] 7.3 Implement schedule encryption and storage
    - Create `encryptSchedule(schedule)` and `decryptSchedule(encrypted)` functions
    - Use AES-256-CBC encryption with environment variable `SCHEDULE_KEY`
    - Store encrypted schedule with locked=true constraint
    - _Requirements: 10.5, 10.6, 20.3_

  - [ ]* 7.4 Write property test for Schedule Immutability
    - **Property 15: Schedule Immutability**
    - **Validates: Requirements 10.6**
    - Test that locked schedules cannot be modified
    - Test that schedule data remains bit-for-bit identical

  - [ ] 7.5 Implement NAV update at round transitions
    - Create `updateNAVsForRound(round)` function in `scheduleManager.ts`
    - Decrypt schedule and read NAV values for specified round
    - Update all fund current_NAV values in funds table
    - Record NAV updates in audit log
    - _Requirements: 10.7, 10.8_

  - [ ]* 7.6 Write property test for NAV Constancy Within Round
    - **Property 14: NAV Constancy Within Round**
    - **Validates: Requirements 10.7, 10.8**
    - Test that NAVs remain constant throughout each round
    - Verify NAVs only change at round transitions


- [ ] 8. Game Engine - State Machine Service
  - [ ] 8.1 Implement phase transition logic
    - Create `src/engine/round/stateMachine.ts` with `checkAndTransition()` function
    - Check if current phase timer has expired (now > phase_start + phase_duration)
    - Acquire database row lock on game_state
    - Re-check expiry after lock acquired (prevent race conditions)
    - Determine next phase based on current state
    - Execute phase-specific operations (order execution, NAV updates, leaderboard)
    - Update game_state with new phase, round, and timestamps
    - Record phase transition in audit log
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 22.1, 22.2, 22.6, 22.7_

  - [ ]* 8.2 Write property test for Phase Transition Determinism
    - **Property 11: Phase Transition Determinism**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**
    - Test that expired phases always transition to correct next phase
    - Verify round increments correctly after RESULTS_DISPLAY
    - Test game completion at round 15

  - [ ] 8.3 Implement pause/resume functionality
    - Add `pauseGame()` and `resumeGame()` functions in `stateMachine.ts`
    - Store remaining time when paused
    - Resume from paused time when unpaused
    - Record admin actions in audit log
    - _Requirements: 17.6, 17.7, 17.8_

- [ ] 9. Game Engine - P2P Trade Execution
  - [ ] 9.1 Implement P2P trade executor
    - Create `src/engine/trading/p2pExecutor.ts` with `executeP2PTrade(trade)` function
    - Transfer fund quantity from seller to buyer
    - Transfer cash (quantity × agreed_price) from buyer to seller
    - Apply 0.2% brokerage fee (split between parties)
    - No slippage applied regardless of trade size
    - Revalidate holdings/cash at execution time
    - Mark trade as completed or failed with error message
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7_


  - [ ]* 9.2 Write property test for P2P Trade Execution Transfer
    - **Property 16: P2P Trade Execution Transfer**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.7**
    - Test correct fund and cash transfers between proposer and counterparty
    - Verify brokerage fee application (0.2%)
    - Verify no slippage is applied
    - Test both buy and sell directions

  - [ ]* 9.3 Write property test for P2P Re-validation at Execution
    - **Property 17: P2P Re-validation at Execution**
    - **Validates: Requirements 14.4, 14.5**
    - Test that trades fail if holdings/cash insufficient at execution time
    - Verify status updates correctly to failed with error message

  - [ ] 9.4 Implement batch P2P execution
    - Create `executeApprovedP2PTrades()` function in `p2pExecutor.ts`
    - Fetch all approved P2P trades for current round
    - Execute each trade in database transaction
    - Record all executions in audit log
    - _Requirements: 13.6, 14.6_

- [ ] 10. Game Engine - Leaderboard Service
  - [ ] 10.1 Implement leaderboard computation
    - Create `src/engine/scoring/leaderboard.ts` with `computeLeaderboard()` function
    - Calculate current portfolio value for all teams
    - Sort teams descending by portfolio value
    - Apply tie-breaking rule: timestamp of reaching value (earliest first)
    - Assign ranks (1-indexed, tied teams get same rank)
    - _Requirements: 15.1, 15.2, 15.4, 15.5, 15.6_

  - [ ]* 10.2 Write property test for Leaderboard Ordering
    - **Property 18: Leaderboard Ordering**
    - **Validates: Requirements 15.1, 15.4, 15.5, 15.6**
    - Test that teams are sorted descending by portfolio value
    - Test tie-breaking by timestamp
    - Verify rank calculation


- [ ] 11. Checkpoint - Core Engine Services Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. API Routes - Authentication Endpoints
  - [ ] 12.1 Implement POST /api/auth/login
    - Create `src/app/api/auth/login/route.ts`
    - Validate team_code and password against database
    - Generate JWT token with 4-hour expiry
    - Create session record in sessions table
    - Return token, team_id, team_name
    - Record login event in audit log
    - _Requirements: 1.3, 1.4, 28.1_

  - [ ] 12.2 Implement POST /api/auth/extend
    - Create `src/app/api/auth/extend/route.ts`
    - Validate existing token
    - Issue new token with extended expiry
    - Update session in database
    - _Requirements: 28.2_

  - [ ] 12.3 Implement POST /api/auth/logout
    - Create `src/app/api/auth/logout/route.ts`
    - Invalidate session in database (set is_active = false)
    - Record logout event in audit log
    - _Requirements: 28.3_

- [ ] 13. API Routes - Game State Endpoints
  - [ ] 13.1 Implement GET /api/game/state
    - Create `src/app/api/game/state/route.ts`
    - Authenticate request
    - Call `checkAndTransition()` to trigger lazy state machine
    - Return current round, phase, phase_start, phase_duration, time_remaining, is_paused
    - Implement ETag caching (return 304 if state unchanged)
    - Apply rate limiting
    - _Requirements: 4.8, 4.9, 4.10, 21.1, 22.1, 22.2_


  - [ ] 13.2 Implement GET /api/game/news
    - Create `src/app/api/game/news/route.ts`
    - Authenticate request
    - Fetch news content for specified round
    - Implement CDN caching (immutable per round)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 13.3 Implement GET /api/game/leaderboard
    - Create `src/app/api/game/leaderboard/route.ts`
    - Authenticate request
    - Call `computeLeaderboard()` to get ranked teams
    - Return sorted array with rank, team_id, team_name, portfolio_value
    - Apply rate limiting
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.7, 21.3_

- [ ] 14. API Routes - Order Management Endpoints
  - [ ] 14.1 Implement POST /api/order/submit
    - Create `src/app/api/order/submit/route.ts`
    - Authenticate request and extract team_id
    - Parse order submission (fund_id, type, quantity)
    - Call `validateOrder()` to check phase, holdings, cash
    - If valid: insert into pending_orders, return order_id and confirmation
    - If invalid: return error with descriptive message
    - Apply rate limiting (10 orders/min per team)
    - Record order submission in audit log
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 20.10_

  - [ ] 14.2 Implement GET /api/order/pending
    - Create `src/app/api/order/pending/route.ts`
    - Authenticate request
    - Fetch pending orders for authenticated team
    - Return array of orders with details
    - _Requirements: 27.1_

  - [ ] 14.3 Implement DELETE /api/order/cancel/:order_id
    - Create `src/app/api/order/cancel/[order_id]/route.ts`
    - Authenticate request and verify order ownership
    - Validate phase is TRADING_OPEN
    - Delete order from pending_orders
    - Record cancellation in audit log
    - _Requirements: 27.2, 27.3, 27.4_


  - [ ] 14.4 Implement PATCH /api/order/modify/:order_id
    - Create `src/app/api/order/modify/[order_id]/route.ts`
    - Authenticate request and verify order ownership
    - Validate phase is TRADING_OPEN
    - Revalidate order with new quantity
    - Update pending_orders or return validation error
    - _Requirements: 27.5, 27.6, 27.7_

- [ ] 15. API Routes - Portfolio Endpoints
  - [ ] 15.1 Implement GET /api/portfolio
    - Create `src/app/api/portfolio/route.ts`
    - Authenticate request
    - Fetch team cash balance and holdings from database
    - Compute market value for each holding (quantity × current_NAV)
    - Compute total portfolio value
    - Implement ETag caching
    - Apply rate limiting
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 21.2_

  - [ ] 15.2 Implement GET /api/portfolio/history
    - Create `src/app/api/portfolio/history/route.ts`
    - Authenticate request
    - Query executed_orders and compute portfolio value at each round
    - Return time-series array for charting
    - _Requirements: 11.7_

- [ ] 16. API Routes - P2P Trading Endpoints
  - [ ] 16.1 Implement POST /api/p2p/propose
    - Create `src/app/api/p2p/propose/route.ts`
    - Authenticate request
    - Validate phase is TRADING_OPEN
    - Parse P2P proposal (counterparty_team_id, fund_id, quantity, price_per_unit, direction)
    - Validate proposer has sufficient holdings/cash
    - Create p2p_trades record with status 'awaiting_approval'
    - Apply rate limiting (5 P2P/min per team)
    - Record proposal in audit log
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 20.10_


  - [ ] 16.2 Implement GET /api/p2p/status/:trade_id
    - Create `src/app/api/p2p/status/[trade_id]/route.ts`
    - Authenticate request
    - Fetch trade status, approved_by, approved_at
    - Return trade details
    - _Requirements: 13.5_

  - [ ]* 16.3 Write property test for P2P Approval Authorization
    - **Property 22: P2P Approval Authorization**
    - **Validates: Requirements 12.6, 13.3, 13.4**
    - Test that only admin-approved P2P trades can execute
    - Verify status transitions from awaiting_approval → approved → completed

- [ ] 17. API Routes - Admin Endpoints
  - [ ] 17.1 Implement GET /api/admin/teams
    - Create `src/app/api/admin/teams/route.ts`
    - Authenticate admin token
    - Fetch all 80 teams with portfolio values, ranks, pending orders count
    - Flag teams with error states
    - Apply rate limiting
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 21.4_

  - [ ] 17.2 Implement POST /api/admin/round/advance
    - Create `src/app/api/admin/round/advance/route.ts`
    - Authenticate admin token
    - Force immediate phase transition
    - Record admin action in audit log with admin identifier
    - _Requirements: 17.2, 17.5, 17.8_

  - [ ] 17.3 Implement POST /api/admin/round/pause and /api/admin/round/resume
    - Create `src/app/api/admin/round/pause/route.ts` and `resume/route.ts`
    - Authenticate admin token
    - Call `pauseGame()` or `resumeGame()` in state machine
    - Record admin action in audit log
    - _Requirements: 17.3, 17.4, 17.6, 17.7, 17.8_


  - [ ] 17.4 Implement POST /api/admin/schedule/upload
    - Create `src/app/api/admin/schedule/upload/route.ts`
    - Authenticate admin token
    - Parse uploaded CSV file (multipart/form-data)
    - Call `validateSchedule(csv)` to check format and constraints
    - If valid: encrypt and store schedule with locked=true
    - If invalid: return validation errors with specific row/column details
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 26.1, 26.2, 26.3, 26.4, 26.7, 26.8_

  - [ ] 17.5 Implement GET /api/admin/p2p/pending
    - Create `src/app/api/admin/p2p/pending/route.ts`
    - Authenticate admin token
    - Fetch all P2P trades with status 'awaiting_approval'
    - Return array with proposer, counterparty, fund, quantity, price, created_at
    - _Requirements: 13.1, 13.2_

  - [ ] 17.6 Implement POST /api/admin/p2p/approve/:trade_id and /reject/:trade_id
    - Create `src/app/api/admin/p2p/approve/[trade_id]/route.ts` and `reject/[trade_id]/route.ts`
    - Authenticate admin token
    - Update p2p_trades status to 'approved' or 'rejected'
    - Record admin action in audit log with admin username
    - _Requirements: 13.3, 13.4, 13.7_

  - [ ] 17.7 Implement POST /api/admin/dispute/adjust
    - Create `src/app/api/admin/dispute/adjust/route.ts`
    - Authenticate admin token
    - Parse adjustment request (team_id, adjustment_type, fund_id?, amount, justification)
    - Validate no negative balances created
    - Apply adjustment to team portfolio
    - Record in audit log with admin identifier and justification
    - _Requirements: 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ] 17.8 Implement GET /api/admin/audit
    - Create `src/app/api/admin/audit/route.ts`
    - Authenticate admin token
    - Parse query filters (team_id, from, to, event_type)
    - Fetch audit log entries with pagination (100 per page)
    - Return filterable, sortable audit log
    - _Requirements: 18.8_


- [ ] 18. Checkpoint - API Routes Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Team Trading App - Core Components
  - [ ] 19.1 Create polling hook for game state
    - Create `src/hooks/useGameState.ts` with React hook
    - Poll `/api/game/state` every 2-3s with jitter
    - Store game state in React Context
    - Handle loading, error, and success states
    - _Requirements: 4.9, 21.1_

  - [ ] 19.2 Create GameClock component
    - Create `src/components/shared/GameClock.tsx`
    - Display current round number, phase name, countdown timer
    - Subscribe to game state context
    - Format time remaining as MM:SS
    - _Requirements: 4.8_

  - [ ] 19.3 Create NewsFeed component
    - Create `src/components/shared/NewsFeed.tsx`
    - Fetch news content for current round from `/api/game/news`
    - Display news during all phases of the round
    - Cache news content per round
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [ ] 19.4 Create polling hook for portfolio
    - Create `src/hooks/usePortfolio.ts` with React hook
    - Poll `/api/portfolio` every 2-3s during TRADING_OPEN phase only
    - Use TanStack Query for caching and state management
    - Handle optimistic updates for order submissions
    - _Requirements: 11.6, 11.7, 21.2_

  - [ ] 19.5 Create PortfolioSummary component
    - Create `src/components/shared/PortfolioSummary.tsx`
    - Display cash balance, holdings list, market values, total portfolio value
    - Subscribe to portfolio hook
    - Format currency as ₹X.XX Cr
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_


  - [ ] 19.6 Create OrderForm component
    - Create `src/components/trading/OrderForm.tsx`
    - Fund selector dropdown, quantity input, buy/sell toggle
    - Client-side validation (positive quantity, fund not cash)
    - Submit to `/api/order/submit` with optimistic UI update
    - Display error messages from server validation
    - Disable during non-TRADING_OPEN phases
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [ ] 19.7 Create pending orders list component
    - Create `src/components/trading/PendingOrders.tsx`
    - Fetch from `/api/order/pending`
    - Display order details with cancel and modify buttons
    - Call DELETE `/api/order/cancel/:id` or PATCH `/api/order/modify/:id`
    - Only enable during TRADING_OPEN phase
    - _Requirements: 27.1, 27.2, 27.5_

  - [ ] 19.8 Create LeaderboardTable component
    - Create `src/components/leaderboard/LeaderboardTable.tsx`
    - Poll `/api/game/leaderboard` every 5s
    - Display sortable table with rank, team name, portfolio value
    - Highlight authenticated team's row
    - _Requirements: 15.2, 15.7, 21.3_

  - [ ] 19.9 Create P2PProposal component
    - Create `src/components/p2p/P2PProposal.tsx`
    - Form for counterparty selection, fund, quantity, price, direction
    - Submit to `/api/p2p/propose`
    - Display proposal status from `/api/p2p/status/:id`
    - Only enable during TRADING_OPEN phase
    - _Requirements: 12.1, 12.2, 13.5_

- [ ] 20. Team Trading App - Pages
  - [ ] 20.1 Create login page
    - Create `src/app/login/page.tsx`
    - Team code and password input form
    - Submit to `/api/auth/login`
    - Store token in localStorage/cookies
    - Redirect to dashboard on success
    - _Requirements: 1.3, 1.4_


  - [ ] 20.2 Create dashboard page
    - Create `src/app/dashboard/page.tsx`
    - Display GameClock, NewsFeed, PortfolioSummary components
    - Protected route (redirect to login if no token)
    - _Requirements: 4.8, 5.2, 11.1_

  - [ ] 20.3 Create trading page
    - Create `src/app/trade/page.tsx`
    - Display OrderForm and PendingOrders components
    - Protected route
    - _Requirements: 6.1, 6.2, 27.1_

  - [ ] 20.4 Create portfolio detail page
    - Create `src/app/portfolio/page.tsx`
    - Display detailed holdings breakdown with fund names
    - Display portfolio history chart
    - Protected route
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 20.5 Create leaderboard page
    - Create `src/app/leaderboard/page.tsx`
    - Display LeaderboardTable component
    - Protected route
    - _Requirements: 15.2, 15.7_

  - [ ] 20.6 Create P2P trading page
    - Create `src/app/p2p/page.tsx`
    - Display P2PProposal component and pending trades list
    - Protected route
    - _Requirements: 12.1, 12.2_

- [ ] 21. Admin Console - Core Components
  - [ ] 21.1 Create TeamGrid component
    - Create `src/components/admin/TeamGrid.tsx`
    - Poll `/api/admin/teams` every 2-3s
    - Display 80 teams in grid layout with portfolio values, ranks, pending orders
    - Highlight teams with error states or failed orders
    - Click team to drill down into details
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 21.4_


  - [ ] 21.2 Create RoundControls component
    - Create `src/components/admin/RoundControls.tsx`
    - Display current round, phase, timer
    - Buttons for advance, pause, resume
    - Call `/api/admin/round/advance`, `/pause`, `/resume`
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ] 21.3 Create ScheduleUploader component
    - Create `src/components/admin/ScheduleUploader.tsx`
    - File input for CSV upload
    - Submit to `/api/admin/schedule/upload`
    - Display validation errors with specific row/column details
    - Show confirmation on success
    - _Requirements: 10.1, 10.4, 26.7, 26.8_

  - [ ] 21.4 Create P2PQueue component
    - Create `src/components/admin/P2PQueue.tsx`
    - Fetch from `/api/admin/p2p/pending`
    - Display pending trades with approve/reject buttons
    - Call `/api/admin/p2p/approve/:id` or `/reject/:id`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 21.5 Create DisputeForm component
    - Create `src/components/admin/DisputeForm.tsx`
    - Form for team selection, adjustment type, fund, amount, justification
    - Submit to `/api/admin/dispute/adjust`
    - Display validation errors
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [ ] 21.6 Create AuditViewer component
    - Create `src/components/admin/AuditViewer.tsx`
    - Fetch from `/api/admin/audit` with filter controls
    - Display paginated, filterable, sortable audit log
    - Export to CSV functionality
    - _Requirements: 18.8_

- [ ] 22. Admin Console - Pages
  - [ ] 22.1 Create admin login page
    - Create `src/app/admin/login/page.tsx`
    - Admin username and password form
    - Separate admin authentication flow
    - Store admin token
    - _Requirements: Admin access control_


  - [ ] 22.2 Create admin dashboard page
    - Create `src/app/admin/dashboard/page.tsx`
    - Display TeamGrid component
    - Protected admin route
    - _Requirements: 18.1_

  - [ ] 22.3 Create admin control page
    - Create `src/app/admin/control/page.tsx`
    - Display RoundControls component
    - Protected admin route
    - _Requirements: 17.1_

  - [ ] 22.4 Create admin schedule page
    - Create `src/app/admin/schedule/page.tsx`
    - Display ScheduleUploader component
    - Protected admin route
    - _Requirements: 10.1_

  - [ ] 22.5 Create admin P2P page
    - Create `src/app/admin/p2p/page.tsx`
    - Display P2PQueue component
    - Protected admin route
    - _Requirements: 13.1_

  - [ ] 22.6 Create admin disputes page
    - Create `src/app/admin/disputes/page.tsx`
    - Display DisputeForm component
    - Protected admin route
    - _Requirements: 19.1_

  - [ ] 22.7 Create admin audit page
    - Create `src/app/admin/audit/page.tsx`
    - Display AuditViewer component
    - Protected admin route
    - _Requirements: 18.8_

  - [ ] 22.8 Create admin team detail page
    - Create `src/app/admin/teams/[team_id]/page.tsx`
    - Display complete team portfolio, order history, audit log entries
    - Protected admin route
    - _Requirements: 18.7, 18.8_


- [ ] 23. Checkpoint - Frontend Components Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. Error Handling and Resilience
  - [ ] 24.1 Implement centralized error handling
    - Create `src/lib/errors.ts` with error classes: ValidationError, AuthenticationError, AuthorizationError, RateLimitError, ServerError
    - Implement API error response format with code, message, details
    - Create error handling middleware for API routes
    - _Requirements: Error handling requirements_

  - [ ] 24.2 Implement client-side error boundaries
    - Create error boundary components for Team App and Admin Console
    - Display user-friendly error messages
    - Implement retry logic for network failures
    - _Requirements: Error handling requirements_

  - [ ] 24.3 Implement optimistic UI with rollback
    - Add optimistic updates for order submissions in Team Trading App
    - Rollback UI state if server returns error
    - Display toast notifications for success/failure
    - _Requirements: 6.7_

- [ ] 25. Performance Optimization
  - [ ] 25.1 Implement response caching with ETags
    - Add ETag generation for `/api/game/state` and `/api/portfolio`
    - Return HTTP 304 when content unchanged
    - Configure cache headers for static content
    - _Requirements: 21.5, 21.6_

  - [ ] 25.2 Implement request batching
    - Batch database queries where possible (e.g., leaderboard computation)
    - Use database transactions for multi-record updates
    - _Requirements: 24.3, 25.4_


  - [ ] 25.3 Implement CDN caching for static assets
    - Configure Next.js static asset optimization
    - Cache fund names, constants, news content at CDN edge
    - _Requirements: 24.4_

  - [ ] 25.4 Add database indexes
    - Create indexes on frequently queried columns (already in schema)
    - Verify index usage with EXPLAIN ANALYZE
    - _Requirements: Performance requirements_

- [ ] 26. Data Persistence and Recovery
  - [ ] 26.1 Implement database transaction wrappers
    - Create transaction helper functions in `src/lib/db.ts`
    - Ensure all multi-record updates use transactions
    - Implement retry logic with exponential backoff
    - _Requirements: 25.4, 25.5, 25.6_

  - [ ] 26.2 Implement game state persistence
    - Ensure game_state updates are atomic and durable
    - Implement database backup automation scripts
    - _Requirements: 25.1, 25.2, 25.8_

  - [ ] 26.3 Implement audit log export
    - Create script to export audit log to CSV
    - Schedule weekly exports
    - _Requirements: 25.8_

- [ ] 27. Integration Testing
  - [ ]* 27.1 Write integration test for order lifecycle
    - Test full cycle: submit → execute → portfolio update → audit log
    - Verify cash and holdings changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

  - [ ]* 27.2 Write integration test for P2P trade flow
    - Test: propose → admin approve → execute → both portfolios update
    - Verify transfers and audit log
    - _Requirements: 12.1, 13.3, 14.1, 14.2, 14.6_


  - [ ]* 27.3 Write integration test for round transition
    - Test: phase expiry → state machine trigger → NAV update → order execution
    - Verify phase progression and data updates
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 10.7, 10.8_

  - [ ]* 27.4 Write integration test for concurrent order submission
    - Simulate 80 teams submitting orders simultaneously
    - Verify no race conditions or data corruption
    - _Requirements: 23.5, 22.6_

  - [ ]* 27.5 Write integration test for session management
    - Test: login → extend → timeout → logout
    - Verify session states and token validation
    - _Requirements: 1.3, 28.1, 28.2, 28.3_

- [ ] 28. Deployment Configuration
  - [ ] 28.1 Configure environment variables
    - Set up `.env.local` template with all required variables
    - Document DATABASE_URL, JWT_SECRET, SCHEDULE_KEY, etc.
    - Configure environment-specific values for dev/staging/prod
    - _Requirements: Deployment requirements_

  - [ ] 28.2 Create Vercel configuration
    - Create `vercel.json` with framework config, regions (bom1), function settings
    - Configure max duration (10s), memory (1024MB) for API routes
    - Set cache headers for API responses
    - _Requirements: 24.1, 24.2_

  - [ ] 28.3 Create database migration scripts
    - Organize migrations in numbered files (001_create_tables.sql, etc.)
    - Create up/down migration scripts
    - Document migration order and dependencies
    - _Requirements: Database setup_


  - [ ] 28.4 Create Supabase setup scripts
    - Document Supabase project initialization
    - Create scripts to apply migrations, enable RLS, create indexes
    - Configure connection pooling settings
    - _Requirements: Database setup_

  - [ ] 28.5 Set up monitoring and logging
    - Configure Sentry for error tracking
    - Add performance monitoring transactions
    - Set up alerting for P95 latency, error rates, connection pool exhaustion
    - _Requirements: Monitoring requirements_

- [ ] 29. End-to-End Testing
  - [ ]* 29.1 Write E2E test for complete trading cycle (Playwright)
    - Test: login → view portfolio → submit buy order → wait for execution → verify portfolio updated
    - Run against deployed environment
    - _Requirements: Complete user flow_

  - [ ]* 29.2 Write E2E test for admin schedule upload and game control
    - Test: admin login → upload schedule → start game → advance phases manually → verify team states
    - _Requirements: Admin workflow_

  - [ ]* 29.3 Write E2E test for P2P trade approval
    - Test: team proposes P2P → admin approves → verify both portfolios updated
    - _Requirements: P2P workflow_

  - [ ]* 29.4 Write E2E test for concurrent team trading
    - Test: multiple teams trading simultaneously → verify leaderboard updates correctly
    - _Requirements: Concurrency requirements_

- [ ] 30. Final Verification and Documentation
  - [ ] 30.1 Verify all correctness properties
    - Run all 23 property-based tests
    - Verify test coverage for all critical paths
    - _Requirements: All properties_

## Notes

- **Property-Based Testing (PBT):** Tasks marked with `*` include property-based test specifications. These tests use fast-check to generate arbitrary inputs and verify correctness properties hold across the entire input space.
  
- **Correctness Properties:** All 23 properties from the design document are woven into specific tasks where they apply. Tasks are ordered to ensure foundations are in place before dependent tasks run.

- **Cost Constraints:** Throughout implementation, prioritize staying within Vercel Hobby (100 GB/month bandwidth) and Supabase Free tier (500 MB storage, 2 GB bandwidth/month) limits. Use caching, compression, and request batching strategically.

- **Testing Strategy:** Each major component section has property-based tests (marked with `*`). Integration tests (Task 27) verify components work together. E2E tests (Task 29) verify complete user flows.

- **Performance Targets:**
  - Order confirmation: P95 < 1 second
  - Phase reflection: P95 < 3 seconds for 95% of users
  - Order execution batch: < 30 seconds for 80 teams
  - Full portfolio valuation: < 5 seconds for all teams
  - Support 400 concurrent sessions

- **Admin Credentials:** Separate authentication for admin console. Create admin users during database seeding with dedicated admin table if needed.

- **Session Timeout:** 4 hours of inactivity before session expires. Implement background cleanup of expired sessions.

- **Error Recovery:** All API endpoints should return detailed error messages with error codes for client-side handling and user display.
