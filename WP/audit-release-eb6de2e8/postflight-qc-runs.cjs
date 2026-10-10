const assert = require('node:assert/strict'), Database = require('better-sqlite3'), jwt = require('jsonwebtoken'), path = require('node:path');
const db = new Database(process.env.DATABASE_PATH || path.resolve('prisma/dev.db'), { readonly: true, fileMustExist: true });
const expected = { BatchAnalyte: 6, BatchPosition: 33, BatchPositionWorkItem: 15, BatchPositionReference: 0, QcMeasurement: 24, QcEvaluation: 6, BatchDisposition: 1, BatchEvent: 28 };
async function main() {
    const before = Object.fromEntries(Object.keys(expected).map(name => [name, db.prepare(`SELECT count(*) n FROM ${name}`).get().n]));
    assert.deepEqual(before, expected);
    assert.equal(db.prepare('SELECT count(*) n FROM BatchQcResult').get().n, 18);
    assert.equal(db.prepare('SELECT count(*) n FROM QcRule').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM BatchDisposition WHERE decision=?').get('REPEAT_BATCH').n, 1);
    const opaque = db.prepare("SELECT payload FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").all();
    assert.equal(opaque.length, 1); assert.equal(JSON.parse(opaque[0].payload).rawDecision, 'ACCEPT');
    for (const [role, id] of [['SUPER_ADMIN', process.env.POSTFLIGHT_ADMIN_ID], ['LAB_MANAGER', process.env.POSTFLIGHT_MANAGER_ID], ['LAB_TECHNICIAN', process.env.POSTFLIGHT_TECH_ID]]) {
        const user = db.prepare('SELECT id,username,role,labId,tokenVersion,countries,projects FROM User WHERE id=?').get(id);
        assert.equal(user.role, role);
        const token = jwt.sign({ id: user.id, username: user.username, role, labId: user.labId, tokenVersion: user.tokenVersion || 0,
            countries: JSON.parse(user.countries || '[]'), projects: JSON.parse(user.projects || '[]') }, process.env.JWT_SECRET, { expiresIn: '120s' });
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch('http://127.0.0.1:3000/api/qc/batches', { headers }); assert.equal(response.status, 200);
        const list = (await response.json()).data; assert.ok(Array.isArray(list));
        if (role === 'SUPER_ADMIN') assert.equal(list.length, db.prepare('SELECT count(*) n FROM Batch').get().n);
        for (const batch of list) {
            assert.ok(batch.analytes.length);
            for (const analyte of batch.analytes) {
                const row = db.prepare('SELECT status,provenance FROM BatchAnalyte WHERE id=?').get(analyte.id);
                assert.equal(analyte.status, row.status); assert.equal(row.provenance, 'LEGACY_MIGRATED');
                const latest = db.prepare('SELECT id,verdict FROM QcEvaluation WHERE batchId=? AND analysisCode=? ORDER BY version DESC LIMIT 1').get(batch.id, analyte.analysisCode);
                assert.equal(analyte.evaluation.id, latest.id); assert.equal(analyte.result, latest.verdict);
                const observations = db.prepare('SELECT id,value,rawInput FROM QcMeasurement WHERE batchId=? AND analysisCode=? AND supersededById IS NULL ORDER BY id').all(batch.id, analyte.analysisCode);
                assert.deepEqual(analyte.measurements.map(({ id,value,rawInput }) => ({id,value,rawInput})).sort((a,b)=>a.id.localeCompare(b.id)), observations);
            }
            const detail = await fetch(`http://127.0.0.1:3000/api/qc/batches/${encodeURIComponent(batch.id)}`, { headers }); assert.equal(detail.status, 200);
            const view = (await detail.json()).data; assert.equal(view.id, batch.id); assert.ok(view.positions.length);
        }
        console.log(`PASS ${role}: normalized list/detail, imported states, exact retained observations (${list.length} visible runs)`);
    }
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map(name => [name, db.prepare(`SELECT count(*) n FROM ${name}`).get().n])), before);
    assert.equal(db.pragma('integrity_check', {simple:true}), 'ok'); assert.deepEqual(db.pragma('foreign_key_check'), []);
    console.log('PASS 113 normalized rows, 18 legacy typed rows retained, no read-probe writes');
}
main().catch(error => { console.error(error.message); process.exitCode=1; }).finally(()=>db.close());