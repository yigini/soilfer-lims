const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const db = new Database(process.env.DATABASE_PATH || path.resolve('prisma/dev.db'), { readonly: true, fileMustExist: true });
async function main() {
    assert.equal(require('./package.json').version, '1.9.0');
    const health = await fetch('http://127.0.0.1:3000/api/health').then(r => r.json());
    assert.equal(health.version, '1.9.0'); assert.equal(health.status, 'ok');
    for (const [role, id] of [['SUPER_ADMIN', process.env.POSTFLIGHT_ADMIN_ID], ['LAB_MANAGER', process.env.POSTFLIGHT_MANAGER_ID], ['LAB_TECHNICIAN', process.env.POSTFLIGHT_TECH_ID]]) {
        const user = db.prepare('SELECT id, username, role, labId, tokenVersion, countries, projects FROM User WHERE id=?').get(id);
        assert.equal(user.role, role);
        const labId = user.labId || db.prepare('SELECT id FROM Lab ORDER BY id LIMIT 1').get().id;
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, labId: user.labId,
            tokenVersion: user.tokenVersion || 0, countries: JSON.parse(user.countries || '[]'), projects: JSON.parse(user.projects || '[]') }, process.env.JWT_SECRET, { expiresIn: '60s' });
        const response = await fetch(`http://127.0.0.1:3000/api/labs/${encodeURIComponent(labId)}/policies`, {headers: {Authorization: `Bearer ${token}`}});
        assert.equal(response.status, 200);
        const policy = await response.json();
        assert.equal(policy.version, 0);
        assert.equal(Object.keys(policy.values).length, Object.keys(require('./config/policyRegistry').registry).length);
        assert.equal(policy.values['gate.verificationRequired'], false);
        assert.equal(policy.values['referenceMaterials.expiryWarningDays'], require('./config/policyRegistry').strict('referenceMaterials.expiryWarningDays'));
        assert.ok(policy.values['consignment.numberFormat']);
        for (const key of ['qc.duplicateMode','qc.blankLimitMode','qc.crmMode','qc.failAction']) assert.deepEqual(policy.values[key], require('./config/policyRegistry').strict(key));
        assert.ok(['YEARLY', 'NEVER'].includes(policy.values['consignment.sequenceReset']));
        console.log(`PASS ${role}: own-scope policy read, resolved registered settings, inherited version 0`);
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM LabPolicy').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM LabPolicyOverride').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM Report WHERE policyVersion IS NOT NULL').get().n, 0);
    const declaredColumn = db.prepare('PRAGMA table_info("Consignment")').all().find(column => column.name === 'declaredExpectedCount');
    assert.ok(declaredColumn); assert.equal(declaredColumn.notnull, 0);
    const schemaSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Consignment'").get().sql;
    assert.match(schemaSql, /declaredExpectedCount[^,]*CHECK/i);
    const canonicalIndex = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='WorkItem_one_active_per_analysis'").get();
    assert.ok(canonicalIndex); assert.match(canonicalIndex.sql, /WHERE\s+"?duplicateOf"?\s+IS\s+NULL/i);
    assert.equal(db.prepare('SELECT count(*) AS n FROM WorkItem WHERE duplicateOf IS NOT NULL').get().n, 0);
    for (const migration of ['20261004190000_add_workitem_duplicate_marker', '20261004190100_unique_active_workitem', '20261004190200_add_declared_consignment_count']) {
        assert.ok(db.prepare('SELECT 1 FROM _schema_migrations WHERE id=?').get(migration));
    }
    console.log('PASS additive declaration CHECK, canonical partial index, three migration receipts and zero automatic resolutions');
    console.log('PASS SemVer health, policy reads create no rows, existing report policyVersion remains NULL');
}
main().catch(error => {console.error(error.message);process.exitCode=1;}).finally(()=>db.close());
