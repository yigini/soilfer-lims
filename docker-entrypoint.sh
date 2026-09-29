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

# Auto-generate or load persistent JWT_SECRET if not provided or still default
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "please-change-this-secret" ]; then
    SECRET_FILE="prisma/.jwt_secret"
    if [ ! -d "prisma" ]; then
        SECRET_FILE=".jwt_secret"
    fi

    if [ -s "$SECRET_FILE" ]; then
        export JWT_SECRET=$(cat "$SECRET_FILE")
        echo "🔑 Loaded persisted JWT_SECRET from $SECRET_FILE"
    else
        GENERATED_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
        if [ -z "$GENERATED_SECRET" ]; then
            echo "❌ FATAL: Failed to generate random JWT_SECRET." >&2
            exit 1
        fi
        printf "%s" "$GENERATED_SECRET" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE" 2>/dev/null || true
        export JWT_SECRET="$GENERATED_SECRET"
        echo "⚠ JWT_SECRET was not set — generated and securely saved persistent secret to $SECRET_FILE."
        echo "  This secret will persist across container restarts."
    fi
fi
if [ -z "$JWT_SECRET" ]; then
    echo "❌ FATAL: JWT_SECRET could not be determined." >&2
    exit 1
fi

# Ensure schema is available (volume mount may overlay prisma dir)
if [ ! -f prisma/schema.prisma ]; then
    echo "⚠ schema.prisma not found — copying from backup..."
    cp /app/server/.schema-backup/schema.prisma prisma/schema.prisma
fi

DB_FILE="prisma/dev.db"
SEED_FLAG="prisma/.seed_complete"
if [ ! -d "prisma" ]; then
    SEED_FLAG=".seed_complete"
fi

# Guard existing installations: detect if database already has users
EXISTING_USERS=0
if [ -s "$DB_FILE" ]; then
    EXISTING_USERS=$(node -e '
        try {
            const Database = require("better-sqlite3");
            const db = new Database("'"$DB_FILE"'", { readonly: true });
            const row = db.prepare("SELECT count(*) as count FROM User").get();
            db.close();
            console.log(row ? row.count : 0);
        } catch (_) {
            console.log(0);
        }
    ' 2>/dev/null || echo "0")
    if [ "$EXISTING_USERS" -gt 0 ] 2>/dev/null; then
        touch "$SEED_FLAG" 2>/dev/null || true
    fi
fi

# Step 1: Initialize database schema if file is missing or empty
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    echo "🌱 Fresh empty volume detected (no existing database at $DB_FILE)."
    echo "📦 Initializing database schema with Prisma..."
    npx prisma db push
fi

# Step 2: Resumable initial seed (runs if not yet seeded and no users exist)
if [ ! -f "$SEED_FLAG" ]; then
    echo "🌱 Seeding initial administrator and laboratory (${DEPLOYMENT_MODE:-local} mode)..."
    node seed.js
    touch "$SEED_FLAG" 2>/dev/null || true
fi

# Guarded: Only run prisma db push on existing databases if explicitly requested
if [ "$ALLOW_PRISMA_DB_PUSH" = "true" ] && [ "$EXISTING_USERS" -gt 0 ]; then
    echo "⚠ ALLOW_PRISMA_DB_PUSH=true detected: pushing database schema..."
    npx prisma db push 2>&1 || echo "⚠ Schema push had warnings (may be OK for existing databases)"
fi

# Guarded: Only run seed on existing databases if explicitly requested
if [ "$ALLOW_AUTO_SEED" = "true" ] && [ "$EXISTING_USERS" -gt 0 ]; then
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
