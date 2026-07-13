# Requirements Document

## Introduction

Market Mayhem is a live, timed, 15-round financial market simulation platform designed to support up to 80 teams with 5 members each (400 concurrent participants). The platform enables teams to trade in a simulated market environment with real-time portfolio management, dynamic pricing, and comprehensive administrative controls. The system consists of three primary surfaces: a Team Trading Application for participants, an Admin Console for game management, and a Game Engine backend serving as the single source of truth for all market data and computations.

The platform is architected for zero operational cost using Vercel Hobby tier and Supabase Free tier, employing HTTP polling instead of websockets, and implementing a lazy state machine pattern for round management. All critical computations are server-side with tamper-proof security measures.

## Glossary

- **Platform**: The complete Market Mayhem system including all three surfaces
- **Team_Trading_App**: The web application used by participants to view news, place orders, and monitor portfolios
- **Admin_Console**: The web application used by administrators to manage games, control rounds, and resolve disputes
- **Game_Engine**: The backend service responsible for NAV computation, order execution, and state management
- **Team**: A group of up to 5 participants sharing a single trading account
- **Participant**: An individual user who is a member of a Team
- **Round**: A single 9-minute game cycle consisting of four phases
- **NAV**: Net Asset Value - the price of a fund at a specific point in time
- **Fund**: A tradeable financial instrument (11 investable funds plus Cash)
- **Cash**: The non-investable 12th fund representing liquid capital
- **Portfolio**: A Team's complete holdings across all Funds and Cash
- **Order**: A buy or sell instruction for a specific Fund and quantity
- **P2P_Trade**: A peer-to-peer transaction between two Teams for a specific Fund
- **Schedule**: The sealed 15-round pricing data for all Funds
- **Slippage**: The price impact penalty applied to large orders
- **Brokerage_Fee**: A 0.2% transaction cost applied to all trades
- **Game_State**: The current phase and round number of the active game
- **Round_Phase**: One of four states: NEWS_REVEAL, TRADING_OPEN, ORDER_LOCK, or RESULTS_DISPLAY
- **Starting_Capital**: ₹100 Crores (1 billion rupees) allocated to each Team at game start
- **Audit_Log**: Immutable record of all state changes and transactions
- **Dispute**: An administrative issue requiring manual resolution
- **Leaderboard**: Ranked display of Team performance by portfolio value
- **Session**: An authenticated connection between a Participant and the Platform

## Requirements

### Requirement 1: Team Structure and Authentication

**User Story:** As a participant, I want to log in to my team's shared trading account, so that I can collaborate with my teammates on trading decisions.

#### Acceptance Criteria

1. THE Platform SHALL support exactly 80 Teams
2. THE Platform SHALL support exactly 5 Participants per Team
3. WHEN a Participant provides valid credentials, THE Platform SHALL authenticate the Participant and grant access to their Team account
4. WHEN a Participant logs in, THE Platform SHALL display the Team identifier and current Session status
5. THE Platform SHALL allow multiple Participants from the same Team to access the Team account concurrently
6. WHEN multiple Participants from the same Team are logged in, THE Platform SHALL display the same Portfolio state to all Participants
7. THE Authentication_Service SHALL enforce unique credentials per Participant
8. THE Authentication_Service SHALL maintain Session state for each authenticated Participant

### Requirement 2: Starting Capital Allocation

**User Story:** As a game administrator, I want each team to start with ₹100 Crores in cash, so that all teams begin with equal capital.

#### Acceptance Criteria

1. WHEN a new game is initialized, THE Game_Engine SHALL allocate ₹100 Crores to each Team's Cash balance
2. THE Game_Engine SHALL set all Fund holdings to zero for each Team at game initialization
3. THE Game_Engine SHALL record the initial capital allocation in the Audit_Log
4. THE Platform SHALL verify that total allocated capital equals ₹8,000 Crores across all 80 Teams

### Requirement 3: Fund Structure and Tradeable Instruments

**User Story:** As a participant, I want to trade across multiple funds, so that I can diversify my portfolio.

#### Acceptance Criteria

1. THE Platform SHALL support exactly 12 Funds
2. THE Platform SHALL designate exactly 11 Funds as investable instruments
3. THE Platform SHALL designate exactly 1 Fund as Cash (non-investable)
4. THE Platform SHALL assign a unique identifier to each Fund
5. WHEN displaying Funds, THE Team_Trading_App SHALL show Fund names and current NAV values
6. THE Game_Engine SHALL maintain NAV history for all Funds across all Rounds

### Requirement 4: Round Structure and Timing

**User Story:** As a participant, I want clear visibility into round timing and phases, so that I know when I can trade.

#### Acceptance Criteria

1. THE Platform SHALL execute exactly 15 Rounds per game
2. THE Platform SHALL execute each Round in exactly 540 seconds (9 minutes)
3. WHEN a Round begins, THE Game_Engine SHALL transition to NEWS_REVEAL phase for 60 seconds
4. WHEN NEWS_REVEAL phase completes, THE Game_Engine SHALL transition to TRADING_OPEN phase for 300 seconds
5. WHEN TRADING_OPEN phase completes, THE Game_Engine SHALL transition to ORDER_LOCK phase for 120 seconds
6. WHEN ORDER_LOCK phase completes, THE Game_Engine SHALL transition to RESULTS_DISPLAY phase for 60 seconds
7. WHEN RESULTS_DISPLAY phase completes, THE Game_Engine SHALL transition to NEWS_REVEAL phase of the next Round
8. THE Team_Trading_App SHALL display the current Round_Phase and remaining time in seconds
9. THE Team_Trading_App SHALL poll the Game_State every 2 to 3 seconds
10. WHEN the Round_Phase changes, THE Team_Trading_App SHALL update the displayed phase within 3 seconds

### Requirement 5: News Feed Distribution

**User Story:** As a participant, I want to see market news at the start of each round, so that I can make informed trading decisions.

#### Acceptance Criteria

1. WHEN the Game_Engine transitions to NEWS_REVEAL phase, THE Game_Engine SHALL publish news content for the current Round
2. THE Team_Trading_App SHALL display the news content during NEWS_REVEAL phase
3. THE Team_Trading_App SHALL display the news content during TRADING_OPEN phase
4. THE Team_Trading_App SHALL display the news content during ORDER_LOCK phase
5. THE Team_Trading_App SHALL display the news content during RESULTS_DISPLAY phase
6. THE Admin_Console SHALL allow administrators to associate news content with specific Round numbers during Schedule upload

### Requirement 6: Order Entry and Validation

**User Story:** As a participant, I want to place buy and sell orders during trading windows, so that I can adjust my portfolio.

#### Acceptance Criteria

1. WHEN the Game_State is TRADING_OPEN, THE Team_Trading_App SHALL enable Order entry
2. WHEN the Game_State is not TRADING_OPEN, THE Team_Trading_App SHALL disable Order entry
3. WHEN a Participant submits an Order, THE Team_Trading_App SHALL require a Fund identifier, transaction type (buy or sell), and quantity
4. WHEN a Participant submits a buy Order, THE Game_Engine SHALL verify that the Team has sufficient Cash to complete the transaction including Brokerage_Fee and potential Slippage
5. WHEN a Participant submits a sell Order, THE Game_Engine SHALL verify that the Team holds sufficient quantity of the specified Fund
6. WHEN an Order fails validation, THE Game_Engine SHALL return a descriptive error message
7. WHEN an Order passes validation, THE Game_Engine SHALL accept the Order and return a confirmation
8. THE Game_Engine SHALL complete Order validation and return a response within 1 second

### Requirement 7: Order Execution and Settlement

**User Story:** As a participant, I want my validated orders to execute reliably, so that my portfolio reflects my trading decisions.

#### Acceptance Criteria

1. WHEN the Game_Engine transitions from TRADING_OPEN to ORDER_LOCK phase, THE Game_Engine SHALL execute all pending Orders
2. WHEN executing a buy Order, THE Game_Engine SHALL deduct Cash equal to (quantity × NAV × 1.002) representing cost plus Brokerage_Fee
3. WHEN executing a buy Order, THE Game_Engine SHALL increase the Team's holdings of the specified Fund by the Order quantity
4. WHEN executing a sell Order, THE Game_Engine SHALL increase Cash equal to (quantity × NAV × 0.998) representing proceeds minus Brokerage_Fee
5. WHEN executing a sell Order, THE Game_Engine SHALL decrease the Team's holdings of the specified Fund by the Order quantity
6. THE Game_Engine SHALL apply Slippage penalty when an Order exceeds 25% of the Team's total capital
7. THE Game_Engine SHALL record each executed Order in the Audit_Log with timestamp, Team identifier, Fund identifier, quantity, NAV, and fees
8. WHEN all Orders are executed, THE Game_Engine SHALL update the Game_State to reflect completion of Order processing

### Requirement 8: Slippage Calculation and Application

**User Story:** As a game designer, I want to penalize large orders with slippage, so that teams cannot manipulate the market with oversized trades.

#### Acceptance Criteria

1. WHEN an Order value exceeds 25% of the Team's Starting_Capital, THE Game_Engine SHALL classify the Order as subject to Slippage
2. WHEN calculating Slippage for a buy Order, THE Game_Engine SHALL increase the effective NAV by 5% of the amount exceeding the 25% threshold
3. WHEN calculating Slippage for a sell Order, THE Game_Engine SHALL decrease the effective NAV by 5% of the amount exceeding the 25% threshold
4. WHEN executing an Order with Slippage, THE Game_Engine SHALL record the base NAV, Slippage amount, and effective NAV in the Audit_Log
5. THE Game_Engine SHALL compute Slippage based on the Order value at the current NAV before Slippage adjustment

### Requirement 9: Brokerage Fee Calculation

**User Story:** As a game designer, I want to charge realistic brokerage fees, so that the simulation reflects real market costs.

#### Acceptance Criteria

1. WHEN executing any Order, THE Game_Engine SHALL apply a Brokerage_Fee of 0.2% of the transaction value
2. WHEN executing a buy Order, THE Game_Engine SHALL deduct the Brokerage_Fee from the Team's Cash balance
3. WHEN executing a sell Order, THE Game_Engine SHALL deduct the Brokerage_Fee from the transaction proceeds before adding to Cash
4. THE Game_Engine SHALL record the Brokerage_Fee amount in the Audit_Log for each executed Order
5. THE Game_Engine SHALL compute Brokerage_Fee after applying any Slippage adjustments

### Requirement 10: NAV Pricing and Schedule Management

**User Story:** As a game administrator, I want to upload a sealed pricing schedule, so that NAV values change predictably across rounds without manual intervention.

#### Acceptance Criteria

1. THE Admin_Console SHALL accept a Schedule file containing NAV values for all 11 investable Funds across all 15 Rounds
2. WHEN the Admin_Console receives a Schedule file, THE Game_Engine SHALL validate that the file contains exactly 165 NAV entries (11 Funds × 15 Rounds)
3. WHEN the Game_Engine validates a Schedule, THE Game_Engine SHALL verify that no NAV change exceeds ±60% cumulatively from the initial value
4. WHEN Schedule validation fails, THE Admin_Console SHALL display a descriptive error message
5. WHEN Schedule validation succeeds, THE Game_Engine SHALL encrypt and store the Schedule
6. THE Game_Engine SHALL prevent any modification to the Schedule after encryption
7. WHEN the Game_Engine transitions to a new Round, THE Game_Engine SHALL update all Fund NAV values according to the Schedule for that Round
8. THE Game_Engine SHALL maintain NAV values unchanged throughout each Round until the next Round begins

### Requirement 11: Portfolio Valuation and Display

**User Story:** As a participant, I want to see my current portfolio value in real-time, so that I can track my team's performance.

#### Acceptance Criteria

1. THE Team_Trading_App SHALL display the Team's current Cash balance
2. THE Team_Trading_App SHALL display the Team's holdings for each Fund with non-zero quantity
3. THE Team_Trading_App SHALL display the current NAV for each Fund
4. THE Team_Trading_App SHALL compute and display the market value of each Fund holding as (quantity × NAV)
5. THE Team_Trading_App SHALL compute and display total Portfolio value as Cash plus sum of all Fund market values
6. THE Team_Trading_App SHALL update Portfolio display within 3 seconds when NAV values change
7. THE Team_Trading_App SHALL poll Portfolio state every 2 to 3 seconds during TRADING_OPEN phase

### Requirement 12: P2P Trading Initiation

**User Story:** As a participant, I want to propose peer-to-peer trades with other teams, so that I can acquire specific funds at negotiated prices.

#### Acceptance Criteria

1. WHEN the Game_State is TRADING_OPEN, THE Team_Trading_App SHALL enable P2P_Trade proposal creation
2. WHEN creating a P2P_Trade proposal, THE Team_Trading_App SHALL require counterparty Team identifier, Fund identifier, quantity, and proposed price
3. WHEN a Participant submits a P2P_Trade proposal, THE Game_Engine SHALL validate that the proposing Team has sufficient holdings (for sell) or Cash (for buy)
4. WHEN a P2P_Trade proposal passes validation, THE Game_Engine SHALL create a pending P2P_Trade record with status "awaiting_approval"
5. WHEN a P2P_Trade proposal is created, THE Game_Engine SHALL notify the Admin_Console
6. THE Game_Engine SHALL prevent execution of P2P_Trade proposals without admin approval

### Requirement 13: P2P Trading Admin Approval

**User Story:** As a game administrator, I want to review and approve peer-to-peer trades, so that I can prevent collusion and ensure fair trading.

#### Acceptance Criteria

1. THE Admin_Console SHALL display all pending P2P_Trade proposals with status "awaiting_approval"
2. THE Admin_Console SHALL display P2P_Trade details including both Team identifiers, Fund identifier, quantity, and proposed price
3. WHEN an administrator approves a P2P_Trade, THE Admin_Console SHALL update the P2P_Trade status to "approved"
4. WHEN an administrator rejects a P2P_Trade, THE Admin_Console SHALL update the P2P_Trade status to "rejected"
5. WHEN a P2P_Trade status changes, THE Game_Engine SHALL notify both involved Teams
6. THE Game_Engine SHALL execute approved P2P_Trades during the next ORDER_LOCK phase
7. THE Game_Engine SHALL record P2P_Trade approval actions in the Audit_Log with administrator identifier and timestamp

### Requirement 14: P2P Trading Execution

**User Story:** As a participant, I want approved P2P trades to execute reliably, so that my negotiated transactions complete as agreed.

#### Acceptance Criteria

1. WHEN executing an approved P2P_Trade, THE Game_Engine SHALL transfer the specified quantity of the Fund from the seller Team to the buyer Team
2. WHEN executing an approved P2P_Trade, THE Game_Engine SHALL transfer Cash equal to (quantity × agreed_price) from the buyer Team to the seller Team
3. WHEN executing an approved P2P_Trade, THE Game_Engine SHALL apply Brokerage_Fee of 0.2% to the transaction value
4. WHEN executing an approved P2P_Trade, THE Game_Engine SHALL verify that both Teams still have sufficient holdings and Cash at execution time
5. WHEN a P2P_Trade fails execution validation, THE Game_Engine SHALL update the status to "failed" and record the reason in the Audit_Log
6. WHEN a P2P_Trade completes successfully, THE Game_Engine SHALL update the status to "completed" and record all transfer details in the Audit_Log
7. THE Game_Engine SHALL exclude P2P_Trade pricing from Slippage calculations

### Requirement 15: Leaderboard Computation and Display

**User Story:** As a participant, I want to see how my team ranks against others, so that I can gauge my performance.

#### Acceptance Criteria

1. THE Platform SHALL compute Team rankings based on total Portfolio value
2. THE Team_Trading_App SHALL display the Leaderboard showing Team identifiers and Portfolio values
3. THE Admin_Console SHALL display the Leaderboard showing Team identifiers and Portfolio values
4. THE Platform SHALL update Leaderboard rankings after each Round when NAV values change
5. THE Platform SHALL display the Leaderboard sorted in descending order by Portfolio value
6. WHEN two or more Teams have identical Portfolio values, THE Platform SHALL apply tie-breaking rules based on timestamp of reaching that value
7. THE Platform SHALL display the requesting Team's rank and Portfolio value prominently in the Leaderboard view

### Requirement 16: Final Scoring with Cash Erosion

**User Story:** As a game designer, I want to penalize teams holding excessive cash at game end, so that teams are incentivized to invest actively.

#### Acceptance Criteria

1. WHEN Round 15 completes, THE Game_Engine SHALL compute final scores for all Teams
2. WHEN computing final scores, THE Game_Engine SHALL apply cash erosion of 0.5% per Round to each Team's Cash balance
3. THE Game_Engine SHALL compute eroded Cash as (Cash_balance × (0.995^15))
4. THE Game_Engine SHALL compute final Portfolio value as (eroded_Cash + sum_of_all_Fund_market_values)
5. THE Game_Engine SHALL rank all Teams by final Portfolio value
6. WHEN multiple Teams have identical final Portfolio values, THE Game_Engine SHALL apply tie-breaking rules prioritizing the Team that reached that value earliest
7. THE Game_Engine SHALL record final scores and rankings in the Audit_Log
8. THE Platform SHALL display final scores on the Leaderboard after Round 15 completes

### Requirement 17: Admin Round Control

**User Story:** As a game administrator, I want manual control over round progression, so that I can pause the game for technical issues or announcements.

#### Acceptance Criteria

1. THE Admin_Console SHALL display the current Round number and Round_Phase
2. THE Admin_Console SHALL provide a control to advance to the next Round_Phase
3. THE Admin_Console SHALL provide a control to pause the game timer
4. THE Admin_Console SHALL provide a control to resume the game timer
5. WHEN an administrator advances the Round_Phase manually, THE Game_Engine SHALL immediately transition to the next phase regardless of remaining time
6. WHEN an administrator pauses the game, THE Game_Engine SHALL freeze the Round timer and prevent automatic phase transitions
7. WHEN an administrator resumes the game, THE Game_Engine SHALL continue the Round timer from the paused value
8. THE Game_Engine SHALL record all manual Round control actions in the Audit_Log with administrator identifier and timestamp

### Requirement 18: Admin Live Game Monitoring

**User Story:** As a game administrator, I want to monitor all teams in real-time, so that I can identify and resolve issues quickly.

#### Acceptance Criteria

1. THE Admin_Console SHALL display a summary view of all 80 Teams
2. THE Admin_Console SHALL display each Team's current Portfolio value in the summary view
3. THE Admin_Console SHALL display each Team's current rank in the summary view
4. THE Admin_Console SHALL display each Team's number of pending Orders in the summary view
5. THE Admin_Console SHALL highlight Teams with error states or failed Orders
6. THE Admin_Console SHALL update the summary view within 3 seconds when Team states change
7. THE Admin_Console SHALL allow administrators to drill down into individual Team details
8. WHEN an administrator selects a Team, THE Admin_Console SHALL display that Team's complete Portfolio, Order history, and Audit_Log entries

### Requirement 19: Dispute Resolution

**User Story:** As a game administrator, I want to manually correct errors in team portfolios, so that I can resolve disputes and fix technical issues.

#### Acceptance Criteria

1. THE Admin_Console SHALL provide a Dispute resolution interface
2. THE Admin_Console SHALL allow administrators to manually adjust a Team's Cash balance with justification
3. THE Admin_Console SHALL allow administrators to manually adjust a Team's Fund holdings with justification
4. WHEN an administrator submits a manual adjustment, THE Admin_Console SHALL require a text justification
5. WHEN an administrator submits a manual adjustment, THE Game_Engine SHALL validate that the adjustment does not create negative balances
6. WHEN a manual adjustment passes validation, THE Game_Engine SHALL apply the adjustment immediately
7. THE Game_Engine SHALL record all manual adjustments in the Audit_Log with administrator identifier, timestamp, adjustment details, and justification
8. THE Platform SHALL notify the affected Team when a manual adjustment is applied to their Portfolio

### Requirement 20: Security and Tamper-Proofing

**User Story:** As a game administrator, I want all critical computations server-side with tamper-proof audit trails, so that the game integrity is maintained.

#### Acceptance Criteria

1. THE Game_Engine SHALL perform all NAV computations, Order validations, and Portfolio valuations server-side
2. THE Platform SHALL prevent client-side modification of NAV values, Cash balances, or Fund holdings
3. THE Platform SHALL encrypt the Schedule data at rest using industry-standard encryption
4. THE Platform SHALL implement row-level security locks on all database writes for Team Portfolio data
5. THE Game_Engine SHALL append all state changes to the Audit_Log with cryptographic timestamps
6. THE Audit_Log SHALL be immutable after write operations complete
7. THE Platform SHALL validate all API requests using server-side authentication tokens
8. THE Platform SHALL reject any API request that attempts to modify Portfolio data directly without going through the Game_Engine
9. THE Admin_Console SHALL log all administrator actions with operator identifier and timestamp
10. THE Platform SHALL implement rate limiting of 100 requests per minute per Participant to prevent abuse

### Requirement 21: HTTP Polling Architecture

**User Story:** As a system architect, I want to use HTTP polling instead of websockets, so that the platform operates within Vercel Hobby and Supabase Free tier constraints.

#### Acceptance Criteria

1. THE Team_Trading_App SHALL poll the Game_Engine for Game_State updates every 2 to 3 seconds
2. THE Team_Trading_App SHALL poll the Game_Engine for Portfolio updates every 2 to 3 seconds during TRADING_OPEN phase
3. THE Team_Trading_App SHALL poll the Game_Engine for Leaderboard updates every 5 seconds
4. THE Admin_Console SHALL poll the Game_Engine for Team summary data every 2 to 3 seconds
5. THE Platform SHALL implement HTTP response caching with ETags to reduce bandwidth consumption
6. THE Platform SHALL return HTTP 304 responses when polled data has not changed since the last request
7. THE Game_Engine SHALL handle 400 concurrent polling connections without exceeding Vercel Hobby tier limits

### Requirement 22: Lazy State Machine for Round Management

**User Story:** As a system architect, I want round transitions triggered by participant activity, so that the platform operates without cron jobs or background workers.

#### Acceptance Criteria

1. WHEN any Participant polls the Game_Engine, THE Game_Engine SHALL check if the current Round_Phase timer has expired
2. WHEN the Round_Phase timer has expired, THE Game_Engine SHALL transition to the next Round_Phase before responding to the poll
3. THE Game_Engine SHALL compute Round_Phase expiry as (phase_start_timestamp + phase_duration_seconds)
4. THE Game_Engine SHALL use database-level timestamps for all phase transition computations
5. THE Game_Engine SHALL implement row-level locks during phase transitions to prevent race conditions
6. WHEN transitioning phases, THE Game_Engine SHALL update the Game_State atomically in a single database transaction
7. THE Game_Engine SHALL guarantee that exactly one phase transition occurs per expiry event regardless of concurrent poll requests

### Requirement 23: Performance and Latency Requirements

**User Story:** As a participant, I want fast order confirmations and real-time updates, so that I can trade effectively during short time windows.

#### Acceptance Criteria

1. WHEN a Participant submits an Order, THE Game_Engine SHALL return confirmation or rejection within 1 second at the 95th percentile
2. WHEN the Game_Engine transitions Round_Phase, THE Team_Trading_App SHALL reflect the new phase within 3 seconds for 95% of Participants
3. THE Game_Engine SHALL complete Order execution for all Teams within 30 seconds during ORDER_LOCK phase
4. THE Platform SHALL support 400 concurrent authenticated Sessions without performance degradation
5. THE Platform SHALL support 80 Teams submitting Orders simultaneously during peak trading periods
6. THE Admin_Console SHALL update Team summary data within 3 seconds of Portfolio changes
7. THE Platform SHALL complete full Portfolio valuation for all 80 Teams within 5 seconds after NAV updates

### Requirement 24: Cost Optimization Requirements

**User Story:** As a project owner, I want zero operational costs during development and low costs during events, so that the platform is economically sustainable.

#### Acceptance Criteria

1. THE Platform SHALL operate within Vercel Hobby tier limits during development (100 GB bandwidth per month)
2. THE Platform SHALL operate within Supabase Free tier limits (500 MB database storage, 2 GB bandwidth per month)
3. THE Platform SHALL implement request batching to minimize database queries
4. THE Platform SHALL cache static content (Fund names, Schedule structure) at the CDN edge
5. THE Platform SHALL minimize API response payload sizes using data compression
6. THE Platform SHALL operate with zero monthly cost during periods of no active games
7. WHERE production games exceed free tier limits, THE Platform SHALL scale within predictable cost bounds

### Requirement 25: Data Persistence and Recovery

**User Story:** As a game administrator, I want complete game state persisted reliably, so that games can recover from technical interruptions.

#### Acceptance Criteria

1. THE Game_Engine SHALL persist Game_State to the database after every phase transition
2. THE Game_Engine SHALL persist all Portfolio updates to the database immediately after Order execution
3. THE Game_Engine SHALL persist all Audit_Log entries to the database within 1 second of the triggering event
4. THE Platform SHALL implement database transactions for all multi-record updates
5. WHEN a database write fails, THE Game_Engine SHALL retry the operation up to 3 times with exponential backoff
6. WHEN all retry attempts fail, THE Game_Engine SHALL log the failure and notify administrators via the Admin_Console
7. THE Platform SHALL enable administrators to restore Game_State from any point in the Audit_Log
8. THE Platform SHALL backup the complete database state after each Round completes

### Requirement 26: Schedule Format and Validation

**User Story:** As a game administrator, I want clear validation errors when uploading schedules, so that I can correct formatting issues before the game starts.

#### Acceptance Criteria

1. THE Admin_Console SHALL accept Schedule files in CSV format
2. THE Schedule file SHALL contain a header row with column labels for Fund identifiers and Round numbers
3. THE Schedule file SHALL contain exactly 11 data rows (one per investable Fund)
4. THE Schedule file SHALL contain exactly 15 data columns (one per Round)
5. WHEN validating a Schedule file, THE Game_Engine SHALL verify that all NAV values are positive numbers
6. WHEN validating a Schedule file, THE Game_Engine SHALL verify that no NAV value exceeds ±60% cumulative change from the initial value
7. WHEN Schedule validation detects errors, THE Admin_Console SHALL display the specific row and column where the error occurred
8. WHEN Schedule validation succeeds, THE Admin_Console SHALL display a confirmation message with the number of NAV entries loaded

### Requirement 27: Order Modification and Cancellation

**User Story:** As a participant, I want to modify or cancel pending orders, so that I can adjust my strategy during the trading window.

#### Acceptance Criteria

1. WHEN the Game_State is TRADING_OPEN, THE Team_Trading_App SHALL display all pending Orders for the Team
2. THE Team_Trading_App SHALL provide a control to cancel each pending Order
3. WHEN a Participant cancels a pending Order, THE Game_Engine SHALL remove the Order from the pending queue
4. THE Game_Engine SHALL record Order cancellations in the Audit_Log with timestamp and Participant identifier
5. THE Team_Trading_App SHALL allow Participants to modify pending Order quantities during TRADING_OPEN phase
6. WHEN a Participant modifies a pending Order, THE Game_Engine SHALL revalidate the Order with the new quantity
7. WHEN Order modification fails validation, THE Game_Engine SHALL retain the original Order and return an error message

### Requirement 28: Session Management and Timeout

**User Story:** As a participant, I want my login session to remain active during the game, so that I don't get logged out during critical trading moments.

#### Acceptance Criteria

1. THE Platform SHALL maintain authenticated Sessions for 4 hours without activity
2. WHEN a Participant's Session expires, THE Team_Trading_App SHALL redirect to the login page
3. THE Team_Trading_App SHALL display a warning 5 minutes before Session expiry
4. THE Platform SHALL allow Participants to extend their Session by clicking a "Stay Logged In" button
5. THE Platform SHALL automatically extend Sessions when Participants submit Orders or perform any write operation
6. THE Platform SHALL limit each Participant to exactly 1 concurrent Session
7. WHEN a Participant logs in while another Session is active, THE Platform SHALL terminate the old Session

### Requirement 29: Responsive UI and Mobile Support

**User Story:** As a participant, I want to access the platform on mobile devices, so that I can trade from anywhere.

#### Acceptance Criteria

1. THE Team_Trading_App SHALL render correctly on viewport widths from 320px to 2560px
2. THE Team_Trading_App SHALL provide touch-optimized controls for Order entry on mobile devices
3. THE Team_Trading_App SHALL display Portfolio data in a mobile-friendly layout on screens below 768px width
4. THE Admin_Console SHALL render correctly on desktop viewport widths from 1024px to 2560px
5. THE Platform SHALL achieve a Lighthouse mobile performance score above 80
6. THE Team_Trading_App SHALL load the initial page within 3 seconds on 3G network connections

### Requirement 30: Error Handling and User Feedback

**User Story:** As a participant, I want clear error messages when operations fail, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN any operation fails, THE Platform SHALL display a human-readable error message
2. THE Platform SHALL include the specific reason for failure in error messages (e.g., "Insufficient cash: need ₹5.2 Cr, available ₹3.1 Cr")
3. THE Platform SHALL display error messages for at least 5 seconds before allowing dismissal
4. WHEN validation fails on Order submission, THE Team_Trading_App SHALL highlight the invalid field
5. WHEN network errors occur, THE Team_Trading_App SHALL display a "Connection lost - retrying..." message
6. THE Platform SHALL automatically retry failed requests up to 3 times before displaying an error
7. THE Platform SHALL log all user-facing errors to a centralized error tracking service with context for debugging

