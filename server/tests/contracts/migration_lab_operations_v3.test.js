/**
 * Contract Test: Lab Operations v3 Migration & Reconciliation Rehearsal
 * 
 * Verifies:
 * 1. Safe dry-run with zero mutations
 * 2. Explicit scientific methodology reconciliation (37 standard + 38 synthetic placeholders)
 * 3. Idempotent repeat execution
 * 4. Preservation of existing operational entities (Samples, WorkItems, Results)
 * 5. Fail-closed rollback behaviour on simulated corruption
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { spawnSync } = require('child_process');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { runMigration, METHODOLOGY_RECONCILIATION, UNRESOLVED_SYNTHETIC_PLACEHOLDERS } = require('../../scripts/migrate_lab_operations_v3');

describe('Lab Operations v3 Database Migration & Reconciliation', () => {
    let rehearsal, rehearsalDbPath, client;
    beforeEach(async () => {
        const now = Date.now();
        rehearsal = beforeGuards({ actor: 'system:fixture', samples: [
            { id: 'SMP-PREMATURE-01', originalId: 'ORIG-SMP-PREMATURE-01', status: 'REGISTERED', labId: 'LAB-TUN', createdAt: now, updatedAt: now },
            { id: 'SMP-WRONG-TEX-01', originalId: 'ORIG-SMP-WRONG-TEX-01', status: 'COMPLETED', labId: 'LAB-GTM', createdAt: now, updatedAt: now }
        ] });
        rehearsalDbPath = rehearsal.file;
        client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + rehearsalDbPath }) });
        await createSampleFixture(client, { data: { id: 'MIG-SMP-001', originalId: 'ORIG-MIG-001', status: 'ACCEPTED', preparationStatus: 'DONE', dryingStatus: 'DONE' } });
        await client.user.create({ data: { id: 'usr-mig-mgr', username: 'mig_mgr', password: 'hash', email: 'mgr@example.test', role: 'LAB_MANAGER', name: 'Migration Manager' } });
        const db = new Database(rehearsalDbPath); db.pragma('foreign_keys = ON');
        try {
            for (const item of METHODOLOGY_RECONCILIATION) {
                db.prepare(`
                    INSERT OR IGNORE INTO "Analysis" (code, name, isGlobal, status)
                    VALUES (?, ?, 1, 'active')
                `).run(item.analysisCode, item.analysisCode);

                const dep = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(item.deprecatedMethodId);
                if (dep) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 1 WHERE id = ?').run(item.deprecatedMethodId);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(item.deprecatedMethodId, item.analysisCode, 'Legacy ' + item.deprecatedMethodId);
                }
                const can = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(item.canonicalMethodId);
                if (can) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 0 WHERE id = ?').run(item.canonicalMethodId);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(item.canonicalMethodId, item.analysisCode, 'Canonical ' + item.canonicalMethodId);
                }
            }
            for (let i = 0; i < UNRESOLVED_SYNTHETIC_PLACEHOLDERS.length; i++) {
                const sp = UNRESOLVED_SYNTHETIC_PLACEHOLDERS[i];
                const analysisCode = `SPEC_PARAM_${i + 1}`;
                db.prepare(`
                    INSERT OR IGNORE INTO "Analysis" (code, name, isGlobal, status)
                    VALUES (?, ?, 1, 'active')
                `).run(analysisCode, `Specialized Agronomic Parameter ${i + 1}`);

                const existing = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(sp);
                if (existing) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 1 WHERE id = ?').run(sp);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(sp, analysisCode, 'Synthetic Placeholder ' + sp);
                }
            }
        } finally { db.close(); }
    });
    afterEach(async () => { await client?.$disconnect(); rehearsal?.close(); });
    function evidence() {
        const db = new Database(rehearsalDbPath, { readonly: true });
        try {
            const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
            return { schema, tables: schema.filter(row => row.type === 'table').map(row => ({ name: row.name,
                rows: db.prepare(`SELECT * FROM "${row.name.replace(/"/g, '""')}"`).all().map(value => JSON.stringify(value)).sort() })) };
        } finally { db.close(); }
    }

    test('1. Dry-Run Mode: Performs read-only audit with zero file or row mutations', () => {
        const fileBefore = fs.readFileSync(rehearsalDbPath);
        const dbPre = new Database(rehearsalDbPath);
        const preMethDefaults = dbPre.prepare('SELECT id FROM "Methodology" WHERE isDefault = 1').all().map(r => r.id);
        const preWorkItemCount = dbPre.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get().c;
        dbPre.close();

        const result = runMigration({ dryRun: true, apply: false, dbPath: rehearsalDbPath });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('DRY_RUN');
        expect(result.audit.unresolvedPlaceholders.length).toBe(38);
        expect(result.audit.methodologyChanges.length).toBeGreaterThanOrEqual(30);

        // Verify that database was completely rolled back and unchanged
        const dbPost = new Database(rehearsalDbPath);
        const postMethDefaults = dbPost.prepare('SELECT id FROM "Methodology" WHERE isDefault = 1').all().map(r => r.id);
        const postWorkItemCount = dbPost.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get().c;
        dbPost.close();

        expect(postMethDefaults).toEqual(preMethDefaults);
        expect(postWorkItemCount).toBe(preWorkItemCount);
        expect(fs.readFileSync(rehearsalDbPath)).toEqual(fileBefore);
    });

    test('2. Apply Mode: Atomically applies DDL and methodology reconciliation', () => {
        const result = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('APPLY');
        expect(result.audit.a94Candidates).toEqual([]);

        const db = new Database(rehearsalDbPath);

        // Verify canonical methodologies are now default and deprecated ones are not
        for (const item of METHODOLOGY_RECONCILIATION) {
            const dep = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(item.deprecatedMethodId);
            if (dep) {
                expect(dep.isDefault === 0 || dep.isDefault === false).toBe(true);
            }

            const can = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(item.canonicalMethodId);
            if (can) {
                expect(can.isDefault === 1 || can.isDefault === true).toBe(true);
            }
        }

        // Verify synthetic placeholders have isDefault = 0
        for (const sp of UNRESOLVED_SYNTHETIC_PLACEHOLDERS) {
            const p = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(sp);
            if (p) {
                expect(p.isDefault === 0 || p.isDefault === false).toBe(true);
            }
        }

        // Verify Analysis status is active
        const nullCount = db.prepare('SELECT COUNT(*) as c FROM "Analysis" WHERE status IS NULL OR status = \'\'').get().c;
        expect(nullCount).toBe(0);

        // Verify all required tables exist
        const requiredTables = [
            'SampleOrderRevision', 'OrderLine', 'WorkAttempt',
            'ReviewDecision', 'SampleAmendment', 'CommandReceipt',
            'WorkItemDraft', 'Unit', 'MethodReference', 'BatchQcResult'
        ];
        for (const tbl of requiredTables) {
            const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tbl);
            expect(exists).toBeDefined();
        }

        db.close();
    });

    test('3. Idempotency: Re-running migration produces zero side effects or duplicated data', () => {
        // First run
        runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        // Second run
        const secondRun = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(secondRun.success).toBe(true);
        expect(secondRun.audit.methodologyChanges.length).toBe(0);
        expect(secondRun.audit.syntheticPlaceholdersDeprecations.length).toBe(0);
        expect(secondRun.audit.analysisStatusUpdates).toBe(0);
    });

    test.each([true,false])('already-applied startup preserves bytes, marker and rows with A94 candidates=%s', async hasCandidates => {
        // #179 pin 5991763890: marked deployments never reapply the old
        // migration, and still expose candidates to the later order workflow.
        if (hasCandidates) {
            await client.sample.update({where:{id:'MIG-SMP-001'},data:{requiredAnalyses:'["TEXTURE"]'}});
            await createWorkItemFixture(client,{data:{id:'WI_MARKED_SAND',sampleId:'MIG-SMP-001',
                analysis:'SAND',status:'NOT_ASSIGNED'}});
        }
        const db=new Database(rehearsalDbPath);
        let marker;
        try {
            db.exec('CREATE TABLE IF NOT EXISTS _schema_migrations(id TEXT PRIMARY KEY,appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP,details TEXT)');
            db.prepare('INSERT INTO _schema_migrations(id,appliedAt,details) VALUES (?,?,?)')
                .run('v3_lab_operations_20260906','2026-09-06 14:15:52','Existing deployment marker: preserve exactly');
            marker=db.prepare('SELECT * FROM _schema_migrations WHERE id=?').get('v3_lab_operations_20260906');
            expect(db.pragma('wal_checkpoint(FULL)')[0].busy).toBe(0);
        } finally {db.close();}
        const before=evidence();
        const fingerprint=()=>createHash('sha256').update(fs.readFileSync(rehearsalDbPath)).digest('hex');
        const fileBefore=fingerprint(), changes=[];
        const originalClose=Database.prototype.close;
        const capture=jest.spyOn(Database.prototype,'close').mockImplementation(function () {
            // Observe SQLite's actual counter on the migration connection,
            // before it closes. A newly opened observer would always report 0.
            changes.push(this.prepare('SELECT total_changes() AS n').get().n);
            return originalClose.call(this);
        });
        let result;
        try {result=runMigration({dryRun:false,apply:true,dbPath:rehearsalDbPath});}
        finally {capture.mockRestore();}
        expect(changes).toEqual([0]);
        expect(result).toMatchObject({success:true,mode:'APPLY',alreadyApplied:true,
            audit:{a94Consolidated:{samples:0,tasks:0}}});
        expect(result.audit.a94Candidates).toHaveLength(hasCandidates ? 1 : 0);
        expect(evidence()).toEqual(before);
        expect(fingerprint()).toBe(fileBefore);
        const reader=new Database(rehearsalDbPath,{readonly:true});
        try {expect(reader.prepare('SELECT * FROM _schema_migrations WHERE id=?').get('v3_lab_operations_20260906')).toEqual(marker);}
        finally {reader.close();}
        const cli=spawnSync(process.execPath,[path.resolve(__dirname,'../../scripts/migrate_lab_operations_v3.js'),'--apply',
            '--db',rehearsalDbPath],{encoding:'utf8'});
        expect(cli.error).toBeUndefined(); expect(cli.status).toBe(0);
        if (hasCandidates) {
            expect(cli.stderr).toContain('A94_MANUAL_REVIEW_PENDING: 1 candidate sample(s) tracked on #162 for #182/#183');
            expect(cli.stderr.split(/\r?\n/).filter(line=>line.startsWith('A94_MANUAL_REVIEW_PENDING:'))).toHaveLength(1);
            expect(JSON.parse(cli.stderr.split(/\r?\n/).find(line=>line.startsWith('[{')))).toEqual(result.audit.a94Candidates);
        } else expect(cli.stderr).not.toContain('A94_MANUAL_REVIEW_PENDING');
        expect(evidence()).toEqual(before); expect(fingerprint()).toBe(fileBefore);
    });

    test('4. Preservation Invariant: Existing assigned work items and sample records are preserved', async () => {
        const db = new Database(rehearsalDbPath);
        // Create an assigned work item with explicit methodology
        const sample = db.prepare("SELECT id FROM Sample WHERE id='MIG-SMP-001'").get();
        const user = db.prepare('SELECT username FROM "User" LIMIT 1').get();
        const meth = db.prepare('SELECT id FROM "Methodology" WHERE analysisCode = \'PH_H2O\' LIMIT 1').get();
        expect(sample).toBeDefined(); expect(meth).toBeDefined(); expect(user).toBeDefined();
        await createWorkItemFixture(client, { data: { id: 'TEST_WORK_ITEM_PRESERVED', sampleId: sample.id,
            analysis: 'PH_H2O', status: 'IN_PROGRESS', methodologyId: meth.id, assignedTo: user.username } });
        db.close();

        // Run migration
        runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        // Verify that custom methodology on assigned work item was NOT overwritten
        const dbCheck = new Database(rehearsalDbPath);
        const item = dbCheck.prepare('SELECT methodologyId, status FROM "WorkItem" WHERE id = ?').get('TEST_WORK_ITEM_PRESERVED');
        expect(item).toBeDefined();
        expect(item.methodologyId).toBe(meth.id);
        expect(item.status).toBe('IN_PROGRESS');
        dbCheck.close();
    });

    test('5. Rejects false chemical mappings and preserves intentional lab defaults (Finding 2)', () => {
        const { UNRESOLVED_METHODOLOGY_MAPPINGS } = require('../../scripts/migrate_lab_operations_v3');
        expect(UNRESOLVED_METHODOLOGY_MAPPINGS.length).toBe(5);

        // Verify none of the 5 false mappings exist in METHODOLOGY_RECONCILIATION
        const falseCodes = ['pH', 'electricalConductivity', 'carbonOrganic', 'nitrogenTotal', 'cationExchangeCapacitySoil'];
        for (const item of METHODOLOGY_RECONCILIATION) {
            expect(falseCodes.includes(item.analysisCode)).toBe(false);
            expect(['pHNaF_ratio1-5', 'EC_ratio1-10', 'OrgC_dc-lt-loi', 'TotalN_h2so4', 'CEC_ph0-cohex'].includes(item.canonicalMethodId)).toBe(false);
        }

        // Inject an intentional LabMethodDefault before migration
        const db = new Database(rehearsalDbPath);
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS "LabMethodDefault" (
                    "id" TEXT PRIMARY KEY NOT NULL,
                    "labId" TEXT NOT NULL,
                    "analysisCode" TEXT NOT NULL,
                    "methodologyId" TEXT NOT NULL,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);
            db.prepare(`
                INSERT INTO "LabMethodDefault" (id, labId, analysisCode, methodologyId, createdAt, updatedAt)
                VALUES ('LMD_TEST_PH', 'LAB-TUN', 'pH', 'CUSTOM_PH_METHOD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run();
        } finally {
            db.close();
        }

        // Run migration
        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.unresolvedMethodologies.length).toBe(5);

        // Verify LabMethodDefault was preserved
        const dbCheck = new Database(rehearsalDbPath);
        const savedDefault = dbCheck.prepare('SELECT methodologyId FROM "LabMethodDefault" WHERE id = ?').get('LMD_TEST_PH');
        expect(savedDefault).toBeDefined();
        expect(savedDefault.methodologyId).toBe('CUSTOM_PH_METHOD');
        dbCheck.close();
    });

    test('6. A94: Dry-run lists grouped fractions; apply refuses the whole migration with zero writes and no marker', async () => {
        await client.sample.update({ where: { id: 'MIG-SMP-001' }, data: { requiredAnalyses: '["TEXTURE"]' } });
        for (const analysis of ['SAND', 'SILT', 'CLAY']) await createWorkItemFixture(client, { data: {
            id: `WI_UNSTARTED_${analysis}`, sampleId: 'MIG-SMP-001', analysis, status: 'NOT_ASSIGNED' } });
        const before = fs.readFileSync(rehearsalDbPath), allEvidence = evidence(), rows = await client.workItem.findMany({ orderBy: { id: 'asc' } });
        const audits = await client.auditLog.findMany({ orderBy: { id: 'asc' } });
        const res = runMigration({ dryRun: true, apply: false, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a94Candidates).toEqual([expect.objectContaining({ sampleId: 'MIG-SMP-001',
            reasons: ['COMPLETE_LEGACY_FRACTION_SET', 'DECLARED_REQUIRED_ANALYSES'],
            tasks: expect.arrayContaining(['SAND', 'SILT', 'CLAY'].map(analysis => expect.objectContaining({
                id: `WI_UNSTARTED_${analysis}`, analysis, status: 'NOT_ASSIGNED', assignedTo: null }))) })]);
        expect(res.audit.a94Consolidated).toEqual({ samples: 0, tasks: 0 });
        expect(() => runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath }))
            .toThrow(expect.objectContaining({ code: 'A94_REQUIRES_ORDER_WORKFLOW', candidates: res.audit.a94Candidates }));
        expect(fs.readFileSync(rehearsalDbPath)).toEqual(before);
        expect(evidence()).toEqual(allEvidence);
        expect(await client.workItem.findMany({ orderBy: { id: 'asc' } })).toEqual(rows);
        expect(await client.auditLog.findMany({ orderBy: { id: 'asc' } })).toEqual(audits);
        const db = new Database(rehearsalDbPath, { readonly: true });
        try {
            // Cold CI schemas have no marker table; an existing table on a
            // marked development template must still contain no new v3 marker.
            // The complete schema/row/file assertions above cover both shapes.
            const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_migrations'").get();
            const marker = table ? db.prepare("SELECT id FROM _schema_migrations WHERE id='v3_lab_operations_20260906'").get() : undefined;
            expect(marker).toBeUndefined();
        }
        finally { db.close(); }
    });

    test('real CLI default is read-only and --apply prints its stable A94 refusal before any source write', async () => {
        await client.sample.update({ where: { id: 'MIG-SMP-001' }, data: { requiredAnalyses: '["TEXTURE"]' } });
        await createWorkItemFixture(client, { data: { id: 'WI_CLI_SAND', sampleId: 'MIG-SMP-001', analysis: 'SAND', status: 'NOT_ASSIGNED' } });
        const before = evidence(), bytes = fs.readFileSync(rehearsalDbPath);
        const script = path.resolve(__dirname, '../../scripts/migrate_lab_operations_v3.js');
        const dry = spawnSync(process.execPath, [script, '--db', rehearsalDbPath], { encoding: 'utf8' });
        expect(dry.status).toBe(0); expect(dry.stdout).toContain('DECLARED_REQUIRED_ANALYSES');
        expect(evidence()).toEqual(before); expect(fs.readFileSync(rehearsalDbPath)).toEqual(bytes);
        const apply = spawnSync(process.execPath, [script, '--apply', '--db', rehearsalDbPath], { encoding: 'utf8' });
        expect(apply.status).toBe(1);
        const refusal = JSON.parse(apply.stderr.split(/\r?\n/).find(line => line.startsWith('{"code":')));
        expect(refusal).toMatchObject({ code: 'A94_REQUIRES_ORDER_WORKFLOW', candidates: [{ sampleId: 'MIG-SMP-001',
            reasons: ['DECLARED_REQUIRED_ANALYSES'], tasks: [{ id: 'WI_CLI_SAND', status: 'NOT_ASSIGNED', assignedTo: null }] }] });
        expect(evidence()).toEqual(before); expect(fs.readFileSync(rehearsalDbPath)).toEqual(bytes);
    });

    test('A94 reports explicit grouped-order evidence without creating or superseding work', async () => {
        const revision = await client.sampleOrderRevision.create({ data: { sampleId: 'MIG-SMP-001', version: 1, requestedBy: 'mig_mgr' } });
        await client.orderLine.create({ data: { revisionId: revision.id, analysis: 'TEXTURE' } });
        await createWorkItemFixture(client, { data: { id: 'WI_ORDER_CLAY', sampleId: 'MIG-SMP-001', analysis: 'CLAY', status: 'ASSIGNED', assignedTo: 'mig_mgr' } });
        const before = evidence(), dry = runMigration({ dryRun: true, apply: false, dbPath: rehearsalDbPath });
        expect(dry.audit.a94Candidates).toMatchObject([{ sampleId: 'MIG-SMP-001', reasons: ['EXPLICIT_GROUPED_ORDER'],
            tasks: [{ id: 'WI_ORDER_CLAY', status: 'ASSIGNED', assignedTo: 'mig_mgr' }] }]);
        expect(() => runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath })).toThrow(expect.objectContaining({ code: 'A94_REQUIRES_ORDER_WORKFLOW' }));
        expect(evidence()).toEqual(before);
    });

    test('a candidate appearing after preflight is refused under the transaction lock before any migration write', async () => {
        await createWorkItemFixture(client, { data: { id: 'WI_RACE_CLAY', sampleId: 'MIG-SMP-001', analysis: 'CLAY', status: 'NOT_ASSIGNED' } });
        const originalTransaction = Database.prototype.transaction;
        let afterExternalEdit;
        const intercept = jest.spyOn(Database.prototype, 'transaction').mockImplementationOnce(function (callback) {
            const concurrent = new Database(rehearsalDbPath); concurrent.pragma('foreign_keys = ON');
            try { concurrent.prepare('UPDATE Sample SET requiredAnalyses = ? WHERE id = ?').run('["TEXTURE"]', 'MIG-SMP-001'); }
            finally { concurrent.close(); }
            afterExternalEdit = evidence();
            return originalTransaction.call(this, callback);
        });
        try {
            expect(() => runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath }))
                .toThrow(expect.objectContaining({ code: 'A94_REQUIRES_ORDER_WORKFLOW', candidates: [expect.objectContaining({
                    sampleId: 'MIG-SMP-001', reasons: ['DECLARED_REQUIRED_ANALYSES'] })] }));
            expect(afterExternalEdit).toBeDefined();
            expect(evidence()).toEqual(afterExternalEdit);
        } finally { intercept.mockRestore(); }
    });

    test('7. A95: Reconciles legacy fraction results with explicit WorkAttempt linkage', async () => {
        const db = new Database(rehearsalDbPath);
        let sId;
        try {
            const sample = db.prepare("SELECT id FROM Sample WHERE id='MIG-SMP-001'").get();
            sId = sample.id;

            // Create legacy results for SAND, SILT, CLAY
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_SAND', ?, 'SAND', '45.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_SILT', ?, 'SILT', '35.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_CLAY', ?, 'CLAY', '20.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);

            // Ensure a TEXTURE work item exists
            await createWorkItemFixture(client, { data: { id: 'WI_LEG_TEXTURE', sampleId: sId, analysis: 'TEXTURE', status: 'COMPLETED' } });
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a95ReconciledAttempts).toBeGreaterThanOrEqual(1);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const attempt = dbCheck.prepare('SELECT * FROM "WorkAttempt" WHERE workItemId = \'WI_LEG_TEXTURE\'').get();
            expect(attempt).toBeDefined();
            expect(attempt.executedMethodRevision).toBe('LEGACY_FRACTIONS');
            const evidence = JSON.parse(attempt.evidenceData);
            expect(evidence.fractions.sand).toBe(45.0);
            expect(evidence.fractions.silt).toBe(35.0);
            expect(evidence.fractions.clay).toBe(20.0);
        } finally {
            dbCheck.close();
        }
    });

    test('8. A96: Flags premature drafts with [WARNING: PREPARATION_PENDING] in durable notes without corrupting checks array', async () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-PREMATURE-01';
        try {
            await createWorkItemFixture(client, { data: { id: 'WI_PREM_01', sampleId, analysis: 'PH_H2O', status: 'ASSIGNED' } });
            db.prepare(`INSERT INTO "WorkItemDraft" (id, workItemId, sampleId, userId, analysis, value, checks, updatedAt) VALUES ('DRAFT_PREM_01', 'WI_PREM_01', ?, 'tech_tun', 'PH_H2O', '6.5', '[true,false]', CURRENT_TIMESTAMP)`).run(sampleId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a96FlaggedDrafts).toBeGreaterThanOrEqual(1);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const draft = dbCheck.prepare('SELECT checks, notes FROM "WorkItemDraft" WHERE id = \'DRAFT_PREM_01\'').get();
            expect(draft).toBeDefined();
            // Verify checks boolean array was preserved intact
            expect(draft.checks).toBe('[true,false]');
            // Verify durable warning was recorded in notes
            expect(draft.notes).toContain('[WARNING: PREPARATION_PENDING]');

            // Verify that sample preparation record was NOT fabricated
            const smp = dbCheck.prepare('SELECT status, preparationStatus FROM "Sample" WHERE id = ?').get(sampleId);
            expect(smp.status).toBe('REGISTERED');
            expect(smp.preparationStatus).toBeNull();
        } finally {
            dbCheck.close();
        }
    });

    test('9. A97: Identifies historical texture classification discrepancies and creates SampleAmendment review entry', () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-WRONG-TEX-01';
        try {
            // 50 sand / 35 silt / 15 clay is officially Loam (L), but legacy algorithm called it Sandy Loam (SL)
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, provenance, updatedAt) VALUES ('RES_WRONG_TEX', ?, 'TEXTURE', 'Sandy Loam', ?, CURRENT_TIMESTAMP)`)
                .run(sampleId, JSON.stringify({ fractions: { sand: 50, silt: 35, clay: 15 } }));
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a97ImpactAssessment.misclassifiedCount).toBeGreaterThanOrEqual(1);
        const mis = res.audit.a97ImpactAssessment.misclassifiedRecords.find(r => r.sampleId === sampleId);
        expect(mis).toBeDefined();
        expect(mis.recordedClass).toBe('Sandy Loam');
        expect(mis.authoritativeClass).toBe('Loam');

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const amend = dbCheck.prepare('SELECT * FROM "SampleAmendment" WHERE sampleId = ? AND type = \'TEXTURE_IMPACT_AUDIT\'').get(sampleId);
            expect(amend).toBeDefined();
            expect(amend.status).toBe('PENDING');
        } finally {
            dbCheck.close();
        }
    });

    test('10. Review Defect 4: Preserves standalone assigned fraction tasks without confirmed grouped order', async () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-STANDALONE-SAND';
        try {
            db.prepare(`INSERT OR IGNORE INTO "User" (id, username, password, email, role, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).run('tech_specialist', 'tech_specialist', 'pw', 'tech@example.com', 'LAB_TECHNICIAN');
            await createSampleFixture(client, { data: { id: sampleId, originalId: sampleId, status: 'RECEIVED', assignedLab: 'GTM-LAB1' } });
            await createWorkItemFixture(client, { data: { id: 'WI_STANDALONE_SAND', sampleId, analysis: 'SAND', status: 'ASSIGNED', assignedTo: 'tech_specialist' } });
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.unresolvedStandaloneFractions.some(f => f.sampleId === sampleId)).toBe(true);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const wi = dbCheck.prepare('SELECT analysis, status, assignedTo FROM "WorkItem" WHERE sampleId = ?').all(sampleId);
            // Must remain SAND, ASSIGNED, tech_specialist; must NOT be superseded or replaced by unassigned TEXTURE
            expect(wi.length).toBe(1);
            expect(wi[0].analysis).toBe('SAND');
            expect(wi[0].status).toBe('ASSIGNED');
            expect(wi[0].assignedTo).toBe('tech_specialist');
        } finally {
            dbCheck.close();
        }
    });

    test('11. Review Defect 3: Refuses to fabricate WorkAttempt when fractions have mixed replicate numbers or moisture bases', async () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-MIXED-REP-BASIS';
        try {
            await createSampleFixture(client, { data: { id: sampleId, originalId: sampleId, status: 'RECEIVED', assignedLab: 'GTM-LAB1' } });
            await createWorkItemFixture(client, { data: { id: 'WI_MIXED_TEX', sampleId, analysis: 'TEXTURE', status: 'COMPLETED' } });
            // Incompatible fractions: rep 1 AIR_DRY, rep 2 OVEN_DRY, rep 3 FIELD_MOIST
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_SAND', ?, 'SAND', '50.0', 1, 'AIR_DRY', CURRENT_TIMESTAMP)`).run(sampleId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_SILT', ?, 'SILT', '35.0', 2, 'OVEN_DRY', CURRENT_TIMESTAMP)`).run(sampleId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_CLAY', ?, 'CLAY', '15.0', 3, 'FIELD_MOIST', CURRENT_TIMESTAMP)`).run(sampleId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const attempts = dbCheck.prepare('SELECT * FROM "WorkAttempt" WHERE workItemId = \'WI_MIXED_TEX\'').all();
            // Must NOT invent a WorkAttempt from incompatible fractions
            expect(attempts.length).toBe(0);
        } finally {
            dbCheck.close();
        }
    });
});
