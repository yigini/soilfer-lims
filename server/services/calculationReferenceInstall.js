const { referenceRows } = require('./calculationReferenceLibrary');
const fail = (code, message, differences) => Object.assign(new Error(message), { statusCode: 409, code, differences });
const COLUMNS = Object.freeze(Object.keys(referenceRows()[0]));

function classifyCalculationReferences(db) {
    const absent = [], differences = [];
    for (const wanted of referenceRows()) {
        if (!db.prepare('SELECT code FROM "Analysis" WHERE code=?').get(wanted.analysisCode)) differences.push(`${wanted.id}: analysis absent`);
        if (!db.prepare('SELECT code FROM "Unit" WHERE code=?').get(wanted.outputUnit)) differences.push(`${wanted.id}: native unit absent`);
        const rows = db.prepare('SELECT * FROM "CalcTemplate" WHERE id=? OR (templateKey=? AND labId IS NULL AND version=1)')
            .all(wanted.id, wanted.templateKey);
        if (!rows.length) absent.push(wanted.id);
        else if (rows.length !== 1) differences.push(`${wanted.id}: reference identity conflicts`);
        else for (const key of COLUMNS) if (rows[0][key] !== wanted[key]) differences.push(`${wanted.id}.${key} differs`);
    }
    if (differences.length) throw fail('CALC_REFERENCE_CONFLICT', 'The reference library or its prerequisites differ from the release.', differences);
    return { classification: absent.length ? 'INCOMPLETE' : 'COMPLETE', referenceCount: referenceRows().length,
        missingReferenceIds: absent, referenceInsertCount: 0, activationInsertCount: 0, backfillCount: 0 };
}

// Add only absent immutable references. The enclosing schema installer owns the
// database path and can roll these inserts back with its own immediate transaction.
// There is no read or write of CalcTemplateActivation and no policy mutation.
function installCalculationReferences(db, { apply = false } = {}) {
    const plan = classifyCalculationReferences(db);
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN' };
    return db.transaction(() => {
        const locked = classifyCalculationReferences(db);
        if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP' };
        const missing = new Set(locked.missingReferenceIds);
        const insert = db.prepare(`INSERT INTO "CalcTemplate" (${COLUMNS.map(key => `"${key}"`).join(',')}) VALUES (${COLUMNS.map(() => '?').join(',')})`);
        for (const row of referenceRows().filter(value => missing.has(value.id))) insert.run(...COLUMNS.map(key => row[key]));
        const complete = classifyCalculationReferences(db);
        if (complete.classification !== 'COMPLETE') throw fail('CALC_REFERENCE_CONFLICT', 'The reference library did not install completely.');
        return { ...complete, mode: 'APPLIED', previousClassification: locked.classification, referenceInsertCount: missing.size };
    }).immediate();
}
module.exports = { classifyCalculationReferences, installCalculationReferences };
