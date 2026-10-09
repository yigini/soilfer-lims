const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { bootstrapPtNonconformity } = require('../../scripts/bootstrap_pt_nonconformity');
const owned = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture({ scope = true } = {}) {
    const f = beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: true });
    owned.push(f.file);
    require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: f.file, apply: true });
    require('../../scripts/install_sample_holds').installSampleHolds({ dbPath: f.file, apply: true });
    require('../../scripts/install_reference_materials').installReferenceMaterials({ dbPath: f.file, apply: true });
    require('../../scripts/install_qc_rules').installQcRules({ dbPath: f.file, apply: true });
    require('../../scripts/install_qc_runs').installQcRuns({ dbPath: f.file, apply: true });
    if (scope) require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: f.file, apply: true });
    return f.file;
}
function startup(file) {
    return spawnSync(process.execPath, [path.resolve(__dirname, '../../index.js')], { encoding: 'utf8', timeout: 15000,
        env: { ...process.env, DATABASE_PATH: file, DATABASE_URL: `file:${file}` } });
}
afterAll(() => { for (const file of owned) for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture') + suffix, { force: true });
} });
test('direct startup refuses a fresh Prisma PT/NCR successor without guards or receipts before app/writers load, without changing the database', () => {
    const file = fixture(), before = hash(file), result = startup(file);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('QC_RUN_STARTUP_READY');
    expect(result.stderr).toContain('PT_SCHEMA_MISMATCH');
    expect(result.stderr).toContain('docs/audit/2.6-qc-audit-pt-equipment.md');
    expect(result.stdout).not.toMatch(/Enterprise Server|SCHEDULER/);
    expect(hash(file)).toBe(before);
});

test('direct startup checks #187 before otherwise complete #189 evidence and makes no writes', () => {
    const file = fixture({ scope: false });
    bootstrapPtNonconformity({ dbPath: file, apply: true });
    require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: file, apply: true });
    const before = hash(file), result = startup(file);
    expect(result.status).toBe(1); expect(result.stdout).toContain('QC_RUN_STARTUP_READY');
    expect(result.stderr).toContain('QC_GATE_SCOPE_NOT_INSTALLED');
    expect(result.stdout).not.toMatch(/"event":"(?:PT_STARTUP_READY|RESULT_EQUIPMENT_STARTUP_READY)"|Enterprise Server|SCHEDULER/);
    expect(hash(file)).toBe(before);
});
test('direct startup refuses a corrupted PT receipt without repairing it or loading the application', () => {
    const file = fixture(); bootstrapPtNonconformity({ dbPath: file, apply: true });
    const db = new Database(file);
    db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}', '189_proficiency_evidence'); db.close();
    const before = hash(file), result = startup(file);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('QC_RUN_STARTUP_READY');
    expect(result.stderr).toContain('PT_SCHEMA_MISMATCH');
    expect(result.stdout).not.toMatch(/Enterprise Server|SCHEDULER/);
    expect(hash(file)).toBe(before);
});
test('direct startup refuses missing Result equipment guards before any application writer starts', () => {
    const file = fixture(); bootstrapPtNonconformity({ dbPath: file, apply: true });
    require('../../scripts/install_nonconformity_reports').installNonconformityReports({ dbPath: file, apply: true });
    const before = hash(file), result = startup(file);
    expect(result.status).toBe(1); expect(result.stdout).toContain('PT_STARTUP_READY');
    expect(result.stderr).toContain('RESULT_EQUIPMENT_NOT_INSTALLED');
    expect(result.stdout).not.toMatch(/Enterprise Server|SCHEDULER/); expect(hash(file)).toBe(before);
});
