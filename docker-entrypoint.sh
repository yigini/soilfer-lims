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

# Guard existing installations: detect database state safely (Fail-Closed)
EXISTING_USERS=0
SCHEMA_READY=0
if [ -s "$DB_FILE" ]; then
    INSPECT_JSON=$(node -e '
        const Database = require("better-sqlite3");
        try {
            const db = new Database(process.argv[1]);
            const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?").get("table", "User");
            if (!tableCheck) {
                console.log(JSON.stringify({ ok: true, schemaReady: false, userCount: 0 }));
            } else {
                const row = db.prepare("SELECT count(*) as count FROM User").get();
                console.log(JSON.stringify({ ok: true, schemaReady: true, userCount: row ? row.count : 0 }));
            }
            db.close();
        } catch (err) {
            console.error("FATAL: Database inspection failed:", err.message);
            process.exit(2);
        }
    ' "$DB_FILE")
    INSPECT_STATUS=$?

    if [ $INSPECT_STATUS -ne 0 ] || [ -z "$INSPECT_JSON" ]; then
        echo "❌ FATAL: Database inspection failed for $DB_FILE. Halting startup to prevent data corruption." >&2
        exit 1
    fi

    EXISTING_USERS=$(node -e 'const r = JSON.parse(process.argv[1]); console.log(r.userCount || 0);' "$INSPECT_JSON")
    SCHEMA_READY=$(node -e 'const r = JSON.parse(process.argv[1]); console.log(r.schemaReady ? 1 : 0);' "$INSPECT_JSON")

    if [ "$EXISTING_USERS" -gt 0 ] 2>/dev/null; then
        touch "$SEED_FLAG" 2>/dev/null || true
    fi
fi

# Step 1: Initialize database schema if file is missing, empty, or schema is not ready
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ] || [ "$SCHEMA_READY" -eq 0 ]; then
    echo "🌱 Initializing database schema with Prisma..."
    npx prisma db push
fi

# Step 2: Resumable initial seed (runs if not yet seeded and no users exist)
if [ ! -f "$SEED_FLAG" ] && [ "$EXISTING_USERS" -eq 0 ]; then
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

# Sitewide Theme Library Additive Migration (Fail-Closed, Idempotent)
echo "📦 Applying sitewide theme library migration..."
node scripts/migrate_sitewide_theme_library.js

# Mandatory workflow-state schema and guards (Additive, Fail-Closed, Idempotent)
echo "📦 Installing workflow-state schema and guards..."
node scripts/install_workflow_state_guards.js --apply

echo "📦 Installing result attempt links..."
node scripts/install_result_attempt_links.js --apply
node scripts/install_sample_holds.js --apply
echo "📦 Installing reference material catalogue..."
node scripts/install_reference_materials.js --apply

# Start the server
echo "🚀 Starting SoilFER-LIMS..."
exec node index.js
