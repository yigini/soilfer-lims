const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const BACKUPS_DIR = path.resolve(__dirname, '..', 'backups');

async function performBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `soilfer_lims_backup_${timestamp}.db`;
    const targetPath = path.join(BACKUPS_DIR, backupFileName);

    try {
        if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }

        console.log(`[BACKUP] Starting SQLite database backup for ${DB_PATH}...`);
        
        if (!fs.existsSync(DB_PATH)) {
            console.error(`[BACKUP] Database file not found at ${DB_PATH}`);
            return false;
        }

        const db = new Database(DB_PATH, { readonly: true });
        
        // Run safe online backup using better-sqlite3 backup API
        await db.backup(targetPath);
        db.close();

        const stats = fs.statSync(targetPath);
        console.log(`[BACKUP] Backup successful: ${backupFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        // Rotate backups older than 14 days
        const retentionDays = 14;
        const now = Date.now();
        const files = fs.readdirSync(BACKUPS_DIR);

        files.forEach(file => {
            if (file.startsWith('soilfer_lims_backup_') && file.endsWith('.db')) {
                const filePath = path.join(BACKUPS_DIR, file);
                const fileStat = fs.statSync(filePath);
                const ageDays = (now - fileStat.mtimeMs) / (1000 * 60 * 60 * 24);
                if (ageDays > retentionDays) {
                    fs.unlinkSync(filePath);
                    console.log(`[BACKUP] Rotated old backup: ${file} (${ageDays.toFixed(1)} days old)`);
                }
            }
        });

        return true;
    } catch (err) {
        console.error('[BACKUP] Error during backup operation:', err);
        return false;
    }
}

if (require.main === module) {
    performBackup().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { performBackup };
