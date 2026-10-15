const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');
const BACKUPS_DIR = process.env.BACKUP_PATH ? path.resolve(process.env.BACKUP_PATH) : path.resolve(__dirname, '..', 'backups');

async function performBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupBaseName = `soilfer_lims_backup_${timestamp}`;
    const tempDbPath = path.join(BACKUPS_DIR, `${backupBaseName}.tmp.db`);
    const finalGzPath = path.join(BACKUPS_DIR, `${backupBaseName}.db.gz`);

    try {
        if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }

        console.log(`[BACKUP] Starting online SQLite backup from ${DB_PATH}...`);
        
        if (!fs.existsSync(DB_PATH)) {
            console.error(`[BACKUP] Database file not found at ${DB_PATH}`);
            return false;
        }

        // 1. Safe online backup using better-sqlite3 backup API with busy_timeout
        const db = new Database(DB_PATH, { readonly: true, timeout: 10000 });
        await db.backup(tempDbPath);
        db.close();

        const rawStats = fs.statSync(tempDbPath);
        console.log(`[BACKUP] Online snapshot complete (${(rawStats.size / 1024 / 1024).toFixed(2)} MB). Compressing with gzip...`);

        // 2. Stream-compress the backup using zlib
        const sourceStream = fs.createReadStream(tempDbPath);
        const gzipStream = zlib.createGzip({ level: 9 });
        const destinationStream = fs.createWriteStream(finalGzPath);

        await pipeline(sourceStream, gzipStream, destinationStream);

        // 3. Remove raw uncompressed temporary file
        fs.unlinkSync(tempDbPath);

        const gzStats = fs.statSync(finalGzPath);
        const ratio = ((1 - (gzStats.size / rawStats.size)) * 100).toFixed(1);
        console.log(`[BACKUP] Gzip compression successful: ${path.basename(finalGzPath)} (${(gzStats.size / 1024 / 1024).toFixed(2)} MB, ${ratio}% reduction)`);

        // 4. Rotate backups older than 14 days
        const retentionDays = 14;
        const now = Date.now();
        const files = fs.readdirSync(BACKUPS_DIR);

        files.forEach(file => {
            if (file.startsWith('soilfer_lims_backup_') && (file.endsWith('.db.gz') || file.endsWith('.db'))) {
                const filePath = path.join(BACKUPS_DIR, file);
                try {
                    const fileStat = fs.statSync(filePath);
                    const ageDays = (now - fileStat.mtimeMs) / (1000 * 60 * 60 * 24);
                    if (ageDays > retentionDays) {
                        fs.unlinkSync(filePath);
                        console.log(`[BACKUP] Rotated old backup: ${file} (${ageDays.toFixed(1)} days old)`);
                    }
                } catch (e) {}
            }
        });

        return finalGzPath;
    } catch (err) {
        console.error('[BACKUP] Error during backup operation:', err);
        if (fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch (e) {}
        }
        return false;
    }
}

if (require.main === module) {
    performBackup().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { performBackup };
