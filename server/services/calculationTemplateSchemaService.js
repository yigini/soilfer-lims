const { validateTemplate } = require('../../shared/soilCalculation');
const TABLES = Object.freeze(['CalcTemplate', 'CalcTemplateActivation', 'CalibrationCurve', 'CalibrationPoint', 'ResultCalculation']);
const MARKER = '199_calculation_templates';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function assertPassCoefficients(db) {
    const bad = db.prepare(`SELECT id FROM "CalibrationCurve" WHERE status='PASS' AND (
        slope IS NULL OR intercept IS NULL OR r IS NULL OR rSquared IS NULL OR slope=0
        OR typeof(slope) NOT IN ('integer','real') OR typeof(intercept) NOT IN ('integer','real')
        OR typeof(r) NOT IN ('integer','real') OR typeof(rSquared) NOT IN ('integer','real')
        OR abs(slope)>1.7976931348623157e308 OR abs(intercept)>1.7976931348623157e308
        OR abs(r)>1.7976931348623157e308 OR abs(rSquared)>1.7976931348623157e308) ORDER BY id`).all();
    if (bad.length) throw fail('CALIBRATION_CURVE_PASS_COEFFICIENTS', 'Existing PASS coefficients require review.', bad.map(row => row.id));
}
function classifyCalculationSchema(db, source) {
    const differences = [];
    for (const [table, fields] of [['Lab', ['id']], ['User', ['username']], ['Analysis', ['code', 'unitCode']],
        ['Unit', ['code', 'quantityKind', 'factorToBase']], ['Methodology', ['id', 'analysisCode']],
        ['Batch', ['id', 'labId', 'startedAt']], ['BatchAnalyte', ['id', 'labId', 'batchId', 'methodologyId', 'criteriaSnapshot', 'provenance']],
        ['Result', ['id', 'rawInput', 'numericValue', 'unit']], ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const object = db.prepare('SELECT type FROM sqlite_master WHERE name=?').get(table);
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        if (object?.type !== 'table') differences.push(`${table} absent`);
        for (const field of fields) if (!columns.some(column => column.name === field)) differences.push(`${table}.${field} absent`);
    }
    if (differences.length) throw fail('CALC_PREREQUISITE_REQUIRED', 'Install the prior application releases first.', differences);
    const presentTables = TABLES.map(table => {
        const wanted = source.sql.match(new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`))?.[0];
        if (!wanted || wanted !== source.freshTables[table]) throw fail('CALC_SOURCE_MISMATCH', 'Managed calculation tables must match the fresh Prisma oracle exactly.');
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(table);
        if (actual && (actual.type !== 'table' || normalized(actual.sql) !== normalized(wanted))) differences.push(`${table} differs`);
        return Boolean(actual);
    });
    const indexes = [...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (indexes.length !== 8 || guards.length !== 16 || !guards.some(row => row.name === 'CalibrationCurve_pass_coefficients_guard')) {
        throw fail('CALC_SOURCE_MISMATCH', 'The calculation release needs its eight indexes and sixteen guards.');
    }
    const installed = (wanted, type) => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (actual && (actual.type !== type || normalized(actual.sql) !== normalized(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(actual);
    };
    const presentIndexes = indexes.map(row => installed(row, 'index')), presentGuards = guards.map(row => installed(row, 'trigger'));
    const sources = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256, referenceSha256: source.referenceSha256 };
    // The schema receipt is independent of catalogue availability. Each
    // installed reference has its own immutable row/source receipt.
    const receipt = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256,
        guards: guards.map(row => row.name), backfillCount: 0 };
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) {
        let recorded; try { recorded = JSON.parse(marker.details); } catch { /* Refuse unverifiable receipts. */ }
        if (JSON.stringify(recorded) !== JSON.stringify(receipt)) differences.push('Calculation receipt differs');
    }
    let classification;
    const base = [...presentTables, ...presentIndexes], release = [...presentGuards, Boolean(marker)];
    if ([...base, ...release].every(value => !value)) classification = 'PRE_199';
    else if (base.every(Boolean) && release.every(value => !value)) classification = 'FRESH_PRISMA';
    else if ([...base, ...release].every(Boolean)) classification = 'COMPLETE';
    else differences.push('Calculation installation is partial or unmarked');
    if (differences.length) throw fail('CALC_SCHEMA_MISMATCH', 'Calculation schema differs from the release.', differences);
    if (presentTables.every(Boolean)) {
        // Pin6088166325: verify existing PASS rows before installing any guard.
        assertPassCoefficients(db);
        for (const row of db.prepare('SELECT * FROM "CalcTemplate" ORDER BY id').all()) {
            try { validateTemplate({ ...row, inputs: JSON.parse(row.inputs), parameters: JSON.parse(row.parameters), curve: row.curve == null ? null : JSON.parse(row.curve) }); }
            catch { throw fail('CALC_TEMPLATE_STORED_INVALID', 'An existing definition needs review.', [row.id]); }
        }
    }
    return { classification, sources, receipt, guards: receipt.guards,
        counts: Object.fromEntries(TABLES.map((table, i) => [table, presentTables[i] ? db.prepare(`SELECT count(*) n FROM "${table}"`).get().n : 0])), backfillCount: 0 };
}
module.exports = { TABLES, MARKER, classifyCalculationSchema, assertPassCoefficients };
