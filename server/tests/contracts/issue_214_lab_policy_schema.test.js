const fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { loadLabPolicyMigrationSource } = require('../../services/labPolicyMigrationSource');
const { installLabPolicySchema, assertLabPolicyStartupReady } = require('../../scripts/install_lab_policy_schema');
const source = loadLabPolicyMigrationSource();
const file = () => assertOwnedTestDatabase(path.resolve(__dirname, '../.tmp/policy_owner_' + randomUUID() + '.db'), 'system:fixture');
const bytes = target => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix, fs.existsSync(target + suffix)
    ? createHash('sha256').update(fs.readFileSync(target + suffix)).digest('hex') : null]));
function absent(column = '') {
    const target = file(), db = new Database(target);
    db.exec('CREATE TABLE "Lab" ("id" TEXT PRIMARY KEY); CREATE TABLE "Report" ("id" TEXT PRIMARY KEY,"history" TEXT' + column + ');');
    db.prepare('INSERT INTO Lab(id) VALUES(?)').run('lab');
    db.prepare('INSERT INTO Report(id,history) VALUES(?,?)').run('report', '{"published":"unchanged"}');
    db.close(); return target;
}
function populate(target) {
    const db = new Database(target);
    db.prepare('INSERT INTO LabPolicy(id,labId,presetCode,version,updatedBy,updatedAt) VALUES(?,?,?,?,?,?)').run('policy','lab','BASIC',17,'manager','2026-10-01');
    db.prepare('INSERT INTO LabPolicyOverride(id,labId,key,value,reason,setBy,revokedAt,revokedBy) VALUES(?,?,?,?,?,?,?,?)')
        .run('override','lab','qc.westgardRules','{ "reject": ["1-3s"], "warn": [] }','Original decision','manager','2026-10-02','other');
    db.prepare('UPDATE Report SET policyVersion=? WHERE id=?').run(16,'report'); db.close();
}
test.each(['', ',"policyVersion" INTEGER'])('ABSENT plans the exact canonical DDL, creates empty storage, preserves history and immediately becomes NO_OP (%s)', column => {
    const target = absent(column), before = bytes(target);
    const dry = installLabPolicySchema({ dbPath: target });
    expect(dry).toMatchObject({ classification: 'ABSENT', mode: 'DRY_RUN', totalChanges: 0, dataWrites: 0, plannedDdlCount: column ? 5 : 6 });
    expect(dry.plannedSql).toBe(column ? source.schemaSql : source.sql);
    expect(bytes(target)).toEqual(before);
    expect(() => assertLabPolicyStartupReady(target)).toThrow(expect.objectContaining({ code: 'LAB_POLICY_STARTUP_REQUIRED', totalChanges: 0 }));
    expect(bytes(target)).toEqual(before);
    expect(installLabPolicySchema({ dbPath: target, apply: true })).toMatchObject({ classification: 'PRESENT', shape: 'CANONICAL', mode: 'APPLIED',
        previousClassification: 'ABSENT', totalChanges: 0, executedDdlCount: column ? 5 : 6, originalRowsPreserved: true });
    const db = new Database(target, { readonly: true });
    expect(db.prepare('SELECT * FROM Report').all()).toEqual([{ id: 'report', history: '{"published":"unchanged"}', policyVersion: null }]);
    for (const name of ['LabPolicy','LabPolicyOverride']) expect(db.prepare('SELECT count(*) n FROM "' + name + '"').get().n).toBe(0);
    db.close(); const installed = bytes(target);
    expect(installLabPolicySchema({ dbPath: target, apply: true })).toMatchObject({ classification: 'PRESENT', mode: 'NO_OP', totalChanges: 0 });
    expect(assertLabPolicyStartupReady(target).classification).toBe('PRESENT'); expect(bytes(target)).toEqual(installed);
});
test('PRESENT canonical policy, override and report history remains byte-identical for dry and apply', () => {
    const target = absent(); installLabPolicySchema({ dbPath: target, apply: true }); populate(target);
    const before = bytes(target);
    for (const apply of [false, true]) expect(installLabPolicySchema({ dbPath: target, apply })).toMatchObject({ classification: 'PRESENT', shape: 'CANONICAL', mode: 'NO_OP', totalChanges: 0 });
    expect(bytes(target)).toEqual(before);
});
test.each([
    ['one table', db => db.exec('DROP TABLE LabPolicyOverride')],
    ['other table absent', db => db.exec('DROP TABLE LabPolicy')],
    ['missing column', db => db.exec('ALTER TABLE LabPolicy DROP COLUMN updatedBy')],
    ['missing canonical index', db => db.exec('DROP INDEX LabPolicyOverride_one_current_scope')],
    ['wrong index', db => db.exec('DROP INDEX LabPolicy_labId_key; CREATE INDEX LabPolicy_labId_key ON LabPolicy(labId)')],
    ['extra column', db => db.exec('ALTER TABLE LabPolicyOverride ADD COLUMN unexpected TEXT')],
    ['extra trigger', db => db.exec('CREATE TRIGGER extra_policy_trigger AFTER INSERT ON LabPolicy BEGIN SELECT 1; END')]
])('refuses %s with zero changes and unchanged DB/WAL/SHM for both modes', (label, alter) => {
    const target = absent(); installLabPolicySchema({ dbPath: target, apply: true });
    const db = new Database(target); alter(db); db.close(); const before = bytes(target);
    for (const apply of [false, true]) expect(() => installLabPolicySchema({ dbPath: target, apply })).toThrow(expect.objectContaining({ code: 'LAB_POLICY_SCHEMA_MISMATCH', totalChanges: 0 }));
    expect(bytes(target)).toEqual(before);
});
test.each([',"policyVersion" TEXT', ',"policyVersion" INTEGER NOT NULL DEFAULT 0'])('refuses a mismatched Report column before creating either table (%s)', column => {
    const target = absent(column), before = bytes(target);
    for (const apply of [false, true]) expect(() => installLabPolicySchema({ dbPath: target, apply })).toThrow(expect.objectContaining({ code: 'LAB_POLICY_SCHEMA_MISMATCH', totalChanges: 0 }));
    expect(bytes(target)).toEqual(before);
});
test('a PRESENT schema with a missing Report column is refused without normalization', () => {
    const target = absent(), db = new Database(target); db.exec(source.schemaSql); db.close(); const before = bytes(target);
    expect(() => installLabPolicySchema({ dbPath: target, apply: true })).toThrow(expect.objectContaining({ code: 'LAB_POLICY_SCHEMA_MISMATCH', totalChanges: 0 }));
    expect(bytes(target)).toEqual(before);
});
test('tampered canonical source refuses before opening a writer, preserving DB/WAL/SHM', () => {
    const target = absent(), before = bytes(target), original = fs.readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => String(name).includes('20261004085500_add_lab_policy_settings')
        ? Buffer.from('tampered') : original(name, ...args));
    try {
        for (const apply of [false, true]) expect(() => installLabPolicySchema({ dbPath: target, apply })).toThrow(expect.objectContaining({ code: 'LAB_POLICY_SOURCE_MISMATCH', totalChanges: 0 }));
        expect(bytes(target)).toEqual(before);
    } finally { spy.mockRestore(); }
});
test('a partial schema in a real active WAL is refused while all original DB/WAL/SHM bytes stay unchanged', () => {
    const target = absent(); installLabPolicySchema({ dbPath: target, apply: true });
    const writer = new Database(target);
    try {
        writer.pragma('journal_mode=WAL');
        writer.exec('ALTER TABLE LabPolicy ADD COLUMN unexpected TEXT');
        const before = bytes(target);
        expect(before['-wal']).not.toBeNull(); expect(before['-shm']).not.toBeNull();
        for (const apply of [false,true]) expect(() => installLabPolicySchema({ dbPath: target, apply }))
            .toThrow(expect.objectContaining({ code: 'LAB_POLICY_SCHEMA_MISMATCH', totalChanges: 0 }));
        expect(bytes(target)).toEqual(before);
    } finally { writer.close(); }
});
test('a real Prisma-created equivalent with stored rows is PRESENT/NO_OP without adding constraints or changing bytes', async () => {
    const target = file(), reader = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { await reader.backup(target); } finally { reader.close(); }
    const db = new Database(target);
    try { db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES(?,?,?,?,?)').run('lab','policy-owner-' + randomUUID(),'Owned lab','TEST','2026-10-01'); }
    finally { db.close(); } populate(target);
    const before = bytes(target);
    expect(installLabPolicySchema({ dbPath: target, apply: true })).toMatchObject({ classification: 'PRESENT', shape: 'PRISMA_EQUIVALENT', mode: 'NO_OP', totalChanges: 0 });
    expect(bytes(target)).toEqual(before);
});
test('empty installed tables resolve shipped Strict/chart/minimum20 through the actual policyService without inserting policy rows', async () => {
    const target = file(), reader = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { await reader.backup(target); } finally { reader.close(); }
    const db = new Database(target);
    expect(db.prepare('SELECT count(*) n FROM LabPolicy').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) n FROM LabPolicyOverride').get().n).toBe(0);
    db.exec('DROP TABLE LabPolicyOverride; DROP TABLE LabPolicy'); db.close();
    installLabPolicySchema({ dbPath: target, apply: true });
    const { PrismaClient } = require('../../prisma_client'), { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + target }) });
    try {
        const lab = await prisma.lab.create({ data: { id: randomUUID(), name: 'No policy row', country: 'TEST', code: randomUUID() } });
        const policy = require('../../services/policyService'), context = { db: prisma, profile: {} };
        expect(await policy.resolve(lab.id, 'qc.lrmLimitMode', context)).toMatchObject({ value: 'CONTROL_CHART', source: 'REGISTRY_DEFAULT', version: 0 });
        expect(await policy.get(lab.id, 'qc.controlChartMinPoints', context)).toBe(20);
        expect(await prisma.labPolicy.count()).toBe(0); expect(await prisma.labPolicyOverride.count()).toBe(0);
    } finally { await prisma.$disconnect(); }
});
test('policy installation and read-only readiness precede214; Docker packages the fixed source outside the database volume', () => {
    const root = path.resolve(__dirname, '../../..'), entrypoint = fs.readFileSync(path.join(root,'docker-entrypoint.sh'),'utf8');
    const startup = fs.readFileSync(path.join(root,'server/index.js'),'utf8');
    expect(entrypoint.indexOf('node scripts/install_lab_policy_schema.js')).toBeLessThan(entrypoint.indexOf('node scripts/install_control_charts.js'));
    expect(startup.indexOf('assertLabPolicyStartupReady')).toBeLessThan(startup.indexOf('assertControlChartStartupReady'));
    expect(fs.readFileSync(path.join(root,'Dockerfile'),'utf8')).toContain('/app/server/.migrations-backup/policy/20261004085500_add_lab_policy_settings/migration.sql');
});
test('the actual shipped Docker post-start policy/chart probe preserves an original WAL-mode database without sidecars', async () => {
    const { qcGateFixture } = require('../helpers/qcGateFixture');
    const f = await qcGateFixture({ fixedWindowPolicy: false, resolvedRules: false });
    await f.db.$disconnect();
    const target = file();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(f.file + suffix))
        fs.copyFileSync(f.file + suffix, target + suffix, fs.constants.COPYFILE_EXCL);
    const writer = new Database(target, { fileMustExist: true });
    try { writer.pragma('journal_mode=WAL'); } finally { writer.close(); }
    const before = bytes(target);
    expect(before['-wal']).toBeNull(); expect(before['-shm']).toBeNull();
    const root = path.resolve(__dirname, '../../..');
    const rehearsal = fs.readFileSync(path.join(root, 'server/scripts/rehearsal_deployment_readiness.cjs'), 'utf8');
    const section = rehearsal.slice(rehearsal.indexOf('const policyAfterOutput='), rehearsal.indexOf('const policyAfter=JSON.parse'));
    const program = section.match(/IMAGE_TAG,'node','-e',\s*`([\s\S]*?)`\s*\]/)[1]
        .replace("'/owned-policy/dev.db'", JSON.stringify(target));
    const actual = JSON.parse(require('node:child_process').execFileSync(process.execPath, ['-e', program],
        { cwd: path.join(root, 'server'), encoding: 'utf8' }).trim());
    expect(actual).toMatchObject({ ready: { classification: 'PRESENT', totalChanges: 0 },
        again: { mode: 'NO_OP', totalChanges: 0 }, charts: { classification: 'COMPLETE_214', totalChanges: 0 },
        counts: { LabPolicy: 0, LabPolicyOverride: 0 }, dbWalShmPreserved: true, secondaryInspectionsOnRetainedSnapshot: true });
    expect(actual.ready.readonlySnapshot.originalDbWalShmSha256).toEqual(before);
    expect(bytes(target)).toEqual(before);
});
