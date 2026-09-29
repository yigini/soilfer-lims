#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# SoilFER-LIMS — Quick Setup Script
# Run this on a fresh server to get LIMS running.
#
# Usage:
#   chmod +x setup.sh && ./setup.sh          # Local mode (default)
#   chmod +x setup.sh && ./setup.sh global   # Global mode
# ─────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Determine deployment mode
MODE="${1:-${DEPLOYMENT_MODE:-local}}"
MODE=$(echo "$MODE" | tr '[:upper:]' '[:lower:]')

if [[ "$MODE" != "local" && "$MODE" != "global" ]]; then
    echo -e "${RED}✗ Invalid mode: $MODE. Use 'local' or 'global'.${NC}"
    exit 1
fi

MODE_UPPER=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║       SoilFER-LIMS Setup Script       ║"
echo "║       Mode: $(printf '%-26s' "${MODE_UPPER}")║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check Node.js ──
echo -e "${BLUE}[1/7]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Install Node.js 24 LTS from: https://nodejs.org"
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
NODE_MINOR=$(node -v | cut -d'.' -f2)
NODE_OK=0
if [ "$NODE_MAJOR" -ge 24 ]; then
    NODE_OK=1
elif [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 12 ]; then
    NODE_OK=1
elif [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -ge 19 ]; then
    NODE_OK=1
fi

if [ "$NODE_OK" -ne 1 ]; then
    echo -e "${RED}✗ Supported Node.js required: v24 LTS (recommended), v22.12+, or v20.19+ (found $(node -v))${NC}"
    echo "  Please install a supported Node.js LTS release from: https://nodejs.org"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── 2. Install Dependencies ──
echo -e "\n${BLUE}[2/7]${NC} Installing server dependencies..."
cd server
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
cd ..

echo -e "      Installing client dependencies..."
cd client
npm ci 2>/dev/null || npm install
cd ..
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── 3. Generate Prisma Client ──
echo -e "\n${BLUE}[3/7]${NC} Generating Prisma client..."
cd server
npx prisma generate
cd ..
echo -e "${GREEN}✓ Prisma client generated${NC}"

# ── 4. Initialize Database Schema ──
echo -e "\n${BLUE}[4/7]${NC} Initializing database schema..."
cd server
npx prisma db push
cd ..
echo -e "${GREEN}✓ Database schema initialized${NC}"

# ── 5. Build Client ──
echo -e "\n${BLUE}[5/7]${NC} Building React client..."
cd client
npm run build
cd ..
echo -e "${GREEN}✓ Client built${NC}"

# ── 6. Create .env ──
echo -e "\n${BLUE}[6/7]${NC} Setting up environment..."
if [ ! -f .env ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    cat > .env <<EOF
PORT=3000
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
DEPLOYMENT_MODE=${MODE}
EOF
    echo -e "${GREEN}✓ Created .env with auto-generated JWT secret${NC}"
else
    echo -e "${YELLOW}ℹ .env already exists${NC}"
    if ! grep -q '^JWT_SECRET=[^[:space:]]' .env 2>/dev/null; then
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
        if grep -q '^JWT_SECRET=' .env 2>/dev/null; then
            sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env && rm -f .env.bak
        else
            echo "JWT_SECRET=${JWT_SECRET}" >> .env
        fi
        echo -e "${GREEN}✓ Populated missing JWT_SECRET in existing .env${NC}"
    fi
fi

# ── 7. Seed Database ──
echo -e "\n${BLUE}[7/7]${NC} Seeding database (${MODE_UPPER} mode)..."
cd server
DEPLOYMENT_MODE=$MODE node seed.js
cd ..

# ── Done! ──
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✓ Setup Complete! (${MODE_UPPER} mode)          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start:   ${BLUE}cd server && NODE_ENV=production node index.js${NC}"
echo -e "  Open:    ${BLUE}http://localhost:3000${NC}"
echo -e "  Login:   ${BLUE}admin${NC} (Role: $([ "$MODE" = "global" ] && echo "SUPER_ADMIN" || echo "LAB_MANAGER"))"
echo -e "  Password: (See initial one-time password generated in step 7 above)"
echo -e "  ${YELLOW}⚠ A password change will be required on your first login.${NC}"
echo ""
