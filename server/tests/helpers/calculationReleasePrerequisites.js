// #199 pin6089156077 and standing precedent6089928620: closed owned-file
// release preparation. Only listed QC/workspace fixture successors may call
// this export, with their owned database only.
const fs = require('node:fs'), path = require('node:path');
const Database = require('better-sqlite3');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const { referenceRows } = require('../../services/calculationReferenceLibrary');

function installCalculationReleasePrerequisites(file) {
    require('../../services/workflowStateRules').assertFixtureContext();
    if (arguments.length !== 1 || process.env.NODE_ENV !== 'test' || typeof file !== 'string') throw Error('Calculation prerequisites require one owned test database.');
    const resolved = path.resolve(file), directory = path.resolve(__dirname, '../.tmp');
    if (path.dirname(resolved) !== directory || !/^[^/\\]+\.db$/.test(path.basename(resolved)) ||
        !fs.existsSync(resolved) || fs.realpathSync(resolved) !== resolved ||
        process.env.PRODUCTION_DATABASE_PATH && path.resolve(process.env.PRODUCTION_DATABASE_PATH).toLowerCase() === resolved.toLowerCase())
        throw Error('Calculation prerequisites refuse a working or production database.');
    const codes = new Set(referenceRows().map(row => row.analysisCode));
    const analyses = catalogue.analyses.filter(row => codes.has(row.code)).map(row => ({ code: row.code, name: row.name,
        unitCode: row.unitCode, units: row.units, isGlobal: 1 }));
    if (analyses.length !== codes.size) throw Error('Published calculation catalogue prerequisites are incomplete.');
    const unitCodes = new Set([...analyses.map(row => row.unitCode), ...referenceRows().map(row => row.outputUnit)]);
    const units = UNITS.filter(row => unitCodes.has(row.code));
    if (units.length !== unitCodes.size) throw Error('Published calculation unit prerequisites are incomplete.');
    const db = new Database(resolved, { fileMustExist: true });
    try {
        db.pragma('foreign_keys = ON');
        // Inspect every prerequisite before writing any. Existing catalogue
        // metadata is compared and preserved, never repaired by this helper.
        const absent = (rows, find, table) => rows.filter(row => {
            const current = find(row.code);
            if (!current) return true;
            if (Object.entries(row).some(([key, value]) => current[key] !== value))
                throw Error(`Conflicting calculation prerequisite: ${table}.${row.code}`);
            return false;
        });
        const missingUnits = absent(units, code => db.prepare('SELECT * FROM "Unit" WHERE code=?').get(code), 'Unit');
        const missingAnalyses = absent(analyses, code => db.prepare('SELECT * FROM "Analysis" WHERE code=?').get(code), 'Analysis');
        db.transaction(() => {
            for (const row of missingUnits) db.prepare('INSERT INTO "Unit" (code,display,quantityKind,factorToBase,synonyms,updatedAt) VALUES (?,?,?,?,?,?)')
                .run(row.code,row.display,row.quantityKind,row.factorToBase,row.synonyms,Date.now());
            for (const row of missingAnalyses) db.prepare('INSERT INTO "Analysis" (code,name,unitCode,units,isGlobal) VALUES (?,?,?,?,?)')
                .run(row.code,row.name,row.unitCode,row.units,row.isGlobal);
        }).immediate();
    } finally { db.close(); }
    return require('../../scripts/install_calculation_templates').installCalculationTemplates({ dbPath: resolved, apply: true });
}
module.exports = { installCalculationReleasePrerequisites };
