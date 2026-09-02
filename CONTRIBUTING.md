# Contributing to SoilFER-LIMS

Thank you for your interest in contributing to **SoilFER-LIMS**! This project provides the core laboratory information infrastructure for the Global Soil Partnership (GSP) and national soil laboratories worldwide.

---

## 1. Guiding Principles

1. **Contract Integrity**: The system enforces strict state machine contracts for sample lifecycle, operational gates, batch quality controls, and agronomic classifications. Never bypass central contract authorities or create parallel state writes.
2. **Multi-Tenant Scope Isolation**: All queries must respect laboratory tenancy via `utils/scopeGuard.js` and role permissions in `config/roles.js`. No raw `req.user.role === ...` checks in controllers.
3. **No Uncalibrated Metadata**: Every result recorded must carry a controlled measurement unit (`Unit`), standard method reference (`MethodReference`), and metrological provenance (`Result.provenance`).
4. **Behavioural Verification**: Code must be accompanied by automated Jest contract tests verifying actual behaviour. Commit messages and code comments are not evidence of correctness.

---

## 2. Development Setup

### Prerequisites
- Node.js 20+ LTS
- SQLite 3.35+ or PostgreSQL 15+
- Git

### Initial Installation
```bash
# Clone the repository
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

# Install server dependencies & generate Prisma client
cd server
npm install

# Initialize local SQLite test database
npx prisma db push --accept-data-loss
node seeds/units.js
node seeds/references.js
node seeds/catalogue.js --confirm

# Install client dependencies
cd ../client
npm install
```

### Running Locally
```bash
# Terminal 1: Backend API server (Port 5000)
cd server
npm run dev

# Terminal 2: Vite frontend (Port 5173)
cd client
npm run dev
```

---

## 3. Testing Requirements

Before submitting any Pull Request, you must run and pass the full test suite:

```bash
cd server
npm test
```

### Contract & Wiring Tests
- When introducing a new model or business logic module, author a corresponding contract test under `server/tests/contracts/`.
- Ensure `server/tests/security/wiring.test.js` passes to prevent dead code or unreferenced exports.

---

## 4. Coding & Commit Guidelines

- **Commit Message Format**: Use conventional commits referencing the target work package or domain:
  - `feat(WP-XX): describe feature`
  - `fix(WP-XX): describe bug fix`
  - `test(WP-XX): add contract test`
  - `docs: update documentation`
- **Declarative Deployment Profiles**: Never hardcode country names, laboratory IDs, or project fallback codes in controllers. All configuration belongs in `profiles/<name>/` as pure JSON data.

---

## 5. Pull Request Workflow

1. Fork the repository and create a feature branch (`git checkout -b feat/your-feature`).
2. Implement your changes following the architectural invariants.
3. Run `npm test` from `server/` and `npm run build` from `client/`.
4. Submit your Pull Request against the `main` branch with a clear description of changes and test results.
