# Workflow Contract Migration and Rollback

## Overview
This migration aligns existing data with the new strict Workflow Contract (Step 8).
It cleans up legacy statuses, orphan records, and ensures data integrity.

## Decisions
1. **Preparation FAILED**: mapped to **PENDING**.
   - *Reason*: Contract forbids explicit failure of preparation phase. It must be retried.
2. **WorkItem QA_PENDING**: mapped to **COMPLETED**.
   - *Reason*: Legacy "QA" step is now "Manager Review". Items waiting for QA are effectively "COMPLETED" by tech, waiting for submission/review.
3. **Orphan Removal**: WorkItems without valid Sample IDs are **Deleted**.
   - *Reason*: Cannot recover context.
4. **Duplicate WorkItems**: Newest accepted/completed item kept. Others archived/deleted.
   - *Reason*: Enforce 1:1 mapping for (Sample, Analysis).

## Usage

### 1. Dry Run (Recommended first)
Prints planned changes without writing to disk.
\`\`\`bash
node server/scripts/migrate_workflow.js --dry-run
\`\`\`

### 2. Execute Migration
Backs up data, applies changes, and saves.
\`\`\`bash
node server/scripts/migrate_workflow.js
\`\`\`

### 3. Validation
Run inventory check and contract tests.
\`\`\`bash
node server/scripts/generate_inventory.js
npm test
\`\`\`

## Rollback
The migration script ensures a full backup is created in \`server/data/migration_logs/backup_<timestamp>/\`.
To rollback:
1. Stop server.
2. Copy files from backup folder to \`server/data/\`.
3. Restart server.
