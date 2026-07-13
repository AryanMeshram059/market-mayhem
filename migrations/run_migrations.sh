#!/bin/bash

# ============================================================================
# Migration Runner Script for Market Mayhem Platform Database
# ============================================================================
# Usage: ./run_migrations.sh [host] [user] [database] [password]
# 
# Examples:
#   ./run_migrations.sh localhost postgres market_mayhem postgres
#   ./run_migrations.sh db.example.com postgres market_mayhem
#   ./run_migrations.sh db.supabase.co postgres market_mayhem
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

# Default values
DB_HOST="${1:-localhost}"
DB_USER="${2:-postgres}"
DB_NAME="${3:-market_mayhem}"
DB_PASSWORD="${4:-}"
DB_PORT="${5:-5432}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================================
# VALIDATION
# ============================================================================

print_header "Market Mayhem Database Migration Runner"

# Check if migrations directory exists
if [ ! -d "$SCRIPT_DIR" ]; then
  print_error "Migrations directory not found: $SCRIPT_DIR"
  exit 1
fi

# Check if migration files exist
MIGRATIONS=(
  "001_create_core_tables.sql"
  "002_create_rls_policies.sql"
  "003_create_indexes.sql"
  "004_seed_initial_data.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ ! -f "$SCRIPT_DIR/$migration" ]; then
    print_error "Migration file not found: $migration"
    exit 1
  fi
done

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  print_error "psql not found. Please install PostgreSQL client tools."
  exit 1
fi

# ============================================================================
# CONNECTION SETUP
# ============================================================================

print_info "Database Configuration:"
print_info "  Host: $DB_HOST"
print_info "  Port: $DB_PORT"
print_info "  User: $DB_USER"
print_info "  Database: $DB_NAME"

# Set password variable if provided
if [ -n "$DB_PASSWORD" ]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

# Test database connection
print_info "Testing database connection..."
if ! psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -c "SELECT 1" &>/dev/null; then
  if [ -z "$DB_PASSWORD" ]; then
    print_warning "Connection test failed. Attempting with password prompt..."
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -c "SELECT 1" || {
      print_error "Failed to connect to database. Please check credentials."
      exit 1
    }
  else
    print_error "Failed to connect to database. Please check credentials and connection settings."
    exit 1
  fi
else
  print_success "Database connection successful"
fi

# ============================================================================
# PRE-MIGRATION CHECKS
# ============================================================================

print_header "Pre-Migration Checks"

# Check for existing tables
TABLE_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")

if [ "$TABLE_COUNT" -gt 0 ]; then
  print_warning "Database already contains $TABLE_COUNT table(s)"
  read -p "Do you want to continue and risk conflicts? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_info "Migration cancelled by user"
    exit 0
  fi
fi

print_success "Pre-migration checks completed"

# ============================================================================
# EXECUTE MIGRATIONS
# ============================================================================

print_header "Executing Migrations"

MIGRATION_COUNT=0
FAILED=0

for migration in "${MIGRATIONS[@]}"; do
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  MIGRATION_PATH="$SCRIPT_DIR/$migration"
  
  echo ""
  print_info "[$MIGRATION_COUNT/4] Executing migration: $migration"
  
  # Execute migration
  if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f "$MIGRATION_PATH" > /tmp/migration_$MIGRATION_COUNT.log 2>&1; then
    print_success "Migration $MIGRATION_COUNT completed successfully: $migration"
  else
    print_error "Migration $MIGRATION_COUNT failed: $migration"
    FAILED=$((FAILED + 1))
    print_error "Error log:"
    cat /tmp/migration_$MIGRATION_COUNT.log
    echo ""
  fi
done

# ============================================================================
# POST-MIGRATION VERIFICATION
# ============================================================================

print_header "Post-Migration Verification"

echo ""
print_info "Verifying tables..."

# Count tables
TABLE_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
print_info "Total tables created: $TABLE_COUNT"

if [ "$TABLE_COUNT" -ge 12 ]; then
  print_success "All expected tables created"
else
  print_warning "Expected 12 tables, found $TABLE_COUNT"
fi

# Check RLS enabled
echo ""
print_info "Verifying Row-Level Security..."
RLS_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM pg_tables WHERE rowsecurity = true AND schemaname = 'public'")
print_info "Tables with RLS enabled: $RLS_COUNT"

if [ "$RLS_COUNT" -ge 8 ]; then
  print_success "RLS policies applied successfully"
else
  print_warning "Expected RLS on 8+ tables, found $RLS_COUNT"
fi

# Check data
echo ""
print_info "Verifying initial data..."

TEAM_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM teams" 2>/dev/null || echo "0")
FUND_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM funds" 2>/dev/null || echo "0")
PORTFOLIO_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM portfolios" 2>/dev/null || echo "0")

print_info "Teams seeded: $TEAM_COUNT (expected: 80)"
print_info "Funds seeded: $FUND_COUNT (expected: 12)"
print_info "Portfolios initialized: $PORTFOLIO_COUNT (expected: 80)"

if [ "$TEAM_COUNT" -eq 80 ] && [ "$FUND_COUNT" -eq 12 ] && [ "$PORTFOLIO_COUNT" -eq 80 ]; then
  print_success "All initial data seeded successfully"
else
  print_warning "Some data may not have been seeded correctly"
fi

# Check game state
echo ""
print_info "Verifying game state..."
GAME_STATE=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t -c "SELECT current_round, current_phase FROM game_state WHERE id = 1" 2>/dev/null || echo "")

if [ -n "$GAME_STATE" ]; then
  print_success "Game state initialized: $GAME_STATE"
else
  print_warning "Game state may not be initialized"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
print_header "Migration Summary"

if [ "$FAILED" -eq 0 ]; then
  print_success "All migrations completed successfully!"
  echo ""
  print_info "Next steps:"
  echo "  1. Verify application connectivity to the database"
  echo "  2. Test authentication with a sample team"
  echo "  3. Test order submission and execution"
  echo "  4. Monitor performance with sample data"
  exit 0
else
  print_error "$FAILED migration(s) failed"
  echo ""
  print_info "Check the error logs above for details"
  exit 1
fi
