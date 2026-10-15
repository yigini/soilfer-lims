const Database = require('better-sqlite3');
const path = require('path');

function migrateStage6(dbPath) {
    const targetDb = dbPath || path.join(__dirname, '..', 'prisma', 'dev.db');
    console.log(`Migrating ${targetDb} for Stage 6...`);
    const db = new Database(targetDb);

    // 1. Create ExternalMapping table
    db.exec(`
        CREATE TABLE IF NOT EXISTS "ExternalMapping" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "entityType" TEXT NOT NULL,
            "entityKey" TEXT NOT NULL,
            "scheme" TEXT NOT NULL,
            "code" TEXT NOT NULL,
            "uri" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ExternalMapping_entityType_entityKey_idx" ON "ExternalMapping"("entityType", "entityKey");
        CREATE INDEX IF NOT EXISTS "ExternalMapping_scheme_code_idx" ON "ExternalMapping"("scheme", "code");
    `);
    console.log('  ✓ Created ExternalMapping table and indexes.');

    // 2. Drop dormant glosis_* columns from Analysis if they exist
    const analysisCols = db.prepare("PRAGMA table_info('Analysis')").all().map(c => c.name);
    const glosisAnalysisCols = ['glosisProperty', 'glosisPropertyUri', 'glosisAttribute', 'glosisUri'];
    for (const col of glosisAnalysisCols) {
        if (analysisCols.includes(col)) {
            try {
                db.exec(`ALTER TABLE "Analysis" DROP COLUMN "${col}"`);
                console.log(`  ✓ Dropped Analysis.${col}`);
            } catch (err) {
                console.warn(`  ⚠ Could not drop Analysis.${col}: ${err.message}`);
            }
        }
    }

    // 3. Drop dormant glosis_* columns from Methodology if they exist
    const methodCols = db.prepare("PRAGMA table_info('Methodology')").all().map(c => c.name);
    const glosisMethodCols = ['glosisProcedure', 'glosisNotation', 'glosisDefinition', 'glosisReference', 'glosisCitation', 'glosisUri'];
    for (const col of glosisMethodCols) {
        if (methodCols.includes(col)) {
            try {
                db.exec(`ALTER TABLE "Methodology" DROP COLUMN "${col}"`);
                console.log(`  ✓ Dropped Methodology.${col}`);
            } catch (err) {
                console.warn(`  ⚠ Could not drop Methodology.${col}: ${err.message}`);
            }
        }
    }

    db.close();
    console.log('Stage 6 database migration complete.');
}

if (require.main === module) {
    migrateStage6();
}

module.exports = { migrateStage6 };
