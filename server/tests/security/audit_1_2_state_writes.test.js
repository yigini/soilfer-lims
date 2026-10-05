const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { scanSource, scanFiles, deferredSources } = require('../helpers/workflowWriteScanner');

// Exactly the file/export pairs pinned by the author in #179 comment 5986548250.
const exceptions = [
    { file: 'tests/helpers/legacyWorkflowDatabase.js', exportName: 'beforeGuards', foreignKeysOffVariant: 'PROJECT_FK_CORRUPT_SYNTHETIC' },
    { file: 'tests/helpers/rejectedGuardWrite.js', exportName: 'rejectedGuardWrite' }
];
const serverRoot = path.resolve(__dirname, '../..');

test('legacy CLI launchers cannot import any fixture or test module', () => {
    for (const filename of ['scripts/run_manager_dashboard_tasklist_side_by_side.cjs', 'scripts/verify_issue149_probe.cjs', 'scripts/run_test_rehearsal.cjs']) {
        for (const specifier of ['../tests/helpers/workflowFixtures', '../tests/helpers/legacyWorkflowDatabase', '../tests/rehearsals/scenario.cjs']) {
            expect(scanSource(`require('${specifier}')`, filename, exceptions)).toEqual([
                expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
        }
    }
    expect(scanSource("require('../tests/helpers/workflowFixtures')", 'scripts/run_dashboard_i18n_browser_journey.cjs', exceptions)).toEqual([]);
});

test('FK OFF is confined to the exact pinned synthetic branch, export and helper file', () => {
    const source = "function beforeGuards({schemaVariant}){if(schemaVariant==='PROJECT_FK_CORRUPT_SYNTHETIC'){db.pragma('foreign_keys = OFF')}} module.exports={beforeGuards}";
    expect(scanSource(source, exceptions[0].file, exceptions)).toEqual([]);
    for (const probe of [
        source.replace('PROJECT_FK_CORRUPT_SYNTHETIC', 'PROJECT_PRE_TEMPLATE_POLICY'),
        source.replace("if(schemaVariant==='PROJECT_FK_CORRUPT_SYNTHETIC')", ''),
        source.replace("{db.pragma", '{}else{db.pragma'),
        source.replace('foreign_keys = OFF', 'recursive_triggers = OFF'),
        source.replace('foreign_keys = OFF', 'foreign_keys = 0'),
        source.replace('foreign_keys = OFF', 'foreign_keys = OFF; DROP TRIGGER Sample_status_insert_guard'),
        source.replaceAll('beforeGuards', 'other')
    ]) expect(scanSource(probe, exceptions[0].file, exceptions)).toEqual([
        expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
    expect(scanSource(source, 'tests/caller.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
    expect(scanSource(source, exceptions[0].file, [{ file: exceptions[0].file, exportName: 'beforeGuards' }])).toEqual([
        expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
});

test('all handwritten runtime, script, seed and test Sample/WorkItem writes use central authorities', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'server'],
        { cwd: path.resolve(serverRoot, '..'), encoding: 'utf8' }).split(/\r?\n/).filter(file => /\.(?:js|cjs|mjs|py|sql)$/.test(file))
        .map(file => file.slice('server/'.length));
    expect(files).toEqual(expect.arrayContaining(['controllers/sampleController.js', 'services/sampleStateService.js',
        'services/workItemStateService.js', 'tests/contracts/audit_1_2_state_authority.test.js', 'seed.js']));
    const violations = scanFiles(serverRoot, [...new Set(files)], exceptions);
    const deferred = violations.filter(finding => finding.code === 'DEFERRED_SYNTHETIC_FAULT_FIXTURE');
    expect(deferred.length).toBeGreaterThan(0);
    expect(deferred.every(finding => finding.file === 'scripts/rehearsal_docker_boundary.cjs' && finding.detail.includes('#245'))).toBe(true);
    expect(violations.filter(finding => finding.code !== 'DEFERRED_SYNTHETIC_FAULT_FIXTURE')).toEqual([]);
});

test.each([
    "import {execSync as launch} from 'node:child_process';launch(\"node -e `db.exec('DELETE FROM Sample')`\")",
    "import {writeFileSync as saveProgram} from 'node:fs';saveProgram('program.cjs',\"db.exec('UPDATE WorkItem SET metadata = 1')\")",
    "const {spawnSync}=require('node:child_process');spawnSync('node',['-e',\"db.exec('INSERT INTO Sample (id) VALUES (1)')\"])",
    "const cp=require('child_process');const code=`db.prepare('UPDATE \\\"WorkItem\\\" SET result = 1')`;cp.spawn('node',['-e',code])",
    "const cp=require('child_process');cp.exec(`node -e \\\"db.exec('delete from \\\\\\\"Sample\\\\\\\"')\\\"`)",
    "const fs=require('fs');fs.writeFileSync('program.cjs',`db.exec('UPDATE \\\"WorkItem\\\" SET status = 1')`)",
    "const fs=require('fs');fs.writeFile('program.mjs','db.exec(`insert into [WorkItem] (id) values (1)`)')",
    "new Function(\"db.exec('INSERT INTO \\\"Sample\\\" (id) VALUES (1)')\")",
    "const vm=require('vm');vm.runInNewContext(\"db.exec('DELETE FROM WorkItem')\")",
    "const vm=require('vm');new vm.Script(\"db.exec('UPDATE Sample SET metadata = 1')\")"
])('embedded literal programs cannot hide workflow DML: %s', source => {
    expect(scanSource(source, 'scripts/new-embedded-program.cjs', exceptions))
        .toEqual([expect.objectContaining({ code: 'EMBEDDED_WORKFLOW_WRITE' })]);
});

test('a new physical source file with embedded node-e Sample inserts fails the inventory', () => {
    const file = path.resolve(serverRoot, 'tests/.tmp', `embedded-canary-${randomUUID()}.cjs`);
    // A source fixture is stored as bytes for inspection; it is never executed.
    const program = "const {spawn}=require('child_process');spawn('node',['-e',\"db.exec('INSERT INTO Sample (id) VALUES (1)')\"]);";
    fs.writeFileSync(file, Buffer.from(program, 'utf8'), { flag: 'wx' });
    try { expect(scanFiles(serverRoot, [path.relative(serverRoot, file)], exceptions))
        .toEqual([expect.objectContaining({ code: 'EMBEDDED_WORKFLOW_WRITE' })]); }
    finally { fs.rmSync(file); }
});

test('the sole deferral is byte-bound inventory; a one-byte change becomes a failing embedded writer', () => {
    expect(exceptions).toHaveLength(2);
    expect(deferredSources).toEqual([{ path: 'server/scripts/rehearsal_docker_boundary.cjs',
        sha256: 'c215311a252b83fb95dcf410d4e9c9bc79c24864ca782123d19631472b226f32',
        reason: '#146 synthetic Docker fault adapter; deferred, see #245' }]);
    const filename = 'scripts/rehearsal_docker_boundary.cjs', source = fs.readFileSync(path.join(serverRoot, filename), 'utf8');
    const reported = scanSource(source, filename, exceptions);
    expect(reported.length).toBeGreaterThan(0);
    expect(reported.every(finding => finding.code === 'DEFERRED_SYNTHETIC_FAULT_FIXTURE')).toBe(true);
    const changed = scanSource(`${source}\n`, filename, exceptions);
    expect(changed).toHaveLength(reported.length);
    expect(changed.every(finding => finding.code === 'EMBEDDED_WORKFLOW_WRITE')).toBe(true);
});

test.each([
    "prisma.sample.create({data: {originalId:'fixture'}})",
    "const model=prisma.workItem; model.updateMany({data:{status:'ACCEPTED'}})",
    "const {sample: alias}=prisma; const data={status:'APPROVED'}; alias.update({data})",
    "const data={clientName:'safe'}; data.status='APPROVED'; prisma.sample.update({data})",
    "const data={clientName:'safe'}; const key='status'; data[key]='APPROVED'; prisma.sample.update({data})",
    "const patch={status:'APPROVED'}; const data={...patch}; prisma.sample.update({data})",
    "const args={data:{status:'APPROVED'}}; prisma.sample.update(args)",
    "const {update: write}=prisma.sample; write({data:{status:'APPROVED'}})",
    "const write=prisma.sample.update.bind(prisma.sample); write({data:{status:'APPROVED'}})",
    "const entity='workItem'; prisma[entity].upsert({create:{sampleId:'s'},update:{status:'ACCEPTED'}})",
    "const delegate=prisma[Math.random()?'sample':'workItem']; delegate.create({data:{}})",
    "function mutate(data) { prisma.sample.update({data:{...data}}) }",
    "const sql='UPDATE Sample SET '+'status = ?'; db.prepare(sql).run('APPROVED')",
    "const table='WorkItem'; db.exec(`INSERT INTO ${table} (id,status) VALUES ('x','ACCEPTED')`)",
    "prisma.$executeRaw`UPDATE WorkItem SET status=${'ACCEPTED'}`",
    "function rawWrite(statement) { db.exec(statement) }",
    "const fields=['status = ?']; db.prepare(`UPDATE Sample SET ${fields.join(',')}`)"
])('the source guard catches aliases, data variables and spreads: %s', source => {
    expect(scanSource(source, 'tests/nonAllowlisted.test.js', exceptions).length).toBeGreaterThan(0);
});

test('a real temporary non-allowlisted test file fails the source guard', () => {
    const file = path.resolve(serverRoot, 'tests/.tmp', `source-canary-${randomUUID()}.test.js`);
    fs.writeFileSync(file, "const alias=prisma.sample; const patch={status:'APPROVED'}; alias.update({data:{...patch}})");
    try {
        expect(scanFiles(serverRoot, [path.relative(serverRoot, file)], exceptions)).toEqual([
            expect.objectContaining({ code: 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY', detail: 'Sample update' })]);
    } finally { fs.rmSync(file); }
});

test('a shadowed file reader cannot impersonate a known schema load', () => {
    const source = "const path=require('node:path'); const fs={readFileSync:()=>statement}; db.exec(fs.readFileSync(path.resolve(__dirname,'../../scripts/schema/full_application_schema.sql'),'utf8'));";
    expect(scanSource(source, 'tests/contracts/shadow-probe.js', exceptions))
        .toEqual([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]);
});

test('the two exceptions apply to the named export only, never to the caller or the rest of its file', () => {
    const allowed = "function beforeGuards(){db.exec('INSERT INTO Sample (id,status) VALUES (1,2)')} module.exports={beforeGuards}";
    expect(scanSource(allowed, exceptions[0].file, exceptions)).toEqual([]);
    expect(scanSource(allowed.replaceAll('beforeGuards', 'other'), exceptions[0].file, exceptions)).toHaveLength(1);
    expect(scanSource(allowed, 'tests/caller.test.js', exceptions)).toHaveLength(1);
    expect(scanSource("function createSample(){prisma.sample.create({data:{}})}", 'services/workItemStateService.js', exceptions)).toHaveLength(1);
});

test.each(exceptions)('runtime cannot import the test helper $file', entry => {
    const specifier = `../${entry.file}`;
    expect(scanSource(`const helpers=require('${specifier}')`, 'controllers/probe.js', exceptions))
        .toEqual([expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
    expect(scanSource(`const source='../tests/helpers/'+'${path.basename(entry.file)}'; require(source)`, 'controllers/probe.js', exceptions)).toHaveLength(1);
    expect(scanSource(`import helper from '${specifier}'`, 'controllers/probe.mjs', exceptions)).toHaveLength(1);
    expect(scanSource(`require('${specifier}')`, 'tests/probe.test.js', exceptions)).toEqual([]);
});

test('metadata-only updates and other models are permitted, and guard disabling is always refused', () => {
    expect(scanSource("const data={clientName:'Corrected'}; prisma.sample.update({data}); prisma.result.create({data:{status:'IMPORTED'}})", 'controllers/probe.js', exceptions)).toEqual([]);
    expect(scanSource("function beforeGuards(){db.exec('PRAGMA foreign_keys = OFF')}", exceptions[0].file, exceptions))
        .toEqual([expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
    expect(scanSource("db.exec('DROP TRIGGER Sample_status_update_guard')", 'scripts/probe.js', exceptions)).toHaveLength(1);
    expect(scanSource("db.exec('DROP TRIGGER unrelated_exchange_trigger; UPDATE Sample SET updatedAt = 1 WHERE status = 2')", 'scripts/probe.js', exceptions)).toEqual([]);
    expect(scanSource("const pattern=/x/; pattern.exec(text)", 'scripts/probe.js', exceptions)).toEqual([]);
});

test.each([
    "db.pragma('foreign_keys = OFF')",
    "const setting='recursive_triggers=0'; database.pragma(setting)",
    "const {pragma: configure}=db; configure('foreign_keys=0')",
    "const method='pragma'; client[method]('foreign_keys = OFF')"
])('native pragma calls cannot disable constraints: %s', source => {
    expect(scanSource(source, 'tests/probe.test.js', exceptions))
        .toEqual([expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
});

test('native pragma reads and enabled constraints remain permitted', () => {
    expect(scanSource("db.pragma('foreign_keys = ON'); db.pragma('foreign_keys', {simple:true}); db.pragma('busy_timeout = 5000')",
        'tests/probe.test.js', exceptions)).toEqual([]);
});

test.each([
    ['UPDATE Consignment SET declaredExpectedCount = ? WHERE id = ?', null],
    ['UPDATE Sample SET status = ? WHERE id = ?', 'RAW_WORKFLOW_SQL'],
    ['PRAGMA foreign_keys = OFF', 'WORKFLOW_GUARD_DISABLED']
])('loaded SQL is inspected without a caller exemption: %s', (sql, code) => {
    const name = `loaded-source-${randomUUID()}.sql`, file = path.resolve(serverRoot, 'tests/.tmp', name);
    fs.writeFileSync(file, sql, { flag: 'wx' });
    try {
        const source = `const fs=require('node:fs'), path=require('node:path'); const sql=fs.readFileSync(path.join(__dirname,'${name}'),'utf8'); db.exec(sql);`;
        const found = scanSource(source, 'tests/.tmp/loaded-source-probe.cjs', exceptions);
        expect(found).toEqual(code ? [expect.objectContaining({ code })] : []);
    } finally { fs.rmSync(file); }
});
