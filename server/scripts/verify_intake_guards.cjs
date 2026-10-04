'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function verify() {
    const root = path.resolve(__dirname, '..');
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    const reception = read('controllers/receptionController.js');
    const sample = read('controllers/sampleController.js');
    const intake = read('services/intakeService.js');
    const preparation = read('services/intakePreparationService.js');
    assert.ok(reception.includes("require('../services/intakeService')") && reception.includes('intake.intake(tx,'), 'Reception must use shared intake');
    assert.ok(sample.includes("require('../services/intakeService').acceptSample(tx,"), 'Acceptance must use shared intake');
    assert.ok(intake.includes('AMBIGUOUS_PROVENANCE_HOLD') && preparation.includes('AMBIGUOUS_PROVENANCE_HOLD'), 'Both preparation and commit must guard provenance');

    // Module initialization can open SQLite. Give this probe its own empty DB,
    // even when invoked outside a disposable container; never open an installed DB.
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-guard-probe-'));
    process.env.DATABASE_PATH = path.join(temporary, 'probe.db');
    process.env.NODE_ENV = 'test';
    const service = require('../services/intakeService');
    try {
        const held = { id: 'disposable-held-sample', updatedAt: new Date(), metadata: JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }) };
        let writes = 0;
        const tx = { sample: { findUnique: async () => held, update: async () => { writes++; throw new Error('Unexpected held-sample write'); } } };
        await assert.rejects(service.commitPrepared(tx, { sample: held, responseKind: 'accepted', body: {}, user: {}, updateData: {}, now: new Date() }), error => error.code === 'AMBIGUOUS_PROVENANCE_HOLD' && error.statusCode === 409);
        assert.equal(writes, 0);
        console.log('GUARDS_VERIFIED: shared intake wiring; held acceptance refused with 409 and zero writes');
    } finally {
        await require('../prisma').$disconnect();
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
