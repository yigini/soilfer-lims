#!/bin/sh
set -e

echo "╔═══════════════════════════════════════╗"
echo "║    SoilFER-LIMS Docker Entrypoint     ║"
echo "╚═══════════════════════════════════════╝"

# Auto-generate JWT_SECRET if not provided or still default
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "please-change-this-secret" ]; then
    export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    echo "⚠ JWT_SECRET was not set — auto-generated a random secret."
    echo "  For persistent tokens across restarts, set JWT_SECRET in your .env or docker-compose.yml"
fi

cd /app/server

# Ensure schema is available (volume mount may overlay prisma dir)
if [ ! -f prisma/schema.prisma ]; then
    echo "⚠ schema.prisma not found — copying from backup..."
    cp /app/server/.schema-backup/schema.prisma prisma/schema.prisma
fi

# Push schema to DB (creates tables if needed, safe to re-run)
echo "📦 Pushing database schema..."
npx prisma db push --skip-generate 2>&1 || echo "⚠ Schema push had warnings (may be OK)"

# Seed default data (skips if users already exist)
echo "🌱 Running seed..."
node seed.js

# Start the server
echo "🚀 Starting SoilFER-LIMS..."
exec node index.js
