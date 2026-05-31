#!/bin/bash
# Full database reset including drizzle migrations
# Run from project root: ./scripts/db-reset-full.sh
#
# This script:
# 1. Drops ALL schemas (public + drizzle)
# 2. Recreates public schema
# 3. Removes migration files (keeps only journal structure)
# 4. Generates fresh migrations from current schema
# 5. Runs migrations
# 6. Seeds initial data
#
# After running this, db:migrate will work cleanly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DRIZZLE_DIR="$PROJECT_ROOT/packages/db/drizzle"

echo "⚠️  FULL DATABASE RESET - This will DELETE ALL DATA!"

echo ""
echo "🗑️  Dropping all schemas..."
PGPASSWORD=journey_dev psql -h localhost -U journey -d journey -c "
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO journey;
GRANT ALL ON SCHEMA public TO public;
"

echo ""
echo "🗑️  Removing old migration files..."
rm -f "$DRIZZLE_DIR"/*.sql
rm -rf "$DRIZZLE_DIR/meta"

echo ""
echo "🔧 Creating extensions..."
PGPASSWORD=journey_dev psql -h localhost -U journey -d journey -c "
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
"

echo ""
echo "📝 Generating fresh migrations..."
pnpm --filter @journey/db generate

echo ""
echo "📦 Running migrations..."
pnpm --filter @journey/db migrate

echo ""
echo "🌱 Seeding data..."
pnpm --filter @journey/db seed

echo ""
echo "✅ Full database reset complete!"
echo "   - All migrations regenerated from current schema"
echo "   - Database is in sync with schema"
echo "   - db:migrate will now work correctly"
