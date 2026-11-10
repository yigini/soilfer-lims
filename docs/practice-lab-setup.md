# Set Up the Practice Lab ("Demo Soil Lab")

Use the practice-lab seed script to fill an empty local database with **Demo Soil Lab** (`DEMO`), including all roles, instruments, check soils, control-chart history, and 15 practice samples across every workflow stage described in the [Manual Screenshot Shot List](screenshot-shot-list.md).

## 1. Run the Seed on a Fresh Local Database

From the `server` folder, run:

```bash
DEMO_SEED=1 npm run seed:demo
```

On Windows PowerShell:

```powershell
$env:DEMO_SEED = "1"
npm run seed:demo
```

To target a separate practice SQLite file instead of the default local `prisma/dev.db` file, set `DATABASE_PATH` before running the command:

```bash
DATABASE_PATH=./prisma/practice-demo.db DEMO_SEED=1 npm run seed:demo
```

## 2. Save the One-Time Practice Credentials

When the seed finishes, it prints a one-time table of randomly generated passwords (and 4-digit bench PINs for `tech1` and `tech2`) to your terminal:

- `superadmin` — **Super Administrator** (`superadmin@example.test`)
- `manager1` — **Laboratory Manager** (`manager1@example.test`)
- `manager2` — **Laboratory Manager** (`manager2@example.test`)
- `qa1` — **Quality & Audit Officer** (`qa1@example.test`)
- `reception1` — **Sample Reception Officer** (`reception1@example.test`)
- `tech1` — **Laboratory Technician** (`tech1@example.test`, bench PIN configured)
- `tech2` — **Laboratory Technician** (`tech2@example.test`, bench PIN configured)
- `viewer1` — **Read-Only Viewer** (`viewer1@example.test`, scoped to *National Topsoil Fertility Survey*)

Copy the credentials from your terminal output for your screenshot or training session. Passwords and PINs are generated fresh on every run and are never stored in documentation.

## 3. Built-In Safety Checks

The seed script refuses to run if:

1. `DEMO_SEED=1` is not set.
2. `NODE_ENV` is set to `production`.
3. A laboratory named **Demo Soil Lab** (or coded `DEMO`) already exists in the target database.

## 4. Resetting the Practice Lab

If you want to reset **Demo Soil Lab** back to its starting state:

1. Stop the running local server.
2. Remove or rename your local practice SQLite file (along with any `-wal` and `-shm` sidecar files).
3. Run `DEMO_SEED=1 npm run seed:demo` again.
