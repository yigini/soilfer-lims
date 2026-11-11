# Set Up the Practice Lab ("Demo Soil Lab")

Use the practice-lab seed script to fill an empty local database with **Demo Soil Lab** (`DEMO`). Two profiles are available depending on what you are preparing:

- **Full screenshot & training seed (`screenshots`, default):** Creates all 7 lab staff accounts, 3 instruments, 2 check-soil lots with control-chart and blank history, 3 expected rows, 1 draft, and 15 practice samples across every workflow stage described in the [Manual Screenshot Shot List](screenshot-shot-list.md).
- **1-hour user-test kit seed (`DEMO_SEED_PROFILE=user-test`):** Creates only what the [First Real User Test Kit](book/src/launch/user-test-kit.md) Setup checklist asks for—`demo-superadmin` plus one **Sample Reception Officer** (`reception1`) and one **Laboratory Technician** (`tech1`), a Soil pH method switched on, one **Ready / Calibrated** pH meter, one active check soil bottle (`LRM-DEMO-01`), **Sample 2** (`FIELD-2026-002`) checked in as **Accepted** and waiting for **Air Drying**, and **Sample 3** (`FIELD-2026-003`) checked in as **Accepted** with **Air Drying** and **Sample Preparation** finished and Soil pH ordered and assigned to `tech1`. **Sample 1** is intentionally not created so the reception participant can check it in live during Task 1.

## 1. Run the Seed on a Fresh Local Database

From the `server` folder, run the default full screenshot seed:

```bash
DEMO_SEED=1 npm run seed:demo
```

Or run the minimal 1-hour user-test profile:

```bash
DEMO_SEED=1 DEMO_SEED_PROFILE=user-test npm run seed:demo
```

On Windows PowerShell:

```powershell
# Full screenshot seed (default)
$env:DEMO_SEED = "1"
Remove-Item Env:\DEMO_SEED_PROFILE -ErrorAction SilentlyContinue
npm run seed:demo

# Or 1-hour user-test kit profile
$env:DEMO_SEED = "1"
$env:DEMO_SEED_PROFILE = "user-test"
npm run seed:demo
```

To target a separate practice SQLite file instead of the default local `prisma/dev.db` file, set `DATABASE_PATH` before running the command:

```bash
DATABASE_PATH=./prisma/practice-demo.db DEMO_SEED=1 npm run seed:demo
```

## 2. Save the One-Time Practice Credentials

When the seed finishes, it prints a one-time table of randomly generated passwords (and 4-digit bench PINs for technician accounts) to your terminal.

In the default `screenshots` profile:

- `demo-superadmin` — **Super Administrator** (`demo-superadmin@example.test`)
- `manager1` — **Laboratory Manager** (`manager1@example.test`)
- `manager2` — **Laboratory Manager** (`manager2@example.test`)
- `qa1` — **Quality & Audit Officer** (`qa1@example.test`)
- `reception1` — **Sample Reception Officer** (`reception1@example.test`)
- `tech1` — **Laboratory Technician** (`tech1@example.test`, bench PIN configured)
- `tech2` — **Laboratory Technician** (`tech2@example.test`, bench PIN configured)
- `viewer1` — **Read-Only Viewer** (`viewer1@example.test`, scoped to *National Topsoil Fertility Survey*)

In the `DEMO_SEED_PROFILE=user-test` profile, only `demo-superadmin`, `reception1`, and `tech1` are created, and the terminal output also prints the Sample 2 and Sample 3 bag codes for your masking-tape labels.

Copy the credentials from your terminal output for your screenshot or user-test session. Passwords and PINs are generated fresh on every run and are never stored in documentation.

## 3. Built-In Safety Checks

Both profiles enforce the same safety guards and refuse to run before making any database changes if:

1. `DEMO_SEED=1` is not set.
2. `NODE_ENV` is set to `production`.
3. The target database already contains any laboratory, sample, or user account (such as an existing `superadmin`).
4. A laboratory named **Demo Soil Lab** (or coded `DEMO`) or the `demo-superadmin` account already exists in the target database.

## 4. Resetting the Practice Lab

If you want to reset **Demo Soil Lab** back to its starting state (or switch between the `screenshots` and `user-test` profiles):

1. Stop the running local server.
2. Remove or rename your local practice SQLite file (along with any `-wal` and `-shm` sidecar files).
3. Run `DEMO_SEED=1 npm run seed:demo` (or `DEMO_SEED=1 DEMO_SEED_PROFILE=user-test npm run seed:demo`) again.
