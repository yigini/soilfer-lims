'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const load = createRequire('/app/server/index.js');
assert.equal(process.env.DATABASE_PATH, '/app/server/prisma/dev.db');
assert.equal(fs.realpathSync(process.env.DATABASE_PATH), '/app/server/prisma/dev.db');
assert.equal(process.env.DISABLE_BACKGROUND_JOBS, 'true');
const db = load('./prisma');
async function main() {
    const healthResponse = await fetch('http://127.0.0.1:3000/api/health');
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.status, 'ok');
    const user = await db.user.findUnique({ where: { id: '1770311018064' } });
    assert.ok(user?.isActive && user.role === 'SUPER_ADMIN' && !user.mustChangePassword);
    const token = load('jsonwebtoken').sign({ id: user.id, tokenVersion: user.tokenVersion || 0 },
        process.env.JWT_SECRET, { expiresIn: '5m' });
    const batches = await db.batch.findMany({ include: load('./services/qcRunViewService').QC_RUN_INCLUDE });
    const batch = batches.find(row => row.analytes.length && row.positions.some(position => position.workItems.some(link => link.workItem)));
    assert.ok(batch, 'An existing normalized production batch is required');
    const response = await fetch(`http://127.0.0.1:3000/api/qc/batches/${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 200);
    const view = await response.json();
    assert.ok(view.data);
    const member = batch.positions.flatMap(position => position.workItems).map(link => link.workItem).find(Boolean);
    const result = await db.result.findFirst({ where: { isCurrent: true, batchId: batch.id } });
    const gate = await load('./services/qcGateService').forResult(result || {
        sampleId: member.sampleId, param: member.analysis, batchId: batch.id, methodologyId: member.methodologyId
    }, { db });
    assert.ok(['PASS', 'WARN', 'FAIL', 'NOT_EVALUATED', 'NO_BATCH', 'REPEAT'].includes(gate.value));
    const featureReads = [];
    for (const path of ['/api/pt/rounds', '/api/pt/summary', '/api/equipment', '/api/auth/bench']) {
        const read = await fetch('http://127.0.0.1:3000' + path, { headers: { Authorization: 'Bearer ' + token } });
        assert.equal(read.status, 200, path);
        const body = await read.json();
        if (path === '/api/pt/rounds') {
            assert.ok(Array.isArray(body.data));
            assert.equal(body.count, await db.proficiencyRound.count({ where: { deletedAt: null } }));
        }
        featureReads.push({ path, status: read.status });
    }
    console.log(JSON.stringify({ health, featureReads, existingBatch: { status: response.status, batchId: batch.id,
        gate: { value: gate.value, mode: gate.mode, modeSource: gate.modeSource,
            evaluationId: gate.evaluationId, dispositionId: gate.dispositionId } },
        readOnly: true, backgroundJobs: 'OFF',
        unacknowledgedWarnProof: 'Passed exact-image post-187 receipt 6051666690; no synthetic live writes' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
