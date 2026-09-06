const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { performBackup } = require('../../scripts/backup_db');
const { verifyBackup } = require('../../scripts/verify_backup');
const { restoreBackup } = require('../../scripts/restore_db');

describe('Database Backup, Verification & Restore Contract', () => {
    const testTempDir = path.resolve(__dirname, '..', '.tmp_backup_test');
    let generatedBackupPath = null;
    const disposableRestoreTarget = path.join(testTempDir, 'restored_disposable.db');

    beforeAll(() => {
        if (!fs.existsSync(testTempDir)) {
            fs.mkdirSync(testTempDir, { recursive: true });
        }
    });

    afterAll(() => {
        if (generatedBackupPath && fs.existsSync(generatedBackupPath)) {
            try { fs.unlinkSync(generatedBackupPath); } catch (_) {}
        }
        if (fs.existsSync(disposableRestoreTarget)) {
            try { fs.unlinkSync(disposableRestoreTarget); } catch (_) {}
        }
        // Also clean up any safety backup or wal/shm
        const files = fs.readdirSync(testTempDir);
        files.forEach(f => {
            try { fs.unlinkSync(path.join(testTempDir, f)); } catch (_) {}
        });
        try { fs.rmdirSync(testTempDir); } catch (_) {}
    });

    test('1. performBackup generates a valid .db.gz archive using online backup API', async () => {
        generatedBackupPath = await performBackup();
        expect(generatedBackupPath).toBeTruthy();
        expect(typeof generatedBackupPath).toBe('string');
        expect(generatedBackupPath.endsWith('.db.gz')).toBe(true);
        expect(fs.existsSync(generatedBackupPath)).toBe(true);
        const stats = fs.statSync(generatedBackupPath);
        expect(stats.size).toBeGreaterThan(100);
    });

    test('2. verifyBackup validates integrity and core tables in the generated archive', async () => {
        expect(generatedBackupPath).toBeTruthy();
        const result = await verifyBackup(generatedBackupPath);
        expect(result.valid).toBe(true);
        expect(result.tables).toBeDefined();
        expect(typeof result.tables.userCount).toBe('number');
        expect(typeof result.tables.sampleCount).toBe('number');
    });

    test('3. verifyBackup detects corrupted or non-SQLite files', async () => {
        const fakeCorruptPath = path.join(testTempDir, 'corrupt_test.db.gz');
        fs.writeFileSync(fakeCorruptPath, Buffer.from('NOT A REAL GZIP OR SQLITE FILE CONTENT'));

        const result = await verifyBackup(fakeCorruptPath);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();

        fs.unlinkSync(fakeCorruptPath);
    });

    test('4. restoreBackup safely restores into disposable target and passes integrity_check', async () => {
        expect(generatedBackupPath).toBeTruthy();

        // Perform restore to disposable target
        const restoreResult = await restoreBackup(generatedBackupPath, disposableRestoreTarget);
        expect(restoreResult.success).toBe(true);
        expect(restoreResult.targetPath).toBe(disposableRestoreTarget);
        expect(fs.existsSync(disposableRestoreTarget)).toBe(true);

        // Open restored database directly with better-sqlite3 and verify
        const db = new Database(disposableRestoreTarget, { readonly: true });
        const integrity = db.pragma('integrity_check');
        expect(integrity).toEqual([{ integrity_check: 'ok' }]);

        const userCount = db.prepare('SELECT COUNT(*) as count FROM "User"').get().count;
        expect(userCount).toBeGreaterThanOrEqual(0);

        db.close();
    });

    test('5. restoreBackup creates safety pre-restore backup when target already exists', async () => {
        expect(fs.existsSync(disposableRestoreTarget)).toBe(true);

        // Run second restore on existing file
        const secondRestore = await restoreBackup(generatedBackupPath, disposableRestoreTarget);
        expect(secondRestore.success).toBe(true);
        expect(secondRestore.preRestoreBackup).toBeDefined();
        expect(fs.existsSync(secondRestore.preRestoreBackup)).toBe(true);

        // Clean up safety backup
        fs.unlinkSync(secondRestore.preRestoreBackup);
    });
});
