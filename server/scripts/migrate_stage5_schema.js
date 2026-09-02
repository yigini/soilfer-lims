const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const db = new Database(dbPath);

console.log('Migrating dev.db for Stage 5...');

// 1. Create BatchQcResult table
db.exec(`
CREATE TABLE IF NOT EXISTS BatchQcResult (
    id TEXT PRIMARY KEY NOT NULL,
    batchId TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT,
    expected REAL,
    measured REAL,
    value1 REAL,
    value2 REAL,
    recoveryPct REAL,
    rpd REAL,
    status TEXT NOT NULL,
    details TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batchId) REFERENCES Batch (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS BatchQcResult_batchId_idx ON BatchQcResult (batchId);
`);

// 2. Create ProficiencyRound table
db.exec(`
CREATE TABLE IF NOT EXISTS ProficiencyRound (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    roundRef TEXT NOT NULL,
    labId TEXT NOT NULL,
    analysisCode TEXT NOT NULL,
    assignedValue REAL NOT NULL,
    uncertainty REAL,
    labResult REAL NOT NULL,
    zScore REAL,
    outcome TEXT NOT NULL,
    date DATETIME NOT NULL,
    notes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (labId) REFERENCES Lab (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ProficiencyRound_labId_analysisCode_idx ON ProficiencyRound (labId, analysisCode);
CREATE INDEX IF NOT EXISTS ProficiencyRound_date_idx ON ProficiencyRound (date);
`);

// 3. Add Result.provenance column
function addCol(table, col, type) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) {
        console.log(`Adding ${col} to ${table}...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    } else {
        console.log(`${table}.${col} already exists.`);
    }
}

addCol('Result', 'provenance', "TEXT DEFAULT 'MEASURED'");

console.log('Stage 5 database migration complete.');
db.close();
