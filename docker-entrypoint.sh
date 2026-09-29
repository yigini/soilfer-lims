#!/bin/sh
set -e

cd /app/server

# If command arguments are passed (e.g. rehearsal, CLI tasks), execute them directly
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

echo "╔═══════════════════════════════════════╗"
echo "║    SoilFER-LIMS Docker Entrypoint     ║"
echo "╚═══════════════════════════════════════╝"

# Auto-generate JWT_SECRET if not provided or still default
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "please-change-this-secret" ]; then
    export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    echo "⚠ JWT_SECRET was not set — auto-generated a random secret."
    echo "  For persistent tokens across restarts, set JWT_SECRET in your .env or docker-compose.yml"
fi

# Ensure schema is available (volume mount may overlay prisma dir)
if [ ! -f prisma/schema.prisma ]; then
    echo "⚠ schema.prisma not found — copying from backup..."
    cp /app/server/.schema-backup/schema.prisma prisma/schema.prisma
fi

DB_FILE="prisma/dev.db"
IS_FRESH_DB=0

# Detect fresh empty volume: database file does not exist or has 0 bytes
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    IS_FRESH_DB=1
    echo "🌱 Fresh empty volume detected (no existing database at $DB_FILE)."
    echo "📦 Initializing database schema with Prisma..."
    npx prisma db push
    
    echo "🌱 Seeding initial administrator and laboratory (${DEPLOYMENT_MODE:-local} mode)..."
    node seed.js
fi

# Guarded: Only run prisma db push on existing databases if explicitly requested
if [ "$ALLOW_PRISMA_DB_PUSH" = "true" ] && [ "$IS_FRESH_DB" -eq 0 ]; then
    echo "⚠ ALLOW_PRISMA_DB_PUSH=true detected: pushing database schema..."
    npx prisma db push 2>&1 || echo "⚠ Schema push had warnings (may be OK for existing databases)"
fi

# Guarded: Only run seed on existing databases if explicitly requested
if [ "$ALLOW_AUTO_SEED" = "true" ] && [ "$IS_FRESH_DB" -eq 0 ]; then
    echo "🌱 ALLOW_AUTO_SEED=true detected: running seed..."
    node seed.js 2>&1 || echo "⚠ Seeding had warnings (may be OK)"
fi

# Versioned Lab Operations v3 Migration (Fail-Closed, Idempotent)
echo "📦 Applying versioned lab operations v3 migration..."
node scripts/migrate_lab_operations_v3.js --apply

# User Appearance Preference Additive Migration (Fail-Closed, Idempotent)
echo "📦 Applying appearance preference migration..."
node scripts/migrate_appearance_preference.js

# Project Templates and Policy Additive Migration (Fail-Closed, Idempotent)
echo "📦 Applying project templates and policy migration..."
node scripts/migrate_project_templates_and_policy.js

# Start the server
echo "🚀 Starting SoilFER-LIMS..."
exec node index.js
