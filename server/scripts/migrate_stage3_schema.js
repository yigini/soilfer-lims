const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const db = new Database(dbPath);

console.log('Migrating dev.db for Stage 3...');

db.exec(`
CREATE TABLE IF NOT EXISTS Unit (
    code TEXT PRIMARY KEY NOT NULL,
    display TEXT NOT NULL,
    quantityKind TEXT NOT NULL,
    factorToBase REAL NOT NULL DEFAULT 1.0,
    synonyms TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS MethodReference (
    id TEXT PRIMARY KEY NOT NULL,
    authority TEXT NOT NULL,
    citation TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LabMethodDefault (
    id TEXT PRIMARY KEY NOT NULL,
    labId TEXT NOT NULL,
    analysisCode TEXT NOT NULL,
    methodologyId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS LabMethodDefault_labId_analysisCode_key ON LabMethodDefault(labId, analysisCode);
`);

function addCol(table, col, type) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) {
        console.log(`Adding ${col} to ${table}...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    } else {
        console.log(`${table}.${col} already exists.`);
    }
}

addCol('Sample', 'matrix', "TEXT DEFAULT 'SOIL'");
addCol('Sample', 'plantPart', 'TEXT');
addCol('Sample', 'growthStage', 'TEXT');

addCol('Analysis', 'unitCode', 'TEXT');
addCol('Analysis', 'matrix', "TEXT DEFAULT 'SOIL'");
addCol('Analysis', 'module', "TEXT DEFAULT 'FERTILITY'");

addCol('Methodology', 'referenceId', 'TEXT');

console.log('Stage 3 DDL schema migration completed successfully.');
db.close();
