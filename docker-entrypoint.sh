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

# Versioned Lab Operations v3 Migration (Fail-Closed)
echo "📦 Applying versioned lab operations v3 migration..."
node scripts/migrate_lab_operations_v3.js --apply

# User Appearance Preference Additive Migration (Fail-Closed, Idempotent)
echo "📦 Applying appearance preference migration..."
node scripts/migrate_appearance_preference.js

# Guarded: Only run prisma db push if explicitly requested (e.g. brand new dev setup)
if [ "$ALLOW_PRISMA_DB_PUSH" = "true" ]; then
    echo "⚠ ALLOW_PRISMA_DB_PUSH=true detected: pushing database schema..."
    npx prisma db push 2>&1 || echo "⚠ Schema push had warnings (may be OK for existing databases)"
fi

# Guarded: Only run seed if explicitly requested
if [ "$ALLOW_AUTO_SEED" = "true" ]; then
    echo "🌱 ALLOW_AUTO_SEED=true detected: running seed..."
    node seed.js 2>&1 || echo "⚠ Seeding had warnings (may be OK)"
fi

# Start the server
echo "🚀 Starting SoilFER-LIMS..."
exec node index.js
