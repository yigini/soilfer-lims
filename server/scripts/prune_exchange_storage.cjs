/**
 * Bounded Storage Maintenance & Retention Pruner
 * Issue #140 (R2, R10, Codex Remediation)
 *
 * Prunes expired snapshots, child snapshot items, obsolete batches/receipts,
 * and expired rotation operations from exchange state tables.
 * Safe, idempotent, non-destructive additive cleanup.
 *
 * Usage:
 *   node server/scripts/prune_exchange_storage.cjs <target-db-path> [--dry-run]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function pruneExchangeStorage(dbPath, options = {}) {
    const dryRun = Boolean(options.dryRun);

    if (!dbPath || dbPath.startsWith('--')) {
        dbPath = process.env.DATABASE_PATH;
    }

    if (!dbPath) {
        throw new Error('Explicit target database path or DATABASE_PATH environment variable is required to prevent accidental operations on default databases.');
    }

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist at ${dbPath}`);
    }

    // Truly read-only connection when dry-running; WAL pragma strictly omitted on read-only preview
    const db = new Database(dbPath, { readonly: dryRun });
    if (!dryRun) {
        db.pragma('journal_mode = WAL');
    }

    let prunedSnapshots = 0;
    let prunedItems = 0;
    let prunedBatches = 0;
    let prunedReceipts = 0;
    let prunedRotationOps = 0;

    const hasSnapTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_snapshots'").get());
    const hasItemsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_snapshot_items'").get());
    const hasBatchesTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_batches'").get());
    const hasReceiptsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_receipts'").get());
    const hasOpsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_rotation_operations'").get());

    const nowIso = new Date().toISOString();
    const retentionWindowDays = options.retentionDays || 30;
    const batchReceiptCutoffIso = new Date(Date.now() - retentionWindowDays * 24 * 60 * 60 * 1000).toISOString();

    if (dryRun) {
        // Read-only inspection
        if (hasSnapTable) {
            const expiredSnaps = db.prepare('SELECT id FROM _exchange_snapshots WHERE expires_at < ?').all(nowIso);
            prunedSnapshots = expiredSnaps.length;
            if (hasItemsTable && expiredSnaps.length > 0) {
                const countStmt = db.prepare('SELECT COUNT(*) as count FROM _exchange_snapshot_items WHERE snapshot_id = ?');
                for (const snap of expiredSnaps) {
                    prunedItems += countStmt.get(snap.id)?.count || 0;
                }
            }
        }

        if (hasBatchesTable) {
            const batchQuery = hasSnapTable
                ? `SELECT COUNT(*) as c FROM _exchange_batches b WHERE b.created_at < ? OR (b.snapshot_id IS NOT NULL AND b.snapshot_id NOT IN (SELECT id FROM _exchange_snapshots))`
                : `SELECT COUNT(*) as c FROM _exchange_batches b WHERE b.created_at < ?`;
            const batchCount = db.prepare(batchQuery).get(batchReceiptCutoffIso);
            prunedBatches = batchCount?.c || 0;
        }

        if (hasReceiptsTable) {
            const receiptQuery = hasSnapTable
                ? `SELECT COUNT(*) as c FROM _exchange_receipts r WHERE r.created_at < ? OR (r.snapshot_id IS NOT NULL AND r.snapshot_id NOT IN (SELECT id FROM _exchange_snapshots))`
                : `SELECT COUNT(*) as c FROM _exchange_receipts r WHERE r.created_at < ?`;
            const receiptCount = db.prepare(receiptQuery).get(batchReceiptCutoffIso);
            prunedReceipts = receiptCount?.c || 0;
        }

        if (hasOpsTable) {
            const opsCount = db.prepare('SELECT COUNT(*) as c FROM _exchange_rotation_operations WHERE expires_at < ?').get(nowIso);
            prunedRotationOps = opsCount?.c || 0;
        }

        db.close();
        return {
            prunedSnapshots,
            prunedItems,
            prunedBatches,
            prunedReceipts,
            prunedRotationOps,
            dryRun: true,
            dbPath
        };
    }

    // Read-write transactional mutation
    const runPrune = db.transaction(() => {
        if (hasSnapTable) {
            const expiredSnaps = db.prepare('SELECT id FROM _exchange_snapshots WHERE expires_at < ?').all(nowIso);
            if (expiredSnaps.length > 0) {
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
            }
        }

        if (hasBatchesTable) {
            const delBatchQuery = hasSnapTable
                ? `DELETE FROM _exchange_batches WHERE created_at < ? OR (snapshot_id IS NOT NULL AND snapshot_id NOT IN (SELECT id FROM _exchange_snapshots))`
                : `DELETE FROM _exchange_batches WHERE created_at < ?`;
            const delBatches = db.prepare(delBatchQuery).run(batchReceiptCutoffIso);
            prunedBatches = delBatches.changes;
        }

        if (hasReceiptsTable) {
            const delReceiptQuery = hasSnapTable
                ? `DELETE FROM _exchange_receipts WHERE created_at < ? OR (snapshot_id IS NOT NULL AND snapshot_id NOT IN (SELECT id FROM _exchange_snapshots))`
                : `DELETE FROM _exchange_receipts WHERE created_at < ?`;
            const delReceipts = db.prepare(delReceiptQuery).run(batchReceiptCutoffIso);
            prunedReceipts = delReceipts.changes;
        }

        if (hasOpsTable) {
            const delOps = db.prepare('DELETE FROM _exchange_rotation_operations WHERE expires_at < ?').run(nowIso);
            prunedRotationOps = delOps.changes;
        }

        return {
            prunedSnapshots,
            prunedItems,
            prunedBatches,
            prunedReceipts,
            prunedRotationOps,
            dryRun: false
        };
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
        console.log(`  Expired snapshots:   ${res.prunedSnapshots}`);
        console.log(`  Child items:         ${res.prunedItems}`);
        console.log(`  Orphaned batches:    ${res.prunedBatches}`);
        console.log(`  Orphaned receipts:   ${res.prunedReceipts}`);
        console.log(`  Rotation operations: ${res.prunedRotationOps}`);
        process.exit(0);
    } catch (err) {
        console.error(`[STORAGE_PRUNE_FAILED] ${err.message}`);
        process.exit(1);
    }
}

module.exports = { pruneExchangeStorage };
