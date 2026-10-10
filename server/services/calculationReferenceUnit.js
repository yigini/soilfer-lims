// #199 pin6087650856. This scientific unit is independent of lab policy.
const MASS_FRACTION_PERCENT = Object.freeze({ code: 'pct_mass', display: '% (m/m)',
    quantityKind: 'MASS_FRACTION', factorToBase: 10.0, synonyms: '[]' });
const conflict = differences => Object.assign(new Error('The controlled mass-fraction percent unit differs from the release.'),
    { statusCode: 409, code: 'UNIT_CATALOGUE_CONFLICT', differences });

function classifyCalculationUnit(db) {
    const row = db.prepare('SELECT code,display,quantityKind,factorToBase,synonyms FROM "Unit" WHERE code=?').get(MASS_FRACTION_PERCENT.code);
    if (row) {
        const differences = Object.keys(MASS_FRACTION_PERCENT).filter(key => row[key] !== MASS_FRACTION_PERCENT[key]);
        if (differences.length) throw conflict(differences);
    }
    return { classification: row ? 'ALREADY_PRESENT' : 'ABSENT', unitCode: MASS_FRACTION_PERCENT.code,
        unitInsertCount: 0, backfillCount: 0 };
}

// Pin6091749172: catalogue authority owns this unit. Calculation installation
// only verifies it; an absent row is a deferred prerequisite, never an insert.
function installCalculationUnit(db, { apply = false } = {}) {
    const plan = classifyCalculationUnit(db);
    return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN' };
}

module.exports = { MASS_FRACTION_PERCENT, classifyCalculationUnit, installCalculationUnit };
