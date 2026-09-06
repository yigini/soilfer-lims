const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const Database = require('better-sqlite3');

/**
 * Verifies the integrity of a SoilFER-LIMS SQLite backup file (.db or .db.gz).
 *
 * Checks:
 * 1. File existence and decompression if gzipped
 * 2. SQLite PRAGMA integrity_check === 'ok'
 * 3. Existence and queryability of core tables ('User', 'Sample')
 *
 * @param {string} filePath Path to backup file (.db or .db.gz)
 * @returns {Promise<{ valid: boolean, tables: { userCount: number, sampleCount: number }, error?: string }>}
 */
async function verifyBackup(filePath) {
    if (!filePath) {
        throw new Error('No backup file path provided.');
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        return { valid: false, error: `File not found: ${resolvedPath}` };
    }

    const isGz = resolvedPath.endsWith('.gz');
    let targetDbPath = resolvedPath;
    let tempUnzippedPath = null;

    try {
        if (isGz) {
            const timestamp = Date.now();
            tempUnzippedPath = path.join(
                path.dirname(resolvedPath),
                `.verify_${timestamp}_${path.basename(resolvedPath, '.gz')}`
            );

            const sourceStream = fs.createReadStream(resolvedPath);
            const gunzipStream = zlib.createGunzip();
            const destinationStream = fs.createWriteStream(tempUnzippedPath);

            await pipeline(sourceStream, gunzipStream, destinationStream);
            targetDbPath = tempUnzippedPath;
        }

        // Open read-only and verify integrity
        const db = new Database(targetDbPath, { readonly: true, fileMustExist: true });

        const integrity = db.pragma('integrity_check');
        const isOk = Array.isArray(integrity) && integrity.length > 0 && integrity[0].integrity_check === 'ok';

        if (!isOk) {
            db.close();
            return {
                valid: false,
                error: `PRAGMA integrity_check failed: ${JSON.stringify(integrity)}`
            };
        }

        // Check required tables
        let userCount = 0;
        let sampleCount = 0;

        try {
            const userRow = db.prepare('SELECT COUNT(*) as count FROM "User"').get();
            userCount = userRow ? userRow.count : 0;
        } catch (e) {
            db.close();
            return { valid: false, error: `Missing or unreadable User table: ${e.message}` };
        }

        try {
            const sampleRow = db.prepare('SELECT COUNT(*) as count FROM "Sample"').get();
            sampleCount = sampleRow ? sampleRow.count : 0;
        } catch (e) {
            db.close();
            return { valid: false, error: `Missing or unreadable Sample table: ${e.message}` };
        }

        db.close();

        return {
            valid: true,
            tables: {
                userCount,
                sampleCount
            }
        };
    } catch (err) {
        return { valid: false, error: err.message };
    } finally {
        if (tempUnzippedPath && fs.existsSync(tempUnzippedPath)) {
            try {
                fs.unlinkSync(tempUnzippedPath);
            } catch (_) {}
        }
    }
}

if (require.main === module) {
    const backupFile = process.argv[2];
    if (!backupFile) {
        console.error('Usage: node scripts/verify_backup.js <path-to-backup.db.gz|path-to-backup.db>');
        process.exit(1);
    }

    console.log(`[VERIFY] Verifying backup integrity: ${backupFile}`);
    verifyBackup(backupFile)
        .then(result => {
            if (result.valid) {
                console.log(`[VERIFY] SUCCESS: Backup integrity check passed.`);
                console.log(`[VERIFY] Core table counts - Users: ${result.tables.userCount}, Samples: ${result.tables.sampleCount}`);
                process.exit(0);
            } else {
                console.error(`[VERIFY] FAILURE: Backup integrity check failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch(err => {
            console.error(`[VERIFY] ERROR: Unexpected error: ${err.message}`);
            process.exit(1);
        });
}

module.exports = { verifyBackup };
