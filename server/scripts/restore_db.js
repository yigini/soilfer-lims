const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const Database = require('better-sqlite3');
const { verifyBackup } = require('./verify_backup');

/**
 * Restores a SoilFER-LIMS SQLite database from a backup file (.db or .db.gz).
 *
 * Procedure:
 * 1. Verifies the backup archive integrity before touching the target.
 * 2. If the target database exists, creates a pre-restore safety snapshot.
 * 3. Removes stale WAL (-wal) and shared-memory (-shm) files to prevent stale state.
 * 4. Safely unpacks and copies the verified database to the target location.
 * 5. Re-verifies integrity of the restored database in place.
 *
 * @param {string} backupPath Path to the source .db or .db.gz backup file
 * @param {string} [customTargetPath] Optional destination DB path
 * @returns {Promise<{ success: boolean, preRestoreBackup?: string, targetPath: string, error?: string }>}
 */
async function restoreBackup(backupPath, customTargetPath) {
    if (!backupPath) {
        throw new Error('No backup archive path provided.');
    }

    const resolvedBackup = path.resolve(backupPath);
    const targetDbPath = customTargetPath
        ? path.resolve(customTargetPath)
        : (process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db'));

    console.log(`[RESTORE] Initiating restore from: ${resolvedBackup}`);
    console.log(`[RESTORE] Target database path: ${targetDbPath}`);

    // 1. Verify backup integrity prior to restore
    console.log(`[RESTORE] Verifying source backup integrity...`);
    const preCheck = await verifyBackup(resolvedBackup);
    if (!preCheck.valid) {
        throw new Error(`Source backup failed integrity check: ${preCheck.error}`);
    }
    console.log(`[RESTORE] Source backup is valid. Users: ${preCheck.tables.userCount}, Samples: ${preCheck.tables.sampleCount}`);

    // Ensure target directory exists
    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // 2. Create pre-restore safety backup if target exists
    let preRestoreBackup = null;
    if (fs.existsSync(targetDbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        preRestoreBackup = `${targetDbPath}.pre_restore_${timestamp}.bak`;
        console.log(`[RESTORE] Creating safety snapshot of current database: ${preRestoreBackup}`);
        fs.copyFileSync(targetDbPath, preRestoreBackup);
    }

    // 3. Clean up stale WAL and SHM files
    const walFile = `${targetDbPath}-wal`;
    const shmFile = `${targetDbPath}-shm`;
    if (fs.existsSync(walFile)) {
        try { fs.unlinkSync(walFile); console.log(`[RESTORE] Removed stale WAL file: ${walFile}`); } catch (e) {
            console.warn(`[RESTORE] Warning: Could not remove WAL file: ${e.message}`);
        }
    }
    if (fs.existsSync(shmFile)) {
        try { fs.unlinkSync(shmFile); console.log(`[RESTORE] Removed stale SHM file: ${shmFile}`); } catch (e) {
            console.warn(`[RESTORE] Warning: Could not remove SHM file: ${e.message}`);
        }
    }

    // 4. Extract/copy to a temporary staging file first
    const stagingPath = `${targetDbPath}.staging_${Date.now()}`;
    try {
        if (resolvedBackup.endsWith('.gz')) {
            const sourceStream = fs.createReadStream(resolvedBackup);
            const gunzipStream = zlib.createGunzip();
            const destinationStream = fs.createWriteStream(stagingPath);
            await pipeline(sourceStream, gunzipStream, destinationStream);
        } else {
            fs.copyFileSync(resolvedBackup, stagingPath);
        }

        // Verify staging file before overwriting target
        const stagingCheck = await verifyBackup(stagingPath);
        if (!stagingCheck.valid) {
            throw new Error(`Staged restoration file corrupted: ${stagingCheck.error}`);
        }

        // Replace target DB with staged copy
        fs.copyFileSync(stagingPath, targetDbPath);
        fs.unlinkSync(stagingPath);

        // 5. Final integrity verification on restored DB
        const db = new Database(targetDbPath, { fileMustExist: true });
        const integrity = db.pragma('integrity_check');
        const isOk = Array.isArray(integrity) && integrity.length > 0 && integrity[0].integrity_check === 'ok';
        if (!isOk) {
            db.close();
            throw new Error(`Post-restore integrity check failed on ${targetDbPath}`);
        }

        const fkCheck = db.pragma('foreign_key_check');
        if (Array.isArray(fkCheck) && fkCheck.length > 0) {
            db.close();
            throw new Error(`Post-restore foreign key check failed on ${targetDbPath}: ${JSON.stringify(fkCheck)}`);
        }

        // 6. Invalidate data exchange epoch if exchange tables are present (Issue #140 / NSIS runbook R5/R10)
        let epochRotated = false;
        try {
            const hasExchangeMeta = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='_exchange_meta'").get();
            if (hasExchangeMeta && hasExchangeMeta.count > 0) {
                process.env.DATABASE_PATH = targetDbPath;
                const { rotateEpoch, ensureTriggers } = require('../services/exchangeStateService');
                const result = rotateEpoch(db, 'STOPPED_WRITER_RESTORE');
                ensureTriggers(db);
                epochRotated = true;
                console.log(`[RESTORE] Successfully rotated data exchange epoch to invalidate prior cursors: ${result.currentEpoch}`);
            }
        } catch (epochErr) {
            console.warn(`[RESTORE] Warning: Could not rotate exchange epoch: ${epochErr.message}`);
        } finally {
            db.close();
        }

        console.log(`[RESTORE] SUCCESS: Database successfully restored to ${targetDbPath}`);
        return {
            success: true,
            preRestoreBackup,
            targetPath: targetDbPath,
            epochRotated
        };
    } catch (err) {
        if (fs.existsSync(stagingPath)) {
            try { fs.unlinkSync(stagingPath); } catch (_) {}
        }
        console.error(`[RESTORE] ERROR: Restoration failed: ${err.message}`);
        throw err;
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node scripts/restore_db.js <path-to-backup.db.gz|path-to-backup.db> [--target <target-db-path>]');
        process.exit(1);
    }

    const backupFile = args[0];
    let targetFile = null;
    const targetIdx = args.indexOf('--target');
    if (targetIdx !== -1 && args[targetIdx + 1]) {
        targetFile = args[targetIdx + 1];
    }

    restoreBackup(backupFile, targetFile)
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error(`[RESTORE] Failed: ${err.message}`);
            process.exit(1);
        });
}

module.exports = { restoreBackup };
