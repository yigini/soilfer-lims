const { referenceRows } = require('./calculationReferenceLibrary');
const { loadCalculationTemplateMigrationSource } = require('./calculationTemplateMigrationSource');
const { UNITS } = require('../seeds/units');
const fail = (code, message, differences) => Object.assign(new Error(message), { statusCode: 409, code, differences });
const COLUMNS = Object.freeze(Object.keys(referenceRows()[0]));
const UNIT_COLUMNS = Object.freeze(['code', 'display', 'quantityKind', 'factorToBase', 'synonyms']);
const referenceReceiptId = id => `199_calculation_reference:${id}`;
const referenceReceipt = (row, sourceSha256) => ({ referenceId: row.id, sourceSha256, backfillCount: 0 });

function classifyCalculationReferences(db) {
    const absent = [], differences = [], deferredReferences = [];
    const sourceSha256 = loadCalculationTemplateMigrationSource().referenceSha256;
    const tablesPresent = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='CalcTemplate'").get());
    // Inspect every present controlled prerequisite before any write, including
    // units whose Analysis has not yet been loaded. Local Analysis identity is
    // its exact code; its name, precision and other lab metadata are preserved.
    for (const code of new Set(referenceRows().map(row => row.outputUnit))) {
        const wanted = UNITS.find(row => row.code === code);
        if (!wanted) throw fail('CALC_SOURCE_MISMATCH', 'A published reference unit is missing from the controlled seed.', [code]);
        const current = db.prepare('SELECT code,display,quantityKind,factorToBase,synonyms FROM "Unit" WHERE code=?').get(code);
        if (current && UNIT_COLUMNS.some(key => current[key] !== wanted[key]))
            throw fail(code === 'pct_mass' ? 'UNIT_CATALOGUE_CONFLICT' : 'CALC_REFERENCE_CONFLICT',
                'A present controlled prerequisite differs from its published definition.',
                UNIT_COLUMNS.filter(key => current[key] !== wanted[key]).map(key => `${code}.${key} differs`));
    }
    for (const wanted of referenceRows()) {
        const missingAnalysisCodes = db.prepare('SELECT code FROM "Analysis" WHERE code=?').get(wanted.analysisCode) ? [] : [wanted.analysisCode];
        const missingUnitCodes = db.prepare('SELECT code FROM "Unit" WHERE code=?').get(wanted.outputUnit) ? [] : [wanted.outputUnit];
        const rows = tablesPresent ? db.prepare('SELECT * FROM "CalcTemplate" WHERE id=? OR (templateKey=? AND labId IS NULL AND version=1)')
            .all(wanted.id, wanted.templateKey) : [];
        const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(referenceReceiptId(wanted.id));
        if (rows.length > 1) differences.push(`${wanted.id}: reference identity conflicts`);
        else if (rows.length === 1) for (const key of COLUMNS) if (rows[0][key] !== wanted[key]) differences.push(`${wanted.id}.${key} differs`);
        if (marker) {
            let recorded; try { recorded = JSON.parse(marker.details); } catch { /* Refuse an unverifiable receipt. */ }
            if (JSON.stringify(recorded) !== JSON.stringify(referenceReceipt(wanted, sourceSha256))) differences.push(`${wanted.id}: receipt differs`);
            if (!rows.length) differences.push(`${wanted.id}: receipt has no reference`);
        } else if (rows.length) differences.push(`${wanted.id}: existing reference has no receipt`);
        if (missingAnalysisCodes.length || missingUnitCodes.length) {
            if (rows.length || marker) differences.push(`${wanted.id}: installed evidence has absent prerequisites`);
            deferredReferences.push({ id: wanted.id, code: 'DEFERRED_PREREQUISITE_ABSENT', missingAnalysisCodes, missingUnitCodes });
        } else if (!rows.length && !marker) absent.push(wanted.id);
    }
    if (differences.length) throw fail('CALC_REFERENCE_CONFLICT', 'The reference library or its receipts differ from the release.', differences);
    return { classification: absent.length ? 'INCOMPLETE' : 'COMPLETE', referenceCount: referenceRows().length,
        installedReferenceCount: referenceRows().length - absent.length - deferredReferences.length,
        missingReferenceIds: absent, deferredReferences, deferredReferenceCount: deferredReferences.length,
        referenceInsertCount: 0, referenceReceiptInsertCount: 0, activationInsertCount: 0, backfillCount: 0 };
}

// Independent row/source receipts permit a later catalogue load to install only
// newly eligible references. Existing definitions and receipts are never adopted
// or updated; the enclosing installer rolls all additions back on any refusal.
function installCalculationReferences(db, { apply = false } = {}) {
    const plan = classifyCalculationReferences(db);
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN' };
    return db.transaction(() => {
        const locked = classifyCalculationReferences(db);
        if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP' };
        const missing = new Set(locked.missingReferenceIds);
        const sourceSha256 = loadCalculationTemplateMigrationSource().referenceSha256;
        const insert = db.prepare(`INSERT INTO "CalcTemplate" (${COLUMNS.map(key => `"${key}"`).join(',')}) VALUES (${COLUMNS.map(() => '?').join(',')})`);
        const receipt = db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)');
        for (const row of referenceRows().filter(value => missing.has(value.id))) {
            insert.run(...COLUMNS.map(key => row[key]));
            receipt.run(referenceReceiptId(row.id), JSON.stringify(referenceReceipt(row, sourceSha256)));
        }
        const complete = classifyCalculationReferences(db);
        if (complete.classification !== 'COMPLETE') throw fail('CALC_REFERENCE_CONFLICT', 'The reference library did not install completely.');
        return { ...complete, mode: 'APPLIED', previousClassification: locked.classification,
            referenceInsertCount: missing.size, referenceReceiptInsertCount: missing.size };
    }).immediate();
}
module.exports = { classifyCalculationReferences, installCalculationReferences, referenceReceiptId, referenceReceipt };
