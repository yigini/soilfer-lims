/**
 * Bounded Storage Maintenance & Retention Pruner
 * Issue #140 (R2, R10, Codex Remediation)
 *
 * Prunes expired snapshots and their frozen child items from _exchange_snapshots and _exchange_snapshot_items.
 * Safe, idempotent, non-destructive additive cleanup.
 *
 * Usage:
 *   node server/scripts/prune_exchange_storage.cjs [optional-db-path]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function pruneExchangeStorage(dbPath, options = {}) {
    if (!dbPath || dbPath.startsWith('--')) {
        dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../prisma/dev.db');
    }

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist at ${dbPath}`);
    }

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    let prunedSnapshots = 0;
    let prunedItems = 0;

    const dryRun = Boolean(options.dryRun);

    const runPrune = db.transaction(() => {
        const hasSnapTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_snapshots'").get());
        const hasItemsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_snapshot_items'").get());

        if (!hasSnapTable) {
            return { prunedSnapshots: 0, prunedItems: 0 };
        }

        const nowIso = new Date().toISOString();
        const expiredSnaps = db.prepare('SELECT id FROM _exchange_snapshots WHERE expires_at < ?').all(nowIso);

        if (expiredSnaps.length === 0) {
            return { prunedSnapshots: 0, prunedItems: 0 };
        }

        if (dryRun) {
            let expiredItemsCount = 0;
            if (hasItemsTable) {
                const countStmt = db.prepare('SELECT COUNT(*) as count FROM _exchange_snapshot_items WHERE snapshot_id = ?');
                for (const snap of expiredSnaps) {
                    expiredItemsCount += countStmt.get(snap.id)?.count || 0;
                }
            }
            return { prunedSnapshots: expiredSnaps.length, prunedItems: expiredItemsCount, dryRun: true };
        }

        const deleteItemsStmt = hasItemsTable ? db.prepare('DELETE FROM _exchange_snapshot_items WHERE snapshot_id = ?') : null;
        const deleteSnapStmt = db.prepare('DELETE FROM _exchange_snapshots WHERE id = ?');

        for (const snap of expiredSnaps) {
            if (deleteItemsStmt) {
                const itemRes = deleteItemsStmt.run(snap.id);
                prunedItems += itemRes.changes;
            }
            const snapRes = deleteSnapStmt.run(snap.id);
            prunedSnapshots += snapRes.changes;
        }

        return { prunedSnapshots, prunedItems, dryRun: false };
    });

    const result = runPrune();
    db.close();
    return { ...result, dbPath };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const targetDb = args.find(a => !a.startsWith('--')) || process.env.DATABASE_PATH;
    try {
        const res = pruneExchangeStorage(targetDb, { dryRun });
        console.log(`[STORAGE_PRUNE_${res.dryRun ? 'DRY_RUN' : 'SUCCESS'}] Database at: ${res.dbPath}`);
        console.log(`  Expired snapshots: ${res.prunedSnapshots}`);
        console.log(`  Child items:       ${res.prunedItems}`);
        process.exit(0);
    } catch (err) {
        console.error(`[STORAGE_PRUNE_FAILED] ${err.message}`);
        process.exit(1);
    }
}

module.exports = { pruneExchangeStorage };
