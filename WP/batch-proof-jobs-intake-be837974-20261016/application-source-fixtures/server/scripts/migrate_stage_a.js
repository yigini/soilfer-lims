const Database = require('better-sqlite3');
const path = require('path');

function migrateDatabase(dbPath) {
    const db = new Database(dbPath, { timeout: 5000 });
    console.log(`[MIGRATE] Checking Stage A columns on: ${dbPath}`);

    // Check Sample table columns
    const sampleCols = new Set(db.prepare("PRAGMA table_info(Sample);").all().map(c => c.name));
    
    if (!sampleCols.has('receivedMass')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN receivedMass REAL;").run();
        console.log("  + Added Sample.receivedMass");
    }
    if (!sampleCols.has('massWarningAcknowledged')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN massWarningAcknowledged INTEGER DEFAULT 0;").run();
        console.log("  + Added Sample.massWarningAcknowledged");
    }
    if (!sampleCols.has('moistureOnArrival')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN moistureOnArrival TEXT;").run();
        console.log("  + Added Sample.moistureOnArrival");
    }
    if (!sampleCols.has('foreignMaterial')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN foreignMaterial TEXT;").run();
        console.log("  + Added Sample.foreignMaterial");
    }
    if (!sampleCols.has('intakePhotos')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN intakePhotos TEXT;").run();
        console.log("  + Added Sample.intakePhotos");
    }
    if (!sampleCols.has('isResubmission')) {
        db.prepare("ALTER TABLE Sample ADD COLUMN isResubmission INTEGER DEFAULT 0;").run();
        console.log("  + Added Sample.isResubmission");
    }

    // Check Analysis table columns
    const analysisCols = new Set(db.prepare("PRAGMA table_info(Analysis);").all().map(c => c.name));
    if (!analysisCols.has('sampleMassRequired')) {
        db.prepare("ALTER TABLE Analysis ADD COLUMN sampleMassRequired REAL DEFAULT 10.0;").run();
        console.log("  + Added Analysis.sampleMassRequired");
    }

    // Seed sensible defaults for specific standard analytical methods
    const massMap = {
        'TEXTURE_PIPETTE': 50.0,
        'TEXTURE_HYDROMETER': 50.0,
        'TEXTURE_LASER': 10.0,
        'PH_H2O': 10.0,
        'PH_CACL2': 10.0,
        'EC_1_5': 10.0,
        'EC_SAT_PASTE': 50.0,
        'TOC_WALKLEY_BLACK': 5.0,
        'TOTAL_N_KJELDAHL': 5.0,
        'OLSEN_P': 5.0,
        'BRAY1_P': 5.0,
        'MEHLICH3': 5.0,
        'EXCH_BASES_NH4OAC': 10.0,
        'CEC_NH4OAC': 10.0,
        'DTPA_MICRONUTRIENTS': 10.0,
        'MIR_SCAN': 5.0,
        'NIR_SCAN': 5.0
    };

    const updateStmt = db.prepare("UPDATE Analysis SET sampleMassRequired = ? WHERE code = ?");
    for (const [code, mass] of Object.entries(massMap)) {
        updateStmt.run(mass, code);
    }
    console.log("  ✓ Updated analytical mass benchmarks in Analysis catalogue");

    db.close();
    console.log("[MIGRATE] Stage A migration complete.");
}

if (require.main === module) {
    const targetDb = process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma', 'dev.db');
    migrateDatabase(targetDb);
}

module.exports = { migrateDatabase };
