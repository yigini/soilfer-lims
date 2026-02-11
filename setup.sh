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

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║       SoilFER-LIMS Setup Script       ║"
echo "║       Mode: $(printf '%-26s' "${MODE^^}")║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check Node.js ──
echo -e "${BLUE}[1/7]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Install Node.js 20+ from: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ required (found v$(node -v))${NC}"
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
echo -e "${GREEN}✓ Prisma client generated${NC}"

# ── 4. Push Database Schema ──
echo -e "\n${BLUE}[4/7]${NC} Pushing database schema..."
npx prisma db push --skip-generate 2>/dev/null || true
cd ..
echo -e "${GREEN}✓ Database ready${NC}"

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
    echo -e "${YELLOW}⚠ .env already exists, skipping${NC}"
fi

# ── 7. Seed Database ──
echo -e "\n${BLUE}[7/7]${NC} Seeding database..."
cd server
DEPLOYMENT_MODE=$MODE node seed.js
cd ..

# ── Done! ──
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✓ Setup Complete! (${MODE^^} mode)          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start:   ${BLUE}cd server && NODE_ENV=production node index.js${NC}"
echo -e "  Open:    ${BLUE}http://localhost:3000${NC}"
echo -e "  Login:   admin / password"
echo -e "  ${RED}⚠ Change this immediately!${NC}"
echo ""
