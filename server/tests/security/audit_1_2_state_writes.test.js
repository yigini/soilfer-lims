const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { scanSource, scanFiles } = require('../helpers/workflowWriteScanner');

// Exactly the file/export pairs pinned by the author in #179 comment 5986548250.
const exceptions = [
    { file: 'tests/helpers/legacyWorkflowDatabase.js', exportName: 'beforeGuards' },
    { file: 'tests/helpers/rejectedGuardWrite.js', exportName: 'rejectedGuardWrite' }
];
const serverRoot = path.resolve(__dirname, '../..');

test('all handwritten runtime, script, seed and test Sample/WorkItem writes use central authorities', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'server'],
        { cwd: path.resolve(serverRoot, '..'), encoding: 'utf8' }).split(/\r?\n/).filter(file => /\.(?:js|cjs|mjs|py|sql)$/.test(file))
        .map(file => file.slice('server/'.length));
    expect(files).toEqual(expect.arrayContaining(['controllers/sampleController.js', 'services/sampleStateService.js',
        'services/workItemStateService.js', 'tests/contracts/audit_1_2_state_authority.test.js', 'seed.js']));
    const violations = scanFiles(serverRoot, [...new Set(files)], exceptions);
    expect(violations).toEqual([]);
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
