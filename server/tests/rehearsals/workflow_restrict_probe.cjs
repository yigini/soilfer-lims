'use strict';
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
try {
    const [caseName, file, id, ...extra] = process.argv.slice(2);
    if (caseName !== 'Sample_Result_restrict' || !file || !id || extra.length) {
        throw new Error('Only the closed Sample_Result_restrict case is accepted.');
    }
    const refusal = rejectedGuardWrite({ actor: 'system:fixture', file,
        statement: 'DELETE FROM Sample WHERE id = ?', parameters: [id],
        expectedGuardCode: 'SQLITE_CONSTRAINT_TRIGGER', expectedConstraint: caseName });
    console.log(JSON.stringify({ passed: true, ...refusal }));
} catch (error) {
    console.log(JSON.stringify({ passed: false, code: 'GUARD_PROBE_RUNNER_REFUSED', message: error.message }));
    process.exitCode = 1;
}
