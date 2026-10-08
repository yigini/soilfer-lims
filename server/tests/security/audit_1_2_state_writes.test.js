const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { scanSource, scanFiles, deferredSources } = require('../helpers/workflowWriteScanner');

test.each([
    ['controllers/canary.js', 'prisma.workItem.deleteMany({where:{sampleId:id}})'],
    ['tests/contracts/canary.test.js', 'prisma.sample.deleteMany({where:{id}})'],
    ['controllers/canary.js', 'state.removeUnstartedWorkItems(prisma, {}, {actor,reason})'],
    ['controllers/canary.js', 'prisma.project.create({data:{samples:{create:[{status:"APPROVED"}]}}})'],
    ['controllers/canary.js', 'const nested={create:[{status:"APPROVED"}]};prisma.project.create({data:{samples:nested}})'],
    ['controllers/canary.js', 'const key="workItems";const op="deleteMany";prisma.sample.update({data:{[key]:{[op]:{}}}})'],
    ['controllers/canary.js', 'prisma.sample.create({data:{workItems:{connect:[{id:otherSampleItem}]}}})'],
    ['controllers/canary.js', 'const relation={set:[{id}]};prisma.project.update({data:{samples:relation}})'],
    ['controllers/canary.js', 'const op="disconnect";prisma.sample.update({data:{workItems:{[op]:[{id}]}}})'],
    ['controllers/canary.js', 'prisma.sample.update({where:{id},data:{workItems:{upsert:{create:{status:"ACCEPTED"},update:{status:"ACCEPTED"}}}}})'],
    ['controllers/canary.js', 'prisma.sample?.update({data:{status:"APPROVED"}})'],
    ['controllers/canary.js', 'prisma.sample.update?.({data:{status:"APPROVED"}})'],
    ['controllers/canary.js', 'db.prepare("UPDATE main.Sample SET status = ?")'],
    ['controllers/canary.js', 'db.prepare("UPDATE OR ABORT main.WorkItem SET status = ?")'],
    ['controllers/canary.js', 'db.exec("REPLACE INTO Sample (id,status) VALUES (1,2)")'],
    ['controllers/canary.js', 'db.exec("INSERT OR REPLACE INTO main.WorkItem (id,status) VALUES (1,2)")']
])('audit gap form is one scanner finding (%s / %s)', (filename, source) => {
    expect(scanSource(source, filename)).toHaveLength(1);
});

test('the original rehearsal cannot reintroduce a direct Sample deletion', () => {
    expect(scanSource('db.prepare("DELETE FROM Sample WHERE id = ?").run(id)', 'tests/rehearsals/verify_issue149_working_review.cjs'))
        .toHaveLength(1);
});

test.each(['connect', 'set', 'disconnect'])('nested %s association has one actual authority finding', command => {
    expect(scanSource(`prisma.project.update({data:{samples:{${command}:[{id}]}}})`, 'controllers/canary.js'))
        .toEqual([expect.objectContaining({ code: 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY' })]);
});

test.each(['unknown case', 'configured candidate'])('the closed FK runner refuses %s', kind => {
    const candidate = process.env.DATABASE_PATH;
    try {
        execFileSync(process.execPath, [path.resolve(serverRoot, 'tests/rehearsals/workflow_restrict_probe.cjs'),
            kind === 'unknown case' ? 'UNKNOWN' : 'Sample_Result_restrict', candidate, 'sample-id'],
        { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test', DATABASE_PATH: candidate, DATABASE_URL: `file:${candidate}` } });
        throw new Error('Refusal runner unexpectedly succeeded');
    } catch (error) {
        expect(error.status).toBe(1);
        expect(JSON.parse(error.stdout)).toMatchObject({ passed: false, code: 'GUARD_PROBE_RUNNER_REFUSED' });
    }
});

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

test.each(['sql', 'schemaSql', 'guardsSql'])('the #190 source resolver inspects the exact checked-in %s asset', field => {
    const source = `const { loadWorkAttemptMigrationSource } = require('../services/workAttemptMigrationSource');
        const release = loadWorkAttemptMigrationSource(); db.exec(release.${field});`;
    expect(scanSource(source, 'scripts/attempt-source-probe.cjs', exceptions)).toEqual([]);
});
test.each(['services/probe.js','controllers/probe.js','routes/probe.js','scripts/probe.js','../client/src/probe.js'])(
    'the #190 historical factory cannot be imported by runtime or client: %s', filename => {
        const specifier = filename.startsWith('../client') ? '../../server/tests/helpers/workAttemptHistoricalFixtures'
            : '../tests/helpers/workAttemptHistoricalFixtures';
        expect(scanSource(`require('${specifier}')`, filename, exceptions)).toEqual([
            expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
    });
test('the #190 factory import allowlist is exact, including the named spectral refusal', () => {
    const source = "require('../helpers/workAttemptHistoricalFixtures')";
    for (const filename of ['audit_3_1_attempt_backfill_plan.test.js','audit_3_1_attempt_install.test.js','audit_3_1_attempt_sql_guards.test.js']) {
        expect(scanSource(source, 'tests/contracts/' + filename, exceptions)).toEqual([]);
    }
    expect(scanSource(source, 'tests/contracts/new_attempt.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    expect(scanSource(source, 'tests/contracts/audit_1_2_spectral_state.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    const named = `test('a literal pre-190 measured orphan refuses the installer and COMPLETE startup without writes',()=>{${source}})`;
    expect(scanSource(named, 'tests/contracts/audit_1_2_spectral_state.test.js', exceptions)).toEqual([]);
    expect(scanSource(named.replace('a literal pre-190 measured orphan refuses the installer and COMPLETE startup without writes','another route test'),
        'tests/contracts/audit_1_2_spectral_state.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
});

test('the #190 composite positive fixture has exactly two named publication callers', () => {
    const names = ['composite texture governs sand, silt, clay and texture without duplicating values',
        'RETURN of composite texture invalidates all four current parameters'];
    const setup = "const {createCompositeTextureExecutionFixture}=require('../helpers/workAttemptFixtures');await createCompositeTextureExecutionFixture(db,{data:rows});";
    for (const name of names) {
        const source = `test('${name}',async()=>{${setup}})`;
        expect(scanSource(source, 'tests/contracts/audit_0_3_publication.test.js', exceptions)).toEqual([]);
        expect(scanSource(source, 'tests/contracts/new_composite.test.js', exceptions)).toEqual([
            expect.objectContaining({ code: 'POSITIVE_FIXTURE_CALLER_NOT_ALLOWED' })]);
    }
    for (const source of [
        setup,
        `test('another publication case',async()=>{${setup}})`,
        `test('${names[0]}',async()=>{${setup.replace('await createCompositeTextureExecutionFixture(db,{data:rows});', 'runLater(createCompositeTextureExecutionFixture);')}})`,
        "const fixtures=require('../helpers/workAttemptFixtures');fixtures.createCompositeTextureExecutionFixture(db,{data:rows});",
        "require('../helpers/workAttemptFixtures')[name](db,{data:rows});"
    ]) expect(scanSource(source, 'tests/contracts/audit_0_3_publication.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'POSITIVE_FIXTURE_CALLER_NOT_ALLOWED' })]);
    // A valid import never grants direct workflow or Result-write permission.
    expect(scanSource(`test('${names[0]}',async()=>{${setup}prisma.result.create({data:{}});})`,
        'tests/contracts/audit_0_3_publication.test.js', exceptions)).toEqual([
        expect.objectContaining({ code: 'RESULT_CREATE_OUTSIDE_AUTHORITY' })]);
});

test.each(['services/probe.js', 'controllers/probe.js', 'routes/probe.js', 'scripts/probe.js', '../client/src/probe.js'])(
    'positive attempt fixtures cannot be imported by runtime or client: %s', filename => {
        const specifier = filename.startsWith('../client') ? '../../server/tests/helpers/workAttemptFixtures'
            : '../tests/helpers/workAttemptFixtures';
        expect(scanSource(`require('${specifier}')`, filename, exceptions)).toEqual([
            expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
    });
test.each(['sample','workItem','result'])('a direct %s write in a #190 test remains a finding outside the factory', model => {
    expect(scanSource(`prisma.${model}.create({data:{}})`, 'tests/contracts/audit_3_1_attempt_install.test.js', exceptions))
        .toEqual([expect.objectContaining({ code: model === 'result' ? 'RESULT_CREATE_OUTSIDE_AUTHORITY' : 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY' })]);
});
test.each(['factory','DDL'])('a changed #190 historical %s digest is a scanner finding', kind => {
    const factory = 'tests/helpers/workAttemptHistoricalFixtures.js';
    const originalRead = fs.readFileSync, source = originalRead(path.resolve(serverRoot, factory), 'utf8');
    let spy;
    if (kind === 'DDL') {
        const target = path.resolve(serverRoot, 'tests/helpers/fixtures/pre190_full_application_schema.sql');
        spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
            const value = originalRead(file, ...args);
            return typeof file === 'string' && path.resolve(file) === target ? Buffer.concat([value, Buffer.from('\n')]) : value;
        });
    }
    try {
        expect(scanSource(kind === 'factory' ? source + '\n' : source, factory, exceptions)).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'HISTORICAL_FIXTURE_SOURCE_MISMATCH' })]));
    } finally { spy?.mockRestore(); }
});

test.each(['services/workAttemptMigrationSource.js', 'prisma/migrations/20261008000100_work_attempt_contract/migration.sql'])(
    'an altered #190 loader or SQL digest restores a failing source finding: %s', target => {
        const originalRead = fs.readFileSync;
        const changedFile = path.resolve(serverRoot, target);
        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
            const bytes = originalRead(file, ...args);
            if (typeof file !== 'string' || path.resolve(file) !== changedFile) return bytes;
            return Buffer.isBuffer(bytes) ? Buffer.concat([bytes, Buffer.from('\n')]) : bytes + '\n';
        });
        try {
            const source = "const { loadWorkAttemptMigrationSource } = require('../services/workAttemptMigrationSource'); const release = loadWorkAttemptMigrationSource(); db.exec(release.sql);";
            expect(scanSource(source, 'scripts/attempt-source-probe.cjs', exceptions)).toEqual([
                expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]);
        } finally { spy.mockRestore(); }
    });

test.each(['loadWorkItemDuplicateMarkerSource', 'loadActiveWorkItemIndexSource'])(
    'the unchanged duplicate-marker prerequisite %s is inspected without writer exemptions', functionName => {
        const source = `const { ${functionName} } = require('../services/workItemUniquenessMigrationSource'); const release = ${functionName}(); db.exec(release.sql);`;
        expect(scanSource(source, 'scripts/duplicate-marker-probe.cjs', exceptions)).toEqual([]);
        expect(scanSource(source.replace(`${functionName}()`, `${functionName}(arbitrary)`), 'scripts/duplicate-marker-probe.cjs', exceptions))
            .toEqual([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]);
    });

test.each([
    ['loadWorkItemDuplicateMarkerSource', 'services/workItemUniquenessMigrationSource.js'],
    ['loadActiveWorkItemIndexSource', 'services/workItemUniquenessMigrationSource.js'],
    ['loadWorkItemDuplicateMarkerSource', 'prisma/migrations/20261004190000_add_workitem_duplicate_marker/migration.sql'],
    ['loadActiveWorkItemIndexSource', 'prisma/migrations/20261004190100_unique_active_workitem/migration.sql']
])('an altered prerequisite source is a failing finding: %s / %s', (functionName, target) => {
    const originalRead = fs.readFileSync, changedFile = path.resolve(serverRoot, target);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
        const bytes = originalRead(file, ...args);
        if (typeof file !== 'string' || path.resolve(file) !== changedFile) return bytes;
        return Buffer.isBuffer(bytes) ? Buffer.concat([bytes, Buffer.from('\n')]) : bytes + '\n';
    });
    try {
        const source = `const { ${functionName} } = require('../services/workItemUniquenessMigrationSource'); const release = ${functionName}(); db.exec(release.sql);`;
        expect(scanSource(source, 'scripts/duplicate-marker-probe.cjs', exceptions)).toEqual([
            expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]);
    } finally { spy.mockRestore(); }
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
    "const vm=require('vm');vm.runInNewContext(\"db.exec('REPLACE INTO main.Sample (id,status) VALUES (1,2)')\")",
    "const {spawnSync}=require('child_process');spawnSync('node',['-e',\"db.exec('INSERT OR REPLACE INTO main.WorkItem (id,status) VALUES (1,2)')\"])",
    "const vm=require('vm');vm.runInNewContext(\"db.exec('UPDATE OR ABORT main.Sample SET status = 1')\")",
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
    expect(scanSource("const data={clientName:'Corrected'}; prisma.sample.update({data})", 'controllers/probe.js', exceptions)).toEqual([]);
    expect(scanSource("prisma.result.create({data:{status:'IMPORTED'}})", 'controllers/probe.js', exceptions))
        .toEqual([expect.objectContaining({ code: 'RESULT_CREATE_OUTSIDE_AUTHORITY' })]);
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
